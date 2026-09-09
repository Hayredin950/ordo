# Implementation Plan — Clarification Document

> This document addresses ambiguities, contradictions, and gaps in the 14-part implementation plan so an agent implementing it won't hit dead ends or make wrong assumptions.

---

## Clarification 1 — Part 2 data flow is slightly wrong

The plan shows:
```
daily_scores → weekly_pct() → challenge leaderboard
```

**This is incorrect.** `weekly_pct()` is for **accountability pairing**, not challenges. The challenge scoring pipeline is:

```
daily_scores → completion_pct(user, start, end) → challenge_scores() → challenge leaderboard
```

`challenge_scores()` calls `completion_pct()` (not `weekly_pct()`), which reads from `daily_scores`. The fix replaces the source of `completion_pct()` from `daily_scores` to `challenge_logs`.

**Clarification for the agent:** When you modify the scoring pipeline, you're changing what `completion_pct()` reads — or creating a new function. You're not touching `weekly_pct()`.

---

## Clarification 2 — Part 3: `challenge_routines` vs `challenge_members` relationship

The plan introduces `challenge_routines` and `challenge_logs` but doesn't define how they connect to `challenge_members`.

**Current tables:**
```
challenges (1) ──── (N) challenge_members (1) ── (N) challenge_logs
```

**Correct relationship:**
```
challenge (1) ── challenge_routines (1:1, one routine per challenge)
challenge (1) ── challenge_members (1:N)
challenge_members (1) ── challenge_logs (1:N, one member's logs)
```

`challenge_logs` needs both `challenge_id` and `user_id` (the member). It doesn't connect through `challenge_members` — it connects directly to both `challenges` and `users`.

**Clarification for the agent:** `challenge_logs` has `(challenge_id, user_id, date)` as its identity, not a surrogate key through `challenge_members`.

---

## Clarification 3 — Part 4: How does a challenge routine get created?

The plan says "the challenge defines what counts" but doesn't specify **how the routine is generated**. Three options, only one should be chosen:

**Option A — Auto-generated from category.**
Create a challenge with category "study" → system auto-creates a default routine (e.g., "Study block, 60 min, every day"). The creator can then customize.

**Option B — Creator manually defines every block.**
When creating a challenge, the creator goes through a block editor (same as the Ordo routine editor) and manually sets every block for every day.

**Option C — Both.** The system auto-generates based on category, but the creator can edit, add, or remove blocks.

**Recommendation: Option C.** The system should auto-generate a default routine based on the challenge category (so the creator isn't blocked by a blank form), but allow full customization. The UI should show the auto-generated routine with an "Edit routine" option.

**Clarification for the agent:** Do NOT leave this as "the plan doesn't specify." Pick Option C and define the default routine per category (e.g., "study" → one 60-min study block every day; "fitness" → one 45-min workout every day).

---

## Clarification 4 — Part 5: Block matching is the hardest problem — needs a concrete algorithm

The plan correctly identifies this as critical but doesn't define the algorithm. Here's the concrete algorithm that should replace the vague criteria:

### Matching rule (single, deterministic)

A user's actual block **matches** a challenge routine block if:

1. **Same date** (the block falls on a day that has a corresponding challenge routine block)
2. **Same category** (the block's category matches the challenge routine block's category)
3. **Time overlap** (the block's time range overlaps with the challenge routine block's time range by at least 50%)

If multiple challenge blocks match the same user block → match to the one with the **largest overlap**.

If no match → the block doesn't count toward the challenge (but still counts toward `daily_scores` globally).

### Concrete examples resolved

| User block | Challenge block | Match? | Why |
|---|---|---|---|
| Study 09:00–10:00 | Study 09:00–11:00 | ✅ Yes | Same category, 66% overlap |
| Study 09:00–10:00 | Study 14:00–15:00 | ❌ No | Same category, 0% time overlap |
| Study 09:00–10:00 | Gym 09:00–10:00 | ❌ No | Different category |
| Deep Study 09:10–11:00 | Study 09:00–11:00 | ✅ Yes | Same category, 80% overlap |
| Study 09:00–10:00 | Study 09:00–10:00 | ✅ Exact | Perfect match |

### Specific edge cases resolved

| Scenario | Resolution |
|---|---|
| **Renamed block** ("Study" → "Study Python") | Match by category + time overlap, not title |
| **Moved block** (09:00–10:00 → 14:00–15:00) | No match (time overlap < 50%) |
| **Duplicated block** (two "Study" blocks, one matches) | Match the one with largest overlap; ignore the other |
| **Deleted block** (no user block on a day with challenge routine) | That day has 0% completion for the challenge |
| **Overlapping blocks** (user has two blocks that match one challenge block) | Sum completion across all matching blocks |
| **Midnight-crossing block** (23:00–01:00) | Match by the day the block starts |
| **Block at 50%** | `completion_pct = 50` for that block |
| **Block at 0%** | `completion_pct = 0`, day counts as "participated" but not "consistency met" |
| **Blocks created after challenge start** | Match normally if date falls within challenge window |

**Clarification for the agent:** The 50% time overlap threshold is a design decision — if you change it to 100% (exact match only), fewer blocks will count and scores will be lower. Document this as a configurable constant.

---

## Clarification 5 — Part 6: `save_state()` modification — where does challenge matching happen?

The plan says `save_state()` should "find active challenges." But `save_state()` already runs with `auth.uid()` and has the user's state. The question is: **does it query all challenges or only challenges this user is a member of?**

**Answer:** Only challenges where the user is an active member. Query:

```sql
select cr.challenge_id, cr.routine
from challenge_routines cr
join challenge_members cm 
  on cm.challenge_id = cr.challenge_id 
 and cm.user_id = auth.uid() 
 and cm.status = 'active'
```

**Also:** `save_state()` needs to know **which dates were changed** (it already does — `changed_date_keys()`). Challenge logging should only happen for dates that actually changed in the save.

**Clarification for the agent:** Don't re-scan all dates on every save. Use `changed_date_keys()` to know which dates to process, then match blocks for only those dates against active challenge routines.

---

## Clarification 6 — Part 7: `challenge_logs` schema needs to be precise

The plan lists these columns but doesn't define types or relationships:

```
challenge_id
member_id
date
challenge_routine_id
source_block_id
planned_minutes
completed_minutes
completion_pct
created_at
updated_at
```

**Here's the precise schema:**

```sql
create table public.challenge_logs (
  challenge_id     uuid not null references public.challenges(id) on delete cascade,
  member_id        uuid not null references auth.users(id) on delete cascade,
  date             date not null,
  routine_block_id text not null,         -- the ID of the matching block in challenge_routines.routine
  source_block_id  text,                  -- the ID of the user's actual block (null if no match)
  planned_minutes  integer not null,       -- from the challenge routine block
  completed_minutes numeric not null,      -- from the user's actual block
  completion_pct   numeric not null,       -- computed: completed_minutes / planned_minutes * 100
  primary key (challenge_id, member_id, date, routine_block_id)
);
```

**Key decisions:**
- `routine_block_id` is the identity in `challenge_routines.routine` — it's how we know which challenge block this log entry is for
- `source_block_id` is the user's actual block ID (from their global `OrdoState.log`) — it's optional because if there's no match, there's no log
- `completion_pct` is computed at write time, not query time

**Clarification for the agent:** If a user has no matching block for a challenge routine block on a given day, **no row is inserted** into `challenge_logs`. The absence of a row means 0% for that block on that day. Don't insert rows with 0%.

---

## Clarification 7 — Part 8: Scoring definitions need exact SQL-equivalent formulas

The plan says "define completion/consistency/participation" but doesn't give the formulas. Here they are:

**Given:**
- `challenge_routine` has blocks `B1, B2, ..., Bn` with planned minutes `P1, P2, ..., Pn`
- `challenge_logs` for a member has entries for each (challenge_id, member_id, date, routine_block_id)
- For each day `d`, `planned_total = sum(Pi)` and `completed_total = sum(completed_minutes)` where rows exist for date `d`

**Completion (per day):**
```
day_completion(d) = sum(completed_minutes for date=d) / sum(planned_minutes for date=d) * 100
```

**Completion (over window):**
```
completion = round(avg(day_completion(d)) for d in [from_d, to_d] where day_completion(d) is not null)
```
If no days have logs → null (not 0).

**Consistency:**
```
active_days = count of dates d where sum(completed_minutes for date=d) >= challenge.min_daily_minutes
consistency = round(100.0 * active_days / window_days)
```
Where `window_days = (to_d - from_d) + 1`. A day with no logs doesn't count as active.

**Participation:**
```
busy_days = count of dates d where sum(completed_minutes for date=d) > 0
participation = round(100.0 * busy_days / window_days)
```

**Final score:**
```
score = round(0.70 * completion + 0.20 * consistency + 0.10 * participation)
```

**Clarification for the agent:** "Planned minutes" for a day is the sum of the challenge routine block durations (not the user's global block durations). "Completed minutes" is the sum of the user's actual completed minutes for matching blocks.

---

## Clarification 8 — Part 9: Joined late — the window is per-member

The plan says "score starts at joined_at." This needs to be explicit in the formulas:

For member M joining challenge C on day D_join:
```
from_d = max(challenge.start_at, M.joined_at)
to_d = min(challenge.end_at, current_date, M.left_at or infinity)
window_days = (to_d - from_d) + 1
```

**Days before joining are excluded from both numerator and denominator.** A member who joins on day 15 of a 30-day challenge is scored on days 15–30 only. They are not penalized for days 1–14.

**Clarification for the agent:** If a member joins late, the challenge should show "You joined on Day 15" somewhere in the UI so they understand why their window is shorter.

---

## Clarification 9 — Part 10: "Snapshot" needs a mechanism

The plan says "Challenge routines are snapshots." But what does that mean technically?

**Answer:** When `create_challenge()` runs, it writes the routine to `challenge_routines` at that point in time. Later, if the creator modifies their global routine, the `challenge_routines` row is unchanged. If a new member joins, they see the routine as it was when the challenge was created — not the current global routine.

**One edge case:** What if the creator changes the challenge routine after members joined? Two options:
- **Option A:** Lock the routine once members join (no changes allowed)
- **Option B:** Allow changes, but existing members see the routine at the time they joined; new members see the updated routine

**Recommendation: Option A.** Simpler, no ambiguity. Once a challenge has ≥1 member, the routine is locked. The creator can start a new version if they want to change it.

**Clarification for the agent:** Add a `locked_at` column to `challenge_routines`. When the first member joins, `locked_at` is set. After that, updates to the routine are rejected by a trigger or policy.

---

## Clarification 10 — Part 11: What happens to `challenge_logs` after finalization?

The plan says "Historical leaderboard is IMMUTABLE." But does `challenge_logs` get frozen?

**Answer:** `challenge_logs` is **never frozen**. It continues to accept new entries for any reason (e.g., late corrections). But `final_score` and `final_rank` in `challenge_members` are frozen by the `challenge_members_freeze_tg` trigger. The leaderboard reads `final_score`, not live `challenge_logs`.

**This means:** Even if `challenge_logs` changes after finalization, the leaderboard won't change because it reads the frozen `final_score`.

**Clarification for the agent:** `challenge_logs` is append-only after finalization (or at least: changes to `challenge_logs` after finalization have no effect on the leaderboard because the leaderboard reads `final_score`).

---

## Clarification 11 — Part 12: Security matrix needs to cover `challenge_routines` and `challenge_logs`

The plan says "audit every new/modified RPC" but doesn't cover the new tables' RLS and grants. Here's what's needed:

| Table | RLS policy | Who can read | Who can write |
|---|---|---|---|
| `challenge_routines` | Enabled | Creator only (owner_id check) | Creator only |
| `challenge_logs` | Enabled | Member (user_id check) or creator (owner_id check) | Member only (own rows) |
| `challenge_invites` | Already exists | Creator or member | Creator only |

**Also:** `challenge_logs` insert/update must check that:
- The user is an active member of the challenge
- The challenge is active (not completed/cancelled)
- The date is within the challenge window
- The `routine_block_id` exists in the challenge's routine

**Clarification for the agent:** `challenge_logs` must have RLS that restricts reads to the challenge owner and members, and writes to members only for their own rows.

---

## Clarification 12 — Part 13: Phased implementation — missing dependency

The plan says:
```
PHASE 1: Create migration (tables, indexes)
PHASE 2: Modify create_challenge()
PHASE 3: Modify save_state()
PHASE 4: Replace scoring source
```

But **Phase 2 depends on Phase 1**. Within Phase 2, `create_challenge()` needs `challenge_routines` to exist before it can insert into it. This is correct but needs to be explicit: **Phase 1 must be deployed and verified before Phase 2 begins.**

**Also missing:** There's no phase for creating the `join_challenge()` modification that initializes `challenge_logs` rows when a member joins. This should be part of Phase 2 (or a Phase 2b):

```
PHASE 2a: create_challenge() creates challenge_routines
PHASE 2b: join_challenge() creates challenge_logs rows for each day
```

**Clarification for the agent:** Add `join_challenge()` modification to the phase list. When a member joins, `challenge_logs` rows must be created for every day of the challenge window, one per challenge routine block, initialized to 0%.

---

## Clarification 13 — Part 14: Missing test cases

The plan lists some test cases but is incomplete. Here are the ones the plan missed:

| Test | Expected |
|---|---|
| Create challenge with category "study" | `challenge_routines` has default study blocks |
| Create challenge then edit routine | Routine updates (before members join) |
| Create challenge then lock routine | After first member joins, routine can't be modified |
| Join challenge | `challenge_logs` rows created for every day × every routine block |
| Log a block matching challenge routine | `challenge_logs` row created with correct completion_pct |
| Log a block NOT matching challenge routine | No `challenge_logs` row created, but `daily_scores` still updated |
| Log the same block twice in one save | `challenge_logs` upserted (no duplicates) |
| Leave challenge | No new `challenge_logs` rows after `left_at` |
| Rejoin challenge | New `challenge_logs` rows start from `joined_at` |
| Challenge ends | `finalize_challenges()` computes `final_score` from `challenge_logs` |
| Edit old activity after finalization | `challenge_logs` changes but `final_score` unchanged |
| Two members, different blocks | Each member's score based on their own `challenge_logs` |
| Member with no matching blocks | Completion = null, consistency = 0%, participation = 0% |
| Member with all blocks at 100% | Score = 100 |
| Private challenge, non-member tries to read logs | Insufficient privilege |
| Creator modifies challenge routine after members join | Rejected (locked) |
| `challenge_logs` with `source_block_id` that doesn't exist | Should not happen — validate on insert |

---

## Summary of all clarifications

| # | Part | Issue | Resolution |
|---|---|---|---|
| 1 | 2 | `weekly_pct()` is not for challenges | `completion_pct()` is the correct function |
| 2 | 3 | `challenge_logs` relationship unclear | `(challenge_id, member_id, date, routine_block_id)` PK |
| 3 | 4 | How routine is created undefined | Auto-generate from category + allow customization |
| 4 | 5 | Block matching algorithm missing | Category + time overlap ≥50%, largest overlap wins |
| 5 | 6 | Which challenges to query | Only where user is active member; use `changed_date_keys()` |
| 6 | 7 | `challenge_logs` schema imprecise | Add types, `routine_block_id`, computed `completion_pct` |
| 7 | 8 | Scoring formulas not defined | Exact SQL-equivalent formulas for all three components |
| 8 | 9 | Joined late window | Per-member window from `joined_at` |
| 9 | 10 | "Snapshot" mechanism | `locked_at` column set when first member joins |
| 10 | 11 | Post-finalization `challenge_logs` | Append-only; frozen `final_score` drives leaderboard |
| 11 | 12 | New table RLS/grants missing | Explicit RLS policies for `challenge_routines` and `challenge_logs` |
| 12 | 13 | Missing `join_challenge()` phase | Add Phase 2b for `challenge_logs` initialization |
| 13 | 14 | Incomplete test matrix | 17 additional test cases identified |
