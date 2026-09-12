# Ordo — Web & Flutter UI/UX + Backend Redesign Implementation Plan (v3)

> **v3 changes:** integrates the v2 review. Adds: Core Decisions Log (§0), Vocabulary (§0.5),
> Recurrence vs Instance model (§4.5), Log as a first-class domain (§9), Offline & Sync strategy
> (§10), Auth & RLS model (§11), Metric definitions (§14), Priority weighting (§14.1), AI
> guardrails (§8.5), Accessibility threaded through sprints (§19), Analytics events (§21), Daily
> Close ritual (§5.7), Migration rollback / feature flags (§23), expanded testing edge cases
> (§20), and Non-goals (§22). Everything in `Ordo_Redesign_Implementation_Plan_v2.md` carries
> over unless a section here supersedes it.

---

## §0. Core Decisions Log (ADR Summary)

These decisions are **locked** unless explicitly revisited. Each is referenced by section elsewhere.

| ID  | Decision                                                                                              | Rationale                                                             |
|-----|-------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------|
| D1  | Routine instances are **virtual for future/today**, **materialized (snapshotted) once a day is logged** | Preserves historic accuracy while keeping routine edits cheap         |
| D2  | Debt is an **append-only ledger**, not a computed field                                               | Enables "when did I fall behind?" queries in Insights                 |
| D3  | Daily score = weighted sum of must + nice completions, **α = 0.7** for must                           | Prevents trivializing a day by doing ten "nice" items                 |
| D4  | Templates are **snapshots**, never live links                                                         | Editing a routine later must never mutate a saved template, and vice versa |
| D5  | Duplicate Day and Template Apply share **one internal operation** `applyRoutineSource(...)`           | Single semantics, single test surface                                 |
| D6  | Flutter is **offline-first** with **last-write-wins** conflict resolution                             | Execution surface must work on subway / gym / no-signal               |
| D7  | All authoritative calculations live **server-side or in shared deterministic logic**                  | Web == Flutter == backend parity is non-negotiable                    |
| D8  | AI **never** performs calculations; it interprets pre-computed facts                                  | LLM math is a bug factory                                             |
| D9  | AI mutations require **explicit user approval** and pass through typed tools                          | Trust + safety + auditability                                         |
| D10 | Every copy/duplicate/apply/clone path **mints fresh IDs**                                             | No shared references, no accidental cross-edits                       |
| D11 | Log is a **first-class domain**, source of truth for Insights                                         | "What Today showed" ≠ "what actually happened"                        |
| D12 | Notifications are **server-scheduled**, deduplicated client-side at display time                     | Must fire when app is closed; must not spam when app is open          |
| D13 | Accessibility is **threaded through every sprint**, not a polish phase                                | Retrofitting a11y is 3× the cost                                      |
| D14 | Every migration phase ships behind a **feature flag** with a documented rollback                      | Reduces blast radius of schema evolution                              |

---

## §0.5. Vocabulary (Locked Terms)

Use these terms **exactly** in code, docs, and UI. Loose usage is the #1 source of drift.

| Term                    | Meaning                                                                        | Not to be confused with    |
|-------------------------|--------------------------------------------------------------------------------|----------------------------|
| **Routine**             | A recurring pattern of activity in the user's week                             | Planner, Today             |
| **Routine Block**       | One recurring entry in a routine (title, time, category, priority)             | Task                       |
| **Routine Instance**    | A Routine Block projected onto a specific date                                 | Routine Block              |
| **Override**            | A date-specific modification that replaces the weekly routine for that date    | Template                   |
| **Task**                | A one-off actionable item; may be unscheduled                                  | Routine Block              |
| **Planner Entry**       | A Routine Instance **or** a scheduled Task appearing in the Planner view       | Today Item                 |
| **Today Item**          | A Planner Entry with completion state for the current date                     | Planner Entry              |
| **Log Entry**           | An immutable record of what actually happened (completion, journal, focus, debt) | Today Item               |
| **Completion**          | One of {0, 25, 50, 75, 100} recorded against a Today Item                      | Daily Score                |
| **Daily Score**         | Weighted rollup of a date's completions (see §14.1)                            | Completion                 |
| **Journal Entry**       | Free-text reflection keyed by `dateKey`                                        | Log Entry                  |
| **Debt**                | Accumulated missed must-do commitments (append-only ledger, §9.4)              | Daily Score                |
| **Streak**              | Consecutive days meeting the streak threshold (defined §14.4)                  | Daily Score                |
| **Template**            | A saved snapshot of a routine (full week or subset of days)                    | Routine                    |
| **Focus Session**       | A timed work interval, optionally linked to a Today Item                       | Timer (generic)            |
| **Snapshot**            | An immutable copy of a structure captured at a point in time                   | Reference / Link           |
| **Override Precedence** | `date-specific override > weekly routine`                                      | —                          |

---

## Routing clarifications (supersede §2 of v2)

**D-Routing-1:** Inbox is a **child view of Planner**, not a top-level tab. Deep links from
notifications point to `/?tab=Planner&task=<id>` (web) / `/planner/inbox?taskId=...` (Flutter).

**D-Routing-2:** Focus has a **standalone surface** used when a session is running or when launched
from a notification, and is **embedded as a widget** on Today when idle. There is no persistent nav
entry for Focus.

**Challenge activity channel:** scaffolded in this redesign (data model, settings UI, delivery
pipeline) but no events fire until the Challenge feature emits them. This keeps the redesign
self-contained while avoiding a second settings migration later.

**Shared templates:** sharing mechanics are an **existing** feature (public template library). What
is new in this redesign is the personal multi-day Template Library (§3.6) and the unified apply
operation (D5).

---

## §3.5 addendum — Unified copy operation (D5)

Duplicate Day and Template Apply both resolve to a single internal operation:

```ts
type RoutineSource =
  | { kind: "day"; dayOfWeek: number }                        // live day
  | { kind: "template"; templateId: string }                  // saved snapshot
  | { kind: "snapshot"; blocks: Block[] };                    // ad-hoc

type ApplyResult = {
  appliedDays: number[];
  skipped: { day: number; reason: "override-exists" | "challenge-locked" }[];
};

function applyRoutineSource(
  source: RoutineSource,
  targetDays: number[],
  mode: "replace" | "merge",
  context: { now: Date },
): Promise<ApplyResult>;
```

`duplicateRoutineDay` and `applyTemplate` are thin wrappers. Both:

- run as a single atomic state transition,
- mint fresh IDs for every cloned block (D10),
- return a per-target-day result so the UI can report partial successes,
- surface a warning when a target day already has blocks (replace) or an override exists.

Additional edge case: applying a template whose days overlap an existing date override must warn
that overrides take precedence, and offer to clear the override as part of the action.

---

## §4.5. Recurrence vs Instance Model (Critical — D1)

**Decision:** routine instances are virtual for future and today; materialized once a day is
logged (a completion or journal entry recorded for that date).

**Rationale**

- Virtual future: editing Monday's routine on Sunday should immediately reflect on all future Mondays.
- Materialized past: editing Monday's routine on Wednesday must not retroactively change Monday's
  history, or Insights lies.
- The transition happens at the moment of first log for a date.

**Mechanics**

```text
For a given date D:
  if D has any LogEntry (completion, journal, focus outcome):
      use materialized routine instances for D
  else:
      compute from the effective routine (override > weekly)
```

Materialization runs inside the same state transition as the first LogEntry write for a date:

```ts
function recordCompletion(state, dateKey, itemKey, value) {
  return ensureMaterialized(state, dateKey)   // snapshot if first log
    .then((s) => insertLogEntry(s, { dateKey, itemKey, value }))
    .then((s) => invalidateDerived(s, dateKey)); // score, debt, streak
}
```

**Consequences**

- Materialized instances are append-only for a given date (frozen on first log).
- Deleting the last LogEntry for a date does not un-materialize; the snapshot remains as a
  historical record of what was planned. Insights needs "planned vs actual".
- Users who edit a routine mid-day see the change reflected until their first log for that day.

---

## §4.6. Planner backend operations

```text
create_task() · update_task() · delete_task() · complete_task()
schedule_task() · unschedule_task() · reschedule_task() · list_tasks()
get_planner_day(date)   // merges routine instances + scheduled tasks
```

A task does not affect completion metrics merely by existing; only logged execution counts.

---

## §5.4 addendum — Notification delivery rule (D12)

Deduplication: **the server always sends; the client decides whether to display** based on
foreground state. This avoids requiring a presence heartbeat on the server (the naive v2
approach) and works correctly for multi-device and background-tab cases.

Additional edge cases:

- DST transition → scheduled times falling into the skipped hour coalesce to the next valid
  instant; never fire twice for the same logical event.
- Duplicate Day / template apply during quiet hours must not fire a notification per cloned block;
  queue a single digest.

---

## §5.7. Daily Close (New — Product Call)

A single Daily Close ritual fires at the reflection-prompt time (~21:30 default) and replaces
three independent end-of-day notifications (debt reminder, streak at risk, reflection prompt)
with one coherent flow:

```text
DAILY CLOSE · Mon Sep 14

You finished 3 of 4 must-do items.

Not done:
  ▸ 09:00 Study (Must)
  ▸ 17:00 Gym (Nice)

Reflection
"What worked, what slipped, and why?"
[________________________]

Tomorrow at a glance
  09:00 Study
  11:00 Database assignment
  17:00 Gym

        [Log 09:00 Study]     [Done for today]
```

- Reduces notification spam; creates a stronger habit loop.
- Feeds the debt ledger (D2) and reflection journal in one atomic action.
- Implementation: a UI composition over existing operations — no new backend domain. Triggered by
  the `dailyClose` channel (renamed from `dailyDebtReminder`; migrate old setting onto the new one).

---

## §8.5. AI Guardrails (New)

| Guardrail       | Rule                                                                                      |
|-----------------|-------------------------------------------------------------------------------------------|
| Cost            | Per-user monthly token budget; soft warning at 80%, hard stop at 100% with graceful fallback |
| Rate limit      | Max N Coach requests per user per hour (default 10); N per day (default 50)               |
| Idempotency     | Every proposal carries a `proposalId`; applying twice is a no-op                          |
| Audit log       | Every agent-initiated mutation logged with `{ userId, proposalId, tool, args, appliedAt }` |
| Prompt injection| Journal entries, task titles, goal descriptions treated as untrusted; wrapped in delimiters |
| Output validation| Tool calls validated against schema; malformed calls rejected without applying           |
| Failure isolation| If Coach fails, core productivity features (Today, Planner, Routine) are unaffected      |
| Reversibility   | Every agent action has an inverse; user can undo from the Coach panel within 24h          |

---

## §9. Log Domain (New — D11)

Log is the source of truth for Insights. It is not the same as Today's view: Today shows what was
planned; Log records what was executed.

### 9.2. Log entry types

```ts
type LogEntry =
  | { kind: "completion"; id: string; dateKey: string; itemId: string; value: 0 | 25 | 50 | 75 | 100; recordedAt: string }
  | { kind: "journal";    id: string; dateKey: string; text: string; recordedAt: string }
  | { kind: "focus";      id: string; dateKey: string; sessionId: string; recordedAt: string }
  | { kind: "debt_event"; id: string; dateKey: string; delta: number; reason: string; recordedAt: string };
```

### 9.4. Debt ledger (D2)

- Append-only. No updates, no deletes.
- Every missed must-do commitment appends a `debt_event` with `delta = +1`.
- Every recovery (a missed must marked done later) appends a `debt_event` with `delta = -1`.
- Debt balance = `SUM(delta)`. Never a computed field.
- Enables Insights to answer "when did I fall behind?" and "how often do I recover?"

### 9.5. Backend operations

```text
record_log_entry(entry)
list_log_entries(userId, dateRange, kind?)
get_debt_balance(userId)
get_debt_history(userId, dateRange)
```

---

## §10. Offline & Sync Strategy (New — D6)

### 10.1. Flutter (offline-first)

- Local store: SQLite (Drift) with typed schema mirroring server entities.
- Queue: mutations buffered locally when offline, replayed on reconnect.
- Conflict resolution: last-write-wins by `updatedAt` for editable entities (routine blocks,
  tasks, goals). Append-only entities (log entries, debt events) never conflict.
- Focus timer: persists entirely locally; syncs on session end or next online opportunity.
- Completion logging: queued locally; server reconciles.

### 10.2. Web

- Online-first, with optimistic UI for edits.
- Retry with exponential backoff for failed mutations.
- Service worker caches read paths for offline viewing (Today, Planner).

### 10.3. Sync invariants

- A local mutation is never dropped silently. If it can't be applied, surface a conflict UI.
- Server is authoritative for anything derived (scores, streaks, debt, insights).
- Client displays `lastSyncAt` when offline.

---

## §11. Auth & Multi-Tenancy (New)

### 11.1. Model

- Supabase Auth (email/password + OAuth).
- Every row scoped by `user_id`.
- Row-Level Security enforced on all tables: `auth.uid() = user_id` for user tables.

### 11.2. Shared resources

- Shared templates: stored in recipient's storage with `sharedFrom` for provenance. Cross-tenant
  reads happen only through a controlled `copy_public_template`-style RPC that writes a copy under
  the recipient — never a live read across tenants. Enforced at DB level, not just app level.
- Challenges: existing behavior preserved; RLS already applies.

### 11.3. Service-to-service

- Server-scheduled notifications run under a service role with explicit scoping.
- No client ever holds a service-role key.

---

## §14. Metric Definitions (New — Critical)

All metrics are computed server-side or in shared deterministic logic (D7). Web and Flutter must
not drift.

### 14.1. Priority weighting (D3)

```text
weight(item)       = item.priority === "must" ? α : (1 - α)      where α = 0.7
contribution(item) = (completion / 100) * weight(item)

daily_score = 100 * Σ contribution / Σ weight    over all planned items that date
```

Edge cases:

- No planned items → `daily_score = null` (not 0). UI displays "No plan for today."
- Only nice items → denominator uses `(1 - α)` per item; score is still 0–100.

### 14.2. Completion

```text
completion = Σ completion_values / Σ planned_items
```

Simple average of completion values, **not** weighted by priority. Priority affects
`daily_score`, not raw completion. Both are shown in Insights.

### 14.3. Must-do completion

```text
must_do_completion = Σ (must completions) / (100 * count(must items))
```

### 14.4. Streak

A day counts toward a streak if:

```text
daily_score(date) >= 70        (configurable threshold)
AND
must_do_completion(date) >= 0.5
```

Streak = longest run of consecutive qualifying days ending today or yesterday. If today has not
yet qualified but yesterday did, the streak is still active until end-of-day.

### 14.5. Consistency

```text
consistency = 1 - (stdev(daily_scores over period) / 100)
```

Clamped to [0, 1], shown as a percentage. Rewards steady performance over spiky performance.

### 14.6. Goal progress

Deterministic rollup rules, configurable per goal type at creation:

| Goal type | Rollup                                                       |
|-----------|--------------------------------------------------------------|
| Weekly    | Weighted average of contributing tasks' completion, weighted by estimated effort |
| Monthly   | Weighted average of child weekly goals                      |
| Semester  | Weighted average of child monthly goals                      |
| Yearly    | Weighted average of child semester goals                      |
| Custom    | User selects: task-count, effort-weighted, or milestone-based |

If a task has no `estimatedEffort`, weight = 1.

### 14.7. Planned vs actual

```text
planned_minutes = Σ (end - start) over routine instances + scheduled tasks
actual_minutes  = Σ focus sessions linked to those items + manual completion inferences
```

---

## §16.5. Backfill Strategy

| From                       | To                             | Method                                        |
|----------------------------|--------------------------------|-----------------------------------------------|
| `log` (existing LogMap)    | Log entries (`kind=completion`)| One-time idempotent script, per-date          |
| `journal` (existing)       | Log entries (`kind=journal`)   | Direct copy, preserve dateKey and recordedAt  |
| Computed debt (if any)     | Log entries (`kind=debt_event`)| Snapshot as a single opening balance per user |
| `routine` blocks (existing)| routine blocks (unchanged)     | No migration; instances materialize lazily    |

## §16.6. Rollback (D14)

- Each migration phase has a reverse script committed alongside the forward script.
- Feature flags gate the read path — flipping a flag off reverts behavior without data rollback.
- Backfill scripts are idempotent so they can be re-run safely.

---

## §19. Accessibility (Threaded Through Sprints — D13)

Not a polish phase. Each sprint includes its a11y work.

| Area                 | Requirement                                                                                     | Sprint |
|----------------------|-------------------------------------------------------------------------------------------------|--------|
| Routine weekly grid  | Full keyboard navigation: arrows move between cells, Enter opens editor, Esc closes             | 2      |
| Routine grid         | Screen-reader labels per cell: "Monday 09:00, Study, 60 minutes, Must"                           | 2      |
| Completion control   | ARIA radiogroup semantics; keyboard arrow selection                                              | 4      |
| Focus timer          | `aria-live="polite"` on remaining time; does not announce every second                           | 4      |
| Focus timer          | Reduced-motion: progress animates via opacity instead of width                                   | 4      |
| Notifications UI     | Settings form fully keyboard navigable; every toggle has an accessible name                      | 4      |
| Color contrast       | Completion color coding meets WCAG AA at all five levels                                         | 4      |
| Insights charts      | Every chart has a data-table equivalent via a "View as table" toggle                             | 6      |
| Goals hierarchy      | Tree view supports arrow-key navigation and expand/collapse via keyboard                         | 5      |
| Coach panel          | `aria-live` on new proposals; Approve/Dismiss reachable in two tabs                              | 7      |
| Flutter              | Semantics widgets on custom controls; respects `textScaleFactor`                                 | All    |

---

## §20. Testing addendum — Edge cases

Add to the v2 test list:

- DST transitions (EU/US) — a block at 02:30 on a spring-forward day; a debt reminder at 02:30 on
  a fall-back day.
- Year boundary — weekly summary spanning Dec 28 – Jan 3.
- User changes timezone mid-week → time-based channels re-resolve.
- Template applied while a Focus session is running does not mutate the running session's linked item.
- Duplicate Day during quiet hours fires no per-block notifications.
- Auth/RLS: user A cannot read user B's routine, tasks, log entries, or templates; shared template
  import produces a fresh copy owned by recipient; deleting a shared template does not affect
  recipients.
- Offline/sync: completion created offline → sync → server correct; same task edited on two
  devices → last-write-wins, no data loss; focus session completes offline → sync → single log
  entry, no duplicates.
- Metrics parity: web result == Flutter result == backend result for every §14 definition.

---

## §21. Analytics Events (New — Product Telemetry)

Distinct from user-facing Insights. These feed product decisions, not the user.

| Event                          | When                            | Properties                                   |
|--------------------------------|---------------------------------|----------------------------------------------|
| `routine_duplicate_day_used`   | Duplicate Day confirmed         | `{ sourceDay, targetCount, mode }`           |
| `template_saved`               | Template saved                  | `{ dayCount, blockCount }`                   |
| `template_applied`             | Template applied                | `{ templateId, targetCount, mode }`          |
| `template_shared`              | Template shared                 | `{ templateId }`                             |
| `focus_session_started`        | Focus starts                    | `{ contextual, plannedDuration }`            |
| `focus_session_completed`      | Focus reaches 0                 | `{ duration, moodRating }`                   |
| `focus_session_cancelled`      | Focus cancelled                 | `{ elapsedSeconds }`                         |
| `notification_channel_toggled` | Any channel on/off              | `{ channel, enabled }`                       |
| `daily_close_completed`        | Daily Close finished            | `{ itemsLogged, reflectionWritten }`         |
| `coach_proposal_shown`         | Coach proposal rendered         | `{ proposalId, kind }`                       |
| `coach_proposal_applied`       | User taps Apply                 | `{ proposalId, kind }`                       |
| `coach_proposal_dismissed`     | User taps Dismiss               | `{ proposalId, kind }`                       |

Privacy: no journal content, no task titles, no goal descriptions in telemetry.

---

## §22. Non-Goals (Explicitly Out of Scope for v3)

- Challenge redesign (only scaffolding for its notification channel)
- New AI model training or fine-tuning
- Desktop-native app
- Social features beyond existing Community
- Custom Insight ranges beyond Week/Month
- Multi-user shared routines (beyond template import)
- Calendar integrations (Google/Apple/Outlook)
- Voice input for tasks/journal
- Habit-tracker-specific UI (Routine covers this)

---

## §23. Feature Flags (D14)

Every migration phase ships behind a flag:

| Flag                        | Controls                                                        | Default    |
|-----------------------------|-----------------------------------------------------------------|------------|
| `ff_materialize_instances`  | Today/Planner read path uses instances vs virtual               | off → on   |
| `ff_tasks_domain`           | Inbox + Task model enabled                                      | off → on   |
| `ff_log_domain`             | Log entries written and read                                    | off → on   |
| `ff_analytics_v2`           | Insights uses new metric definitions (§14)                      | off → on   |
| `ff_daily_close`            | Daily Close replaces three end-of-day notifications             | off → on   |
| `ff_focus_v2`               | New focus timer with contextual linking + offline               | off → on   |
| `ff_coach`                  | Coach panel visible                                             | off → on   |

Flipping any flag off reverts behavior without data rollback (all data changes are additive).

---

## Sprint plan addendum

Sprint 1 additionally: decide recurrence/instance model (§4.5), offline strategy (§10), metric
definitions (§14), RLS model (§11); name Flutter state management (Riverpod); a11y baseline.

Sprint 2 additionally: grid keyboard navigation + screen-reader labels.
Sprint 4 additionally: Daily Close ritual; a11y for completion control, focus timer live region,
reduced-motion, notification settings.
Sprint 7 is hard-gated on Sprint 6 (Insights) being complete — AI summaries consume the analytics
APIs. Ship them merged or sequentially, never interleaved.

---

## Appendix A — Open Questions

1. α = 0.7 must/nice weighting: per-user tunable or fixed? **Recommendation: fixed for v3, revisit in v4.**
2. Streak threshold of 70: percentage of daily score, or raw count of must items? **Recommendation: percentage.**
3. Materialization timing: on first log, or on day rollover? **Recommendation: first log.**
4. Daily Close: replace the reflection prompt entirely, or coexist? **Recommendation: replace (single channel).**
5. Coach audit-log retention: 30 / 90 / forever? **Recommendation: 90 days.**

## Appendix B — Changelog

- **v3:** ADR log, vocabulary, recurrence/instance model, Log domain, offline strategy, auth/RLS,
  metric definitions, AI guardrails, accessibility threading, analytics events, Daily Close,
  migration rollback + flags, expanded tests, non-goals.
- **v2:** Added full implementation detail for Focus Timer, Notification Channels, Duplicate This
  Day, Template Library. Removed Community/Challenges from scope.
- **v1:** Initial redesign plan.
