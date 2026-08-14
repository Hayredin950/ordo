import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 8787),
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgres://ordo:ordo_dev_pw@localhost:5434/ordo",
  appUrl: process.env.APP_URL ?? "http://localhost:5173",
  sessionDays: Number(process.env.SESSION_DAYS ?? 30),

  // Telegram (bot activates when a token is present)
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME ?? "",

  // OAuth — each provider activates when its client id/secret are present
  githubClientId: process.env.GITHUB_CLIENT_ID ?? "",
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",

  // AI coach — rule-based fallback when absent
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",

  // Slack (adapter present, activates when configured)
  slackBotToken: process.env.SLACK_BOT_TOKEN ?? "",
  slackSigningSecret: process.env.SLACK_SIGNING_SECRET ?? "",

  // Magic-link email delivery — without SMTP the code is logged to the console
  smtpUrl: process.env.SMTP_URL ?? "",
  mailFrom: process.env.MAIL_FROM ?? "Ordo <noreply@ordo.local>",
} as const;

export const isProd = process.env.NODE_ENV === "production";
