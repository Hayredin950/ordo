import cron from "node-cron";
import { pool } from "../db/index.js";
import { telegramAdapter, slackAdapter, type Keyboard } from "../notify/index.js";
import { buildCheckIn } from "../bot/telegram.js";
import { generateWeeklyReport } from "../ai/coach.js";

type Block = { id: string; title: string; start: string; end: string; category: string; priority?: string };

type OrdoState = {
  routine?: Record<string, Block[]>;
  overrides?: Record<string, Block[]>;
  log?: Record<string, Record<string, number>>;
};

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type LinkedUser = {
  user_id: string;
  chat_id: string | null;
  slack_channel: string | null;
};

/** Every user who has at least one notification channel linked. */
async function allLinkedUsers(): Promise<LinkedUser[]> {
  const { rows } = await pool.query<{ user_id: string; chat_id: string | null; slack_channel: string | null }>(
    `SELECT tl.user_id, tl.chat_id::text AS chat_id, sl.channel AS slack_channel
       FROM telegram_links tl
       LEFT JOIN slack_links sl ON sl.user_id = tl.user_id`,
  );
  return rows;
}

async function loadState(userId: string): Promise<OrdoState> {
  const { rows } = await pool.query<{ state: OrdoState }>(
    `SELECT state FROM user_state WHERE user_id = $1`,
    [userId],
  );
  return rows[0]?.state ?? {};
}

function blockForDay(state: OrdoState, d: Date): Block[] {
  return state.overrides?.[dateKey(d)] ?? state.routine?.[String(d.getDay())] ?? [];
}

function minutesUntil(start: string): number {
  const now = new Date();
  const [h, m] = start.split(":").map(Number);
  const target = new Date(now);
  target.setHours(h ?? 0, m ?? 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

/** Fan a message out to every channel a user has linked (Telegram, Slack…). */
async function notifyUser(u: LinkedUser, text: string, keyboard?: Keyboard): Promise<void> {
  if (u.chat_id) await telegramAdapter.send(u.chat_id, text, keyboard);
  if (u.slack_channel) await slackAdapter.send(u.slack_channel, text);
}

export function startScheduler(): void {
  // Pre-block reminders + nags — every minute, cheap query.
  cron.schedule("* * * * *", async () => {
    try {
      const users = await allLinkedUsers();
      for (const u of users) {
        const state = await loadState(u.user_id);
        const today = new Date();
        const blocks = blockForDay(state, today);
        const entries = state.log?.[dateKey(today)] ?? {};
        for (const b of blocks) {
          const mins = minutesUntil(b.start);
          if (mins === 10 && b.priority !== "nice") {
            await notifyUser(u, `⏰ In 10 minutes: <b>${b.title}</b> (${b.start}–${b.end})`);
          }
          if (mins <= -5 && mins > -90 && (entries[b.id] ?? 0) === 0 && b.priority === "must") {
            await notifyUser(u, `🔔 <b>${b.title}</b> (${b.start}) passed unlogged. Log it or it becomes debt.`);
          }
        }
      }
    } catch (err) {
      console.error("[scheduler] reminder pass failed", err);
    }
  });

  // Morning brief — 07:00 local.
  cron.schedule("0 7 * * *", async () => {
    try {
      const users = await allLinkedUsers();
      for (const u of users) {
        const state = await loadState(u.user_id);
        const today = new Date();
        const blocks = blockForDay(state, today);
        if (!blocks.length) continue;
        const must = blocks.filter((b) => b.priority !== "nice");
        const headline = must.length
          ? `Today's must-dos: ${must.map((b) => b.title).join(", ")}`
          : "No must-do blocks today — coast is earned.";
        await notifyUser(
          u,
          `🌅 Good morning. ${headline}\n\nFull plan:\n${blocks.map((b) => `• ${b.start}–${b.end} ${b.title}`).join("\n")}`,
        );
      }
    } catch (err) {
      console.error("[scheduler] morning brief failed", err);
    }
  });

  // Evening check-in — 21:00 local.
  cron.schedule("0 21 * * *", async () => {
    try {
      const users = await allLinkedUsers();
      for (const u of users) {
        const state = await loadState(u.user_id);
        const checkIn = await buildCheckIn(state, new Date());
        if (checkIn) {
          await notifyUser(u, checkIn.text, checkIn.keyboard);
        }
      }
    } catch (err) {
      console.error("[scheduler] evening check-in failed", err);
    }
  });

  // Future-self letter delivery — every 10 minutes, due letters go out once.
  cron.schedule("*/10 * * * *", async () => {
    try {
      const { rows } = await pool.query(
        `SELECT l.id, l.goal_title, l.body, tl.chat_id, sl.channel AS slack_channel
           FROM future_letters l
           JOIN telegram_links tl ON tl.user_id = l.user_id
           LEFT JOIN slack_links sl ON sl.user_id = l.user_id
          WHERE l.delivered = false AND l.deadline <= CURRENT_DATE`,
      );
      for (const l of rows) {
        const text = `💌 <b>Your future-self letter has arrived.</b>\n\n“${l.body}”\n\n— sealed for “${l.goal_title}”`;
        if (l.chat_id) await telegramAdapter.send(l.chat_id, text);
        if (l.slack_channel) await slackAdapter.send(l.slack_channel, text);
        await pool.query(`UPDATE future_letters SET delivered = true WHERE id = $1`, [l.id]);
      }
    } catch (err) {
      console.error("[scheduler] future letter delivery failed", err);
    }
  });

  // Weekly report — Sunday 20:00 local.
  cron.schedule("0 20 * * 0", async () => {
    try {
      const users = await allLinkedUsers();
      for (const u of users) {
        const state = await loadState(u.user_id);
        const report = await generateWeeklyReport(state);
        await notifyUser(u, report);
      }
    } catch (err) {
      console.error("[scheduler] weekly report failed", err);
    }
  });

  console.log("[scheduler] cron jobs registered");
}
