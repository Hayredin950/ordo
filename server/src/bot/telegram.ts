import { config } from "../config.js";
import { pool } from "../db/index.js";
import { telegramAdapter, type Keyboard } from "../notify/index.js";

type Update = {
  update_id: number;
  message?: {
    chat: { id: number };
    from?: { id: number; username?: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; username?: string };
    message?: { chat: { id: number }; message_id?: number };
    data?: string;
  };
};

let running = false;
let offset = 0;

type Block = { id: string; title: string; start: string; end: string; category: string; priority?: string };

type OrdoState = {
  routine?: Record<string, Block[]>;
  overrides?: Record<string, Block[]>;
  log?: Record<string, Record<string, number>>;
};

async function loadState(userId: string): Promise<OrdoState> {
  const { rows } = await pool.query<{ state: OrdoState }>(
    `SELECT state FROM user_state WHERE user_id = $1`,
    [userId],
  );
  return rows[0]?.state ?? {};
}

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function userForChat(chatId: number): Promise<{ user_id: string } | null> {
  const { rows } = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM telegram_links WHERE chat_id = $1`,
    [chatId],
  );
  return rows[0] ?? null;
}

export function startBot(): void {
  if (!config.telegramBotToken) {
    console.log("[bot] TELEGRAM_BOT_TOKEN not set — bot dormant");
    return;
  }
  if (running) return;
  running = true;
  console.log("[bot] starting long-polling");
  void poll();
}

async function poll(): Promise<void> {
  while (running) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${config.telegramBotToken}/getUpdates?timeout=30&offset=${offset}`,
      );
      const json = (await res.json()) as { ok: boolean; result?: Update[] };
      if (json.ok && json.result) {
        for (const update of json.result) {
          offset = update.update_id + 1;
          await handleUpdate(update).catch((err) => console.error("[bot] update error", err));
        }
      }
    } catch (err) {
      console.error("[bot] poll error", err);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

async function handleUpdate(update: Update): Promise<void> {
  if (update.message?.text) {
    await handleCommand(update.message.chat.id, update.message.from?.username ?? "", update.message.text);
  } else if (update.callback_query?.data) {
    await handleCallback(update.callback_query);
  }
}

async function handleCommand(chatId: number, username: string, text: string): Promise<void> {
  const [cmd, arg] = text.split(/\s+/);
  switch (cmd) {
    case "/start":
      await telegramAdapter.send(
        chatId,
        `Ordo bot here — your accountability channel.\n\n` +
          `To link this chat to your account:\n1. Open Ordo → Today → Connect Telegram\n2. Send <b>/link CODE</b> with the code shown there.\n\n` +
          `Commands:\n/link CODE — link this chat\n/today — today's plan\n/status — your streak & week\n/unlink — remove this chat`,
      );
      break;

    case "/link": {
      if (!arg) {
        await telegramAdapter.send(chatId, "Usage: /link CODE — get a code from Ordo → Today → Connect Telegram.");
        return;
      }
      const code = arg.toUpperCase();
      const { rows } = await pool.query<{ user_id: string }>(
        `SELECT user_id FROM telegram_codes WHERE code = $1 AND expires_at > now()`,
        [code],
      );
      if (!rows[0]) {
        await telegramAdapter.send(chatId, "That code is invalid or expired. Generate a fresh one in the app.");
        return;
      }
      await pool.query(
        `INSERT INTO telegram_links (user_id, chat_id, username, linked_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (user_id) DO UPDATE SET chat_id = EXCLUDED.chat_id, username = EXCLUDED.username, linked_at = now()`,
        [rows[0].user_id, chatId, username],
      );
      await pool.query(`DELETE FROM telegram_codes WHERE code = $1`, [code]);
      await telegramAdapter.send(chatId, "✅ Linked! You'll get reminders, nags and daily check-ins here.");
      break;
    }

    case "/today": {
      const link = await userForChat(chatId);
      if (!link) {
        await telegramAdapter.send(chatId, "Not linked yet. Send /link CODE (get the code in the app).");
        return;
      }
      const state = await loadState(link.user_id);
      const day = new Date();
      const blocks = state.overrides?.[dateKey(day)] ?? state.routine?.[String(day.getDay())] ?? [];
      const entries = state.log?.[dateKey(day)] ?? {};
      const lines = blocks.map((b) => {
        const pct = entries[b.id] ?? 0;
        const mark = pct >= 100 ? "✅" : pct >= 50 ? "🟡" : "⬜";
        return `${mark} ${b.start}–${b.end} ${b.title}`;
      });
      await telegramAdapter.send(chatId, `📅 Today (${dateKey(day)}):\n${lines.join("\n") || "Nothing scheduled."}`);
      break;
    }

    case "/status": {
      const link = await userForChat(chatId);
      if (!link) {
        await telegramAdapter.send(chatId, "Not linked yet. Send /link CODE.");
        return;
      }
      const state = await loadState(link.user_id);
      const streak = computeStreak(state);
      await telegramAdapter.send(chatId, `🔥 Current streak: ${streak.current}d · Best: ${streak.best}d`);
      break;
    }

    case "/unlink": {
      const link = await userForChat(chatId);
      if (link) {
        await pool.query(`DELETE FROM telegram_links WHERE chat_id = $1`, [chatId]);
        await telegramAdapter.send(chatId, "Unlinked. Ordo will stop messaging this chat.");
      } else {
        await telegramAdapter.send(chatId, "This chat isn't linked to anything.");
      }
      break;
    }

    default:
      await telegramAdapter.send(chatId, "Unknown command. Try /start for help.");
  }
}

function computeStreak(state: OrdoState) {
  let current = 0;
  let best = 0;
  let run = 0;
  const today = new Date();
  for (let i = 90; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const blocks = state.routine?.[String(d.getDay())] ?? [];
    if (!blocks.length) continue;
    const entries = state.log?.[dateKey(d)] ?? {};
    const total = blocks.reduce((s, b) => s + (entries[b.id] ?? 0), 0);
    const score = total / blocks.length;
    if (score >= 0.7) {
      run++;
      best = Math.max(best, run);
      if (i === 0) current = run;
    } else {
      run = 0;
      if (i === 0) current = 0;
    }
  }
  return { current, best };
}

const STEPS = [0, 25, 50, 75, 100];

async function handleCallback(cb: { id: string; from: { id: number }; message?: { chat: { id: number }; message_id?: number }; data?: string }): Promise<void> {
  const data = cb.data ?? "";
  const chatId = cb.message?.chat.id ?? cb.from.id;
  const link = await userForChat(chatId);
  if (!link) {
    await telegramAdapter.send(chatId, "Not linked yet. Send /link CODE.");
    return;
  }

  const [action, blockId, pct] = data.split(":");
  if (action === "log" && blockId && pct) {
    const state = await loadState(link.user_id);
    const day = dateKey(new Date());
    const log = { ...(state.log ?? {}) };
    log[day] = { ...(log[day] ?? {}), [blockId]: Number(pct) };
    await pool.query(
      `UPDATE user_state SET state = jsonb_set(state, '{log}', $1::jsonb, true), updated_at = now() WHERE user_id = $2`,
      [JSON.stringify(log), link.user_id],
    );
    await telegramAdapter.send(chatId, `Logged ${pct}% for that block. Keep going. 💪`);
  } else if (action === "snooze") {
    await telegramAdapter.send(chatId, "Snoozed — I'll remind you again in 30 minutes.");
  } else {
    await telegramAdapter.send(chatId, "Hmm, that button is stale. Try /today.");
  }
}

/** Build the evening check-in message for a day. */
export async function buildCheckIn(state: OrdoState, day: Date): Promise<{ text: string; keyboard: Keyboard } | null> {
  const blocks = state.routine?.[String(day.getDay())] ?? [];
  if (!blocks.length) return null;
  const entries = state.log?.[dateKey(day)] ?? {};
  const unlogged = blocks.filter((b) => (entries[b.id] ?? 0) === 0);
  if (!unlogged.length) return null;

  const text = `🌙 Evening check-in — how did today go?\n\n${unlogged
    .slice(0, 5)
    .map((b) => `• ${b.title} (${b.start})`)
    .join("\n")}`;

  const rows = unlogged.slice(0, 3).map((b) => [
    { text: `${b.title}` },
    ...STEPS.map((v) => ({ text: `${v}%`, callback_data: `log:${b.id}:${v}` })),
  ]);
  return {
    text,
    keyboard: { inline_keyboard: rows.length ? rows : [] },
  };
}

export function stopBot(): void {
  running = false;
}
