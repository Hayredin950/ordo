/**
 * Telegram bot, webhook edition. On Render this was a long-polling loop; on
 * Vercel there is no process to poll from, so Telegram pushes updates to
 * /api/telegram/webhook and this module handles one update per request.
 *
 * Runs with the service-role client: a Telegram chat has no Supabase session,
 * so RLS cannot identify it. The chat_id → user_id mapping in `telegram_links`
 * is the only authorization step, which is why link codes are single-use.
 */
import { serviceClient } from "./supabase.server";
import { telegramAdapter, telegramCall, type Keyboard } from "./notify.server";
import { blocksForDay, computeStreak, dateKey, logForDay, type ServerState } from "./state.server";

export type TelegramUpdate = {
  update_id?: number;
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

const STEPS = [0, 25, 50, 75, 100];

async function userForChat(chatId: number): Promise<string | null> {
  const { data } = await serviceClient()
    .from("telegram_links")
    .select("user_id")
    .eq("chat_id", chatId)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

async function loadState(userId: string): Promise<ServerState> {
  const { data } = await serviceClient()
    .from("user_state")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();
  return ((data?.state as ServerState | undefined) ?? {}) as ServerState;
}

/** Build the evening check-in for the blocks that are still unlogged. */
export function buildCheckIn(
  state: ServerState,
  day: Date,
): { text: string; keyboard: Keyboard } | null {
  const blocks = blocksForDay(state, day);
  if (!blocks.length) return null;
  const entries = logForDay(state, day);
  const unlogged = blocks.filter((b) => (entries[b.id] ?? 0) === 0);
  if (!unlogged.length) return null;

  const text = `🌙 Evening check-in — how did today go?\n\n${unlogged
    .slice(0, 5)
    .map((b) => `• ${b.title} (${b.start})`)
    .join("\n")}`;

  // One row per block: a label button, then the percentage buttons.
  const rows = unlogged
    .slice(0, 3)
    .map((b) => [
      { text: b.title },
      ...STEPS.map((v) => ({ text: `${v}%`, callback_data: `log:${b.id}:${v}` })),
    ]);
  return { text, keyboard: { inline_keyboard: rows } };
}

async function handleCommand(chatId: number, username: string, text: string): Promise<void> {
  const [cmd, arg] = text.trim().split(/\s+/);
  switch (cmd) {
    case "/start":
      await telegramAdapter.send(
        chatId,
        `Ordo bot here — your accountability channel.\n\n` +
          `To link this chat to your account:\n1. Open Ordo → Today → Connect Telegram\n2. Send <b>/link CODE</b> with the code shown there.\n\n` +
          `Commands:\n/link CODE — link this chat\n/today — today's plan\n/status — your streak & week\n/unlink — remove this chat`,
      );
      return;

    case "/link": {
      if (!arg) {
        await telegramAdapter.send(
          chatId,
          "Usage: /link CODE — get a code from Ordo → Today → Connect Telegram.",
        );
        return;
      }
      // Single SQL statement: validates, redeems, links and ticks onboarding.
      const { data, error } = await serviceClient().rpc("claim_telegram_code", {
        p_code: arg,
        p_chat_id: chatId,
        p_username: username,
      });
      if (error) {
        console.error("[bot] claim_telegram_code failed", error.message);
        await telegramAdapter.send(chatId, "Something broke on my side. Try again in a minute.");
        return;
      }
      await telegramAdapter.send(
        chatId,
        data
          ? "✅ Linked! You'll get reminders, nags and daily check-ins here."
          : "That code is invalid or expired. Generate a fresh one in the app.",
      );
      return;
    }

    case "/today": {
      const userId = await userForChat(chatId);
      if (!userId) {
        await telegramAdapter.send(
          chatId,
          "Not linked yet. Send /link CODE (get the code in the app).",
        );
        return;
      }
      const state = await loadState(userId);
      const day = new Date();
      const blocks = blocksForDay(state, day);
      const entries = logForDay(state, day);
      const lines = blocks.map((b) => {
        const pct = entries[b.id] ?? 0;
        const mark = pct >= 100 ? "✅" : pct >= 50 ? "🟡" : "⬜";
        return `${mark} ${b.start}–${b.end} ${b.title}`;
      });
      await telegramAdapter.send(
        chatId,
        `📅 Today (${dateKey(day)}):\n${lines.join("\n") || "Nothing scheduled."}`,
      );
      return;
    }

    case "/status": {
      const userId = await userForChat(chatId);
      if (!userId) {
        await telegramAdapter.send(chatId, "Not linked yet. Send /link CODE.");
        return;
      }
      const streak = computeStreak(await loadState(userId));
      await telegramAdapter.send(
        chatId,
        `🔥 Current streak: ${streak.current}d · Best: ${streak.best}d`,
      );
      return;
    }

    case "/unlink": {
      const userId = await userForChat(chatId);
      if (!userId) {
        await telegramAdapter.send(chatId, "This chat isn't linked to anything.");
        return;
      }
      await serviceClient().from("telegram_links").delete().eq("chat_id", chatId);
      await telegramAdapter.send(chatId, "Unlinked. Ordo will stop messaging this chat.");
      return;
    }

    default:
      await telegramAdapter.send(chatId, "Unknown command. Try /start for help.");
  }
}

async function handleCallback(cb: NonNullable<TelegramUpdate["callback_query"]>): Promise<void> {
  const chatId = cb.message?.chat.id ?? cb.from.id;
  // Always answer, or the button spins in the client until it times out.
  await telegramCall("answerCallbackQuery", { callback_query_id: cb.id });

  const userId = await userForChat(chatId);
  if (!userId) {
    await telegramAdapter.send(chatId, "Not linked yet. Send /link CODE.");
    return;
  }

  const [action, blockId, pct] = (cb.data ?? "").split(":");
  if (action === "log" && blockId && pct) {
    const value = Math.max(0, Math.min(100, Number(pct) || 0));
    const state = await loadState(userId);
    const day = dateKey(new Date());
    const log = { ...(state.log ?? {}) };
    log[day] = { ...(log[day] ?? {}), [blockId]: value };
    const { error } = await serviceClient()
      .from("user_state")
      .update({ state: { ...state, log }, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) {
      console.error("[bot] log update failed", error.message);
      await telegramAdapter.send(chatId, "Could not save that — try again from the app.");
      return;
    }
    await telegramAdapter.send(chatId, `Logged ${value}% for that block. Keep going. 💪`);
  } else if (action === "snooze") {
    await telegramAdapter.send(chatId, "Snoozed — I'll remind you again in 30 minutes.");
  } else {
    await telegramAdapter.send(chatId, "Hmm, that button is stale. Try /today.");
  }
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  if (update.message?.text) {
    await handleCommand(
      update.message.chat.id,
      update.message.from?.username ?? "",
      update.message.text,
    );
  } else if (update.callback_query) {
    await handleCallback(update.callback_query);
  }
}
