# Ordo Challenge System — Technical Audit

> **DO NOT MODIFY ANY FILES.** This is an inspection-only report.

---

## 1. Current Architecture

The Ordo app is a full-stack application:
- **Frontend**: React (web) + Flutter (mobile), both sharing the same Supabase backend
- **Backend**: Supabase (PostgreSQL with RLS + SECURITY DEFINER RPCs)
- **Cron**: Vercel serverless function (`tick.server.ts`) invoked by GitHub Actions / Vercel cron / external cron service every 5 minutes

**Challenge data flow today:**
```
User saves Ordo document (routine/log changes)
  → save_state() in Supabase
    → refresh_daily_scores() for changed dates
      → day_facts() computes block_count, planned_minutes, completed_minutes, completion_pct
        → daily_scores (one row per user per day)

Challenge leaderboard reads:
  → challenge_scores(challenge_id, user_id)
    → completion_pct(user, start_at, end_at) reads daily_scores
      → returns completion, consistency, participation, score
  → challenge_leaderboard() reads challenge_scores() + challenge_members
    → returns top 5 + user's own row with rank, score, has_left, is_final
```

**Key architectural decision (already finalized):** `weekly_pct()` is ONLY for accountability pairing. Challenges must use a separate `completion_pct()` path that reads from `challenge_logs` (new table to be introduced).

---

## 2. Frontend Files

### Web (React)

| File | Component | Purpose | RPC Called | State | Props | Loading/Error |
|---|---|---|---|---|---|---|
| `src/components/ordo/CommunityView.tsx` | `CommunityView` | Main community page with pairing + challenges + settings | All challenge RPCs via `db.*` | `challenges`, `chName`, `chDays`, `chFloor`, `chCategory`, `chPrivate`, `createBusy`, `joinCode`, `codeBusy`, `openBoard`, `board`, `breakdown`, `boardBusy` | `user` from `useAuth()` | Try/catch with `toast.error()` |
| `src/lib/db.ts` | — | TypeScript API layer | All RPCs | — | — | Throws `dbError()` |

**Challenge Creation Form** (`CommunityView.tsx:210-238`):
- Inputs: `chName` (text), `chDays` (number, default 30), `chFloor` (number, default 30), `chCategory` (dropdown), `chPrivate` (toggle)
- Calls: `db.createChallenge({ name, category, startAt, endAt, visibility, minDailyMinutes })`
- `startAt = new Date()`, `endAt = startAt + max(1, chDays) * DAY_MS`
- Loading state: `createBusy` disables button, shows spinner
- Error handling: `toast.error(errMsg(err, "Could not create the challenge"))`

**Challenge Cards/List** (`CommunityView.tsx:561-718`):
- Renders `challenges.map((c) => ...)` 
- Each card shows: name, visibility lock, date range, member count, min/day, status badge, progress bar (if joined), action buttons
- `joinable = !c.joined && c.status !== 'completed' && c.status !== 'cancelled'`
- `isOwner && (status === 'upcoming' || status === 'active')` shows Cancel button

**Join Button** (`CommunityView.tsx:257-267`):
- Calls `db.joinChallenge(id)`
- Toast: "Joined. Rank is by score — nobody sees what your days contain."
- On success: `loadChallenges()`, `setOpenBoard(id)`, `void loadBoard(id)`
- Error: `toast.error(errMsg(err, "Could not join"))`

**Leave Button** (`CommunityView.tsx:269-279`):
- Calls `db.leaveChallenge(id)`
- Toast: "Left the challenge — your score so far stays ranked."
- On success: `loadChallenges()`, optionally `loadBoard(id)` if board is open
- Error: `toast.error(errMsg(err, "Could not leave"))`

**Leaderboard** (`CommunityView.tsx:179-197`):
- Calls `db.challengeLeaderboard(id)` and `db.challengeBreakdown(id)` in parallel
- `challengeBreakdown` uses `.catch(() => null)` so a non-member's 404 doesn't blank the leaderboard
- `boardBusy` state: shows spinner while loading
- Shows: rank #, name, score%, "(left)" tag, "You are #X of Y", breakdown percentages

**Join by Code** (`CommunityView.tsx:240-255`):
- Calls `db.joinChallengeByCode(joinCode.trim())`
- Returns challenge ID, then opens that challenge's board

**Cancel** (`CommunityView.tsx:281-289`):
- Calls `db.cancelChallenge(id)`
- Toast: "Cancelled. It will not be scored."

### Mobile (Flutter)

| File | Component/Function | Purpose | RPC Called | State | Loading/Error |
|---|---|---|---|---|---|
| `mobile/lib/screens/community_screen.dart` | `_CommunityScreenState` | Main community screen | All RPCs via `OrdoDb.*` | `_peers`, `_requests`, `_challenges`, `_loading` | `CircularProgressIndicator` while loading, `_toast()` for errors |
| `mobile/lib/screens/community_screen.dart` | `_ChallengeSectionState` | Challenge section (form + cards + leaderboard) | All RPCs via `OrdoDb.*` | `_nameCtrl`, `_daysCtrl`, `_floorCtrl`, `_codeCtrl`, `_category`, `_private`, `_createBusy`, `_codeBusy`, `_openBoardId`, `_board`, `_breakdown`, `_boardBusy` | `_createBusy`/`_codeBusy` spinners, `_toast()` for errors |
| `mobile/lib/services/db.dart` | `OrdoDb` class | Dart API layer | All RPCs | — | Returns `[]` or `null` on error (swallowed) |
| `mobile/lib/models/ordo_state.dart` | `Challenge` class | Challenge data model | — | `id`, `name`, `startsOn`, `endsOn`, `ownerId`, `members`, `joined` | — |
| `mobile/lib/services/categories_provider.dart` | `CategoriesProvider` | Category list for dropdown | None (local) | `_categories` (hardcoded built-ins) | — |

**Flutter `OrdoDb` challenge methods** (`mobile/lib/services/db.dart:71-166`):
- `listChallenges()` → `client.rpc('list_challenges')`, returns `[]` on error
- `createChallenge(name, days, {category, private, minDailyMinutes})` → computes `end = start + Duration(days: days < 2 ? 30 : days)`
- `joinChallenge(id)`, `joinChallengeByCode(code)`, `leaveChallenge(id)`, `cancelChallenge(id)` — all swallow errors
- `challengeLeaderboard(id)` — returns `{leaderboard: [], myRank: null, totalMembers: 0}` on error
- `challengeBreakdown(id)` — returns `null` on error

**Flutter Challenge Model** (`mobile/lib/models/ordo_state.dart:219-232`):
```dart
class Challenge {
  final String id;
  final String name;
  final String startsOn;
  final String endsOn;
  final String ownerId;
  final int members;
  final bool joined;
}
```
This is a **minimal model** — it does NOT include: `status`, `visibility`, `is_owner`, `day_index`, `total_days`, `my_score`, `invite_code`, `category`, `description`, `min_daily_minutes`, `max_participants`. The Flutter UI reads these from the raw `Map<String, dynamic>` returned by `listChallenges()`.

**Button conditions (Flutter, `community_screen.dart:552-563`)**:
```dart
final joinable = !joined && status != 'completed' && status != 'cancelled';
if (isOwner && (status == 'upcoming' || status == 'active')) // Cancel button
```

---

## 3. RPC Inventory

### 9 Challenge RPCs

| # | Function | SQL File | Parameters | Return Type | Tables Read | Tables Modified | SEC DEF | auth.uid() | Frontend Caller | Needs Modification |
|---|----------|----------|------------|-------------|-------------|-----------------|---------|------------|-----------------|-------------------|
| 1 | `create_challenge` | `0006` §7 | `p_name, p_category, p_description, p_start_at, p_end_at, p_visibility, p_max_participants, p_min_daily_minutes` | `public.challenges` | `challenges`, `challenge_members`, `challenge_invites` | `challenges`, `challenge_members`, `challenge_invites` | Yes | Yes | `createChallenge()` both clients | **YES** — must create `challenge_routines` |
| 2 | `join_challenge` | `0006` §7 | `p_challenge uuid` | `void` | `challenges`, `challenge_members` | `challenge_members` | Yes | Yes | `joinChallenge()` both clients | **YES** — must initialize `challenge_logs`, set `locked_at` |
| 3 | `join_challenge_by_code` | `0006` §7 | `p_code text` | `uuid` | `challenge_invites`, `challenges` | `challenge_members` (via `challenge_join_internal`) | Yes | Yes | `joinChallengeByCode()` both clients | **YES** — same as join |
| 4 | `leave_challenge` | `0006` §7 | `p_challenge uuid` | `void` | `challenge_members` | `challenge_members` (set status='left', left_at) | Yes | Yes | `leaveChallenge()` both clients | **NO** — current behavior is correct |
| 5 | `cancel_challenge` | `0006` §7 | `p_challenge uuid` | `void` | `challenges` | `challenges` (set cancelled_at) | Yes | Yes | `cancelChallenge()` both clients | **NO** — current behavior is correct |
| 6 | `list_challenges` | `0006` §8 | none | table (id, owner_id, name, category, ..., status, members, joined, is_owner, day_index, total_days, my_score, invite_code) | `challenges`, `challenge_members`, `challenge_invites` | none | Yes (stable) | Yes | `listChallenges()` both clients | **YES** — may add `challenge_routines` columns |
| 7 | `get_challenge` | `0006` §8 | `p_challenge uuid` | table (challenge base fields) | `challenges`, `challenge_members`, `challenge_invites` | none | Yes (stable) | Yes | `getChallenge()` web only | **YES** — may add `challenge_routines` |
| 8 | `get_challenge_leaderboard` | `0006` §8 | `p_challenge uuid` | table (user_id, name, score, rank, is_me, has_left, is_final, total_members) | `challenge_members`, `challenge_scores()`, `profiles` | none | Yes (stable) | Yes | `challengeLeaderboard()` both clients | **YES** — scoring source changes to `challenge_logs` |
| 9 | `get_challenge_breakdown` | `0006` §8 | `p_challenge uuid` | table (window_days, active_days, completion, consistency, participation, score, is_final, final_rank) | `challenge_members`, `challenge_scores()` | none | Yes (stable) | Yes | `challengeBreakdown()` both clients | **YES** — scoring source changes to `challenge_logs` |

### Additional Challenge-Adjacent Functions

| Function | SQL File | Purpose | Needs Modification |
|---|---|---|---|
| `challenge_join_internal` | `0006` §7 | Internal join logic (not client-callable) | **YES** — must initialize `challenge_logs` and set `locked_at` |
| `challenge_scores` | `0006` §6 | Computes completion/consistency/participation/score | **YES** — source changes from `daily_scores` to `challenge_logs` |
| `completion_pct` | `0006` §6 | Global completion over date range (reads `daily_scores`) | **YES** — this is what `challenge_scores()` calls; needs a challenge-specific variant |
| `challenge_status` | `0006` §6 | Derives status from dates | **NO** — still correct |
| `challenge_members_freeze` | `0006` §9 | Trigger preventing score mutation after finalization | **NO** — still correct |
| `finalize_challenges` | `0006` §9 | Cron scoring pass | **YES** — must use `challenge_logs` instead of `challenge_scores()` |
| `refresh_daily_scores` | `0006` §5 | Refreshes `daily_scores` for dates | **NO** — stays for global activity |
| `day_facts` | `0006` §5 | Computes block facts from user_state | **NO** — stays for global activity |
| `block_minutes` | `0006` §5 | Converts HH:MM to minutes | **NO** — reusable utility |

### Legacy Shim Functions

| Function | SQL File | Purpose |
|---|---|---|
| `unpair(p_peer uuid)` | `0006` §11 | Calls `unpair_user()` — Flutter legacy |
| `create_challenge(p_name text, p_days integer)` | `0006` §11 | Legacy 2-arg create, delegates to full `create_challenge()` |
| `challenge_leaderboard(p_challenge uuid)` | `0006` §11 | Legacy leaderboard shape, delegates to `get_challenge_leaderboard()` |

---

## 4. Database Schema

### Existing Tables (from `0001_init.sql`, `0006_pairing_challenges_repair.sql`)

#### `public.challenges`
```
id               uuid PK default gen_random_uuid()
owner_id         uuid FK auth.users (id) ON DELETE CASCADE
name             text
category         text default 'general'
description      text default ''
start_at         timestamptz default now()
end_at           timestamptz
visibility       text check ('public','private') default 'public'
min_daily_minutes integer NOT NULL default 30 check (5-720)
max_participants integer NULL
cancelled_at     timestamptz NULL
finalized_at     timestamptz NULL
updated_at       timestamptz NOT NULL default now()
```
**No `status` column** (removed in 0006; derived from dates via `challenge_status()`).
**Constraints**: `end_at > start_at`, `min_daily_minutes BETWEEN 5 AND 720`.
**RLS**: `challenges: read visible` — select where `visibility='public' OR owner_id=auth.uid() OR EXISTS (challenge_members WHERE user_id=auth.uid())`. Delete revoked from authenticated. Insert only owner.
**Indexes**: none explicit for challenge queries (relies on PK + RLS).

#### `public.challenge_members`
```
id             uuid PK default gen_random_uuid()
challenge_id   uuid FK challenges (id) ON DELETE CASCADE
user_id        uuid FK auth.users (id) ON DELETE CASCADE
joined_at      timestamptz NOT NULL default now()
left_at        timestamptz NULL
status         text check ('active','left','removed') default 'active'
final_score    numeric NULL
final_rank     integer NULL
created_at     timestamptz NOT NULL default now()
```
**Unique constraint**: `challenge_members_uk` on `(challenge_id, user_id)`.
**RLS**: `challenge_members: read own` — select where `user_id = auth.uid()`. All columns revoked from authenticated except grant to service_role. **No insert/delete for authenticated** (handled by RPCs).
**Trigger**: `challenge_members_freeze_tg` — before update, prevents changing `final_score`, `final_rank`, `joined_at` once `final_score` is set.

#### `public.challenge_invites`
```
challenge_id   uuid PK FK challenges (id) ON DELETE CASCADE
code           text NOT NULL UNIQUE
created_at     timestamptz NOT NULL default now()
```
**RLS**: Enabled, **NO policies** — only accessible via SECURITY DEFINER RPCs. All privileges revoked from anon/authenticated, granted to service_role.

#### `public.daily_scores`
```
user_id           uuid NOT NULL FK auth.users (id) ON DELETE CASCADE
date              date NOT NULL
block_count       integer NOT NULL default 0
planned_minutes   integer NOT NULL default 0
completed_minutes integer NOT NULL default 0
completion_pct    numeric(5,2) NOT NULL default 0
updated_at        timestamptz NOT NULL default now()
```
**PK**: `(user_id, date)`.
**RLS**: Enabled, **NO policies** for authenticated. Revoked from anon/authenticated, granted to service_role. Only written by `save_state()` via SECURITY DEFINER.

#### `public.user_state`
```
user_id    uuid PK FK auth.users (id) ON DELETE CASCADE
state      jsonb NOT NULL default '{}'
history    jsonb NOT NULL default '[]'
updated_at timestamptz NOT NULL default now()
```
**RLS**: `for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())`. Only the owner can read/write their own state.

#### `public.profiles`
```
id         uuid PK FK auth.users (id) ON DELETE CASCADE
email      text NOT NULL default ''
name       text NOT NULL default ''
avatar_url text NOT NULL default ''
provider   text NOT NULL default 'email'
created_at timestamptz NOT NULL default now()
role       text check ('user','admin') default 'user'
```

#### `public.app_categories`
```
id     text PK
label  text
color  text
icon   text
sort   integer
```
Admin-managed. Client reads via `listCategories()` RPC. Built-in categories: `health`, `study`, `work`, `finance`, `spiritual`, `relationships`.

#### `public.pairing_requests`
```
id            uuid PK
requester_id  uuid FK auth.users (id)
target_email  text
target_id     uuid FK auth.users (id) (added in 0006)
status        text check ('pending','accepted','declined')
created_at    timestamptz
responded_at  timestamptz
expires_at    timestamptz
```
**RLS**: Enabled, **NO policies**. Only accessible via RPCs.

### Existing RLS/Grants Summary

| Table | RLS | Authenticated | Service Role |
|---|---|---|---|
| `challenges` | Yes | Select (read visible policy) | All |
| `challenge_members` | Yes | Select own | All |
| `challenge_invites` | Yes | None (no policies) | All |
| `daily_scores` | Yes | None (no policies) | All |
| `pairing_requests` | Yes | None (no policies) | All |
| `user_state` | Yes | Own row | — |
| `profiles` | Yes | Own + select | — |

---

## 5. save_state() Pipeline

### Exact Flow

**Trigger**: User saves their Ordo document (any change to routine, overrides, log, journal, goals).

**Frontend → Server**:
1. Client calls `saveState(state)` → `sb().rpc("save_state", { p_state: state })`
2. Server calls `public.save_state(p_state)` — a SECURITY DEFINER function

**Inside `save_state()`** (`0006` migration):

```
1. auth.uid() check
2. Read v_prev (previous state) and v_hist (history) from user_state FOR UPDATE
3. If p_state == v_prev: just update updated_at, return
4. Otherwise:
   a. Push v_prev to history (cap 30 entries)
   b. Update user_state with new p_state, history, redo='[]'
5. Determine changed dates:
   - If routine changed: refresh_daily_scores(v_uid, current_date - 180, current_date)
   - Otherwise: use changed_date_keys(v_prev->'log', p_state->'log') UNION changed_date_keys(v_prev->'overrides', p_state->'overrides')
     → array of dates that actually changed
6. Call refresh_daily_scores(v_uid, v_days) for the changed dates only
```

**Inside `refresh_daily_scores(p_user, p_days)`**:
```
1. Select state from user_state
2. Delete existing daily_scores for p_user where date = any(p_days)
3. For each date d in p_days:
   a. Call day_facts(v_state, d)
   b. day_facts reads:
      - state.overrides[d] if exists, else state.routine[dow]
      - state.log[d] for completion percentages per block
   c. Computes: block_count, planned_minutes (sum of block durations), completed_minutes (sum of block_duration * pct/100), completion_pct (avg of block percentages)
   d. Insert into daily_scores (upsert)
4. Return row count
```

**Inside `changed_date_keys(p_old, p_new)`**:
```
Returns setof date where:
- Keys in p_old vs p_new differ
- Key matches regex '^\d{4}-\d{2}-\d{2}$'
- (coalesce(p_old, '{}') -> key) is distinct from (coalesce(p_new, '{}') -> key)
```

**Key functions and signatures:**
- `save_state(p_state jsonb) returns void` — SECURITY DEFINER, writes to `user_state`, calls `refresh_daily_scores`
- `refresh_daily_scores(p_user uuid, p_days date[]) returns integer` — SECURITY DEFINER, writes to `daily_scores`
- `refresh_daily_scores(p_user uuid, p_from date, p_to date) returns integer` — SQL wrapper calling the array version
- `changed_date_keys(p_old jsonb, p_new jsonb) returns setof date` — immutable, no auth check needed
- `day_facts(p_state jsonb, p_day date) returns (block_count, planned_minutes, completed_minutes, completion_pct)` — immutable, reads state JSON
- `block_minutes(p_start text, p_end text) returns integer` — immutable

**Transaction boundaries**: Each `save_state()` call is a single transaction. The `FOR UPDATE` lock on `user_state` ensures no concurrent saves collide.

**Safest insertion point for challenge-log generation**: After step 5 (determine changed dates) and before/within step 6 (refresh_daily_scores). The changed dates and the user's state are already available. The insertion would:
```sql
-- After refresh_daily_scores for changed dates
-- For each active challenge the user is a member of:
--   For each changed date:
--     Get challenge_routines.routine for that challenge
--     Match user's actual blocks (from state.log[date]) against challenge routine blocks
--     UPSERT into challenge_logs
```

---

## 6. daily_scores Pipeline

### What one row represents

`daily_scores` is **one row per user per date**. It does NOT have a `challenge_id` column. It captures **global** activity regardless of challenge.

### How planned work is calculated

From `day_facts()`:
- `planned_minutes` = sum of `block_minutes(start, end)` for all blocks in the day's routine (or overrides)
- Block duration = `((extract(epoch from end_time) - extract(epoch from start_time)) / 60 + 1440) % 1440` — handles midnight-crossing blocks

### How completed work is calculated

- `completed_minutes` = sum of `block_minutes(start, end) * completion_pct / 100` for each block
- The completion percentage comes from `state.log[date][block_id]` (a 0–100 number the user sets)
- If no log entry exists for a block, the block contributes 0 to completed_minutes

### How completion percentage is calculated

- `completion_pct` = average of all block percentages for the day (rounded to 2 decimal places)
- If no blocks exist: 0

### Category information

**Not retained in `daily_scores`**. The `block_count`, `planned_minutes`, `completed_minutes`, `completion_pct` columns are aggregates. Individual block information (including category) is lost after `day_facts()` computes the daily aggregate.

### Why this causes the category problem

**Scenario**: Challenge = "30 Days of Study" (category = study, floor = 30 min)

User's global routine:
- Monday: Gym (work, 60 min), Study (study, 60 min), Work (work, 60 min)

User logs: Gym 100%, Study 0%, Work 100%

`daily_scores` for that Monday:
- `block_count = 3`, `planned_minutes = 180`, `completed_minutes = 120`, `completion_pct = 66.67`

`challenge_scores()` reads this row and computes:
- `completion = 66.67` (includes Gym and Work activity)
- `consistency`: `completed_minutes (120) >= floor (30)` → counts as a "floor day"
- `participation`: `completed_minutes (120) > 0` → counts as a "busy day"

**Result**: The Study challenge gets scored 66.67% even though the user completed 0% of study activity. The Gym and Work blocks incorrectly contribute to the challenge score because `daily_scores` doesn't separate activity by category or challenge.

---

## 7. Current Challenge Creation

### Flow

```
Create Challenge Form (CommunityView / _ChallengeSectionState)
  → validate name non-empty
  → set createBusy = true
  → compute startAt = now(), endAt = now() + days
  → db.createChallenge({ name, category, startAt, endAt, visibility, minDailyMinutes })
    → RPC: create_challenge(p_name, p_category, p_description, p_start_at, p_end_at, p_visibility, p_max_participants, p_min_daily_minutes)
      → VALIDATE: name non-empty and ≤80 chars, visibility in ('public','private'), end > start, end ≤ start+365 days, max_participants ≥ 2 if set, floor 5-720, category exists in app_categories or is built-in
      → INSERT into challenges (owner_id, name, category, description, start_at, end_at, visibility, max_participants, min_daily_minutes, updated_at)
      → INSERT into challenge_members (challenge_id, user_id) ON CONFLICT DO NOTHING
      → If private: generate 8-char invite code, INSERT into challenge_invites
      → RETURN challenges row
```

### Fields the creator currently supplies

1. **Name** (text, max 80 chars) — e.g., "30 days of study"
2. **Category** (dropdown) — one of 6 built-ins + any admin-created categories
3. **Visibility** (toggle) — "Public" or "Invite code only"
4. **Days** (number, default 30) — used to compute `end_at`
5. **Min/day** (number, default 30) — `min_daily_minutes` floor

### How category is represented

- `category` column on `challenges` is `text`
- Values: `'general'`, `'health'`, `'study'`, `'work'`, `'finance'`, `'spiritual'`, `'relationships'`, or any custom category from `app_categories`
- **Not enforced as enum** — validated in PL/pgSQL `IF` statement

### How duration is stored

- `start_at` = `now()` (client sends `DateTime.now().toUtc().toIso8601String()`)
- `end_at` = `start_at + Duration(days: days)` (client computes)
- Server falls back: `v_end := coalesce(p_end_at, v_start + interval '30 days')`

### How recurring days are represented

**They are NOT represented in challenge creation.** The challenge only has `start_at` and `end_at` dates. There is no per-day routine definition in the challenge create form. The challenge routine doesn't exist yet.

### Time blocks

**Do NOT exist in the create form.** The create form has: name, category, visibility, days, min/day. There is no block editor. Time blocks are only defined in the user's global `OrdoState.routine`.

### Default routine generation

**Not implemented.** `create_challenge()` does not create a `challenge_routines` entry. This must be added.

---

## 8. Current Challenge Join

### Flow

```
Join Button (CommunityView / _ChallengeSectionState)
  → db.joinChallenge(challengeId) or db.joinChallengeByCode(code)
    → RPC: join_challenge(p_challenge) or join_challenge_by_code(p_code)
      → Calls challenge_join_internal(p_challenge, false/true)
        → VALIDATE: auth.uid() not null, challenge exists, not cancelled, not finished
        → VALIDATE: if private and not p_private_ok → reject
        → VALIDATE: joining window not closed (start + max(1 day, 20% of window))
        → VALIDATE: not already a member (status='active')
        → VALIDATE: not removed
        → VALIDATE: not full (if max_participants set)
        → INSERT/UPDATE challenge_members (ON CONFLICT DO UPDATE: set status='active', left_at=NULL, joined_at=LEAST(original, now()))
        → Returns
```

### What currently happens on join

1. Validates challenge and membership rules
2. Inserts or updates `challenge_members` row (status='active', joined_at=now() or preserved on rejoin)
3. **Nothing else** — no `challenge_logs` rows are created, no `locked_at` is set

### What needs to happen in new implementation

1. Same validations
2. Insert/update `challenge_members`
3. **Initialize `challenge_logs` rows** for each day of the challenge window, one per routine block
4. **Set `locked_at`** on `challenge_routines` if this is the first member
5. Return challenge/member state

---

## 9. Current Challenge Scoring

### Completion Calculation

**Function**: `public.completion_pct(p_user uuid, p_start_at timestamptz, p_end_at timestamptz)`
```sql
SELECT coalesce(round(avg(ds.completion_pct), 2), 0)
FROM public.daily_scores ds
WHERE ds.user_id = p_user
  AND ds.date BETWEEN p_start_at::date AND least(p_end_at::date, current_date)
```
**Reads from `daily_scores`** — all activity, no category filter.

### Consistency Calculation

**Inside `challenge_scores()`**:
```sql
count(ds.date) filter (where ds.completed_minutes >= w.floor_min) as floor_days
```
Then: `round(100.0 * floor_days / nullif(days, 0), 1)`
**Tests `completed_minutes >= min_daily_minutes`** — not planned minutes.

### Participation Calculation

**Inside `challenge_scores()`**:
```sql
count(ds.date) filter (where ds.completed_minutes > 0) as busy_days
```
Then: `round(100.0 * busy_days / nullif(days, 0), 1)`
**Tests `completed_minutes > 0`** — any activity at all.

### Final Score Formula

**Inside `challenge_scores()`**:
```sql
round(0.70 * (sum_pct / nullif(days, 0))
    + 0.20 * (100.0 * floor_days / nullif(days, 0))
    + 0.10 * (100.0 * busy_days / nullif(days, 0)), 1)
```

### Null/Zero/Division-by-Zero Handling

- `nullif(days, 0)` prevents division by zero
- If `days = 0` (window hasn't opened): `completion`, `consistency`, `participation` are all `null`
- `coalesce(m.final_score, agg.score, 0)` in leaderboard — falls back to 0 if nothing scored
- `challenge_score()` returns `coalesce(v_score, 0)`

### Rounding Behavior

- `completion_pct` in `daily_scores`: `numeric(5,2)` — 2 decimal places
- `completion` in `challenge_scores()`: `round(agg.sum_pct / nullif(agg.days, 0), 1)` — 1 decimal place
- `consistency`, `participation`: `round(100.0 * ..., 1)` — 1 decimal place
- Final `score`: `round(..., 1)` — 1 decimal place
- `weekly_pct`: `round(avg(ds.completion_pct))::integer` — rounded to integer

### Date Boundaries

- `from_d = max(challenge.start_at::date, member.joined_at::date)`
- `to_d = min(challenge.end_at::date, current_date, coalesce(member.left_at::date, 'infinity'))`
- `window_days = (to_d - from_d) + 1`
- `daily_scores` filtered by `ds.date BETWEEN w.from_d AND w.to_d`

### Timezone Handling

**Minimal**. `tick.server.ts` runs in UTC with an optional `ORDO_TZ_OFFSET_MINUTES` offset. `current_date` in PostgreSQL uses the server timezone. `daily_scores.date` is a `date` type (no timezone). This means daily_scores boundaries depend on the server timezone, not the user's local timezone.

---

## 10. Finalization/Cron

### Where it lives

`src/lib/server/tick.server.ts` — the `runTick()` function.

### How it's invoked

Three pingers call `/api/cron/tick`:
- GitHub Actions every 5 minutes
- Vercel's daily cron
- Any external cron service

### How it detects expired challenges

Inside `finalize_challenges()` (PL/pgSQL, SECURITY DEFINER):
```sql
SELECT c.id, c.start_at, c.end_at, c.cancelled_at
FROM public.challenges c
WHERE c.end_at < now() AND c.finalized_at IS NULL
ORDER BY c.end_at
LIMIT 200
FOR UPDATE SKIP LOCKED
```

### What it does for each challenge

**If not cancelled**:
1. For each member: call `refresh_daily_scores(user_id, start_at::date, end_at::date)` to backfill any missing days
2. Compute final scores using `challenge_scores(challenge_id)` — which reads `daily_scores`
3. Update `challenge_members`: set `final_score` and `final_rank` (where `final_score IS NULL`)
4. Set `challenges.finalized_at = now()`

**If cancelled**: Set `finalized_at = now()`, leave `final_score` null.

### Idempotency

Yes. The `WHERE finalized_at IS NULL` predicate ensures a second run finds nothing. The `AND final_score IS NULL` condition on the update ensures rows aren't overwritten. The `FOR UPDATE SKIP LOCKED` prevents concurrent ticks from double-scoring.

### What must change for new architecture

- `finalize_challenges()` currently calls `challenge_scores()` which reads `daily_scores`
- Must be updated to read from `challenge_logs` instead
- `challenge_scores()` must be replaced or a new function must be created that reads `challenge_logs`
- The freeze trigger (`challenge_members_freeze_tg`) remains unchanged

---

## 11. Existing Routine/Block Model

### Does a challenge-specific routine exist?

**No.** There is no `challenge_routines` table. The only routine model is the user's global `OrdoState.routine`.

### Global routine structure

**Client-side** (`src/lib/ordo.ts`):
```typescript
type OrdoState = {
  routine: Record<number, Block[]>;  // 0=Sunday..6=Saturday
  overrides: Record<string, Block[]>; // dateKey -> blocks
  log: Record<string, Record<string, number>>; // dateKey -> blockId -> completion%
  goals: Goal[];
  // ...
}
```

**Block structure**:
```typescript
type Block = {
  id: string;
  title: string;
  start: string;  // HH:MM
  end: string;
  category: CategoryId;
  priority: "must" | "nice";
  goalId?: string;
}
```

**Server-side** (`src/lib/server/state.server.ts`):
```typescript
type ServerBlock = {
  id: string;
  title: string;
  start: string;
  end: string;
  category: string;
  priority?: string;
}
```

**Database**: Routines are stored as JSONB inside `user_state.state` — no separate routine table. `routine` is a `Record<number, Block[]>` keyed by day-of-week (0–6).

### What must be introduced for `challenge_routines`

A new table `public.challenge_routines`:
- `challenge_id` (UUID, PK, FK to challenges)
- `routine` (JSONB, same structure as OrdoState.routine)
- `locked_at` (timestamptz, NULL until first member joins)
- `created_at` (timestamptz)

And `challenge_routines` blocks must have the same fields as `Block`: `id`, `title`, `start`, `end`, `category`, `priority`.

---

## 12. Required Challenge Routine Model

**Table**: `public.challenge_routines`
```sql
CREATE TABLE public.challenge_routines (
  challenge_id  uuid PRIMARY KEY REFERENCES public.challenges(id) ON DELETE CASCADE,
  routine       jsonb NOT NULL,  -- same structure as OrdoState.routine: Record<number, Block[]>
  locked_at     timestamptz NULL,  -- set when first member joins
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

**RLS**: Enabled. SELECT/INSERT/UPDATE: `challenge_id IN (SELECT id FROM public.challenges WHERE owner_id = auth.uid())` for creator. After lock, no updates.

**Grant**: service_role all; authenticated select own via function.

**How routine blocks are stored**: Same JSONB structure as `OrdoState.routine`. Each block has `{id, title, start, end, category, priority}`.

---

## 13. Required Challenge Log Model

**Table**: `public.challenge_logs`
```sql
CREATE TABLE public.challenge_logs (
  challenge_id     uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  member_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date             date NOT NULL,
  routine_block_id text NOT NULL,     -- the ID of the matching block in challenge_routines.routine
  source_block_id  text,               -- the ID of the user's actual block (from their global routine/overrides)
  planned_minutes  integer NOT NULL,   -- from the challenge routine block
  completed_minutes numeric NOT NULL,  -- from the user's actual block
  completion_pct   numeric NOT NULL,   -- computed: completed_minutes / planned_minutes * 100
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, member_id, date, routine_block_id)
);
```

**Indexes**: `(challenge_id, date)`, `(member_id, challenge_id, date)`.

**RLS**: Enabled. SELECT: member or owner. INSERT/UPDATE: member for own rows only. DELETE: not allowed (append-only after finalization).

**Append-only after finalization**: Enforced by trigger or application logic. The `challenge_members_freeze_tg` trigger on `challenge_members` doesn't cover `challenge_logs` — a new trigger or policy is needed.

---

## 14. Block Matching Feasibility

### Existing fields available for matching

From user's global routine/overrides (`user_state.state`):
- `block.category` (text)
- `block.start` (HH:MM string)
- `block.end` (HH:MM string)
- `block.id` (text)
- `block.title` (text)
- `block.priority` ("must" | "nice")

From challenge routine (`challenge_routines.routine`):
- Same fields as above

### Matching rule implementation

The rule `category match + >=50% time overlap + largest overlap wins` can be implemented:

**In PL/pgSQL** (inside the `save_state()` modification or a helper function):
1. For each changed date, get the user's blocks from `state.overrides[date]` or `state.routine[dow]`
2. Get the challenge routine blocks for that day-of-week from `challenge_routines.routine`
3. For each user block, compute overlap with each challenge routine block:
   - `overlap = max(0, min(end1, end2) - max(start1, start2))` (in minutes)
   - `total_block_time = max(end1, end2) - min(start1, start2)` (in minutes)
   - `overlap_pct = overlap / total_block_time * 100` (if total_block_time > 0)
4. Match if `category1 = category2 AND overlap_pct >= 50`
5. If multiple matches, pick the one with largest `overlap_pct`

### Edge case coverage

| Edge case | Existing fields | Relevant |
|---|---|---|
| Exact match | category, start, end | ✅ |
| Partial overlap (>50%) | start, end | ✅ |
| Renamed block | category (not title) | ✅ |
| Moved block | start, end | ✅ |
| Duplicated block | id, category, start, end | ✅ |
| Deleted block | No blocks on that day | ✅ (no log row) |
| Overlapping blocks | Multiple blocks same category | ✅ |
| Midnight-crossing | `block_minutes()` handles this | ✅ |
| Block at 50% | `completion_pct` from log | ✅ |
| Block at 0% | `completion_pct = 0` | ✅ |
| Blocks created after challenge start | `changed_date_keys()` detects new blocks | ✅ |

### Gaps

**UNKNOWN**: The existing schema has no stored function that computes time overlap between two blocks. `block_minutes()` converts a single block to minutes but doesn't compute overlap between two blocks. This will need a new helper function or inline PL/pgSQL logic.

---

## 15. RLS and Security

### `challenge_routines`

| Operation | Who | Policy |
|---|---|---|
| SELECT | Creator only | `challenge_id = ANY(challenges WHERE owner_id = auth.uid())` |
| INSERT | Creator only | Same as SELECT + challenge just created |
| UPDATE | Creator only, before first member joins | `locked_at IS NULL` + owner check |
| DELETE | Never (CASCADE via challenges delete) | Revoked |

**Implementation**: Use a SECURITY DEFINER function for reads/writes. Direct table access should be revoked from authenticated.

### `challenge_logs`

| Operation | Who | Policy |
|---|---|---|
| SELECT | Member or creator | `(user_id = auth.uid() OR challenge.owner_id = auth.uid())` |
| INSERT | Member only | Must be active member of challenge AND challenge is active AND date within window |
| UPDATE | Member for own rows only | `user_id = auth.uid()` AND challenge not finalized |
| DELETE | Never | Revoked |

**Implementation**: Use SECURITY DEFINER RPCs for all writes. Direct table access revoked from authenticated. service_role granted all.

**Critical prevention**:
- A user must not write another user's challenge logs → check `challenge_members WHERE user_id = auth.uid() AND status = 'active'`
- A user must not modify logs for a finalized challenge → check `challenges.finalized_at IS NULL`
- A user must not modify a locked challenge routine → check `challenge_routines.locked_at IS NULL`

---

## 16. TypeScript Impact

### Existing Types

**`src/lib/db.ts`**:
```typescript
type ChallengeBase = { id, owner_id, name, category, description, start_at, end_at, status, visibility, min_daily_minutes, max_participants, members, joined, is_owner, invite_code }
type Challenge = ChallengeBase & { day_index, total_days, my_score }
type BoardRow = { user_id, name, score, rank, is_me, has_left, is_final, total_members }
type ChallengeBreakdown = { window_days, active_days, completion, consistency, participation, score, is_final, final_rank }
```

**`mobile/lib/models/ordo_state.dart`**:
```dart
class Challenge { id, name, startsOn, endsOn, ownerId, members, joined }
```

### Types that must change

| File | Type | Changes |
|---|---|---|
| `src/lib/db.ts` | `Challenge` | Add `challenge_routine_id`? |
| `src/lib/db.ts` | `ChallengeBase` | Add `locked_at`? |
| `src/lib/db.ts` | New type | `ChallengeRoutine` |
| `src/lib/db.ts` | New type | `ChallengeLog` |
| `mobile/lib/models/ordo_state.dart` | `Challenge` | Add `locked_at`, `category`, `min_daily_minutes`, etc. |
| Both clients | `listChallenges` return | May include `challenge_routine` info |
| Both clients | `challengeLeaderboard` return | Unchanged shape |
| Both clients | `challengeBreakdown` return | Unchanged shape |

### Transformations between DB and UI

Currently: `listChallenges()` returns `Map<String, dynamic>[]` in Flutter, `Challenge[]` in web. The Flutter model is notably minimal. The web TypeScript types are more complete.

---

## 17. Existing Tests

| File | What it tests | Challenge-related? |
|---|---|---|
| `mobile/test/widget_test.dart` | App theme, Panel widget, ProgressRing, Stat | **NO** |
| `supabase/tests/smoke_pairing_challenges.sql` | Full RPC test suite: create, join, leave, leaderboard, scoring, finalization, RLS | **YES** — comprehensive |
| No unit tests | No Jest/Vitest/flutter test for challenge logic | **NO** |

**The smoke test** (`smoke_pairing_challenges.sql`) is the most valuable existing test. It tests:
- Challenge creation (public, private, completed)
- Status derivation
- Joining (public, private by code, twice, finished)
- Leaderboard (breakdown, rank, total_members)
- Leaving (score preserved, left member visible)
- Finalization (idempotent, frozen score immutable)
- Cancellation (owner-only, no score)
- RLS (all tables have RLS, internal tables not readable)
- `challenge_join_internal` not callable by clients

**Missing**: No tests for the new `challenge_routines`, `challenge_logs`, block matching, routine locking, or challenge-specific scoring.

---

## 18. Missing Tests

| Test | Expected |
|---|---|
| Create challenge with category → `challenge_routines` auto-created | Routine has default blocks for that category |
| Create challenge, edit routine before first join | Routine updates |
| First member joins → `locked_at` set | Routine cannot be modified after |
| Second member joins → routine locked | `locked_at` unchanged |
| Join challenge | `challenge_logs` rows created for every day × every routine block |
| Log block matching challenge routine | `challenge_logs` row created with correct completion_pct |
| Log block NOT matching challenge routine | No `challenge_logs` row |
| Log same block twice in one save | UPSERT — no duplicates |
| Leave challenge | No new `challenge_logs` after `left_at` |
| Rejoin | New `challenge_logs` start from `joined_at` |
| Challenge ends | `finalize_challenges()` computes from `challenge_logs` |
| Edit old activity after finalization | `challenge_logs` changes but `final_score` unchanged |
| Two members, different blocks | Each score from own `challenge_logs` |
| No matching blocks | Completion = null, participation = 0% |
| 100% completion | Score = 100 |
| Partial completion | Correct score |
| Multiple members | Correct ranking |
| Block at 50% | `completion_pct = 50` |
| Block deleted after match | No log row for that block/day |
| Midnight-crossing block | Match by start date |
| Private challenge, non-member reads logs | Insufficient privilege |
| Creator modifies routine after members join | Rejected |
| `challenge_join_internal` callable by client | Insufficient privilege |
| `challenge_logs` insert by non-member | Insufficient privilege |

---

## 19. Dependency Graph

### Challenge Creation
```
ChallengeCreateForm (CommunityView.tsx / _ChallengeSectionState)
  → db.createChallenge() / OrdoDb.createChallenge()
    → create_challenge() RPC
      → INSERT challenges
      → INSERT challenge_members
      → INSERT challenge_invites (if private)
      → INSERT challenge_routines  [NEW]
        → generates default routine blocks from category
```

### Challenge Join
```
Join button (CommunityView.tsx / _ChallengeSectionState)
  → db.joinChallenge() / OrdoDb.joinChallenge()
    → join_challenge() → challenge_join_internal() RPC
      → VALIDATE challenge, membership
      → INSERT challenge_members
      → INSERT challenge_logs for each day/block [NEW]
      → If first member: UPDATE challenge_routines SET locked_at = now() [NEW]
```

### Challenge Scoring (Logging)
```
User edits/logs activity
  → saveState(state)
    → save_state() RPC
      → save to user_state
      → changed_date_keys() [existing]
      → refresh_daily_scores() [existing]
      → For each active challenge member:
          → Get challenge_routines.routine [NEW]
          → Match blocks against challenge routine [NEW]
          → UPSERT challenge_logs [NEW]
```

### Challenge Leaderboard
```
Leaderboard button (CommunityView.tsx / _ChallengeSectionState)
  → db.challengeLeaderboard() / OrdoDb.challengeLeaderboard()
    → get_challenge_leaderboard() RPC
      → challenge_scores() [CHANGED]
        → reads challenge_logs (was daily_scores) [NEW]
      → challenge_members
      → profiles
```

### Finalization
```
Cron tick (tick.server.ts)
  → finalize_challenges() RPC
    → find challenges where end_at < now() AND finalized_at IS NULL
    → refresh_daily_scores() [EXISTING — still needed for daily_scores]
    → challenge_scores() [CHANGED — reads challenge_logs]
    → UPDATE challenge_members SET final_score, final_rank
    → UPDATE challenges SET finalized_at
    → challenge_members_freeze_tg [EXISTS — prevents mutation]
```

---

## 20. Implementation Risks

| Risk | Severity | Details |
|---|---|---|
| **Duplicate challenge logs** | HIGH | UPSERT on `(challenge_id, member_id, date, routine_block_id)` prevents this, but if the matching logic produces different `routine_block_id` for the same block on different saves, duplicates could occur. The PK prevents this, but the UPSERT must be correct. |
| **Duplicate memberships** | MEDIUM | `challenge_members` has a unique constraint on `(challenge_id, user_id)`. `challenge_join_internal` uses `ON CONFLICT DO UPDATE`. This is already handled. |
| **Race condition: first member joins** | HIGH | Two users could join simultaneously. Both see `locked_at IS NULL`. Both try to set it. The second one must fail or detect. Solution: use a transaction with `SELECT ... FOR UPDATE` on `challenge_routines`. |
| **Routine locking race condition** | HIGH | Same as above. Must use `SELECT ... FOR UPDATE` in the same transaction as the member insert. |
| **Overlapping blocks matching** | MEDIUM | If user has two blocks in same category with overlapping times, both could match the same challenge block. The "largest overlap wins" rule must be deterministic. |
| **Timezone/date boundary bugs** | HIGH | `daily_scores.date` is a `date` type without timezone. `save_state()` runs in server timezone. Challenge windows are defined by `start_at`/`end_at` (timestamptz). A user in a different timezone could have their blocks counted on a different date than expected. |
| **Challenge start/end boundary bugs** | MEDIUM | `challenge_scores()` uses `BETWEEN from_d AND to_d` (date). If `start_at` is `2025-01-01 23:00:00+00`, the `from_d` is `2025-01-01` regardless of the user's local timezone. |
| **Users joining late** | MEDIUM | `from_d = max(start_at, joined_at)`. A user joining on day 15 of 30 is scored on days 15–30 only. Their `challenge_logs` rows for days 1–14 don't exist, so participation/consistency for those days are 0. But the window is shorter, so it's not penalized. |
| **Users leaving** | MEDIUM | `challenge_logs` rows for the member persist. `challenge_scores()` uses `to_d = min(end_at, current_date, left_at)`. New logs shouldn't be written after `left_at`. The `challenge_logs` insert must check `current_date <= left_at` (or `left_at IS NULL`). |
| **Users rejoining** | MEDIUM | `joined_at` is preserved from original join (in `challenge_join_internal` ON CONFLICT DO UPDATE). `challenge_logs` for days before rejoin already exist. New logs after rejoin should be inserted/upserted. |
| **Challenge edits after locking** | HIGH | If `locked_at` is not properly enforced, routine changes after join would make `challenge_logs` mismatched. Must be enforced by trigger or policy. |
| **Finalization running twice** | LOW | `finalized_at IS NULL` predicate prevents this. Already working. |
| **Score mutation after finalization** | MEDIUM | `challenge_members_freeze_tg` prevents `challenge_members` updates. But `challenge_logs` inserts after finalization would not update `final_score`. However, they could be visible if a leaderboard is re-opened. Must either prevent `challenge_logs` inserts after finalization or ensure the leaderboard reads `final_score`, not live `challenge_logs`. |
| **RLS bypass through SECURITY DEFINER** | HIGH | `SECURITY DEFINER` functions run with the privileges of the function owner (typically `service_role` or `postgres`). If `challenge_logs` insert is done inside a `SECURITY DEFINER` function that checks membership, it's safe. But if the function doesn't check properly, a user could insert logs for any challenge. |
| **Expensive leaderboard queries** | MEDIUM | `challenge_logs` joins on `(challenge_id, member_id, date)` could be slow with many members and many days. Proper indexes are critical. |
| **save_state() performance** | MEDIUM | Adding challenge matching to `save_state()` increases its runtime. For a user with many active challenges and many changed dates, the block matching loop could be expensive. Consider batching or a separate async job. |

---

## 21. Exact Files That Must Change

### Database Migrations
- `supabase/migrations/0007_challenge_routines_logs.sql` — NEW migration: create `challenge_routines`, `challenge_logs`, indexes, policies, grants, helper functions

### Server-Side Functions
- `supabase/migrations/0006_pairing_challenges_repair.sql` — MODIFY: `create_challenge()` to insert `challenge_routines`; `join_challenge`/`challenge_join_internal` to initialize `challenge_logs` and set `locked_at`; `challenge_scores()` to read `challenge_logs`; `finalize_challenges()` to use new scoring; `challenge_members_freeze` trigger to cover `challenge_logs`
- `src/lib/server/state.server.ts` — MODIFY: `save_state()` to trigger challenge-log generation

### Web Frontend
- `src/components/ordo/CommunityView.tsx` — MODIFY: routine editor UI after challenge creation; leaderboard already correct
- `src/lib/db.ts` — MODIFY: `createChallenge()` to handle `challenge_routines`; add new functions for challenge routines/logs; `challengeScores()` source change
- `src/lib/ordo.ts` — MODIFY: `Challenge` type to include routine, locked_at

### Mobile Frontend
- `mobile/lib/screens/community_screen.dart` — MODIFY: routine editor UI after challenge creation
- `mobile/lib/services/db.dart` — MODIFY: `createChallenge()` to handle `challenge_routines`; add new functions
- `mobile/lib/models/ordo_state.dart` — MODIFY: `Challenge` class to include `locked_at`, `category`, etc.

### Tests
- `supabase/tests/smoke_pairing_challenges.sql` — ADD: tests for `challenge_routines`, `challenge_logs`, routine locking, block matching
- `mobile/test/widget_test.dart` — ADD: challenge-specific widget tests

---

## 22. Questions/Unknowns

1. **Default routine generation algorithm**: When a challenge is created with category "study", what exact blocks are generated? How many blocks per day? What duration? Is it configurable by the creator?

2. **Block matching implementation location**: Should the block matching logic live in PL/pgSQL (inside `save_state()` or a helper function) or in TypeScript (in `state.server.ts` before calling the RPC)?

3. **Challenge routine editing UI**: How is the routine editor presented? Is it a simplified version of the Ordo routine editor, or a custom form? Should the mobile client have a different UX than web?

4. **Challenge_logs cleanup**: When a challenge is cancelled, what happens to existing `challenge_logs` rows? Are they deleted, preserved, or marked as cancelled?

5. **Late join challenge_logs initialization**: When a member joins on day 15 of a 30-day challenge, are `challenge_logs` rows created only for days 15–30, or for all 30 days? If all 30, how are days 1–14 represented (0% or absent)?

6. **Challenge routine update propagation**: If the creator edits the routine before any member joins, do existing `challenge_logs` rows (if any) need to be invalidated?

7. **Timezone handling for challenge_logs**: The `date` column in `challenge_logs` — should it be in the user's local timezone or the server timezone? How is this determined?

8. **Challenge_categories validation**: The `create_challenge()` validation checks `v_cat <> 'general' AND v_cat NOT IN ('health', ...) AND NOT EXISTS (app_categories)`. Should `challenge_routines` also validate that the generated blocks' categories are valid?

9. **save_state() batch size**: If a user is a member of 20 active challenges and changes 30 days of activity, does the challenge-log generation loop need a batch limit? Could it cause timeouts in the `save_state()` RPC?

10. **Legacy Flutter builds**: The mobile app already in the wild calls `unpair()`, `create_challenge(p_name, p_days)`, and `challenge_leaderboard(p_challenge)` — the legacy shims in `0006` §11. Do these shims need to be updated to also create/read `challenge_routines`?

11. **`challenge_logs` update behavior**: The PK is `(challenge_id, member_id, date, routine_block_id)`. If a user's block changes (e.g., they redo a day), how is the `challenge_logs` row updated? Is `updated_at` meaningful? Can `completion_pct` be updated after finalization?

12. **Challenge scoring for `challenge_scores()`**: The current `challenge_scores()` function returns `window_days`, `active_days`, `completion`, `consistency`, `participation`, `score`. Should it be replaced entirely, or should a new function `challenge_scores_logs()` be created alongside it? The old one is called by `get_challenge_leaderboard`, `get_challenge_breakdown`, `challenge_score`, and `finalize_challenges`.
