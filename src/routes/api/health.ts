/**
 * What this deployment can actually do. The login page uses it to decide which
 * OAuth buttons to show, and the notification panel to say whether a bot token
 * exists — so the UI never offers a feature the server cannot honour.
 */
import { createFileRoute } from "@tanstack/react-router";
import { json, serverConfig } from "@/lib/server/config.server";
import { serviceConfigured } from "@/lib/server/supabase.server";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () =>
        json({
          ok: true,
          status: {
            github: serverConfig.oauthGithub,
            google: serverConfig.oauthGoogle,
            telegram: Boolean(serverConfig.telegramBotToken),
            slack: Boolean(serverConfig.slackBotToken),
            anthropic: Boolean(serverConfig.anthropicApiKey),
            telegramBot: serverConfig.telegramBotUsername,
          },
          // Not part of HealthStatus; handy when debugging a deploy.
          cron: Boolean(serverConfig.cronSecret) && serviceConfigured(),
        }),
    },
  },
});
