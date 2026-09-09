# Ordo Challenge Fix --- Implementation Plan

## 0. Purpose

This plan fixes the current Ordo Challenge system so a challenge
measures **only the activity defined by its challenge routine**, rather
than the user's entire global daily activity.

Example:

``` text
Global routine:
Monday → Gym 60m, Study 60m, Work 60m

Challenge:
"30 Days of Study"
Challenge routine:
Monday → Study 09:00–10:00

User logs:
Gym 100%, Study 0%, Work 100%

Old result:
66.67% challenge completion ❌

New result:
0% challenge completion ✅
```

The implementation must preserve the existing Accountability/Pairing
system.

------------------------------------------------------------------------

# 1. Non-Negotiable Architecture

## 1.1 Two separate scoring systems

### Accountability

`weekly_pct()` remains **only** for Accountability pairing.

``` text
User global activity
    ↓
daily_scores
    ↓
weekly_pct()
    ↓
Accountability peer progress
```

Do not change this architecture.

### Challenges

Challenges use their own scoring path:

``` text
User activity
    ↓
save_state()
    ↓
changed_date_keys()
    ↓
challenge block matching
    ↓
challenge_logs
    ↓
completion_pct() / challenge_scores()
    ↓
Challenge leaderboard
```

Challenge scoring must NOT read global `daily_scores`.

`daily_scores` remains the global activity aggregate used by normal Ordo
scoring and Accountability.

------------------------------------------------------------------------

# 2. Target Challenge Architecture

``` text
                         ┌──────────────────────┐
                         │   Global Ordo        │
                         │   routine + logs     │
                         └──────────┬───────────┘
                                    │
                              save_state()
                                    │
                         changed_date_keys()
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
             refresh_daily_scores()         Challenge matching
                    │                               │
                    ▼                               ▼
              daily_scores                 challenge_logs
                    │                               │
                    ▼                               ▼
             weekly_pct()                 challenge_scores()
                    │                               │
                    ▼                               ▼
             Accountability                  Leaderboard
```

The important boundary is:

> `daily_scores` is global. `challenge_logs` is challenge-specific.

------------------------------------------------------------------------

# 3. Database Changes

Create:

``` text
supabase/migrations/0007_challenge_routines_logs.sql
```

Do not rewrite the existing `0006` migration in production. Use a new
migration for the new schema and function replacements.

## 3.1 `challenge_routines`

Create:

``` sql
CREATE TABLE public.challenge_routines (
  challenge_id uuid PRIMARY KEY
    REFERENCES public.challenges(id)
    ON DELETE CASCADE,

  routine jsonb NOT NULL,

  locked_at timestamptz NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Meaning

`routine` has the same structure as the normal Ordo routine:

``` typescript
Record<number, Block[]>
```

where:

``` typescript
type Block = {
  id: string;
  title: string;
  start: string;
  end: string;
  category: string;
  priority: "must" | "nice";
}
```

The challenge routine belongs to the challenge.

It does NOT point to or reuse the user's global routine.

### Locking

``` text
locked_at = NULL
    ↓
creator can edit routine
    ↓
first member joins
    ↓
locked_at = now()
    ↓
routine becomes immutable
```

The challenge routine must never change after the first member joins.

------------------------------------------------------------------------

# 4. Challenge Routine Generation

## 4.1 Creation flow

When `create_challenge()` creates a challenge:

``` text
INSERT challenges
        ↓
INSERT challenge_members
        ↓
INSERT challenge_invites if private
        ↓
GENERATE challenge_routines
```

The challenge routine must be generated automatically from the selected
challenge category and the challenge's minimum daily requirement.

## 4.2 Default generation rule

The implementation should generate a simple valid routine for the
selected category that satisfies `min_daily_minutes`.

The exact default block layout should be deterministic.

Recommended representation:

``` text
Monday    → one category block
Tuesday   → one category block
...
Sunday    → one category block
```

Each generated block:

``` text
category = challenge.category
priority = "must"
duration >= min_daily_minutes
```

Use a stable generated block ID.

Do not copy the creator's global routine.

## 4.3 Creator editing

Immediately after creation, the creator can edit:

-   days
-   block title
-   category
-   start time
-   end time
-   priority
-   block placement

The editor should modify `challenge_routines.routine`.

It must not modify:

``` text
user_state.state.routine
```

The challenge routine is a separate rulebook.

## 4.4 Routine editing RPC

Add a SECURITY DEFINER RPC for routine updates, for example:

``` text
update_challenge_routine(p_challenge uuid, p_routine jsonb)
```

The exact signature may follow the project's existing RPC conventions.

The RPC must verify:

1.  authenticated user
2.  user is challenge owner
3.  challenge exists
4.  `challenge_routines.locked_at IS NULL`
5.  challenge is not finalized/cancelled
6.  routine JSON structure is valid

After locking, return an error.

Do not rely only on frontend disabling.

------------------------------------------------------------------------

# 5. First-Member Lock

This is critical.

## 5.1 `join_challenge()` / `challenge_join_internal()`

The first successful member join must:

1.  lock the challenge routine row with `FOR UPDATE`
2.  determine whether `locked_at IS NULL`
3.  insert/update membership
4.  initialize challenge logs
5.  set `locked_at = now()` if this is the first member

Use one transaction.

Conceptually:

``` sql
SELECT *
FROM challenge_routines
WHERE challenge_id = p_challenge
FOR UPDATE;
```

Then:

``` text
if locked_at is null:
    first_member = true
else:
    first_member = false
```

Set `locked_at` during the same transaction.

## 5.2 Race condition

Two users must not both become the "first member."

The row lock is required.

Correct:

``` text
Transaction A
  SELECT challenge_routines FOR UPDATE
  lock acquired
  insert member
  set locked_at
  commit

Transaction B
  waits
  SELECT row
  sees locked_at != NULL
  continues normally
```

------------------------------------------------------------------------

# 6. `challenge_logs`

Create:

``` sql
CREATE TABLE public.challenge_logs (
  challenge_id uuid NOT NULL
    REFERENCES public.challenges(id)
    ON DELETE CASCADE,

  member_id uuid NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  date date NOT NULL,

  routine_block_id text NOT NULL,

  source_block_id text,

  planned_minutes integer NOT NULL,

  completed_minutes numeric NOT NULL,

  completion_pct numeric NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (
    challenge_id,
    member_id,
    date,
    routine_block_id
  )
);
```

Indexes:

``` sql
CREATE INDEX challenge_logs_challenge_date_idx
ON public.challenge_logs (challenge_id, date);

CREATE INDEX challenge_logs_member_challenge_date_idx
ON public.challenge_logs (member_id, challenge_id, date);
```

## 6.1 Column meaning

### `challenge_id`

Which challenge this activity belongs to.

### `member_id`

The challenge member whose activity is being scored.

Never trust a client-provided member ID.

Use `auth.uid()` inside SECURITY DEFINER logic.

### `date`

The Ordo activity date being evaluated.

### `routine_block_id`

The exact block from:

``` text
challenge_routines.routine
```

that the activity matched.

This is the challenge's planned block.

### `source_block_id`

The user's actual global-routine/override block that matched it.

### `planned_minutes`

Duration of the challenge routine block.

### `completed_minutes`

Actual completed minutes calculated from the user's completion
percentage:

``` text
source_block_duration × source_completion_pct / 100
```

### `completion_pct`

Computed at write time.

Do not allow the client to provide arbitrary challenge completion.

The server computes it.

------------------------------------------------------------------------

# 7. Challenge Log Initialization on Join

`challenge_join_internal()` must initialize challenge-log state.

For a member joining at time `joined_at`:

``` text
effective_from =
    max(challenge.start_at::date, joined_at::date)
```

Initialize rows for the member's effective challenge window and
challenge routine blocks.

Do not penalize a late joiner for days before they joined.

Therefore:

``` text
30-day challenge
user joins day 15

scoring window:
day 15 → day 30
```

Days 1--14 are outside that member's active scoring window.

For a rejoin, preserve the original membership history as required by
the existing system and only create/update logs for the active period
after rejoin. Do not erase prior challenge history.

------------------------------------------------------------------------

# 8. Block Matching Algorithm

This is the core fix.

For every changed date and every active challenge membership:

1.  load the user's blocks for that date
2.  load challenge routine blocks for that day of week
3.  compare blocks
4.  require category match
5.  calculate time overlap
6.  require at least 50% overlap
7.  if multiple challenge blocks match, choose the largest overlap
8.  write/update exactly one log for the winning challenge block

## 8.1 Source blocks

For a date:

``` text
if state.overrides[date] exists:
    use state.overrides[date]
else:
    use state.routine[day_of_week]
```

The user's `state.log[date][block_id]` supplies completion percentage.

## 8.2 Category matching

The categories must be equal:

``` sql
user_block.category = challenge_block.category
```

Titles are irrelevant.

Therefore:

``` text
"Study"
"Exam preparation"
"Deep work"
```

can match if their category is the same and the time rule passes.

Renaming a block must not break matching.

## 8.3 Time overlap

For two blocks:

``` text
overlap_start = max(start1, start2)
overlap_end   = min(end1, end2)

overlap_minutes =
    max(0, overlap_end - overlap_start)
```

The finalized matching rule is:

``` text
overlap_percentage =
    overlap_minutes
    /
    union_duration
    × 100
```

where:

``` text
union_duration =
    max(end1, end2) - min(start1, start2)
```

A match requires:

``` text
category matches
AND
overlap_percentage >= 50
```

If multiple challenge blocks qualify, choose the block with the largest
overlap percentage.

The implementation must be deterministic when there is a tie. Use a
stable secondary ordering such as challenge routine block ID.

## 8.4 Important clarification

Do not use:

``` text
overlap / challenge_block_duration
```

unless explicitly changing the finalized rule.

Use the finalized rule:

``` text
overlap / union duration
```

## 8.5 Matching helper

Prefer a PostgreSQL helper function so the matching logic is centralized
and testable.

For example:

``` text
calculate_block_overlap(...)
```

or an equivalent internal helper.

Do not duplicate the algorithm in web and mobile clients.

The database is the source of truth.

------------------------------------------------------------------------

# 9. Required Edge Cases

All of these must have automated tests.

  -----------------------------------------------------------------------
  Case                                Expected
  ----------------------------------- -----------------------------------
  Exact match                         Match

  Partial overlap \>50%               Match

  Partial overlap \<50%               No match

  Exactly 50%                         Match

  Different category                  No match

  Renamed source block                Match if category/time still match

  Moved source block                  Re-evaluate using new time

  Duplicated source blocks            Deterministic winner

  Multiple matching challenge blocks  Largest overlap wins

  Deleted source block                No log for that source block

  Deleted/absent routine block        No match

  Overlapping source blocks           Deterministic winner

  0% completion                       Log exists with 0 completion

  100% completion                     Log exists with full completion

  Midnight-crossing block             Handle using existing
                                      `block_minutes()` semantics

  New block created after challenge   `changed_date_keys()` detects the
  starts                              affected date
  -----------------------------------------------------------------------

Do not silently skip these cases.

------------------------------------------------------------------------

# 10. `save_state()` Integration

Current pipeline:

``` text
save_state()
  → changed dates
  → refresh_daily_scores()
```

New pipeline:

``` text
save_state()
  → save user_state
  → changed_date_keys()
  → refresh_daily_scores()
  → refresh challenge_logs for changed dates
```

## 10.1 Use `changed_date_keys()`

Do not scan the whole challenge period on every save.

If only:

``` text
2026-09-09
```

changed, process only:

``` text
2026-09-09
```

## 10.2 Routine changes

The existing behavior refreshes a broad range when the global routine
changes.

Preserve the existing `daily_scores` behavior.

For challenges, only process challenge-relevant dates that actually need
recalculation.

Do not introduce unnecessary full challenge-window scans.

## 10.3 Challenge matching helper

Add a server-side PostgreSQL function such as:

``` text
refresh_challenge_logs_for_dates(
    p_user uuid,
    p_days date[]
)
```

Responsibilities:

``` text
for each active challenge membership:
    for each changed date:
        read challenge routine
        read user's blocks
        match blocks
        calculate completed minutes
        calculate completion_pct
        UPSERT challenge_logs
```

This keeps `save_state()` smaller and makes challenge logic
independently testable.

------------------------------------------------------------------------

# 11. Updating and Removing Challenge Logs

Challenge logs represent the current matching result for a challenge
routine block.

When a source block changes:

``` text
old match
   ↓
save new state
   ↓
recalculate changed date
   ↓
new matching result
```

The affected log must be updated accordingly.

If a previously matched block no longer matches, the old challenge-log
row must not remain as stale scoring data.

Therefore the per-date refresh should reconcile the date:

``` text
1. determine expected matching rows
2. delete/reconcile stale rows for that member/challenge/date
3. upsert current matching rows
```

However, do not delete historical logs after finalization if the
finalization policy requires historical immutability.

After finalization, challenge score must remain frozen.

------------------------------------------------------------------------

# 12. `completion_pct()` for Challenges

Do not reuse the global `completion_pct()` implementation that reads
`daily_scores`.

The challenge version must read:

``` text
challenge_logs
```

and must be constrained by:

``` text
challenge_id
member_id
effective member window
```

Conceptually:

``` sql
SELECT coalesce(round(avg(cl.completion_pct), 2), 0)
FROM challenge_logs cl
WHERE cl.challenge_id = p_challenge
  AND cl.member_id = p_user
  AND cl.date BETWEEN from_d AND to_d;
```

If the existing global function name `completion_pct()` is already used
by non-challenge code, do not break it.

Instead, create a challenge-specific internal function, for example:

``` text
challenge_completion_pct(...)
```

and make `challenge_scores()` use that function.

This preserves global behavior while fixing challenge scoring.

------------------------------------------------------------------------

# 13. Challenge Scoring

The scoring model remains:

``` text
Completion     = 70%
Consistency    = 20%
Participation  = 10%
```

## 13.1 Completion

Calculate from challenge logs only.

Use the average of daily challenge completion percentages across the
member's effective window.

Equivalent behavior:

``` sql
completion =
    round(
        avg(challenge daily completion),
        1
    )
```

If there are no scoring days, return `NULL` where the existing API
expects `NULL`.

## 13.2 Consistency

The existing rule is based on:

``` text
completed_minutes >= min_daily_minutes
```

For challenge scoring, `completed_minutes` must come from the member's
challenge-specific logs, not `daily_scores`.

Then:

``` text
consistency =
    round(
        100 × floor_days / window_days,
        1
    )
```

## 13.3 Participation

A day is a participation day when:

``` text
completed_minutes > 0
```

again using challenge-specific logs.

Then:

``` text
participation =
    round(
        100 × active_days / window_days,
        1
    )
```

## 13.4 Final score

Preserve the existing formula:

``` sql
round(
    0.70 * completion
  + 0.20 * consistency
  + 0.10 * participation,
  1
)
```

Equivalent SQL must preserve the current null/division handling.

Do not change the weights.

Do not change rounding unless required by an actual bug.

------------------------------------------------------------------------

# 14. Effective Member Window

For each member:

``` text
from_d =
    max(challenge.start_at::date,
        member.joined_at::date)

to_d =
    min(
        challenge.end_at::date,
        current_date,
        coalesce(member.left_at::date, 'infinity')
    )
```

Then:

``` text
window_days = (to_d - from_d) + 1
```

This means:

``` text
late join → starts scoring when they join
leave     → scoring ends when they leave
```

Do not penalize late joiners for days before joining.

------------------------------------------------------------------------

# 15. Leaderboard

`get_challenge_leaderboard()` should continue returning the existing UI
shape.

Internally:

``` text
get_challenge_leaderboard()
    ↓
challenge_scores()
    ↓
challenge_logs
```

The leaderboard must not calculate scores from `daily_scores`.

For finalized challenges:

``` text
final_score
final_rank
```

stored on `challenge_members` become the historical source of truth.

For active challenges:

``` text
live challenge_scores()
```

can be used.

------------------------------------------------------------------------

# 16. Finalization

Current cron:

``` text
tick.server.ts
  → finalize_challenges()
```

Keep this architecture.

## 16.1 Finalization flow

``` text
find:
  end_at < now()
  AND finalized_at IS NULL

for each challenge:
    ensure required challenge log state is available
    calculate challenge_scores()
    assign final_score
    assign final_rank
    set finalized_at
```

Do not use `daily_scores` for challenge scoring.

## 16.2 Final score freeze

After finalization:

``` text
challenge_members.final_score
challenge_members.final_rank
```

are immutable.

Existing:

``` text
challenge_members_freeze_tg
```

must continue protecting them.

## 16.3 Challenge logs after finalization

Add explicit protection.

Preferred behavior:

``` text
finalized_at IS NOT NULL
    ↓
no new challenge-log writes
no updates to challenge logs
```

This prevents the live challenge-log state from diverging from the
frozen score.

If the product intentionally needs post-finalization historical
corrections, they must be handled by an explicit administrative
path---not normal user saves.

------------------------------------------------------------------------

# 17. Cancelled Challenges

Preserve the current semantics:

``` text
cancelled challenge
    ↓
finalized_at set
    ↓
no final score
```

Challenge logs may remain for audit/history, but they must not produce a
final competitive score.

Do not silently delete them unless the product explicitly requires
deletion.

------------------------------------------------------------------------

# 18. RLS and Grants

## 18.1 `challenge_routines`

Enable RLS.

Direct authenticated table writes should not be the normal path.

Use SECURITY DEFINER RPCs.

Rules:

``` text
SELECT:
    challenge owner

INSERT:
    challenge owner / creation RPC

UPDATE:
    challenge owner
    AND locked_at IS NULL

DELETE:
    revoked
```

`service_role`:

``` text
ALL
```

## 18.2 `challenge_logs`

Enable RLS.

Normal clients should not directly write arbitrary rows.

All writes should pass through SECURITY DEFINER functions that verify:

``` text
auth.uid() IS NOT NULL

member exists

member.user_id = auth.uid()

member.status = 'active'

challenge not finalized

date is inside effective challenge window
```

A user must never be able to submit:

``` text
member_id = another user's ID
```

and create their logs.

For reads:

``` text
challenge member → allowed for relevant challenge data
challenge owner → allowed where required by product
non-member → denied
```

The implementation should avoid exposing another member's detailed
activity unless the product explicitly requires it.

The leaderboard should expose scores, not task details.

------------------------------------------------------------------------

# 19. RPC Changes

## 19.1 Modify

### `create_challenge()`

Add:

``` text
challenge_routines creation
```

Return enough information for the creator to open/edit the routine.

### `join_challenge()`

Keep public validation behavior.

Route to:

``` text
challenge_join_internal()
```

### `join_challenge_by_code()`

Use the same internal join path.

### `challenge_join_internal()`

Add:

``` text
row lock
routine lock on first member
challenge_logs initialization
```

### `challenge_scores()`

Change source:

``` text
daily_scores ❌
challenge_logs ✅
```

### `finalize_challenges()`

Use challenge-specific scoring.

Protect finalization from repeated execution.

### `get_challenge_leaderboard()`

Continue existing return shape, but consume corrected scoring.

### `get_challenge_breakdown()`

Continue existing return shape, but consume corrected scoring.

## 19.2 Do not change unnecessarily

These should remain functionally unchanged:

``` text
leave_challenge()
cancel_challenge()
challenge_status()
refresh_daily_scores()
day_facts()
block_minutes()
weekly_pct()
pairing/accountability RPCs
```

Only modify them if compilation/dependency requirements force it.

------------------------------------------------------------------------

# 20. Web Changes

## `src/components/ordo/CommunityView.tsx`

Add challenge routine editing UI.

Creation flow becomes:

``` text
Create challenge
    ↓
challenge created
    ↓
open challenge routine editor
    ↓
creator adjusts routine
    ↓
save routine
    ↓
challenge ready
```

The UI must show:

``` text
Routine unlocked
```

until the first member joins.

After the first member joins:

``` text
Routine locked
```

and editing controls are disabled.

The frontend lock is UX only.

The database must enforce the lock.

Leaderboard UI should continue showing:

-   rank
-   score
-   own rank
-   completion
-   consistency
-   participation

Do not expose challenge member task details.

------------------------------------------------------------------------

# 21. Web Database Layer

## `src/lib/db.ts`

Add:

``` text
ChallengeRoutine
ChallengeLog
```

types where needed.

Update:

``` text
Challenge
```

to expose:

``` text
category
locked_at
routine information where needed
```

Add functions for:

``` text
getChallengeRoutine()
updateChallengeRoutine()
```

Use the existing database/RPC conventions.

Do not implement challenge matching in TypeScript.

------------------------------------------------------------------------

# 22. Web Ordo Types

## `src/lib/ordo.ts`

Update the `Challenge` type only as needed for the UI.

Potential fields:

``` typescript
locked_at?: string | null;
category?: string;
```

Keep leaderboard response types stable unless the database contract
changes.

------------------------------------------------------------------------

# 23. Mobile Changes

## `mobile/lib/screens/community_screen.dart`

Add the challenge routine editor.

The flow should mirror web:

``` text
create
  ↓
edit routine
  ↓
save
  ↓
join/competition
```

Disable editing after lock.

## `mobile/lib/services/db.dart`

Add RPC methods for:

``` text
get challenge routine
update challenge routine
```

Update challenge creation handling if the RPC response changes.

## `mobile/lib/models/ordo_state.dart`

Extend `Challenge` with fields required by the UI, especially:

``` text
category
locked_at
```

Avoid breaking older challenge responses.

------------------------------------------------------------------------

# 24. Backward Compatibility

Existing legacy shims must remain functional:

``` text
create_challenge(p_name, p_days)
challenge_leaderboard(p_challenge)
unpair(p_peer)
```

The legacy two-argument challenge creation path must still create a
valid `challenge_routines` row.

If the old client does not know about challenge routines:

``` text
challenge creation still succeeds
challenge gets deterministic default routine
```

The backend remains authoritative.

Do not require an old Flutter client to understand the new table
directly.

------------------------------------------------------------------------

# 25. Type Safety

For both web and mobile:

-   Do not assume optional fields are present.
-   Preserve existing RPC return shapes where possible.
-   Add explicit types for new routine/log data.
-   Validate JSON before writing `challenge_routines.routine`.
-   Never trust client-provided `member_id`, `completion_pct`, or
    `completed_minutes`.

------------------------------------------------------------------------

# 26. Performance

`save_state()` is a hot path.

Avoid:

``` text
every save
  × every challenge ever
  × every day in every challenge
```

Use:

``` text
active memberships only
× changed dates only
```

Recommended:

``` text
save_state()
  → changed_date_keys()
  → challenge refresh for changed dates
```

Add indexes:

``` text
challenge_logs(challenge_id, date)
challenge_logs(member_id, challenge_id, date)
```

If future scale makes synchronous challenge matching too expensive, move
it to an asynchronous job. Do not prematurely introduce a distributed
queue for the current implementation.

------------------------------------------------------------------------

# 27. Exact Implementation Order

Follow this order to avoid broken intermediate states.

## Phase 1 --- Database schema

Create:

``` text
0007_challenge_routines_logs.sql
```

Add:

-   `challenge_routines`
-   `challenge_logs`
-   indexes
-   constraints
-   grants
-   RLS
-   update timestamp trigger if needed
-   block-overlap helper
-   challenge-log helper functions

Do not change the frontend yet.

------------------------------------------------------------------------

## Phase 2 --- Challenge creation

Modify:

``` text
create_challenge()
```

to create the default challenge routine.

Test:

``` text
create challenge
→ challenge_routines exists
→ routine has correct category
```

------------------------------------------------------------------------

## Phase 3 --- Routine editing

Add:

``` text
get_challenge_routine()
update_challenge_routine()
```

Enforce:

``` text
owner only
locked_at IS NULL
```

Test editing before join.

------------------------------------------------------------------------

## Phase 4 --- Join

Modify:

``` text
challenge_join_internal()
```

Add:

``` text
FOR UPDATE
challenge_logs initialization
locked_at
```

Test:

``` text
first join → lock
second join → lock unchanged
```

------------------------------------------------------------------------

## Phase 5 --- Challenge log generation

Implement:

``` text
refresh_challenge_logs_for_dates()
```

Add:

``` text
category matching
time overlap
50% threshold
largest overlap winner
completion calculation
UPSERT
stale-row reconciliation
```

Test all matching cases before integrating with `save_state()`.

------------------------------------------------------------------------

## Phase 6 --- `save_state()`

Modify:

``` text
save_state()
```

to call the challenge log refresh using:

``` text
changed_date_keys()
```

Do not replace the existing `daily_scores` pipeline.

Verify:

``` text
global scoring still works
accountability still works
challenge scoring now sees only matching activity
```

------------------------------------------------------------------------

## Phase 7 --- Challenge scoring

Modify:

``` text
challenge_scores()
```

so all calculations use:

``` text
challenge_logs
```

Preserve:

``` text
70/20/10
rounding
member window
late join behavior
leave behavior
null/zero handling
```

------------------------------------------------------------------------

## Phase 8 --- Leaderboard and breakdown

Verify:

``` text
get_challenge_leaderboard()
get_challenge_breakdown()
challenge_score()
```

all use the corrected scoring path.

------------------------------------------------------------------------

## Phase 9 --- Finalization

Modify:

``` text
finalize_challenges()
```

to use challenge logs.

Add protection so challenge logs cannot change after finalization
through normal user activity.

Verify:

``` text
final_score frozen
final_rank frozen
leaderboard historical
```

------------------------------------------------------------------------

## Phase 10 --- Frontend

Update:

``` text
CommunityView.tsx
db.ts
ordo.ts
community_screen.dart
mobile/services/db.dart
mobile/models/ordo_state.dart
```

Add routine editing and lock state.

------------------------------------------------------------------------

## Phase 11 --- Tests

Run database tests first.

Then frontend tests.

Then full end-to-end testing.

------------------------------------------------------------------------

# 28. Test Plan

## 28.1 Existing regression tests

All existing tests in:

``` text
supabase/tests/smoke_pairing_challenges.sql
```

must continue passing.

Especially:

-   create
-   private create
-   join
-   join twice
-   finished challenge
-   leaderboard
-   leave
-   finalization
-   cancellation
-   RLS
-   internal RPC protection

------------------------------------------------------------------------

# 29. New Database Tests

Add tests for:

### Challenge routine

1.  Create challenge → routine automatically created.
2.  Routine category equals challenge category.
3.  Creator can edit before first join.
4.  Non-owner cannot edit.
5.  First member join sets `locked_at`.
6.  Creator cannot edit after lock.
7.  Second member does not change `locked_at`.
8.  Concurrent first joins cannot both modify the routine.

### Challenge logs

9.  Join creates expected log state.
10. Matching block creates log.
11. Different category creates no log.
12. Less-than-50% overlap creates no log.
13. Exactly 50% overlap matches.
14. Multiple matches choose largest overlap.
15. Duplicate save does not create duplicates.
16. Source block rename still matches.
17. Moved block is recalculated.
18. Deleted block removes stale match.
19. 0% completion produces 0%.
20. 100% completion produces 100%.
21. Midnight-crossing behavior is correct.
22. Late join is not penalized for earlier days.
23. Leave prevents new logs after `left_at`.
24. Rejoin does not corrupt historical logs.

### Scoring

25. Challenge completion uses `challenge_logs`.
26. Global Gym/Work activity cannot increase Study challenge score.
27. Consistency uses challenge completed minutes.
28. Participation uses challenge completed minutes.
29. 70/20/10 formula is exact.
30. Rounding is exact.
31. No matching activity gives the expected zero/null behavior.
32. Multiple members have independent scores.
33. Leaderboard ranking is correct.

### Finalization

34. Finalization stores final score.
35. Finalization stores final rank.
36. Running finalization twice does not change results.
37. Challenge logs cannot mutate after finalization through normal
    paths.
38. Frozen score remains unchanged.
39. Historical leaderboard uses frozen score.

### Security

40. Non-member cannot read private challenge logs.
41. User cannot insert logs for another user.
42. User cannot insert logs outside their challenge.
43. User cannot modify another member's logs.
44. User cannot modify finalized challenge logs.
45. User cannot edit another owner's challenge routine.
46. User cannot edit a locked routine.
47. `challenge_join_internal` is not directly callable by clients.

------------------------------------------------------------------------

# 30. Critical Regression Scenario

This must be the first end-to-end scenario after implementation.

## Setup

Global routine:

``` text
Monday
  Gym   — work   — 60m
  Study — study  — 60m
  Work  — work   — 60m
```

Challenge:

``` text
name: 30 Days of Study
category: study
routine:
  Monday → Study 09:00–10:00
```

User logs:

``` text
Gym   = 100%
Study = 0%
Work  = 100%
```

Expected:

``` text
daily_scores completion = 66.67%
```

because daily_scores still represents global activity.

But:

``` text
challenge_logs:
Study block → 0%
```

Therefore:

``` text
challenge completion = 0%
participation = 0%
consistency = 0%
final score = 0%
```

The Gym and Work blocks must contribute **nothing** to the Study
challenge.

Then test:

``` text
Study = 50%
```

Expected challenge completion contribution:

``` text
50%
```

Then:

``` text
Study = 100%
```

Expected:

``` text
100%
```

This proves the architectural bug is fixed.

------------------------------------------------------------------------

# 31. Definition of Done

The implementation is complete only when all of the following are true:

-   [ ] `challenge_routines` exists.
-   [ ] Every new challenge receives a default challenge routine.
-   [ ] Creator can edit the routine before first member joins.
-   [ ] First member join sets `locked_at`.
-   [ ] Routine is immutable after first join.
-   [ ] `challenge_logs` exists with correct types and primary key.
-   [ ] `challenge_logs.completion_pct` is server-computed.
-   [ ] Block matching uses category + \>=50% overlap.
-   [ ] Largest overlap wins.
-   [ ] All defined edge cases pass.
-   [ ] `save_state()` uses `changed_date_keys()`.
-   [ ] Global `daily_scores` behavior remains unchanged.
-   [ ] `weekly_pct()` remains Accountability-only.
-   [ ] Challenge scoring reads `challenge_logs`.
-   [ ] Completion is 70% of final score.
-   [ ] Consistency is 20%.
-   [ ] Participation is 10%.
-   [ ] Existing rounding/date-window behavior is preserved.
-   [ ] Late joins are not penalized for pre-join days.
-   [ ] Leaving stops new scoring after `left_at`.
-   [ ] Finalization freezes `final_score` and `final_rank`.
-   [ ] Challenge logs cannot mutate after finalization through normal
    paths.
-   [ ] RLS/grants protect both new tables.
-   [ ] SECURITY DEFINER functions validate `auth.uid()`.
-   [ ] Existing challenge smoke tests still pass.
-   [ ] New challenge-specific tests pass.
-   [ ] Web routine editor works.
-   [ ] Mobile routine editor works.
-   [ ] Legacy clients can still create/join/view challenges.
-   [ ] No challenge score is affected by unrelated global activity.

------------------------------------------------------------------------

# 32. Files Expected to Change

## New

``` text
supabase/migrations/0007_challenge_routines_logs.sql
```

## Database / server

``` text
supabase/migrations/0006_pairing_challenges_repair.sql
src/lib/server/state.server.ts
```

Prefer putting production changes into a new migration rather than
editing an already-applied migration.

## Web

``` text
src/components/ordo/CommunityView.tsx
src/lib/db.ts
src/lib/ordo.ts
```

## Mobile

``` text
mobile/lib/screens/community_screen.dart
mobile/lib/services/db.dart
mobile/lib/models/ordo_state.dart
```

## Tests

``` text
supabase/tests/smoke_pairing_challenges.sql
mobile/test/widget_test.dart
```

Add dedicated SQL tests for matching/scoring where appropriate rather
than putting every backend test into widget tests.

------------------------------------------------------------------------

# 33. Important Implementation Rules

1.  Do not use `weekly_pct()` for challenges.
2.  Do not use `daily_scores` for challenge scoring.
3.  Do not copy the user's global routine into the challenge by
    reference.
4.  Do not allow challenge routine edits after `locked_at`.
5.  Do not trust client-provided challenge scores.
6.  Do not trust client-provided `member_id`.
7.  Do not put matching logic separately in web and mobile.
8.  Do not scan every challenge day on every save.
9.  Do not break the existing Accountability system.
10. Do not change the existing 70/20/10 scoring weights.
11. Do not silently change rounding.
12. Do not silently penalize late joiners.
13. Do not allow normal user activity to mutate finalized challenge
    results.
14. Use transactions and row locks for first-member routine locking.
15. Use UPSERT with the existing challenge-log primary key.
16. Reconcile stale challenge logs when a changed activity block no
    longer matches.
17. Keep the leaderboard score-only; challenge task details remain
    private.

------------------------------------------------------------------------

# 34. Final Target Architecture

``` text
                    USER ACTIVITY
                         │
                         ▼
                    save_state()
                         │
                         ▼
                changed_date_keys()
                         │
             ┌───────────┴───────────┐
             │                       │
             ▼                       ▼
   refresh_daily_scores()    challenge matching
             │                       │
             ▼                       ▼
       daily_scores            challenge_logs
             │                       │
             ▼                       ▼
        weekly_pct()          challenge_scores()
             │                       │
             ▼                       ▼
     ACCOUNTABILITY             CHALLENGES
                                     │
                                     ▼
                               LEADERBOARD
```

And the challenge itself:

``` text
CREATE CHALLENGE
       │
       ▼
challenge_routines created
       │
       ▼
creator edits routine
       │
       ▼
FIRST MEMBER JOINS
       │
       ├── challenge_logs initialized
       │
       └── locked_at = now()
       │
       ▼
ROUTINE IMMUTABLE
       │
       ▼
members log normal Ordo activity
       │
       ▼
save_state()
       │
       ▼
match category + time
       │
       ▼
challenge_logs
       │
       ▼
70% completion
20% consistency
10% participation
       │
       ▼
LEADERBOARD
       │
       ▼
CHALLENGE ENDS
       │
       ▼
FINALIZE
       │
       ├── final_score
       ├── final_rank
       └── frozen historical result
```

## End result

The Challenge feature becomes a true **challenge-specific scoring
system** instead of a view over the user's entire Ordo activity.

A "30 Days of Study" challenge counts Study activity only.

A "30 Days of Gym" challenge counts Gym activity only.

Unrelated global activity remains visible to the user and continues
contributing to normal Ordo/Accountability scoring, but it cannot leak
into an unrelated Challenge.
