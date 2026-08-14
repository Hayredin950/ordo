import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/index.js";
import { requireUser } from "./auth.js";

export const stateRouter = Router();

stateRouter.get("/", requireUser, async (req: any, res) => {
  const { rows } = await pool.query(
    `SELECT state FROM user_state WHERE user_id = $1`,
    [req.user.id],
  );
  res.json({ state: rows[0]?.state ?? null });
});

stateRouter.put("/", requireUser, async (req: any, res) => {
  const parsed = z.object({ state: z.record(z.unknown()) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid state payload" });

  // Version history (undo): keep the previous snapshot, capped at 30.
  await pool.query(
    `INSERT INTO user_state (user_id, state, updated_at, history)
     VALUES ($1, $2, now(), '[]'::jsonb)
     ON CONFLICT (user_id) DO UPDATE SET
       state = EXCLUDED.state,
       updated_at = now(),
       history = CASE
         WHEN user_state.state = EXCLUDED.state THEN user_state.history
         ELSE (user_state.history || jsonb_build_array(user_state.state)) - 0
       END`,
    [req.user.id, JSON.stringify(parsed.data.state)],
  );
  res.json({ ok: true });
});

stateRouter.delete("/", requireUser, async (req: any, res) => {
  await pool.query(`DELETE FROM user_state WHERE user_id = $1`, [req.user.id]);
  res.json({ ok: true });
});

// Undo: restore the most recent snapshot.
stateRouter.post("/undo", requireUser, async (req: any, res) => {
  const { rows } = await pool.query<{ history: unknown[]; state: unknown }>(
    `SELECT history, state FROM user_state WHERE user_id = $1`,
    [req.user.id],
  );
  const history = rows[0]?.history as unknown[] | undefined;
  if (!history?.length) return res.status(404).json({ error: "Nothing to undo" });

  const previous = history[history.length - 1];
  const remaining = history.slice(0, -1);
  await pool.query(
    `UPDATE user_state SET state = $2::jsonb, history = $3::jsonb, updated_at = now() WHERE user_id = $1`,
    [req.user.id, JSON.stringify(previous), JSON.stringify(remaining)],
  );
  res.json({ state: previous });
});
