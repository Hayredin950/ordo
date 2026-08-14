import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/index.js";
import { requireUser } from "./auth.js";
import { authStatus } from "./auth.js";

export const slackRouter = Router();

slackRouter.get("/status", requireUser, async (req: any, res) => {
  const { rows } = await pool.query<{ channel: string }>(
    `SELECT channel FROM slack_links WHERE user_id = $1`,
    [req.user.id],
  );
  res.json({
    configured: authStatus().slack,
    linked: rows[0] ? { channel: rows[0].channel } : null,
  });
});

slackRouter.post("/link", requireUser, async (req: any, res) => {
  if (!authStatus().slack) return res.status(501).json({ error: "Slack bot is not configured" });
  const parsed = z.object({ channel: z.string().min(1).max(100) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid channel" });

  let channel = parsed.data.channel.trim();
  if (!channel.startsWith("#") && !channel.startsWith("@")) channel = `#${channel}`;

  await pool.query(
    `INSERT INTO slack_links (user_id, channel, linked_at)
     VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE SET channel = EXCLUDED.channel, linked_at = now()`,
    [req.user.id, channel],
  );
  res.json({ ok: true, channel });
});

slackRouter.post("/unlink", requireUser, async (req: any, res) => {
  await pool.query(`DELETE FROM slack_links WHERE user_id = $1`, [req.user.id]);
  res.json({ ok: true });
});
