# Ordo API server

Node.js + Express + PostgreSQL backend for Ordo, per the plan's architecture:
auth, per-user data isolation, Telegram bot, scheduler, and AI coach.

## Quick start

```sh
# 1. Postgres (docker) — or point DATABASE_URL at any Postgres 14+
docker run -d --name ordo-postgres \
  -e POSTGRES_PASSWORD=ordo_dev_pw -e POSTGRES_USER=ordo -e POSTGRES_DB=ordo \
  -p 5434:5432 -v ordo_pgdata:/var/lib/postgresql/data postgres:16

# 2. Install + run
npm install
cp .env.example .env   # fill in what you want to activate
npm run dev            # http://localhost:8787
```

Schema is created automatically on boot (`server/src/db/schema.sql`).

## What activates when (all env-gated)

| Feature | Env vars | Without them |
| --- | --- | --- |
| Email + password auth | — (always on) | — |
| Magic link | `SMTP_URL` (else code prints to console) | dev code shown in response |
| GitHub sign-in | `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` | button hidden |
| Google sign-in | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | button hidden |
| Telegram bot | `TELEGRAM_BOT_TOKEN` (+ `TELEGRAM_BOT_USERNAME`) | bot dormant |
| Slack channel | `SLACK_BOT_TOKEN` | adapter dormant |
| AI coach | `ANTHROPIC_API_KEY` | rule-based fallback |

## Endpoints

- `GET /api/health` — status + which capabilities are configured
- `POST /api/auth/signup|login|logout|magic|magic/verify`
- `GET|PUT|DELETE /api/state` — the user's Ordo document (per-user isolation)
- `GET /api/telegram/status`, `POST /api/telegram/link|unlink`
- `GET /api/slack/status`, `POST /api/slack/link|unlink`
- `GET /api/export/json|csv|ical`
- `GET /api/templates/public`, `POST /api/templates/publish`, `POST /api/templates/:id/copy`
- `GET /api/coach/weekly`, `GET /api/coach/catchup`
- `GET|POST /api/pairs`, `DELETE /api/pairs/:peerId` (accountability pairing)
- `GET|POST /api/challenges`, `POST /api/challenges/:id/join`, `GET /api/challenges/:id/leaderboard`
- `GET|POST /api/letters`, `DELETE /api/letters/:id` (future-self letters)
- `GET|POST /api/onboarding` (checklist progress)
- `GET /api/history`, `POST /api/state/undo`, `DELETE /api/account` (version history + GDPR delete)

## Scheduler

Cron jobs (node-cron, server-local time):

- every minute — 10-min pre-block reminders + unlogged must-do nags
- 07:00 — morning brief
- 21:00 — evening check-in with 0/25/50/75/100 inline buttons
- Sunday 20:00 — weekly report (Claude or rule-based)
