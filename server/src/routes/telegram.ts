import { Router } from "express";
import { randomBytes } from "node:crypto";
import { pool } from "../db/index.js";
import { config } from "../config.js";
import { requireUser } from "./auth.js";
import { authStatus } from "./auth.js";

export const telegramRouter = Router();

telegramRouter.get("/status", requireUser, async (req: any, res) => {
  const { rows } = await pool.query<{ chat_id: string; username: string }>(
    `SELECT chat_id, username FROM telegram_links WHERE user_id = $1`,
    [req.user.id],
  );
  res.json({
    configured: authStatus().telegram,
    botUsername: config.telegramBotUsername,
    linked: rows[0] ? { chatId: String(rows[0].chat_id), username: rows[0].username } : null,
  });
});

telegramRouter.post("/link", requireUser, async (req: any, res) => {
  if (!authStatus().telegram) return res.status(501).json({ error: "Telegram bot is not configured" });

  const code = randomBytes(4).toString("hex").toUpperCase(); // 8 chars, e.g. "A1B2C3D4"
  await pool.query(
    `INSERT INTO telegram_codes (code, user_id, expires_at)
     VALUES ($1, $2, now() + interval '15 minutes')
     ON CONFLICT (code) DO UPDATE SET user_id = EXCLUDED.user_id, expires_at = EXCLUDED.expires_at`,
    [code, req.user.id],
  );
  res.json({ code, botUsername: config.telegramBotUsername });
});

telegramRouter.post("/unlink", requireUser, async (req: any, res) => {
  await pool.query(`DELETE FROM telegram_links WHERE user_id = $1`, [req.user.id]);
  res.json({ ok: true });
});
