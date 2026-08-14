# Daily Orbit

do all at once [Ordo — Personal Accountability & Goal-Tracking System — Full Plan

1. Vision

A self-mentoring system: you define what you want to achieve at every time scale (year → semester → month → week → day → time-block), you log what actually happens, and the system holds you accountable — through hard data, charts, and nagging bots — instead of relying on motivation alone.

2. Core Concepts & Data Model

Entity	Description

User	One account, multiple connected notification channels (Telegram, Slack, email, push)

Life Domain / Category	Health, Study, Work, Finance, Relationships, Spiritual, etc. — every goal and task belongs to one, so you can see balance, not just total completion

Goal Period	Year → Semester → Month → Week → Day. Each period has a target (what you want to achieve) and can be linked to its parent period (a week's goal rolls up into the month's)

Routine Template	The "default" schedule for a normal day — a set of time-blocked activities. Can be different per weekday (Mon–Fri routine vs. weekend routine), and overridden entirely for a specific date

Task / Time Block	A single scheduled activity with start time, end time, category, linked goal, and a completion type: binary (done/not done) or percentage (partially done)

Progress Log	Immutable record of what actually happened each day — this is what all charts and streaks are computed from, never the plan itself

Streak / Habit Tracker	Consecutive days a specific recurring task was completed

Notification Rule	When and how you get pinged — before a task, when a task is missed, daily summary, weekly/monthly report

Reflection / Journal Entry	Optional free-text note attached to a day, week, or month — useful for the AI to generate better suggestions later

Key design point you already got right: the routine template and the actual daily log are separate objects. The template says what should happen; the log says what did happen. This is what makes tracking and catch-up logic possible.

3. Features — Organized by What You Asked For + What's Missing

A. Planning (what you described)

Set goals at year / semester / month / week / day level, each optionally linked to the level above

Define a default weekly routine (same schedule every day, or different per day)

Override any specific date with a custom schedule (holidays, travel, exam day)

Time-blocked daily schedule (start–end time per activity)

Duplicate / apply a schedule — take any day's schedule (including a special/override day) and:

copy it to one or more specific other days of the week

apply it across an entire week

apply it as the standing routine for a whole month

apply it across any custom date range (e.g. "this exact schedule from June 1 to Aug 30" for a semester)

This is really a small "template" object under the hood — a day's schedule can be saved as a named template and applied to any date/range, not just copied ad hoc. That also gives you the templates-library feature for free (Section F).

B. Tracking (what you described + gaps)

Mark tasks done / not done or partially done with a percentage — needed for tasks like "read 50 pages" where you read 30

Auto-rollup: a day's completion % automatically feeds into the week's, which feeds into the month's, which feeds into the year's — you see progress at every zoom level without manual re-entry

Missed-task "debt" tracking: when something is skipped, it doesn't just vanish — it's flagged and carried forward until resolved or explicitly dropped

Streaks: consecutive days a habit was kept, and longest streak ever (this is a strong psychological motivator you didn't mention but will want)

C. Visualization (what you described + gaps)

Completion-rate charts by day / week / month / semester / year

Heatmap calendar (like GitHub's contribution graph) — one glance shows your whole year's consistency

Category breakdown (are you crushing "Work" but ignoring "Health"?)

Trend line: are you improving or declining over the last N weeks?

D. Notifications (what you described + gaps)

Reminder before a task starts ("in 10 minutes: study")

Nag when a task's time passes and it's not marked done

Daily summary — morning ("here's today") and evening ("here's how today went")

Weekly / monthly report — sent automatically, no need to open the app

Multi-channel: Telegram first, Slack as a second option (both can share one internal "notification service" so adding Discord/email later is cheap)

Snooze / reschedule a task directly from the chat (reply to the bot instead of opening the app)

E. Catch-up & AI Suggestions (what you described + gaps)

When you fall behind, the system proposes a redistribution: e.g. "you missed 3 study sessions this week — here's how to fit them into the next 4 days without breaking your other commitments"

AI weekly/monthly review: a short generated reflection — what went well, what consistently gets skipped, one suggested adjustment for next week (this is closer to actual "mentoring" than a static % chart)

Pattern detection: "you complete 90% of morning tasks but only 40% of evening tasks — consider moving X earlier"

F. Features you didn't mention but will likely want

Journaling / notes per day — short reflection field; makes the AI suggestions much better

Priority levels on tasks (must-do vs. nice-to-have) so catch-up logic knows what to sacrifice first

Templates library — save a routine ("exam week schedule") and reuse it later instead of rebuilding

Google Calendar sync (optional) — so time blocks show up where you already look

Focus/Pomodoro timer built into a task — many people in "discipline system" apps ask for this eventually

Data export (CSV / PDF monthly report) — useful for genuine year-end review

Accountability sharing — optional: let a friend or mentor see your weekly % (you said you don't have a mentor yet — this future-proofs for when you do, or lets a friend fill that role)

Offline support on mobile — log completion without signal, sync later

Multi-timezone handling — only matters if you travel, but cheap to design in now, expensive to retrofit later

G. Multi-User Platform & Social Login

Turning this from "my personal tool" into "something other people sign up for" changes several decisions early, so it's worth locking in now rather than retrofitting later.

Social sign-in: Google and GitHub both have straightforward, standard OAuth login — easy to add via a library like NextAuth/Auth.js or Firebase Auth (one line of config each). Instagram is a real limitation: Instagram doesn't offer a general "Sign in with Instagram" for third-party apps the way Google/GitHub do — its API access is scoped to content/media permissions, not identity login. Apple and email/password (with magic link) are the more realistic third and fourth options if you want broader reach.

Per-user data isolation: every goal, template, and log row is scoped to a user_id — this is mostly a schema decision made once at the start, cheap now, painful to add later

Public/shareable templates: users can optionally publish a routine template ("Med Student Study Routine", "Marathon Training Plan") to a shared library others can browse and duplicate into their own account

Privacy controls: default everything private; user explicitly opts in to share a specific goal, streak, or weekly % with another named user (a friend, or a real mentor)

Accountability pairing: two users can link accounts so each sees the other's completion %, not the task details — lightweight peer accountability without full social-network exposure

Opt-in leaderboards / challenges: e.g. a 30-day challenge others can join, ranked by completion rate — strong engagement driver, but keep it opt-in since forced competition undermines the "personal mentor" feel

Plans/tiers: if this becomes public, decide early whether it's free, freemium (AI suggestions behind a paywall), or subscription — affects how much you invest in the AI-suggestion cost per user

Onboarding flow: a first-time wizard that walks a new user through setting their first weekly routine and first goal — the single biggest driver of whether a new signup actually sticks around

H. "Make It Amazing" — Standout Features

Motivation & engagement

Year-in-review report — an auto-generated, visual end-of-year (and end-of-month) summary: total completion %, best streak, most consistent category, biggest turnaround week — a "Spotify Wrapped" for your discipline

Points & levels, not just streaks — small dopamine loop for consistency, optional to disable if it feels gimmicky to you

"Future self" letter — write a note to yourself when you set a year/semester goal, sealed until that goal's deadline, delivered automatically via bot when it's reached

Milestone badges — 7-day streak, 30-day streak, "comeback" badge for recovering after a bad week (rewards resilience, not just perfection)

Smart / AI capabilities

Conversational daily check-in — instead of a flat "did you do X? yes/no" button, the Telegram bot can hold a short natural check-in ("How'd the study session go?" → you reply in your own words → it logs completion % and a note automatically)

Auto-build a first routine — describe your goals in plain language and let AI draft a starting weekly schedule you then tweak, instead of building it from a blank grid

Smart notification timing — learns when you actually respond/act on reminders and gradually shifts nudge times to your real patterns instead of a fixed clock time

Task dependencies — mark that Task B can't be started until Task A is done, useful for study plans or project-based goals

Integrations

Wearable/health sync (Apple Health / Google Fit) — auto-mark a workout task complete if it detects matching activity, removing manual logging friction for fitness goals

Calendar sync (already noted) plus weather-aware rescheduling for outdoor tasks

Webhook/API access — lets power users connect the tracker to Zapier/IFTTT for their own workflows

Productivity-tool sync (Notion, Linear, Asana) — Ordo becomes the accountability/scheduling layer on top of tools you already work in, instead of a fifth place to check:

Notion: two-way sync of a database — a Notion page/row can represent a goal or task; marking it done in Notion marks it done in Ordo and vice versa; daily/weekly logs can also be pushed to a Notion page as a running journal

Linear: pull assigned issues in as tasks on your daily schedule (e.g. "Linear issue ENG-123" shows up as a time-blocked task); completing the issue in Linear auto-completes it in Ordo — useful if your "work" category is really software work

Asana: same pattern — import Asana tasks with due dates directly into the relevant day/week, sync completion status both ways

Build this as one internal "Integration Adapter" interface (same pattern as the Notification Service) — each tool (Notion/Linear/Asana/others later) is just a plugin that maps their task object to Ordo's task object, so adding e.g. Jira or Trello later is cheap

Decide per-user which categories/projects sync automatically vs. which stay Ordo-only (you likely don't want every personal habit cluttering a work tool, or vice versa)

Personalization

Custom themes, and a daily motivational quote or an AI-generated one-line nudge tailored to your current streak/category struggles

Multi-language support if you want this to reach non-English speakers eventually

Reporting

Shareable progress cards (image export of a week/month's heatmap) — useful if you want to post accountability updates publicly or to a mentor/friend

Not all of these belong in Phase 1 — they're here so nothing gets lost, and you can pull individual ones forward whenever they fit a phase.

Advanced (further round — use selectively, not all at once)

Streak freeze — one "pass" per week/month that protects a streak from a single missed day without lying about it in the data (Duolingo-style; prevents one bad day from causing total motivation collapse)

Adaptive targets — AI notices if a goal is consistently too easy (100% for 3 weeks straight) or too hard (under 30% for 3 weeks) and proposes adjusting it, rather than letting you either coast or burn out

Coach persona setting — choose the tone of your check-ins and nags: strict/direct, gentle/encouraging, or neutral/data-only — since "mentor" tone matters a lot for whether nagging helps or annoys you

Cross-category correlation insights — e.g. "your study completion drops 40% on days you sleep under 6 hours" — turns raw logs into actual self-knowledge, not just a scoreboard

Commitment stakes (advanced, optional) — pledge a small real consequence (e.g. a note to a friend, or integration with a stakes service) if a goal is missed — genuinely increases follow-through for some people, but adds complexity and isn't for everyone

Accountability cohorts — small groups (not just 1:1 pairing) who see each other's weekly % and can nudge each other

iCal import/export — two-way sync with any calendar app, not just Google

Public shareable profile — optional page showing your streaks/badges, for people who want external accountability

A Note on Scope

You now have a genuinely complete feature backlog — planning hierarchy, tracking, charts, notifications, AI catch-up, duplication/templates, multi-user auth, and two rounds of "amazing" differentiators. That's easily 12+ months of feature work if built all at once.

The risk at this point isn't missing a good idea — it's that an ever-growing feature list becomes its own procrastination, which would be ironic for an app whose whole purpose is fighting procrastination. Every feature above is now captured in the plan, so nothing is lost by not building it yet.

My honest recommendation: pick 3–5 features from this entire document that matter most to you personally, lock those as your real Phase 1, and start building. Everything else stays in the backlog for later phases — it's already written down, so it can't be forgotten.

I. Reliability, Accessibility & Growth

Reliability & data safety

Version history / undo — recover an accidentally deleted goal or overwritten routine instead of losing it permanently

Real-time multi-device sync with conflict resolution — if you edit today's schedule on phone and web at the same time, define which change wins (last-write-wins is simplest to start)

Automatic backups and a documented restore process

Two-factor authentication for account security, especially once it's multi-user

GDPR-style data controls — full data export and full account deletion, needed the moment this has real users beyond you

Accessibility & usability

Screen-reader support and colorblind-safe chart palettes — charts (heatmaps especially) are the first thing to break for colorblind users if not designed carefully

Natural-language task entry — type "workout every day at 6am except Sunday" and have it parsed into a recurring schedule instead of clicking through a form

Onboarding checklist for first-time users (set first goal → build first routine → connect Telegram → done) with a visible progress bar for the onboarding itself

Guest/demo mode — let a new visitor try the app with sample data before creating an account, lowers signup friction

Access beyond the primary channel

SMS fallback notifications for moments without a reliable Telegram/internet connection

Location-based reminders (geofencing) — e.g. auto-nudge "log your gym session" when you arrive at the gym

Voice assistant shortcuts (Siri/Google Assistant) — "Hey Siri, mark my workout done" without opening the app

Growth & monetization (relevant once multi-user)

Referral system — invite a friend, both get a perk (e.g. AI suggestions unlocked for a period)

Mentor/coach marketplace — optional paid tier where real human coaches can view a client's dashboard and leave comments, turning the "I don't have a mentor yet" problem into a feature for other users too

Admin/support dashboard — needed once you have real users who hit bugs or need account help

Print-friendly weekly planner export — for people who still want a paper backup of their week

At this point the backlog spans every layer of a real product — core function, intelligence, growth, and operations. It's all captured in this document, so whenever you're ready to prioritize, nothing has to be reconstructed from memory.

4. Suggested Architecture

Layer	Recommendation	Why

Backend API	Node.js (Express or NestJS) or Python (FastAPI)	Either works well; NestJS/FastAPI give you structure as this grows

Database	PostgreSQL	Relational rollups (day→week→month→year) map naturally to SQL; also handles time-series progress logs well

Web frontend	Next.js + Tailwind	Fast to build, good charting ecosystem (Recharts/Chart.js)

Mobile app	React Native (Expo)	Share business logic/types with the web app; or start as a installable PWA to delay native app cost

Bot layer	A separate "Notification Service" that talks to Telegram Bot API and Slack API through one internal interface	Adding a new channel later = one new adapter, not a rewrite

Scheduler	Cron jobs or a queue (e.g., BullMQ/Celery)	Needed for "send reminder at 6:55am", "send weekly report every Sunday 8pm"

AI suggestions	Claude API call fed with: this week's plan, completion log, and any journal notes → returns redistribution plan + short reflection	Keep this as its own service so you can improve prompts without touching core app logic

Authentication	Auth.js (NextAuth) or Firebase Auth, with Google + GitHub + Apple + email-magic-link providers	Standard OAuth flows out of the box; avoids hand-rolling password storage/security

5. Suggested Build Order (Phased Roadmap)

Phase 1 — MVP (get you actually using it fast)

Auth: Google + GitHub sign-in from day one (cheap to add now, expensive to bolt on later)

Data model: goals (week/day only, skip year/semester for now), routine template, daily log, per-user isolation

Web app: create routine, duplicate a day's schedule to other days/a week/a month, mark tasks done/not done, simple weekly view

Telegram bot: daily reminder + evening "did you do X?" check-in

Basic weekly completion % chart

Phase 2 — Full hierarchy + richer tracking

Add month/semester/year goal levels with rollup

Partial completion (%) support

Heatmap calendar, category breakdown

Missed-task debt tracking

Named, reusable templates (save any schedule, apply to any future date range)

Phase 3 — Intelligence + polish

AI catch-up suggestions and weekly reflection

Slack channel support

Streaks, priority levels

Mobile app (React Native) once the web data model is stable

Phase 4 — Multi-user & community

Public template library, accountability pairing, opt-in leaderboards/challenges

Plan/tier decisions if opening to the public

Calendar sync, focus timer, data export

Starting at Phase 1 with just Telegram + a simple web view means you're actually using the system within days, not months — and every later phase builds on real usage data instead of guesses.

6. Open Decisions to Make Before Building

Do you want one single "life routine" or separate routines per category (e.g., a work routine and a personal routine tracked independently)?

For missed tasks — should the system auto-reschedule them, or always ask you to confirm first?

How strict should "partially done" be — free-form % entry, or fixed steps (25/50/75/100)?

Do you want the AI reflection to be purely observational, or should it be allowed to be blunt/critical in tone?]

## What's implemented (all phases)

**Phase 1 — MVP** ✅
- Email/password, magic-link, GitHub + Google OAuth sign-in (env-gated)
- Goals (year → day hierarchy), per-weekday routine templates, date overrides, daily log
- Duplicate a day to another day / every weekday / any date range; simple weekly view + chart
- Telegram bot: daily reminders, evening check-in with 0/25/50/75/100 buttons

**Phase 2 — Full hierarchy + richer tracking** ✅
- Month/semester/year goal levels with automatic rollup; partial completion (%)
- GitHub-style consistency heatmap, category breakdown, 3-week trend
- Missed-task debt tracking + named reusable templates

**Phase 3 — Intelligence + polish** ✅
- AI catch-up proposals + weekly reflection (Claude when `ANTHROPIC_API_KEY` is set, rule-based otherwise)
- Slack as a second notification channel (per-user channel link, shared adapter)
- Streaks (current + best), priority levels (must / nice)

**Phase 4 — Multi-user & community** ✅
- Public template library (publish, browse, copy)
- Accountability pairing (see a peer's weekly % only), opt-in challenges + leaderboards
- Focus timer, data export (JSON / CSV / iCal), onboarding checklist with progress bar

**Also shipped (Sections H & I)** ✅
- Year-in-review report, points, milestone badges, future-self letters (bot-delivered on deadline)
- Version history / undo (last 30 snapshots), full account deletion, guest/demo mode (localStorage)

## Development

The app is a TanStack Start (React + Tailwind) frontend plus a Node.js + Express + PostgreSQL backend (`server/`).

```sh
# 1. Postgres (docker)
docker run -d --name ordo-postgres \
  -e POSTGRES_PASSWORD=ordo_dev_pw -e POSTGRES_USER=ordo -e POSTGRES_DB=ordo \
  -p 5434:5432 -v ordo_pgdata:/var/lib/postgresql/data postgres:16

# 2. Backend (auth, bot, scheduler, AI coach)
cd server
npm i
cp .env.example .env   # optional: Telegram token, OAuth keys, Anthropic key
npm run dev            # http://localhost:8787

# 3. Frontend (in another terminal, from repo root)
bun install
bun run dev            # http://localhost:5173
```

Signed out, the app behaves exactly like the original Phase 1 (all data in
localStorage). Sign in and your data syncs per-user to Postgres, the Telegram
bot becomes available, and the coach report is generated server-side.

See [`server/README.md`](server/README.md) for the full backend docs.
