# Ordo

A personal accountability system. You define what you want at every time scale —
year, semester, month, week, day, time block — log what actually happens, and the
app holds you to it with charts, streaks and a bot that nags.

Live at **[ordo-core.vercel.app](https://ordo-core.vercel.app)**.

The plan and the log are deliberately separate objects: a routine template says
what _should_ happen, the daily log says what _did_. Every score, streak and chart
is computed from the log, never from the plan.

## What it does

**Plan** — goals from year down to day, each level rolling up into the one above. A
default routine per weekday, any single date overridable, and any day's schedule
copyable to another day, to every weekday, or across an arbitrary date range.
Schedules worth keeping can be saved as named templates.

**Track** — mark a block done, or partially at 25 / 50 / 75 / 100. Must-do versus
nice-to-have priority, missed-block debt that carries forward instead of vanishing,
current and best streak.

**See** — weekly completion, a GitHub-style consistency heatmap, category
breakdown, a three-week trend line, and a year-in-review.

**Get nagged** — over Telegram or Slack: a morning brief, a reminder before a block
starts, a nag when a must-do passes unlogged, an evening check-in whose buttons
write completion straight back into the document, and a weekly report. Future-self
letters are sealed when you set a goal and delivered by the bot on its deadline.

**Reflect** — an AI catch-up proposal and weekly reflection, written by Claude when
`ANTHROPIC_API_KEY` is set and by a rule-based fallback when it is not.

**Share, if you want to** — publish a routine to the public template library, pair
with someone to see each other's weekly percentage (never task details), or join an
opt-in challenge with a leaderboard.

**Preferences** — 24-hour or 12-hour clock, stored on the account rather than in
the browser, honoured everywhere the app or the bot prints a time.

Signed out, everything runs on `localStorage` as a demo. Signing in syncs the same
document per-user to Postgres. Every integration degrades to "not configured" in
the UI instead of breaking.

## Admin console

`/admin`, visible only to accounts whose `profiles.role` is `admin`. Five sections:
an overview of signups, activity and per-integration counts; the category editor;
the user list with promote/demote; announcements shown as a banner to every
signed-in user; and moderation of the public template library.

The client-side guard is cosmetic. Every call the console makes is either an
admin-only RLS policy or a `SECURITY DEFINER` function that raises `Admins only`,
so a non-admin who reached the page would see a screen of errors rather than
anybody's data. `admin_set_role` additionally refuses self-demotion and refuses to
demote the founder address, so the last admin cannot lock everyone out.

**Categories are data, not a constant.** The six built-ins (Health, Study, Work,
Finance, Spiritual, Relationships) live in `src/lib/categories.ts` so a signed-out
browser still renders. A row in `app_categories` with the same id overrides one; a
row with a new id adds one, with any CSS colour and any icon from the lucide
registry. Deleting an override restores the built-in. A block filed under a
category that has since been deleted keeps its id and renders unlabelled rather
than silently jumping to another category.

## Architecture

There is no separate backend server. The database _is_ the backend.

```
Browser ──supabase-js──▶ Supabase Postgres   (row level security enforces access)
   │                          ▲
   │                          │ service role
   └──▶ Vercel (TanStack Start SSR + 5 API routes) ──┘
             ▲
             └── GitHub Actions / Vercel Cron / any cron service → /api/cron/tick
```

- **Frontend + SSR: Vercel only.** Nitro's `vercel` preset emits Build Output API
  v3 into `.vercel/output/`.
- **Data + auth: Supabase.** Every read and write goes straight from the browser to
  Postgres through `supabase-js`. Access control lives in RLS policies, not in
  application code, so there is nothing to trust on the client. Supabase Auth
  handles email/password, 6-digit code verification and GitHub/Google OAuth.
- **Serverless routes** exist only for the few things that genuinely cannot run in
  the browser, because they need the service role key or a third-party secret:

  | Route                        | Purpose                                                  |
  | ---------------------------- | -------------------------------------------------------- |
  | `GET /api/health`            | Which integrations are configured (drives the UI badges) |
  | `GET /api/coach/weekly`      | AI weekly reflection (Anthropic, RLS-scoped read)        |
  | `GET /api/coach/catchup`     | AI catch-up proposal                                     |
  | `POST /api/telegram/webhook` | Telegram bot, verified by secret token header            |
  | `GET\|POST /api/cron/tick`   | One idempotent scheduler pass, `Bearer $CRON_SECRET`     |

- **Anything touching a secret lives in `src/lib/server/*.server.ts`.** TanStack's
  import protection rewrites `*.server.*` files to mocks in the client environment,
  so a stray import fails loudly instead of shipping a key.

## Development

```sh
bun install
cp .env.example .env.local   # at minimum VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
bun run dev                  # http://localhost:5173
```

```sh
bun run typecheck   # tsc --noEmit
bun run lint        # eslint . (prettier runs as a rule, so formatting fails here)
bun run build       # vite build + register the Vercel cron
```

`src/routeTree.gen.ts` is generated by the router plugin during dev and build. A
newly added route file will not typecheck until one of them has run.

## Supabase setup

Three migrations, in [`supabase/migrations/`](supabase/migrations): the schema, a
`pgcrypto`-free rewrite of the Telegram code minting, and the admin role with its
categories and announcements.

```sh
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Then in the dashboard: **Authentication → URL Configuration** → set the site URL
and add your domain to the redirect allow-list, and **Authentication → Providers** →
enable GitHub and/or Google with their client id and secret. Both are also
described in [`supabase/config.toml`](supabase/config.toml), so
`supabase config push` applies them for you.

**Careful with `supabase config push`.** It writes the whole auth config, including
`external.*.secret`. Export `SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID`,
`SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET` and the two Google equivalents first, or the
push overwrites your working OAuth credentials with empty strings.

### The OAuth callback belongs to Supabase, not to this app

Supabase brokers the whole flow, so the callback you register with the provider is

```
https://<your-project-ref>.supabase.co/auth/v1/callback
```

and _not_ a URL on your own domain. Pointing it at the app fails with
`redirect_uri_mismatch` from Google, or "The redirect_uri MUST match the registered
callback URL" from GitHub. Set it under **GitHub → Settings → Developer settings →
OAuth Apps → Authorization callback URL** and **Google Cloud Console → Credentials
→ your OAuth client → Authorised redirect URIs**. Google's _Authorised JavaScript
origins_ is a separate field; filling only that one is not enough.

To see what Supabase actually sends:

```sh
curl -sD - -o /dev/null \
  "https://<your-project-ref>.supabase.co/auth/v1/authorize?provider=github"
```

The `Location` header shows the `client_id` and `redirect_uri` in play.

### Email verification needs your own SMTP

Sign-in and signup both verify a **6-digit code** (`supabase.auth.verifyOtp`), not a
clickable link, so the user never leaves the tab they started in. Supabase generates
that code either way — but its stock templates print `{{ .ConfirmationURL }}`
instead of `{{ .Token }}`, and a free-tier project on the built-in email provider
may not change them:

```
400 Email template modification is not available for free tier projects
    using the default email provider.
```

Configuring `[auth.email.smtp]` with a sender of your own lifts that restriction,
and also the built-in provider's cap of two emails per hour for the entire project.
Once SMTP is set:

1. Uncomment the two `[auth.email.template.*]` blocks in
   [`supabase/config.toml`](supabase/config.toml). The templates in
   [`supabase/templates/`](supabase/templates) already use `{{ .Token }}`.
2. Set `enable_confirmations = true`, so a new account is unusable until its address
   is verified.
3. `supabase config push`.

Until then the emails carry a link, and the app copes: the code screen still
appears, and clicking the link also lands a session. `verifyOtp({ type: "email" })`
accepts both the signup-confirmation code and the sign-in code, so one path serves
both flows. Password and OAuth sign-in never touch email at all.

### What the schema is made of

- **Tables.** `profiles`, `user_state`, `telegram_links`, `telegram_codes`,
  `slack_links`, `notification_rules`, `public_templates`, `pairings`, `challenges`,
  `challenge_members`, `future_letters`, `onboarding`, `notification_log`,
  `app_categories`, `announcements`. `user_state` holds the user's whole Ordo
  document as `jsonb`, plus a `history` stack capped at 30 that powers undo.
- **RLS on every table**, with `user_id = auth.uid()` as the default rule. The
  exceptions are deliberate: `public_templates` and `challenges` are browsable by
  any signed-in user, and `app_categories` and `announcements` are readable by
  everyone but writable only by an admin — they are app configuration, not user
  data.
- **`SECURITY DEFINER` functions** for everything a user must do without direct
  table access: `save_state` / `undo_state`, `weekly_pct`, `peer_progress`,
  `pair_with_email` / `unpair`, `list_challenges` / `create_challenge` /
  `join_challenge` / `challenge_leaderboard`, `publish_template` /
  `copy_public_template`, `set_onboarding`, `create_telegram_code` /
  `claim_telegram_code`, `delete_account`, and the admin trio `admin_overview` /
  `admin_list_users` / `admin_set_role`. `peer_progress` and
  `challenge_leaderboard` return aggregate percentages only, never task details.
- **`handle_new_user()`** creates the `profiles` row on signup and promotes the
  founder address to `admin`. It promotes but never demotes, so an admin added by
  hand keeps the role on their next login.
- **`notification_log` doubles as the scheduler's lock.** Its primary key is
  `(user_id, kind, day, ref)`, so a duplicate send fails with `23505` and is
  skipped. Overlapping cron pings are therefore harmless.

## Environment variables

Copy [`.env.example`](.env.example) to `.env.local` for development and set the same
keys on Vercel. Nothing here is required to boot.

| Variable                       | Where           | Purpose                                                                                                         |
| ------------------------------ | --------------- | --------------------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`            | client + server | Supabase project URL                                                                                            |
| `VITE_SUPABASE_ANON_KEY`       | client + server | Public by design; RLS is what protects the data                                                                 |
| `SUPABASE_SERVICE_ROLE_KEY`    | **server only** | Bypasses RLS. Used by exactly two routes: the Telegram webhook and the cron tick                                |
| `OAUTH_GITHUB`, `OAUTH_GOOGLE` | server          | `1` to show the buttons on the login page. The providers themselves are configured in the Supabase dashboard    |
| `CRON_SECRET`                  | server          | `Authorization: Bearer` value that `/api/cron/tick` requires. `openssl rand -hex 32`                            |
| `ORDO_TZ_OFFSET_MINUTES`       | server          | Minutes to shift the schedule from UTC, so "07:00" means 07:00 where you are (`180` for UTC+3). Defaults to `0` |
| `TELEGRAM_BOT_TOKEN`           | server          | From @BotFather                                                                                                 |
| `TELEGRAM_BOT_USERNAME`        | server          | Shown in the UI as the deep link to your bot                                                                    |
| `TELEGRAM_WEBHOOK_SECRET`      | server          | Must match the `secret_token` you register; the route 401s without it                                           |
| `SLACK_BOT_TOKEN`              | server          | Optional second channel; the bot must be invited to the channel                                                 |
| `ANTHROPIC_API_KEY`            | server          | Optional. Without it the coach falls back to a rule-based report                                                |
| `ANTHROPIC_MODEL`              | server          | Defaults to `claude-sonnet-4-5-20250929`                                                                        |
| `VITE_API_URL`                 | client          | Only if the frontend and API routes live on different origins. Empty = same origin                              |

`VITE_*` values are inlined into the client bundle at build time, so they must be
present _before_ the build runs. Changing one later needs a rebuild, not just a
redeploy.

## Scheduler

`/api/cron/tick` is one idempotent pass over every linked user, so it does not
matter how often — or from how many sources — it is called. Per pass it can send the
morning brief (07:00–12:00), a pre-block reminder (0–15 minutes ahead), a nag for an
unlogged must-do, the evening check-in with its 0/25/50/75/100 buttons (from 21:00),
the weekly report (Sunday from 20:00), and any future-self letters that came due.
Each message reads the recipient's own clock preference. If a send fails, its
`notification_log` claim is deleted so the next tick retries.

Three ways to ping it, all supported at once:

1. **GitHub Actions** — [`.github/workflows/cron.yml`](.github/workflows/cron.yml),
   every 5 minutes. This is the one that gives you minute-level reminders. Needs
   `ORDO_APP_URL` and `CRON_SECRET` as repository secrets (_Settings → Secrets and
   variables → Actions_). GitHub only honours a workflow's `schedule:` from the
   **default branch**, so this stays dormant until the file is on `main`.
2. **Vercel Cron** — registered at build time by
   [`scripts/vercel-crons.mjs`](scripts/vercel-crons.mjs), which patches `crons`
   into `.vercel/output/config.json` (`0 7 * * *`). Vercel injects the
   `Authorization` header itself from the project's `CRON_SECRET`. Hobby plans allow
   one daily cron, which is why Actions carries the fine-grained schedule.
3. **Any external cron service:**

   ```sh
   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<your-app>/api/cron/tick
   ```

## Telegram bot

The bot is a webhook, not a long-poller — there is no process to keep alive.
Register it once per deployment:

```sh
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://<your-app>/api/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET" \
  -d 'allowed_updates=["message","callback_query"]'
```

Those are the only two update types the handler reads, so narrowing them keeps the
function from waking for edits and channel posts. `getWebhookInfo` confirms what
stuck.

To link an account: generate a code from the Telegram panel on the Today view, then
send `/link <code>` to the bot. Commands are `/start`, `/link`, `/today`, `/status`
and `/unlink`; the evening check-in's buttons write the completion percentage
straight back into `user_state`.

**A bot cannot open a conversation.** Until a person presses Start (or sends any
message) at `t.me/<your-bot>`, every `sendMessage` to them fails with
`400 chat not found`, cron reminders included. The webhook still answers `200`,
because a poison update must never be retried forever, so the failure is visible
only in the runtime logs as `[telegram] sendMessage failed`.

## Deploying to Vercel

Set the environment variables above on the project, then:

```sh
vercel link
vercel --prod
```

The build command is `bun run build` and the output is `.vercel/output` (Build
Output API v3), which Vercel detects without any `vercel.json`.

**If a deployment comes back `BLOCKED`:** on the Hobby plan Vercel refuses any
deployment whose tip commit was authored by someone other than the account owner,
and it reads that author from local git even for CLI deploys. Commit under the
owner's identity —

```sh
git config user.name  "<vercel-account-owner>"
git config user.email "<their-github-email>"
```

— which also means a branch whose tip is a foreign commit can still be landed by
merging with `--no-ff`, since the merge commit becomes the new tip. Failing that,
deploy the prebuilt output from a directory with no git metadata:

```sh
bun run build
mkdir -p /tmp/deploy/.vercel && cp -r .vercel/output .vercel/project.json /tmp/deploy/.vercel/
cd /tmp/deploy && vercel deploy --prebuilt --prod --archive=tgz
```
