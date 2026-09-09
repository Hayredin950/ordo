# Ordo Challenge System — Full Documentation

---

## Part 1: How It Works Right Now

---

### 1.1 The UI / User Experience

#### Where challenges live

The challenge UI lives on the **Community screen** — both on mobile (Flutter: `mobile/lib/screens/community_screen.dart`) and web (React: `src/components/ordo/CommunityView.tsx`). The screen has three sections stacked vertically:

1. **Accountability pairing** — invite friends by email, accept/decline requests
2. **Challenges** — create, join, view leaderboards
3. **Settings & data** — privacy, delete account

#### Creating a challenge (what the user sees)

The create form has these fields:

| Field | UI element | Default | What it sends to server |
|---|---|---|---|
| **Name** | Text input, max 80 chars | Empty | `p_name` |
| **Category** | Dropdown | "Any category" (i.e. "general") | `p_category` |
| **Visibility** | Toggle: Public / Invite code only | Public | `p_visibility` |
| **Days** | Number input | 30 | Client computes `end_at = now() + days` |
| **Min/day** | Number input | 30 | `p_min_daily_minutes` |

When you tap **Create**, the app calls `create_challenge` RPC with those values. The server:
1. Validates everything (name not empty, end > start, floor between 5–720, max participants ≥ 2, category exists)
2. Inserts a row into `public.challenges`
3. Automatically adds the creator as a member
4. If private, generates an 8-character invite code in `public.challenge_invites`

#### Challenge cards

Each challenge shows as a card with:
- Name, category, lock icon (if private)
- Date range (start → end), member count, minutes/day
- Status badge (Active / Upcoming / Completed / Cancelled)
- Progress bar (only for joined members) showing "Day X / Y · Z%"
- Action buttons that change based on your role and status:
  - **Join** — if you haven't joined and the challenge is active
  - **Leave** — if you've joined and it's still active
  - **Leaderboard** — opens a panel showing the top 5 scores + your row
  - **Invite code** — only visible if you're the owner or a member
  - **Cancel** — only visible to the owner when status is Upcoming or Active

#### Leaderboard panel

When you tap **Leaderboard**, it opens inline below the card and shows:
- A ranked list (top 5 plus your own row)
- Each row: rank number, name, score %, "(left)" if they departed
- At the bottom: "You are #X of Y" and a breakdown (completion/consistency/participation %)
- The breakdown shows three percentages: **Completion**, **Consistency**, **Participation** and a line like "3 of 7 days logged"

#### Challenge list ordering

Challenges are sorted by: Active first → Upcoming → Completed → Cancelled. Within the same status, challenges you've joined appear first, then sorted by start date descending.

---

### 1.2 The API Layer

All challenge operations go through **Supabase RPC functions** (PostgreSQL stored procedures with `SECURITY DEFINER`). The client never reads or writes tables directly — it only calls these functions.

#### Write operations

| Function | Client call | What it does |
|---|---|---|
| `create_challenge(...)` | `OrdoDb.createChallenge()` | Creates challenge row, adds creator as member, generates invite code if private |
| `join_challenge(uuid)` | `OrdoDb.joinChallenge(id)` | Adds you as a member. Checks: challenge exists, not cancelled, not finished, not private (unless via code), not full, joining window still open (first 20% of the run) |
| `join_challenge_by_code(text)` | `OrdoDb.joinChallengeByCode(code)` | Looks up the code in `challenge_invites`, calls internal join logic |
| `leave_challenge(uuid)` | `OrdoDb.leaveChallenge(id)` | Sets your status to 'left' and stamps `left_at`. Row is preserved. |
| `cancel_challenge(uuid)` | `OrdoDb.cancelChallenge(id)` | Only owner. Sets `cancelled_at`. Never scored. |

#### Read operations

| Function | Client call | What it returns |
|---|---|---|
| `list_challenges()` | `OrdoDb.listChallenges()` | All challenges visible to you: your own, challenges you've joined, and public ones within 30 days of ending |
| `get_challenge(uuid)` | `getChallenge(id)` | Full details of one challenge |
| `challenge_leaderboard(uuid)` | `OrdoDb.challengeLeaderboard(id)` | Top 5 ranked + your row. Each row: rank, name, score, `is_me`, `has_left`, `is_final`, `total_members` |
| `challenge_breakdown(uuid)` | `OrdoDb.challengeBreakdown(id)` | Your personal three-component breakdown (null if not a member) |
| `challenge_score(user, challenge)` | `challengeScore(userId, challengeId)` | Your overall score for a challenge |

#### Scoring operation

| Function | Called by | What it does |
|---|---|---|
| `finalize_challenges()` | Cron job (`tick.server.ts`) | Scoring pass. Finds challenges where `end_at < now()` and `finalized_at is null`. Scores every member, freezes `final_score`. Idempotent — runs at most 200 per call with `for update skip locked`. |

---

### 1.3 The Data Sources

#### Core tables

```
challenges                 challenge_members         daily_scores
─────────────              ───────────────────       ──────────────────
id (uuid) PK               id (uuid) PK              user_id (FK)
owner_id (FK)              challenge_id (FK)         date
name                       user_id (FK)              block_count
category                   joined_at                 planned_minutes
description                left_at                   completed_minutes
start_at                   status                    completion_pct
end_at                     final_score               updated_at
status (derived)           final_rank                primary key (user_id, date)
visibility                 final_score is immutable   
min_daily_minutes          cancelled_at              (one row per user per day)
max_participants           finalized_at              
invite_code (in challenge_invites table)
```

**Key tables:**
- `challenge_invites` — stores the invite code for private challenges. `challenge_id` (PK, FK) + `code` (unique) + `created_at`
- `daily_scores` — one row per user per day with `block_count`, `planned_minutes`, `completed_minutes`, `completion_pct`

#### How daily_scores gets populated

When a user saves their Ordo document, this chain fires:

```
User saves state (save_state())
  └─► refresh_daily_scores(user, dates_changed)
       └─► For each date, calls day_facts(state, date)
            └─► Reads the user's OrdoState:
                - Overrides for that specific date (if any)
                - Routine blocks for that day-of-week (0=Sun..6=Sat)
                - Log entries (completion % per block)
            └─► Computes: block_count, planned_minutes, completed_minutes, completion_pct
            └─► Writes to daily_scores (upsert)
```

The `day_facts` function:
1. Checks `state.overrides[date]` first (user-overridden blocks for that specific date)
2. Falls back to `state.routine[dow]` (the weekly routine for that day of the week)
3. Reads `state.log[date]` for each block's completion percentage
4. Computes `block_minutes(start, end)` and `pct` (clamped 0–100)
5. Returns aggregate: `block_count`, `planned_minutes` (sum of block durations), `completed_minutes` (sum of block_duration * pct/100), `completion_pct` (average of all block percentages)

**Important: `daily_scores` is global** — it doesn't know about any challenge. It just records "on date X, this user did Y activity."

---

### 1.4 The Scoring Mechanism

This is how the three percentages get computed for a challenge.

The database function `challenge_scores(challenge_id, user_id)` does this:

```
1. Determine the scoring window for each member:
   - from_d = max(challenge.start_at, member.joined_at)
   - to_d   = min(challenge.end_at, current_date, member.left_at or infinity)
   
   This means: scoring starts when you join (not when the challenge starts),
   and ends when you leave or the challenge ends.

2. Count the total days in the window: window_days = (to_d - from_d) + 1

3. Left join daily_scores to get your actual data:
   - Count days with any activity: active_days
   - Count days where completed_minutes >= min_daily_minutes: floor_days (consistency)
   - Count days where completed_minutes > 0: busy_days (participation)
   - Sum of completion_pct across all days: sum_pct

4. Compute the three components:
   completion   = round(sum_pct / window_days)          — average daily completion
   consistency  = round(100 * floor_days / window_days)  — % of days you hit the floor
   participation = round(100 * busy_days / window_days)  — % of days you did anything

5. Final score = round(0.70 * completion + 0.20 * consistency + 0.10 * participation)
```

**Concrete example:**

Challenge: "30 days of study", 30 days, 30 min/day floor
Member joined on day 1, logged 20 days:
- 15 days met the 30-min floor → consistency = 15/20 = 75%
- 18 days had any activity → participation = 18/20 = 90%
- Average daily completion across 20 days = 82% → completion = 82%
- Score = 0.70 × 82 + 0.20 × 75 + 0.10 × 90 = 57.4 + 15 + 9 = **81%**

---

### 1.5 The Finalization Pipeline

When a challenge ends, the cron job (`tick.server.ts`) calls `finalize_challenges()`:

```
1. Find challenges where end_at < now() AND finalized_at is null
   (limit 200 per call, with "for update skip locked" for concurrency)

2. For each finished challenge:
   a. Refresh daily_scores for every member for the full date range
      (ensures no gaps — days the user didn't open the app still count as zero)
   
   b. Compute final scores using challenge_scores()
   
   c. Update challenge_members: set final_score and final_rank
   
   d. Set challenge.finalized_at = now()

3. Cancelled challenges: set finalized_at but leave final_score = null
   (null means "no result" — not "everyone failed")

4. A trigger (challenge_members_freeze_tg) prevents any further
   updates to final_score/final_rank/joined_at once scored
```

---

## Part 2: The Problem

### 2.1 What's wrong

The current system has a fundamental disconnect: **challenges are generic time containers, not tied to specific routines or goals.**

When you create a challenge called "30 days of study", the system expects you to study. But the scoring doesn't check if you studied — it checks your **global Ordo activity** during that 30-day window. Your gym blocks, finance blocks, work blocks — all count equally toward the challenge score.

**Why this happens:**

1. `daily_scores` stores **all** activity regardless of category or challenge
2. `challenge_scores()` reads `daily_scores` without filtering by category
3. A challenge's `category` field is just metadata — it's never used in scoring
4. Members don't have a challenge-specific routine — they use their global one

**The user experience of this problem:**

- You create a "30 days of study" challenge
- You log your gym routine for 30 days
- The challenge shows you scored 95% even though you never opened a single study block
- The leaderboard doesn't reflect "who studied" — it reflects "who used Ordo the most"

### 2.2 Root cause in the architecture

The data model has two disconnected worlds:

```
World 1: Your Ordo document (global)
├── routine[day_of_week] → blocks with categories
├── overrides[date] → category-specific blocks  
├── log[date][block_id] → completion %
├── goals[] → long-term targets
└── save_state() → writes to daily_scores (global, no challenge_id)

World 2: Challenges
├── challenges[] → time window, category, floor
├── challenge_members[] → who's in, joined_at, final_score
└── challenge_scores() → reads daily_scores (no challenge_id filter)
```

There's **no bridge** between them. A challenge doesn't know what routine to score against, and daily_scores doesn't know which challenge a day's activity belongs to.

---

## Part 3: The Fix Plan

### 3.1 Design goal

When a user creates a challenge, the challenge should define its own routine. Both the creator and joined members follow that routine. Scoring counts only activity against that routine's blocks — not global Ordo activity.

**In the user's words:** When I create a challenge called "30 days of study", that challenge has its own blocks (e.g., study 09:00–10:00). Members join and log their activity against those blocks. The score reflects only how they did on those specific blocks.

### 3.2 What needs to change

#### 3.2.1 Database changes

**New table: `challenge_routines`**

```sql
create table public.challenge_routines (
  challenge_id  uuid primary key references public.challenges(id) on delete cascade,
  routine       jsonb not null,        -- same structure as OrdoState.routine
  overrides     jsonb default '{}',    -- per-date overrides
  created_at    timestamptz not null default now()
);
```

This stores the routine that the challenge defines. When Alice creates "30 days of study" with a "study 09:00–10:00" block, that block goes here.

**New table: `challenge_logs`**

```sql
create table public.challenge_logs (
  challenge_id  uuid not null references public.challenges(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          date not null,
  block_id      text not null,          -- matches the block ID in challenge_routines
  completion_pct numeric not null default 0,
  primary key (challenge_id, user_id, date, block_id)
);
```

This stores per-member, per-day, per-challenge activity. When Bob logs 80% on his study block in the "30 days of study" challenge, it goes here — not in his global `daily_scores`.

**Modified: `daily_scores`** — add a `challenge_id` column (nullable)

```sql
alter table public.daily_scores add column challenge_id uuid references public.challenges(id);
```

When a day's activity is challenge-specific, `daily_scores` gets the challenge_id. Global activity keeps it null.

#### 3.2.2 Create flow changes

**Current flow:**
```
User types name → taps Create → server creates challenge with category metadata
```

**New flow:**
```
User types name, picks category, sets days, sets floor
→ Server creates challenge
→ Server also creates a default routine in challenge_routines:
   - For each day of the week, create a block based on the category
   - Example "study" category: a 60-min "study" block on all days
→ The challenge now has a routine to score against
```

**UI changes needed:**
- After creating a challenge, show the routine that was auto-generated
- Allow the creator to customize the routine (add/edit/remove blocks)
- Show members what routine they're supposed to follow

#### 3.2.3 Join flow changes

**Current flow:**
```
User taps Join → server adds row to challenge_members → done
```

**New flow:**
```
User taps Join → server adds row to challenge_members → server also creates
  challenge_logs entries for each day of the challenge window (initialized to 0%)
→ When the member logs their day, they log against the challenge's blocks
```

#### 3.2.4 Logging flow changes

**Current flow:**
```
User opens Ordo → logs blocks → save_state() → refresh_daily_scores()
→ writes to daily_scores (global)
```

**New flow:**
```
User opens Ordo → logs blocks → save_state()
→ For each day:
  a. Write to daily_scores (global, for the user's overall stats)
  b. For each active challenge the user is in:
     - Look up the challenge routine from challenge_routines
     - Match the logged blocks to the challenge's blocks (by title/category)
     - Write to challenge_logs (challenge_id, user_id, date, block_id, completion_pct)
```

**How blocks match between global routine and challenge routine:**
- Challenge routine blocks have IDs that reference the challenge
- When a user logs blocks, the system checks: do any of the blocks in this save match the blocks in any active challenge's routine?
- Matching can be by: block title, category, or a new `challenge_block_id` mapping

#### 3.2.5 Scoring changes

**Current `challenge_scores()`:**
```sql
select from daily_scores ds
  where ds.user_id = member and ds.date between from_d and to_d
-- reads global daily_scores, no challenge filter
```

**New scoring function:**
```sql
select from challenge_logs cl
  where cl.challenge_id = p_challenge and cl.user_id = p_user
  and cl.date between from_d and to_d
-- reads challenge-specific logs
```

The three components become:
- **Completion** = average of (sum of completion_pct per day / block_count in challenge routine)
- **Consistency** = % of days where sum(completion_pct per day) >= challenge's floor (converted to a percentage of the routine's total minutes)
- **Participation** = % of days with any challenge_logs entries

#### 3.2.6 `save_state()` changes

The current `save_state()` function needs to be extended to also process challenge logs:

```sql
create or replace function public.save_state(p_state jsonb)
returns void as $$
declare
  v_uid uuid := auth.uid();
  v_days date[];
  v_challenges record;
begin
  -- existing logic: save state, update history, refresh daily_scores
  
  -- NEW: for each active challenge the user is a member of,
  -- process the log entries for challenge-specific scoring
  for v_challenges in
    select cr.challenge_id, cr.routine
    from public.challenge_routines cr
    join public.challenge_members cm 
      on cm.challenge_id = cr.challenge_id and cm.user_id = v_uid and cm.status = 'active'
  loop
    -- for each date in the save, match logged blocks to challenge routine blocks
    -- write to challenge_logs
  end loop;
end;
$$;
```

---

### 3.3 Full data flow after the fix

```
┌─────────────────────────────────────────────────────────────┐
│ USER CREATES CHALLENGE                                       │
│                                                              │
│ "30 days of study", category=study, 30 min/day              │
│                                                              │
│ 1. challenges table: new row with start_at, end_at, floor   │
│ 2. challenge_routines: routine with study blocks             │
│    ├── Mon: [Study 09:00-10:00, category=study]             │
│    ├── Tue: [Study 09:00-10:00, category=study]             │
│    └── ... (all days)                                       │
│ 3. challenge_logs: empty rows for each member × each day    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ USER JOINS CHALLENGE                                         │
│                                                              │
│ 1. challenge_members: new row (status='active', joined_at)  │
│ 2. challenge_logs: initialized rows for each day at 0%      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ USER LOGS THEIR DAY                                          │
│                                                              │
│ User opens Ordo, logs: Study block 09:00-10:00 at 80%       │
│                                                              │
│ 1. save_state() writes global daily_scores (unchanged)      │
│ 2. save_state() checks active challenges for this user       │
│ 3. For each challenge:                                       │
│    a. Gets challenge_routines.routine                        │
│    b. Matches logged block to challenge block (by title/category) │
│    c. Writes challenge_logs(challenge_id, user_id, date, block_id, 80) │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ LEADERBOARD COMPUTES SCORE                                   │
│                                                              │
│ 1. challenge_scores() reads challenge_logs (not daily_scores)│
│ 2. completion = avg of 80% across logged days                │
│ 3. consistency = % of days where 80% >= 30-min floor        │
│ 4. participation = % of days with any challenge_logs entry   │
│ 5. Final = 0.70×completion + 0.20×consistency + 0.10×part   │
└─────────────────────────────────────────────────────────────┘
```

---

### 3.4 Summary of changes

| Layer | Current | After fix |
|---|---|---|
| **DB tables** | `challenges`, `challenge_members`, `daily_scores` (global) | Add `challenge_routines`, `challenge_logs`, `challenge_id` FK on `daily_scores` |
| **Create flow** | Name + category + days + floor → challenge row | Also creates a default routine in `challenge_routines` |
| **Join flow** | Adds member row | Also initializes `challenge_logs` rows |
| **Logging** | `save_state()` → `daily_scores` only | `save_state()` → `daily_scores` + match blocks to active challenges → `challenge_logs` |
| **Scoring** | `challenge_scores()` reads `daily_scores` | `challenge_scores()` reads `challenge_logs` |
| **UI** | Challenge card shows name, dates, progress | Challenge card also shows the routine, letting members know what to log |
| **Block matching** | None | Match logged blocks to challenge routine blocks by title/category |

---

### 3.5 Edge cases to handle

1. **A block belongs to multiple challenges** — if two challenges have a "Study" block and the user logs one "Study" block, it should count for both challenges (same log entry maps to both challenge_logs rows)
2. **Member leaves mid-challenge** — challenge_logs rows remain for the days they were active; scoring uses `joined_at` to `left_at` window
3. **Challenge routine changes after members joined** — should be locked once members join, or members should be notified of changes
4. **Global activity without a matching challenge block** — should still go to `daily_scores` but not to `challenge_logs`
5. **Custom routines** — allow creators to define a completely custom routine when creating a challenge, not just category-based defaults
6. **Challenge with no blocks** — if the challenge routine has no blocks on a given day, that day can't count toward the score (participation = 0 for that day)

---

*Document covers: current UI/UX, current API, current data model, current scoring, the problem, and the full fix plan including database changes, flow changes, and edge cases.*
