import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import { initDb, pool } from "./db/index.js";
import { authRouter, authStatus, requireUser } from "./routes/auth.js";
import { stateRouter } from "./routes/state.js";
import { telegramRouter } from "./routes/telegram.js";
import { slackRouter } from "./routes/slack.js";
import { exportRouter } from "./routes/export.js";
import { templatesRouter } from "./routes/templates.js";
import { socialRouter } from "./routes/social.js";
import { startBot, stopBot } from "./bot/telegram.js";
import { startScheduler } from "./scheduler/index.js";
import { generateWeeklyReport, proposeCatchUp } from "./ai/coach.js";

const app = express();

app.use(cors({ origin: config.appUrl, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

// Health + capability probe so the frontend can show what's live.
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, status: authStatus() });
});

app.use("/api/auth", authRouter);
app.use("/api/state", stateRouter);
app.use("/api/telegram", telegramRouter);
app.use("/api/slack", slackRouter);
app.use("/api/export", exportRouter);
app.use("/api/templates", templatesRouter);
app.use("/api", socialRouter);

app.get("/api/coach/weekly", requireUser, async (req: any, res) => {
  const { rows } = await pool.query(`SELECT state FROM user_state WHERE user_id = $1`, [req.user.id]);
  const report = await generateWeeklyReport(rows[0]?.state ?? {});
  res.json({ report });
});

app.get("/api/coach/catchup", requireUser, async (req: any, res) => {
  const { rows } = await pool.query(`SELECT state FROM user_state WHERE user_id = $1`, [req.user.id]);
  res.json({ proposal: proposeCatchUp(rows[0]?.state ?? {}) });
});

async function main(): Promise<void> {
  await initDb();
  const probe = await pool.query(`SELECT count(*)::int AS n FROM users`);
  console.log(`[db] connected, ${probe.rows[0]?.n ?? 0} users`);

  startBot();
  startScheduler();

  app.listen(config.port, () => {
    console.log(`[server] Ordo API on http://localhost:${config.port}`);
    console.log(`[server] auth: github=${authStatus().github} google=${authStatus().google} telegram=${authStatus().telegram} ai=${authStatus().anthropic}`);
  });
}

main().catch((err) => {
  console.error("[server] fatal", err);
  process.exit(1);
});

process.on("SIGINT", () => {
  stopBot();
  process.exit(0);
});
