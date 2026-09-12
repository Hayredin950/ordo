# Ordo — Web & Flutter UI/UX + Backend Redesign Implementation Plan (v2)

> **v2 changes:** Community/Challenges is now implemented (see the separate Challenge Feature plan) and out of scope here. This revision adds full implementation detail for four features that were previously listed only as one-liners: **Focus Timer** (Today), **Notification Channels** (Today/Settings), **Duplicate This Day** (Routine), and the **Template Library** (Routine). Everything else carries over unchanged from v1 unless noted.

## Scope

Redesign the Ordo areas that still need work:

- Routine
- Planner / Tasks
- Today
- Goals
- Insights

**Community / Challenges are out of scope for the main redesign.** Keep the existing Challenge architecture and UI direction, with only small consistency improvements where necessary.

The core product model becomes:

```text
Goals
  ↓
Routine → Planner → Today → Log
                         ↓
                    Insights
                         ↓
                       Coach
```

- **Routine:** what normally repeats
- **Task:** something that needs doing
- **Planner:** what is intentionally scheduled
- **Today:** what is being executed
- **Log:** what actually happened
- **Goal:** desired outcome
- **Insights:** what behavior shows
- **Challenge:** separate time-bound commitment/rulebook

AI is an intelligence layer over this system, not a replacement for deterministic business logic.

---

# 1. Product Principles

## Separate the concepts

Do not make every task a routine block.

| Concept | Meaning |
|---|---|
| Routine | A recurring activity pattern |
| Task | A one-off/actionable item |
| Planner | Where tasks and routines are scheduled |
| Today | Execution view |
| Log | Actual result |
| Goal | Desired outcome |
| Insights | Historical analysis |
| Challenge | Independent commitment/rulebook |

## Backend authority

Web and Flutter must not independently calculate authoritative:

- scores
- streaks
- debt
- goal rollups
- challenge scores
- consistency
- historical analytics

Frontend displays domain results.

## Mobile is not a shrunken desktop

Web can use multi-column workspaces.

Flutter should use:

- bottom sheets
- full-screen editors
- compact timelines
- swipe/drag interactions
- mobile-native navigation

---

# 2. Navigation

Recommended primary navigation:

```text
Today
Planner
Routine
Goals
Insights
Community
```

Supporting areas:

```text
Inbox / Tasks
Focus
Templates
Settings
```

Keep Community / Challenges separate from the redesign described here.

---

# 3. Routine Redesign

## Purpose

Routine answers:

> What normally repeats in my life?

It should no longer feel like a generic todo editor.

## Primary desktop view

```text
ROUTINE                              [Week] [Templates] [...]

Your recurring schedule

       MON     TUE     WED     THU     FRI     SAT     SUN

09:00  Study   Study   Study   Study   Study
10:00

17:00  Gym             Gym             Gym
18:00
```

Below or beside the weekly overview:

```text
MONDAY

Study       09:00–10:00    Study     Must
Gym         17:00–18:00    Health    Nice

[+ Add routine]
```

The weekly overview is the main interface. Clicking a block opens its editor.

## Block editor

Use a side panel on desktop and bottom sheet/full-screen editor on mobile:

```text
Study

Start       09:00
End         10:00
Title       Study
Category    Study
Priority    Must

[Delete]
```

Do not expose advanced operations everywhere.

## Keep existing functionality

Retain:

- recurring blocks
- day selection
- time editing
- title
- category
- priority
- duplicate day
- date-specific overrides
- templates
- shared templates
- effective-week preview

Move secondary functionality into menus/drawers.

## Override rule

Preserve:

```text
date-specific override > weekly routine
```

Show a clear `Custom day` indicator when an override exists.

## Duplicate This Day

### Purpose

Let a user reuse a day they've already configured instead of re-building it block by block. This is the single highest-leverage editing shortcut on the Routine page — most weeks are variations on 2–3 day patterns (e.g. "gym days" vs "study days").

### Entry points

- **Per-day menu** on the weekly view: `MONDAY ⋯` → `Duplicate this day`
- **Block editor footer** (when viewing a day, not a single block): `Duplicate day to...`

### Flow

```
Tap "Duplicate this day" on MONDAY
        │
        ▼
Bottom sheet / popover:

  Copy Monday's schedule to:

  ☐ Tue   ☐ Wed   ☑ Thu   ☐ Fri   ☐ Sat   ☐ Sun

  ⚠ Thursday already has 2 blocks.
     They will be replaced.

        [Cancel]        [Copy to 1 day]
```

- Multi-select target days in one action (don't force one-day-at-a-time).
- If a target day already has blocks, show an explicit **replace warning** per affected day — never silently merge or silently overwrite.
- Offer a lighter **"Merge instead of replace"** toggle only if the product wants additive copying; default behavior should be replace, since that matches user intent for "make Thursday look like Monday."
- After confirming, show a brief inline confirmation ("Copied to Thursday") rather than a modal dismissal with no feedback.

### Data rule

Every duplicated block is a **new record with a new ID** — never a shared reference to the source block. Editing the copy on Thursday must never change Monday.

```ts
function duplicateRoutineDay(sourceDay: DayOfWeek, targetDays: DayOfWeek[], mode: "replace" | "merge") {
  // 1. Load source day's blocks
  // 2. For each target day:
  //      - if mode === "replace": delete existing blocks for that day
  //      - clone each source block with a new id, same title/time/category/priority
  //      - insert cloned blocks under the target day
  // 3. Return the updated weekly routine
}
```

### Backend operation

```text
duplicate_routine_day(sourceDay, targetDays[], mode)
```

Runs as a single transaction so a partial failure never leaves some target days copied and others not.

### Edge cases

- Source day has zero blocks → disable the action, or show "Monday has no routine to copy."
- Target day is the source day itself → excluded from the selectable list.
- Routine is locked (rare — routines are generally not lockable outside Challenges, but if a routine is tied to an active Challenge's schedule, block the copy and explain why).

## Template Library

### Purpose

Templates let a user save a full weekly pattern (or a single day) once and reapply it later — useful for recurring life phases ("Exam week", "Off-season training", "Internship schedule") without rebuilding routines from scratch each time.

### Where it lives

```text
Routine  →  [Templates] (top-right action)
```

Opens the **Template Library**, not a dropdown — templates carry enough detail (multiple days, multiple blocks each) to deserve a dedicated screen/sheet.

### Template Library screen

```text
TEMPLATES

Your templates

┌─────────────────────────────────────┐
│ 📚 Exam Week                        │
│ 5 days · 12 blocks                  │
│ Last used 3 weeks ago               │
│                       [Apply] [⋯]   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 💼 Internship Schedule               │
│ 5 days · 8 blocks                    │
│                       [Apply] [⋯]   │
└─────────────────────────────────────┘

Shared with you

┌─────────────────────────────────────┐
│ 🏋 Push/Pull/Legs (from Ahmed)      │
│ 6 days · 6 blocks                    │
│                       [Apply] [⋯]   │
└─────────────────────────────────────┘

              [+ Save current week as template]
```

`⋯` menu per template: `Rename`, `Duplicate`, `Share`, `Delete`.

### Save flow

```
Routine page → [Templates] → "Save current week as template"
        │
        ▼
  Name this template
  [ Exam Week________________ ]

  Include days:
  ☑ Mon ☑ Tue ☑ Wed ☑ Thu ☑ Fri ☐ Sat ☐ Sun

        [Cancel]        [Save template]
```

Only the selected days' blocks are captured into the template — a template is a snapshot, not a live link to the current routine (editing the routine later never changes a saved template, and vice versa).

### Apply flow

Applying a template behaves like a bulk version of Duplicate Day, with the same replace/merge and warning rules:

```
Apply "Exam Week"?

This will replace your current
Monday–Friday routine.

        [Cancel]        [Apply template]
```

### Sharing

If templates are shareable (per v1's "shared templates" mention), an imported/shared template must be **copied into the recipient's own storage with fresh IDs** on import — never a reference back to the sharer's template, so the sharer editing or deleting their original never affects someone who applied it.

### Data model

```ts
type RoutineTemplate = {
  id: string;
  ownerId: string;
  name: string;
  days: {
    dayOfWeek: number;
    blocks: { title: string; category?: string; priority?: "must" | "nice"; startTime: string; endTime: string }[];
  }[];
  createdAt: string;
  updatedAt: string;
  sharedFrom?: string; // original template id, for provenance display only — not a live link
};
```

### Backend operations

```text
list_templates()
create_template(name, days[])
apply_template(templateId, targetDays[], mode)
rename_template()
delete_template()
share_template(templateId, targetUserId)
import_shared_template(sharedTemplateId)  // clones with fresh IDs
```

### Edge cases

- Applying a template to a routine that has an active Challenge lock on some days → block those specific days, apply to the rest, and report which days were skipped and why.
- Deleting a template a user previously shared → does not remove it from anyone who already imported it (they hold their own copy).

## Backend

Preserve existing routine state where possible. Provide/reuse domain operations such as:

```text
get_effective_routine(date)
get_weekly_routine()
create_routine_block()
update_routine_block()
delete_routine_block()
duplicate_routine_day()
apply_routine_template()
```

All copies must receive fresh IDs. Never share object references.

## Tests

Cover:

- editing one day
- duplicate day → single target, multi-target, replace vs merge, warning shown when overwriting, source-day-has-nothing case, source-day-excluded-from-targets case
- Mon–Fri copy
- date-range override
- override precedence
- template save (partial day selection, full week)
- template apply (replace warning, partial-lock skip behavior)
- template rename/delete (delete doesn't affect others' imported copies)
- shared template import (fresh IDs, no live link back to source)
- fresh IDs across all copy/duplicate/apply paths
- web/mobile consistency

---

# 4. Planner / Tasks Redesign

## Purpose

Planner answers:

> What do I intend to do, and when?

This is the major missing separation in the old design.

## Task model

If the current state does not already contain an equivalent task model, introduce one:

```ts
type Task = {
  id: string;
  title: string;
  category?: string;
  priority?: "must" | "nice";
  status: "todo" | "done" | "cancelled";

  dueDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;

  goalId?: string;
  createdAt: string;
  updatedAt: string;
};
```

Adapt the existing model instead of duplicating storage if a compatible model already exists.

## Inbox

```text
INBOX

+ Add task

□ Finish database assignment
□ Apply for internship
□ Read Docker chapter
□ Buy charger
```

Inbox items do not require a time slot.

## Planner

Combine routine instances and scheduled tasks:

```text
MONDAY

09:00 ───── 10:00
📚 Study
Routine

11:00 ───── 12:30
📝 Finish database assignment
Task

17:00 ───── 18:00
💪 Gym
Routine
```

## Task lifecycle

```text
Unscheduled
    ↓
Scheduled to date
    ↓
Time-blocked
    ↓
Completed
```

A task should not affect completion metrics simply because it exists. Actual execution/logging determines what contributes to the relevant metrics.

## Backend operations

```text
create_task()
update_task()
delete_task()
complete_task()
schedule_task()
unschedule_task()
reschedule_task()
list_tasks()
```

---

# 5. Today Redesign

## Purpose

Today answers:

> What am I doing today, and how am I actually performing?

Execution should be the primary focus.

## Desktop structure

```text
TODAY
Monday, September 14                  [<] [Today] [>]

82%
Daily score

------------------------------------------------
09:00  📚 Study
       Routine · Must
       [0] [25] [50] [75] [100]

11:00  📝 Database assignment
       Task · Must
       [0] [25] [50] [75] [100]

17:00  💪 Gym
       Routine · Nice
       [0] [25] [50] [75] [100]
------------------------------------------------

Next
17:00 · Gym

Reflection
"What worked, what slipped, and why?"
```

## Keep

- date navigation
- completion control 0/25/50/75/100
- daily score
- streak
- journal
- debt
- focus timer
- announcement banner
- onboarding

## Reduce visual competition

Move notification setup to:

```text
Settings → Notifications
```

Today can show only a compact status.

Make advanced timer settings secondary.

Make debt details expandable.

Make onboarding a compact checklist.

## Notification Channels

### Purpose

Today currently competes for space with ad hoc notification setup. Move configuration to a dedicated Settings screen, organized by **channel** — each channel is a distinct type of notification the user can independently enable, time, and (where relevant) route to a delivery method.

### Channels

| Channel | Trigger | Default | Configurable |
|---|---|---|---|
| Routine block starting | N minutes before a scheduled block | 10 min before, on | Lead time, on/off per category |
| Task due | Task's due date/time | On, at due time | Lead time, on/off |
| Daily debt reminder | Missed must-do items exist, once/day | On, 19:00 | Time, on/off |
| Streak at risk | No logged activity yet, late in the day | On, 21:00 | Time, on/off |
| Daily reflection prompt | End of day | On, 21:30 | Time, on/off |
| Weekly summary | Once/week | On, Sunday 18:00 | Day/time, on/off |
| Coach recommendation | New AI suggestion available | On | On/off only |
| Challenge activity | Someone overtakes your rank / challenge ending soon | On | On/off only |

### Settings screen

```text
SETTINGS → NOTIFICATIONS

Delivery
  Push                              [✓]
  Email                             [ ]

Channels

Routine reminders
  Notify before a block starts      [✓]
  Lead time                         10 min ▾

Task due reminders                  [✓]

Daily debt reminder                 [✓]
  Time                              19:00

Streak at risk                      [✓]
  Time                              21:00

Reflection prompt                   [✓]
  Time                              21:30

Weekly summary                      [✓]
  Day / time              Sunday · 18:00

Coach recommendations               [✓]

Challenge activity                  [✓]

Quiet hours
  Don't notify between      22:00 – 07:00
```

- **Quiet hours** apply across all channels except ones the user explicitly marks as urgent-only (if that concept exists) — otherwise, quiet hours simply suppress delivery and, where meaningful, queue a single digest instead of firing multiple missed notifications on wake.
- Today's own UI should show only a compact status, not a full settings surface:

```text
🔔 Notifications on · 3 reminders today     [Manage]
```

### Data model

```ts
type NotificationPreferences = {
  delivery: { push: boolean; email: boolean };
  channels: {
    routineReminder: { enabled: boolean; leadMinutes: number };
    taskDueReminder: { enabled: boolean };
    dailyDebtReminder: { enabled: boolean; time: string };
    streakAtRisk: { enabled: boolean; time: string };
    reflectionPrompt: { enabled: boolean; time: string };
    weeklySummary: { enabled: boolean; dayOfWeek: number; time: string };
    coachRecommendation: { enabled: boolean };
    challengeActivity: { enabled: boolean };
  };
  quietHours: { enabled: boolean; start: string; end: string };
};
```

### Delivery architecture

```text
Trigger event (scheduler tick, task due, debt computed, coach output, challenge event)
        │
        ▼
Notification eligibility check
   (channel enabled? within quiet hours? user still active in-app?)
        │
        ▼
Delivery fan-out
   ├── Web Push (Service Worker + Push API)
   └── Mobile Push (FCM for Android, APNs for iOS)
        │
        ▼
Notification tap → deep link to relevant screen
   (routine reminder → Today at that block,
    task due → Planner/task detail,
    debt → Today debt panel,
    coach → Coach panel,
    challenge → Challenge card)
```

- Scheduling for time-based channels (debt reminder, streak-at-risk, reflection, weekly summary) should be driven server-side (a scheduled job per user preference), not client-side timers, so notifications still fire when the app isn't open.
- Routine-block and task-due reminders need per-item scheduling keyed to that item's time — reschedule/cancel the underlying notification whenever the block or task is edited, rescheduled, or deleted.
- Deduplicate: if a user has the app open and actively viewing Today, suppress the push and show an in-app toast/badge instead.

### Backend operations

```text
get_notification_preferences()
update_notification_preferences()
register_push_token(platform, token)
schedule_item_reminder(itemId, itemType, fireAt)
cancel_item_reminder(itemId)
```

### Edge cases

- User disables push permission at the OS level → app should detect this and show a passive banner ("Notifications are off in your device settings") rather than silently failing.
- User changes timezone → resolve all time-based channels (debt reminder time, quiet hours, etc.) against the user's current timezone, and re-schedule server-side jobs accordingly.
- Multiple devices → push token registration must support more than one token per user (e.g. phone + desktop web).

## Completion

Keep the five-value segmented control.

100% should use subtle success styling, strikethrough and reduced emphasis.

## Journal

Continue persisting:

```text
journal[dateKey]
```

The journal becomes an important future AI context source.

## Debt

Show the summary first:

```text
3 missed commitments

[Review debt]
```

Only expand detailed catch-up information when requested.

## Focus Timer

### Purpose

The Focus timer should feel attached to *what you're working on right now*, not exist as a standalone stopwatch competing with the Today timeline for attention.

### Entry points

1. **Contextual, from a block/task** — each item on Today's timeline gets a small `▶ Focus` affordance. Tapping it pre-fills the timer with that item's title/category and starts immediately (or opens a confirm-and-start sheet).
2. **Standalone widget** — a compact card lower in the Today layout for ad hoc focus sessions not tied to a scheduled item:

```text
Focus
50 min
[Start]
```

### Session states

```
Idle → Running → Paused → Completed
                     │
                     └──→ Cancelled (discarded, not logged)
```

```text
FOCUS · Study                         (contextual — linked to 09:00 block)

              23:41
          remaining

     ██████████████░░░░░░░░

     [Pause]        [End early]
```

- **Idle**: shows duration picker (default presets 25/50/90 min + custom) and a Start button.
- **Running**: countdown, pause/end-early controls, and — if linked to a block/task — a visible chip naming that item so the user always knows what the session is "for."
- **Paused**: countdown frozen, `[Resume]` replaces `[Pause]`; auto-resume reminder if left paused too long (configurable, e.g. nudge after 10 min paused).
- **Completed** (timer reaches 0, or user ends early past a minimum threshold): brief summary —

```text
Focus session complete
50 minutes · Study

Did this session go well?
[😀]  [😐]  [😞]

[Log to Study block]     [Done]
```

  If the session was contextual, offer a one-tap "apply this session's completion" that feeds into the linked block/task's completion control (0/25/50/75/100) rather than requiring the user to separately mark it done.

- **Cancelled** (ended well before the minimum threshold): discard without logging, no guilt-inducing "you failed" messaging — just return to idle.

### Persistence rules

- The timer must survive app backgrounding, tab switching, and app restarts — persist `startedAt`, `durationSeconds`, `pausedAt`/`pausedDurationTotal`, and `linkedItemId` server-side or in durable local storage, and recompute remaining time from timestamps rather than trusting an in-memory countdown.
- Only one active focus session per user at a time (starting a new one while one is running should prompt to end the current one first, not silently overwrite it).

### Data model

```ts
type FocusSession = {
  id: string;
  userId: string;
  linkedItemId?: string;       // routine block or task id
  linkedItemType?: "routine" | "task";
  plannedDurationSeconds: number;
  startedAt: string;
  pausedIntervals: { start: string; end?: string }[];
  endedAt?: string;
  outcome?: "completed" | "cancelled";
  moodRating?: "good" | "neutral" | "bad";
};
```

### Backend operations

```text
start_focus_session(linkedItemId?, durationSeconds)
pause_focus_session(sessionId)
resume_focus_session(sessionId)
end_focus_session(sessionId, outcome, moodRating?)
get_active_focus_session()
```

### Advanced settings (secondary, not on Today itself)

Move to a settings sub-screen or overflow menu: custom preset durations, auto-start-break-timer toggle, sound/haptic choices, "auto pause when app backgrounded" toggle. Today itself only ever shows the compact widget above.

## Backend

Preserve authoritative calculations for:

- daily score
- streak
- debt
- completion

Use changed-date processing rather than recalculating unnecessary history.

---

# 6. Goals Redesign

## Purpose

Goals answer:

> What am I trying to achieve?

## Main page

Make the goal hierarchy the main workspace rather than making the page primarily a creation form.

```text
GOALS

2026
━━━━━━━━━━━━━━━━━━━━
Software Engineering       72%

Semester
━━━━━━━━━━━━━━━━━━━━
AI Engineering             68%
University                 84%

This Month
━━━━━━━━━━━━━━━━━━━━
Build RAG prototype        42%

This Week
━━━━━━━━━━━━━━━━━━━━
Finish Docker module       75%
```

## Goal detail

```text
BUILD RAG PROTOTYPE

42% progress

████████░░░░░░░░

Target: 80%

WHY
...

PLAN
...

ACTIVITY
...

REFLECTION
...

Related tasks
...
```

## Goal/task relationship

```text
Goal
 ↓
Tasks
 ↓
Planner
 ↓
Execution
 ↓
Logs
```

Do not assume every task contributes equally to goal progress. Define deterministic rollup rules.

## Goal creation

Use a compact modal/sheet:

```text
Create goal

What do you want to be true?
[________________________]

Period
[Week ▾]

Category
[Study ▾]

Target
[80%]

[Create goal]
```

## Future-self letters

Keep the feature, but move it into a secondary goal area/tab:

```text
Goal Detail
Overview
Tasks
Progress
Future Letter
```

It should not compete visually with the goal hierarchy.

## Backend

Use/reuse operations such as:

```text
get_goal_progress(goal_id)
get_goal_children(goal_id)
get_goal_activity(goal_id)
create_goal()
update_goal()
delete_goal()
```

Keep authoritative progress calculation server-side/shared deterministic logic.

---

# 7. Insights Redesign

## Purpose

Insights answers:

> What is my behavior telling me?

Do not build a page full of unrelated charts.

## Main structure

```text
INSIGHTS

This week                         [<] [Week] [>]

YOUR PERFORMANCE

Completion       82%
Consistency      76%
Must-do          88%

TREND

This week        82%
Last week        74%
Change           +8%

WHAT'S WORKING

✓ Morning study is highly consistent
✓ Wednesday is your strongest day

WHAT'S NOT

⚠ Evening must-do blocks are often missed
⚠ Sunday planning is inconsistent

PATTERNS

Best time:       08:00–12:00
Weakest time:    18:00–21:00
Best category:   Study

GOALS

AI Engineering       68%
University            84%

CHALLENGES

Current challenge    #4
Score                78.4
```

## Useful visualizations

Only use charts that answer questions:

- completion trend
- consistency trend
- day-of-week heatmap
- time-of-day performance
- category breakdown
- goal progress
- planned vs actual

Avoid decorative charts.

## Backend analytics layer

Create deterministic functions:

```text
calculate_completion()
calculate_consistency()
calculate_streak()
calculate_debt()
calculate_category_performance()
calculate_day_performance()
calculate_time_of_day_performance()
calculate_weekly_trend()
calculate_goal_progress()
calculate_planned_vs_actual()
```

Return compact structured results to both web and Flutter.

Example:

```ts
type InsightSummary = {
  completion: number;
  consistency: number;
  mustDoCompletion: number;

  strongestDay: string;
  weakestDay: string;

  strongestTimeRange: string;
  weakestTimeRange: string;

  weeklyTrend: number;

  categories: CategoryInsight[];
};
```

Support Week and Month initially. Add longer/custom ranges after the core implementation is stable.

---

# 8. AI / Agentic Layer

AI should be built after the deterministic productivity engine is stable.

## Principle

Do not ask an LLM to calculate things the application can calculate exactly.

Backend calculates:

```text
82% completion
3 missed must-do blocks
Wednesday strongest
Evenings weakest
```

The LLM interprets these facts and produces useful recommendations.

## Ordo Coach

Example:

```text
ORDo COACH

You completed 82% of your planned
blocks this week.

Your mornings are consistently
stronger than your evenings.

You have 3 missed must-do blocks.

I recommend moving tomorrow's
study session to 09:00.

[Apply]
[Why?]
[Dismiss]
```

## Agent architecture

```text
User
  |
  v
Ordo Coach
  |
  +--> Context tools
  |      |
  |      +--> get_today()
  |      +--> get_week()
  |      +--> get_goals()
  |      +--> get_routine()
  |      +--> get_activity()
  |      +--> get_debt()
  |
  +--> LLM reasoning
  |
  +--> Proposal
          |
          v
     User approval
          |
          v
       Typed tool
          |
          v
        Database
```

## Possible tools

```text
get_today()
get_week()
get_routine()
get_goals()
get_goal_progress()
get_recent_activity()
get_missed_blocks()
get_insights()
get_challenges()

create_task()
schedule_task()
reschedule_task()
create_routine_block()
update_goal()
create_catchup_plan()
```

Never provide unrestricted SQL/database access to the LLM.

For meaningful mutations:

```text
AI proposal
    ↓
User approval
    ↓
Typed tool
    ↓
Authorization
    ↓
Database
```

## Initial AI scope

Implement first:

1. Daily summary
2. Weekly behavioral summary
3. Catch-up planning
4. Schedule recommendations
5. Goal-progress explanation

Then expand to agentic execution.

---

# 9. Shared Backend / API Layer

Both clients should consume the same domain behavior:

```text
Web ────────┐
            ├── Backend / Supabase
Flutter ────┘
```

Recommended domains:

```text
routine
tasks
planner
today
goals
insights
coach
```

Do not duplicate important business rules in React and Dart.

---

# 10. Web Structure

Recommended component organization:

```text
src/components/ordo/
├── routine/
│   ├── RoutinePage.tsx
│   ├── RoutineWeekView.tsx
│   ├── RoutineBlock.tsx
│   ├── RoutineBlockEditor.tsx
│   ├── RoutineTemplates.tsx
│   └── RoutineOverrideBadge.tsx
│
├── planner/
│   ├── PlannerPage.tsx
│   ├── PlannerTimeline.tsx
│   ├── TaskInbox.tsx
│   ├── TaskItem.tsx
│   └── TaskEditor.tsx
│
├── today/
│   ├── TodayPage.tsx
│   ├── TodayTimeline.tsx
│   ├── CompletionControl.tsx
│   ├── DailyScore.tsx
│   ├── StreakCard.tsx
│   ├── DebtPanel.tsx
│   ├── Journal.tsx
│   └── FocusWidget.tsx
│
├── goals/
│   ├── GoalsPage.tsx
│   ├── GoalTree.tsx
│   ├── GoalCard.tsx
│   ├── GoalDetail.tsx
│   └── GoalEditor.tsx
│
├── insights/
│   ├── InsightsPage.tsx
│   ├── PerformanceSummary.tsx
│   ├── TrendChart.tsx
│   ├── DayHeatmap.tsx
│   ├── TimeOfDayAnalysis.tsx
│   └── CategoryAnalysis.tsx
│
└── coach/
    ├── CoachCard.tsx
    ├── CoachPanel.tsx
    └── CoachAction.tsx
```

---

# 11. Flutter Structure

```text
mobile/lib/
├── screens/
│   ├── routine/
│   │   ├── routine_screen.dart
│   │   └── routine_editor_screen.dart
│   ├── planner/
│   │   ├── planner_screen.dart
│   │   └── task_editor_screen.dart
│   ├── today/
│   │   └── today_screen.dart
│   ├── goals/
│   │   ├── goals_screen.dart
│   │   └── goal_detail_screen.dart
│   └── insights/
│       └── insights_screen.dart
│
├── widgets/
│   ├── routine/
│   ├── planner/
│   ├── today/
│   ├── goals/
│   ├── insights/
│   └── coach/
│
└── services/
    ├── routine_service.dart
    ├── task_service.dart
    ├── goal_service.dart
    ├── insight_service.dart
    └── coach_service.dart
```

---

# 12. Database / Migration Strategy

Do not rewrite the entire database at once.

## Phase A — Audit

Identify current:

```text
routine state
daily_scores
journal
goals
tasks
overrides
templates
challenge tables
```

## Phase B — Tasks

Introduce missing task/planner persistence only if the existing state cannot support the required model.

## Phase C — Analytics

Create deterministic backend analytics functions.

## Phase D — Today

Update Today to consume routine instances + task instances.

## Phase E — Goals

Connect goals to activity/tasks through deterministic rollups.

## Phase F — Insights

Build the Insights API on the analytics layer.

## Phase G — AI

Build Coach on top of stable analytics/context APIs.

---

# 13. Migration Safety

For existing users:

- preserve routine data
- preserve logs
- preserve challenge behavior
- preserve challenge routines
- preserve date overrides
- preserve journals
- preserve goals
- preserve templates

Do not change Challenge scoring as part of this redesign.

---

# 14. Performance

Avoid recalculating the entire history after every edit.

Use changed-date processing where applicable.

Today should request only:

```text
one date
→ effective routine
→ relevant tasks
→ logs
→ summary
```

Insights should request:

```text
selected period
→ server aggregation
→ compact result
```

Do not load years of raw activity into the client for every Insights view.

---

# 15. Testing

## Routine

- weekly routine
- overrides
- precedence
- duplication
- templates
- fresh IDs

## Tasks

- create
- update
- delete
- complete
- schedule
- reschedule
- unschedule

## Planner

- routine + task combination
- drag/reschedule
- timezone
- date boundaries

## Today

- completion values
- daily score
- journal
- streak
- debt
- focus timer: start/pause/resume/end-early/cancel, persistence across app restart and backgrounding, single-active-session rule, contextual link to a block/task feeding its completion control
- notifications: channel enable/disable respected, quiet hours suppress delivery, per-item reminders reschedule on edit/delete and cancel on delete, timezone changes re-resolve scheduled times, multi-device token registration

## Goals

- hierarchy
- creation
- progress
- task relationship
- deletion

## Insights

- weekly calculations
- monthly calculations
- empty history
- partial history
- timezone boundaries

## Cross-platform

For important domain behavior:

```text
Web result == Flutter result == backend result
```

---

# 16. Implementation Order

## Sprint 1 — Architecture

- finalize Routine vs Task vs Planner
- audit current state/schema
- identify reusable code
- identify migrations

## Sprint 2 — Routine

- weekly visual view
- focused editor
- overrides
- duplicate this day (multi-target, replace/merge, warnings)
- template library (save, apply, rename/delete, sharing + fresh-ID import)
- responsive web
- mobile editor

## Sprint 3 — Tasks + Planner

- task model
- Inbox
- planner timeline
- routine + task combination
- scheduling/rescheduling

## Sprint 4 — Today

- execution-first layout
- task integration
- routine integration
- completion logging
- simplified secondary panels
- focus timer (contextual + standalone, persistence, session outcome → completion)
- notification channels (settings screen, server-side scheduling, quiet hours, per-item reminders, deep links)

## Sprint 5 — Goals

- hierarchy redesign
- goal detail
- task relationships
- simplified creation
- secondary Future Letter area

## Sprint 6 — Insights

- analytics functions
- weekly/monthly summaries
- trends
- patterns
- goal analytics
- planned vs actual

## Sprint 7 — AI

- Coach context
- daily summary
- weekly summary
- catch-up
- recommendations
- approval-based tools

## Sprint 8 — Polish

- animations
- loading states
- error states
- empty states
- accessibility
- responsive behavior
- Flutter-specific polish
- performance

---

# 17. Definition of Done

## Routine

- recurring schedule is visually understandable
- routine is separate from tasks
- editing is fast
- overrides work
- duplicate-this-day works with clear replace/merge warnings and fresh IDs
- template library supports save/apply/share with no live links between copies

## Planner

- unscheduled tasks are supported
- tasks can be scheduled
- routine and tasks can appear together
- rescheduling is easy

## Today

- execution is primary
- completion logging is prominent
- journal remains available
- score/streak/debt are understandable
- secondary setup features do not dominate
- focus timer survives backgrounding/restart and correctly feeds linked-item completion
- notification channels are configurable in Settings, fire server-side on schedule, and respect quiet hours

## Goals

- hierarchy is clear
- progress is visible
- details show contributing activity
- creation is simple

## Insights

- charts answer real questions
- trends/patterns are visible
- insights are actionable
- calculations are deterministic

## AI

- deterministic calculations remain outside the LLM
- AI receives structured Ordo context
- agent actions use typed tools
- significant changes require approval
- AI failure does not break core productivity features

## Cross-platform

- web and Flutter share domain behavior
- UI is adapted to each platform
- important business rules are not duplicated

---

# 18. Final Product Model

```text
                    GOALS
                      |
              "Where am I going?"
                      |
                      v
              +---------------+
              |    ROUTINE    |
              | What repeats? |
              +-------+-------+
                      |
                      v
              +---------------+
              |    PLANNER    |
              | What do I     |
              | intend to do? |
              +-------+-------+
                      |
                      v
              +---------------+
              |     TODAY     |
              | What do I do? |
              +-------+-------+
                      |
                      v
              +---------------+
              |      LOG      |
              | What happened?|
              +-------+-------+
                      |
               +------+------+
               |             |
               v             v
           INSIGHTS      CHALLENGES
           What did I    How did I
           learn?        perform?
               |
               v
             COACH
        What should I
         change next?
```

The redesign should preserve Ordo's strongest identity—**planned time → actual execution → measurable accountability**—while removing ambiguity between routines, tasks, and planning.
