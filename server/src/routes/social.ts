import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/index.js";
import { requireUser } from "./auth.js";

export const socialRouter = Router();

// ---- Accountability pairing -------------------------------------------------
// Each user sees only the other's weekly %, never task details.

type Block = { id: string };

type StateForScore = { log?: Record<string, Record<string, number>>; routine?: Record<string, Block[]> };

async function weeklyPct(userId: string): Promise<number | null> {
  const { rows } = await pool.query<{ state: StateForScore }>(
    `SELECT state FROM user_state WHERE user_id = $1`,
    [userId],
  );
  const state = rows[0]?.state;
  if (!state?.routine) return null;
  const log = state.log ?? {};
  let sum = 0;
  let n = 0;
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const blocks = state.routine[String(d.getDay())] ?? [];
    if (!blocks.length) continue;
    const entries = log[key] ?? {};
    sum += blocks.reduce((acc, b) => acc + (entries[b.id] ?? 0), 0) / blocks.length;
    n++;
  }
  return n ? Math.round(sum / n) : null;
}

socialRouter.get("/pairs", requireUser, async (req: any, res) => {
  const { rows } = await pool.query<{ peer_id: string; peer_name: string; peer_email: string }>(
    `SELECT
        CASE WHEN user_a = $1 THEN user_b ELSE user_a END AS peer_id,
        u.name AS peer_name,
        u.email AS peer_email
       FROM pairings p
       JOIN users u ON u.id = CASE WHEN user_a = $1 THEN user_b ELSE user_a END
      WHERE user_a = $1 OR user_b = $1`,
    [req.user.id],
  );
  const peers = [];
  for (const r of rows) {
    peers.push({ id: r.peer_id, name: r.peer_name, email: r.peer_email, weekly: await weeklyPct(r.peer_id) });
  }
  res.json({ peers });
});

socialRouter.post("/pairs", requireUser, async (req: any, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid email" });
  const email = parsed.data.email.toLowerCase();
  if (email === req.user.email.toLowerCase()) return res.status(400).json({ error: "You can't pair with yourself" });

  const { rows } = await pool.query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email]);
  if (!rows[0]) return res.status(404).json({ error: "No account with that email — invite them to Ordo first" });

  const a = req.user.id < rows[0].id ? req.user.id : rows[0].id;
  const b = req.user.id < rows[0].id ? rows[0].id : req.user.id;
  await pool.query(
    `INSERT INTO pairings (user_a, user_b) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [a, b],
  );
  res.json({ ok: true });
});

socialRouter.delete("/pairs/:peerId", requireUser, async (req: any, res) => {
  await pool.query(
    `DELETE FROM pairings WHERE (user_a = $1 AND user_b = $2) OR (user_a = $2 AND user_b = $1)`,
    [req.user.id, req.params.peerId],
  );
  res.json({ ok: true });
});

// ---- Opt-in challenges ------------------------------------------------------

function challengeScore(state: unknown): number {
  const s = state as StateForScore | null;
  if (!s?.routine) return 0;
  const log = s.log ?? {};
  let sum = 0;
  let n = 0;
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const blocks = s.routine[String(d.getDay())] ?? [];
    if (!blocks.length) continue;
    const entries = log[key] ?? {};
    sum += blocks.reduce((acc, b) => acc + (entries[b.id] ?? 0), 0) / blocks.length;
    n++;
  }
  return n ? Math.round(sum / n) : 0;
}

socialRouter.get("/challenges", requireUser, async (req: any, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.starts_on, c.ends_on, c.owner_id,
            (SELECT count(*) FROM challenge_members m WHERE m.challenge_id = c.id)::int AS members,
            EXISTS(SELECT 1 FROM challenge_members me WHERE me.challenge_id = c.id AND me.user_id = $1) AS joined
       FROM challenges c
      ORDER BY c.created_at DESC
      LIMIT 50`,
    [req.user.id],
  );
  res.json({ challenges: rows });
});

socialRouter.post("/challenges", requireUser, async (req: any, res) => {
  const parsed = z.object({ name: z.string().min(1).max(80), days: z.number().int().min(7).max(90) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid challenge" });
  const { rows } = await pool.query(
    `INSERT INTO challenges (owner_id, name, starts_on, ends_on)
     VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + $3)
     RETURNING id, name, starts_on, ends_on`,
    [req.user.id, parsed.data.name, parsed.data.days],
  );
  const c = rows[0];
  await pool.query(`INSERT INTO challenge_members (challenge_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [c.id, req.user.id]);
  res.json({ challenge: c });
});

socialRouter.post("/challenges/:id/join", requireUser, async (req: any, res) => {
  const { rows } = await pool.query(`SELECT id FROM challenges WHERE id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Challenge not found" });
  await pool.query(`INSERT INTO challenge_members (challenge_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [req.params.id, req.user.id]);
  res.json({ ok: true });
});

socialRouter.get("/challenges/:id/leaderboard", requireUser, async (req: any, res) => {
  const { rows } = await pool.query<{ user_id: string; name: string }>(
    `SELECT m.user_id, u.name
       FROM challenge_members m
       JOIN users u ON u.id = m.user_id
      WHERE m.challenge_id = $1`,
    [req.params.id],
  );
  const board = [];
  for (const r of rows) {
    const { rows: stateRows } = await pool.query(`SELECT state FROM user_state WHERE user_id = $1`, [r.user_id]);
    board.push({ user_id: r.user_id, name: r.name, score: challengeScore(stateRows[0]?.state) });
  }
  board.sort((a, b) => b.score - a.score);
  const rank = board.findIndex((b) => b.user_id === req.user.id) + 1;
  res.json({ leaderboard: board, myRank: rank || null });
});

// ---- Future-self letter -----------------------------------------------------

socialRouter.get("/letters", requireUser, async (req: any, res) => {
  const { rows } = await pool.query(
    `SELECT id, goal_title, body, deadline, delivered, created_at
       FROM future_letters WHERE user_id = $1 ORDER BY deadline ASC`,
    [req.user.id],
  );
  res.json({ letters: rows });
});

socialRouter.post("/letters", requireUser, async (req: any, res) => {
  const parsed = z.object({ goal_title: z.string().min(1).max(120), body: z.string().min(1).max(2000), deadline: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid letter" });
  const { rows } = await pool.query(
    `INSERT INTO future_letters (user_id, goal_title, body, deadline)
     VALUES ($1, $2, $3, $4::date)
     RETURNING id, goal_title, body, deadline, delivered, created_at`,
    [req.user.id, parsed.data.goal_title, parsed.data.body, parsed.data.deadline],
  );
  res.json({ letter: rows[0] });
});

socialRouter.delete("/letters/:id", requireUser, async (req: any, res) => {
  await pool.query(`DELETE FROM future_letters WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
  res.json({ ok: true });
});

// ---- Onboarding -------------------------------------------------------------

socialRouter.get("/onboarding", requireUser, async (req: any, res) => {
  const { rows } = await pool.query(`SELECT * FROM onboarding WHERE user_id = $1`, [req.user.id]);
  res.json({ onboarding: rows[0] ?? null });
});

socialRouter.post("/onboarding", requireUser, async (req: any, res) => {
  const parsed = z.object({
    goal_set: z.boolean().optional(),
    routine_set: z.boolean().optional(),
    telegram_linked: z.boolean().optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid onboarding" });
  const { goal_set, routine_set, telegram_linked } = parsed.data;
  await pool.query(
    `INSERT INTO onboarding (user_id, goal_set, routine_set, telegram_linked, completed_at)
     VALUES ($1, COALESCE($2, false), COALESCE($3, false), COALESCE($4, false), NULL)
     ON CONFLICT (user_id) DO UPDATE SET
       goal_set = COALESCE(EXCLUDED.goal_set, onboarding.goal_set),
       routine_set = COALESCE(EXCLUDED.routine_set, onboarding.routine_set),
       telegram_linked = COALESCE(EXCLUDED.telegram_linked, onboarding.telegram_linked),
       completed_at = CASE
         WHEN (COALESCE(EXCLUDED.goal_set, onboarding.goal_set) AND COALESCE(EXCLUDED.routine_set, onboarding.routine_set) AND COALESCE(EXCLUDED.telegram_linked, onboarding.telegram_linked)) THEN now()
         ELSE NULL END`,
    [req.user.id, goal_set ?? null, routine_set ?? null, telegram_linked ?? null],
  );
  const { rows } = await pool.query(`SELECT * FROM onboarding WHERE user_id = $1`, [req.user.id]);
  res.json({ onboarding: rows[0] });
});

// ---- Version history / undo + account deletion ------------------------------

socialRouter.get("/history", requireUser, async (req: any, res) => {
  const { rows } = await pool.query<{ history: unknown }>(`SELECT history FROM user_state WHERE user_id = $1`, [req.user.id]);
  res.json({ history: rows[0]?.history ?? [] });
});

socialRouter.delete("/account", requireUser, async (req: any, res) => {
  // Cascades wipe state, sessions, links, letters, memberships, pairings.
  await pool.query(`DELETE FROM users WHERE id = $1`, [req.user.id]);
  res.json({ ok: true });
});
