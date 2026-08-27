/**
 * Server-side configuration. Files named `*.server.*` are denied to the client
 * bundle by TanStack Start's import protection, so secrets read here can never
 * be shipped to the browser.
 */
const env = (key: string): string => (process.env[key] ?? "").trim();

/** Accepts 1 / true / yes / on, so operators can use whatever reads naturally. */
const flag = (key: string): boolean => ["1", "true", "yes", "on"].includes(env(key).toLowerCase());

export const serverConfig = {
  /** Same values the browser gets; VITE_* fallbacks keep one source of truth. */
  supabaseUrl: env("SUPABASE_URL") || env("VITE_SUPABASE_URL"),
  supabaseAnonKey: env("SUPABASE_ANON_KEY") || env("VITE_SUPABASE_ANON_KEY"),
  /** Bypasses RLS — only the webhook and the cron tick may use it. */
  supabaseServiceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY"),

  telegramBotToken: env("TELEGRAM_BOT_TOKEN"),
  telegramBotUsername: env("TELEGRAM_BOT_USERNAME"),
  /** Telegram echoes this back in X-Telegram-Bot-Api-Secret-Token. */
  telegramWebhookSecret: env("TELEGRAM_WEBHOOK_SECRET"),

  slackBotToken: env("SLACK_BOT_TOKEN"),

  anthropicApiKey: env("ANTHROPIC_API_KEY"),
  anthropicModel: env("ANTHROPIC_MODEL") || "claude-sonnet-4-5-20250929",

  /** Vercel injects this for its own cron; the other schedulers must match it. */
  cronSecret: env("CRON_SECRET"),

  // OAuth providers live in the Supabase dashboard, which we cannot introspect —
  // these say "I turned that provider on", so the login page shows the button.
  oauthGithub: flag("OAUTH_GITHUB"),
  oauthGoogle: flag("OAUTH_GOOGLE"),
} as const;

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export const fail = (status: number, error: string): Response => json({ error }, status);
