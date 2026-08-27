/**
 * One notification interface, two adapters. Callers name a channel; whether it
 * is configured is the adapter's problem, not theirs.
 */
import { serverConfig } from "./config.server";

export type KeyboardButton = { text: string; callback_data?: string };
export type Keyboard = { inline_keyboard: KeyboardButton[][] };

export interface ChannelAdapter {
  name: "telegram" | "slack";
  configured: boolean;
  send(recipient: string | number, text: string, keyboard?: Keyboard): Promise<boolean>;
}

export async function telegramCall(
  method: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  if (!serverConfig.telegramBotToken) return false;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${serverConfig.telegramBotToken}/${method}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      console.error(`[telegram] ${method} failed: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[telegram] ${method} error`, err);
    return false;
  }
}

export const telegramAdapter: ChannelAdapter = {
  name: "telegram",
  get configured() {
    return Boolean(serverConfig.telegramBotToken);
  },
  async send(chatId, text, keyboard) {
    return telegramCall("sendMessage", {
      chat_id: Number(chatId),
      text,
      parse_mode: "HTML",
      ...(keyboard ? { reply_markup: JSON.stringify(keyboard) } : {}),
    });
  },
};

/** Slack has no HTML parse mode, so tags are stripped rather than escaped. */
const toSlackText = (text: string): string =>
  text
    .replace(/<b>(.*?)<\/b>/g, "*$1*")
    .replace(/<i>(.*?)<\/i>/g, "_$1_")
    .replace(/<[^>]+>/g, "");

export const slackAdapter: ChannelAdapter = {
  name: "slack",
  get configured() {
    return Boolean(serverConfig.slackBotToken);
  },
  async send(channel, text) {
    if (!serverConfig.slackBotToken) return false;
    try {
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${serverConfig.slackBotToken}`,
        },
        body: JSON.stringify({ channel: String(channel), text: toSlackText(text) }),
      });
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!body.ok) console.error("[slack] send failed", body.error ?? "unknown");
      return body.ok;
    } catch (err) {
      console.error("[slack] send error", err);
      return false;
    }
  },
};

export const channels: Record<string, ChannelAdapter> = {
  telegram: telegramAdapter,
  slack: slackAdapter,
};

export async function sendViaChannel(
  channel: string,
  recipient: string,
  text: string,
  keyboard?: Keyboard,
): Promise<boolean> {
  const adapter = channels[channel];
  if (!adapter?.configured) return false;
  return adapter.send(recipient, text, keyboard);
}

/** Fan one message out to every channel a user has linked. */
export async function notifyUser(
  target: { chat_id?: string | number | null; slack_channel?: string | null },
  text: string,
  keyboard?: Keyboard,
): Promise<boolean> {
  let sent = false;
  if (target.chat_id) sent = (await telegramAdapter.send(target.chat_id, text, keyboard)) || sent;
  if (target.slack_channel) sent = (await slackAdapter.send(target.slack_channel, text)) || sent;
  return sent;
}
