-- Ordo schema — per-user isolation from day one. Every row is scoped by user_id.

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT '',
  avatar_url    TEXT NOT NULL DEFAULT '',
  provider      TEXT NOT NULL DEFAULT 'local',           -- local | google | github
  password_hash TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,                            -- sha256 of the bearer token
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

-- The user's whole Ordo document (routine, overrides, templates, goals, log,
-- journal). Stored per user so charts and the bot read the same truth.
CREATE TABLE IF NOT EXISTS user_state (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS telegram_links (
  user_id   UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  chat_id   BIGINT NOT NULL,
  username  TEXT NOT NULL DEFAULT '',
  link_code TEXT UNIQUE NOT NULL DEFAULT '',
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-user Slack channel (Phase 3 second channel). The bot posts to this
-- channel using the shared SLACK_BOT_TOKEN.
CREATE TABLE IF NOT EXISTS slack_links (
  user_id   UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  channel   TEXT NOT NULL,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One-shot codes used to bind a Telegram chat to a web account.
CREATE TABLE IF NOT EXISTS telegram_codes (
  code       TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS telegram_codes_user_idx ON telegram_codes (user_id);

CREATE TABLE IF NOT EXISTS notification_rules (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type     TEXT NOT NULL,            -- pre_block | nag | morning | evening | weekly | monthly
  channel  TEXT NOT NULL DEFAULT 'telegram',  -- telegram | slack
  time     TEXT NOT NULL DEFAULT '', -- HH:MM local for scheduled types
  enabled  BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS notification_rules_user_idx ON notification_rules (user_id);

-- Published templates for the shared library (Phase 4). Copy-on-publish; the
-- source user's private copy stays untouched.
CREATE TABLE IF NOT EXISTS public_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT '',
  name       TEXT NOT NULL,
  blocks     JSONB NOT NULL,
  copies     INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS public_templates_created_idx ON public_templates (created_at DESC);

-- Accountability pairing (Phase 4): two users see each other's weekly %,
-- never task details. One row per pair, sorted lexicographically.
CREATE TABLE IF NOT EXISTS pairings (
  user_a   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)
);

-- Opt-in 30-day challenges (Phase 4), ranked by completion rate.
CREATE TABLE IF NOT EXISTS challenges (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  starts_on  DATE NOT NULL DEFAULT CURRENT_DATE,
  ends_on    DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenge_members (
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id)
);

-- "Future self" letter (Section H): sealed until the goal's deadline, then
-- delivered by the bot.
CREATE TABLE IF NOT EXISTS future_letters (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_title TEXT NOT NULL,
  body       TEXT NOT NULL,
  deadline   DATE NOT NULL,
  delivered  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS future_letters_due_idx ON future_letters (deadline) WHERE NOT delivered;

-- Version history / undo (Section I): last N snapshots per user, kept server-side.
ALTER TABLE user_state ADD COLUMN IF NOT EXISTS history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Onboarding checklist progress (Section I / G).
CREATE TABLE IF NOT EXISTS onboarding (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  goal_set   BOOLEAN NOT NULL DEFAULT false,
  routine_set BOOLEAN NOT NULL DEFAULT false,
  telegram_linked BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ
);
