/**
 * Telegram webhook. Long-polling needed a process that never sleeps; on Vercel
 * Telegram pushes updates here instead.
 *
 * Authentication is the secret token Telegram echoes back in a header, set when
 * the webhook is registered:
 *
 *   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
 *     -d "url=https://<your-app>/api/telegram/webhook" \
 *     -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
 *
 * Handler errors are swallowed on purpose: Telegram retries any non-2xx, and a
 * poison update would otherwise be redelivered forever.
 */
import { createFileRoute } from "@tanstack/react-router";
import { fail, json, serverConfig } from "@/lib/server/config.server";
import { handleTelegramUpdate, type TelegramUpdate } from "@/lib/server/telegram.server";

export const Route = createFileRoute("/api/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!serverConfig.telegramBotToken) return fail(503, "Telegram bot not configured");
        if (!serverConfig.telegramWebhookSecret)
          return fail(503, "TELEGRAM_WEBHOOK_SECRET not set");
        if (
          request.headers.get("x-telegram-bot-api-secret-token") !==
          serverConfig.telegramWebhookSecret
        ) {
          return fail(401, "Bad secret token");
        }

        let update: TelegramUpdate;
        try {
          update = (await request.json()) as TelegramUpdate;
        } catch {
          return fail(400, "Invalid JSON");
        }

        try {
          await handleTelegramUpdate(update);
        } catch (err) {
          console.error("[telegram] update failed", err);
        }
        return json({ ok: true });
      },
    },
  },
});
