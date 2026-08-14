import { config } from "../config.js";

/**
 * One internal notification interface. Telegram is the first adapter; Slack
 * (and later email/push) plug in here without touching callers.
 */
export interface ChannelAdapter {
  name: "telegram" | "slack";
  configured: boolean;
  /** Send a plain message to a chat/channel. */
  send(recipient: string | number, text: string, keyboard?: unknown): Promise<boolean>;
}

export type KeyboardButton = { text: string; callback_data?: string };

export interface Keyboard {
  inline_keyboard: KeyboardButton[][];
}

// ---- Telegram adapter ------------------------------------------------------
async function telegramCall(method: string, payload: Record<string, unknown>): Promise<boolean> {
  if (!config.telegramBotToken) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[telegram] ${method} failed: ${res.status} ${body}`);
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
  configured: Boolean(config.telegramBotToken),
  async send(chatId: string | number, text: string, keyboard?: Keyboard) {
    return telegramCall("sendMessage", {
      chat_id: Number(chatId),
      text,
      parse_mode: "HTML",
      ...(keyboard ? { reply_markup: JSON.stringify(keyboard) } : {}),
    });
  },
};

// ---- Slack adapter ---------------------------------------------------------
export const slackAdapter: ChannelAdapter = {
  name: "slack",
  configured: Boolean(config.slackBotToken),
  async send(channel: string | number, text: string) {
    if (!config.slackBotToken) return false;
    try {
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.slackBotToken}`,
        },
        body: JSON.stringify({ channel: String(channel), text }),
      });
      const json = (await res.json()) as { ok: boolean };
      if (!json.ok) console.error("[slack] send failed");
      return json.ok;
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

/** Send through the channel named in a notification rule. */
export async function sendViaChannel(
  channel: string,
  recipient: string,
  text: string,
  keyboard?: Keyboard,
): Promise<boolean> {
  const adapter = channels[channel];
  if (!adapter || !adapter.configured) return false;
  return adapter.send(recipient, text, keyboard);
}
