# Challenge Feature — UI/UX Redesign & Implementation Plan

A generalized, platform-agnostic plan for redesigning a "Challenge" feature (card + creation flow) in an app that has a routine/schedule, scoring, ranking, and membership system. Applicable to Web and Mobile (Flutter/React Native/etc.) with minor platform-specific adjustments noted inline.

---

## 1. Design Goal

The Challenge Card should answer one core question at a glance:

> **"What is my current standing in this challenge, and what do I need to do next?"**

It should communicate five things in 3–5 seconds:

1. What is the challenge?
2. What is its current status?
3. How am I performing?
4. Where do I rank?
5. What action should I take next?

**Principle:** The card is a *summary*. Full detail lives in an expanded Challenge Detail screen.

---

## 2. Card Information Hierarchy

```
Header        → Icon, Name, Category/Duration, Status badge
Score         → Single primary metric (not multiple competing numbers)
Progress      → Time/participation progression (separate from score)
Quick Stats   → Rank, Members, Consistency (3 max)
Today's Task  → Only today's relevant routine block(s), not the full schedule
Primary CTA   → One obvious next action
Secondary CTA → One lightweight secondary action (e.g. Leaderboard)
```

### Key distinctions to keep visually separate
| Concept | Meaning |
|---|---|
| **Progress** (`Day 23/30`) | How far the challenge has progressed in time |
| **Score** (`78.4`) | How well the user is performing |
| **Rank** (`#4`) | How the user compares to others |

Do not conflate these into one number or one visual element.

---

## 3. Status Handling

Use an explicit, unambiguous status badge — never let the user infer status from dates.

| Status | Badge |
|---|---|
| Upcoming | `● UPCOMING` |
| Active | `● ACTIVE` |
| Completed | `✓ COMPLETED` |
| Finalized | `🏆 FINALIZED` |
| Cancelled | `× CANCELLED` |

Colors should come from the existing design system, not ad hoc values. Status must remain legible via text label alone (not color-only), for accessibility.

---

## 4. Card States (design each explicitly — don't force one layout to fit all)

- **Upcoming** — shows start countdown, routine preview, join/edit CTA.
- **Active** — the primary/standard card: score, progress, stats, today's task, CTA.
- **Completed / Finalized** — frozen historical result; switch language from live ("Today's challenge") to final ("Final Score", "Final Rank"); show completion/consistency/participation breakdown.
- **Creator, pre-first-join** — routine editable; show "Routine can still be edited" + note that it locks once someone joins.
- **Locked routine** — after first join, show a 🔒 locked indicator instead of an edit button that would fail.
- **Loading** — skeleton placeholders matching card layout, never a blank card.
- **Error** — human-readable message + retry action; never surface raw backend/RPC errors (e.g. translate `locked_at constraint violation` into "This routine is now locked because another member joined.").
- **Empty (no challenges)** — icon + short message + create/join actions (only show actions that actually exist in the product).

---

## 5. Quick Stats Row

Use whatever the backend actually exposes — don't invent metrics (e.g. don't fabricate a "streak" if it isn't tracked).

Fallback logic:
```
If streak/consistency available → Rank | Members | Consistency %
Else                             → Rank | Members | (omit third stat)
```

---

## 6. Detail (Expanded) View

Reached by tapping the card. Contains everything the summary card intentionally omits:

- Full score breakdown (completion / consistency / participation)
- Full rank (`#4 / 18`)
- Full weekly routine (all days, not just today)
- Full leaderboard
- Primary CTA repeated at the bottom

---

## 7. Visual & Interaction Rules

- **One visual focal point** — the score. Avoid stacking multiple colorful badges (status + rank + consistency + participation + category) — it becomes noisy. Recommended hierarchy: Primary = Score, Secondary = Progress, Tertiary = Rank/Consistency/Members, Supporting = Routine/Dates/Category, Action = Primary CTA.
- **Animations** — keep subtle (score count-up, progress bar fill). Reserve stronger celebration (confetti, etc.) for milestone events: challenge completed, new personal best, top-3 finish. Don't celebrate every routine log.
- **Touch targets (mobile)** — minimum ~44–48dp height for buttons; avoid tiny icon-only menus.
- **Accessibility** — sufficient contrast, semantic status labels, accessible button labels, keyboard navigation (web), screen-reader descriptions, status never conveyed by color alone.

---

## 8. Component Architecture

### Web (example: React)
```
src/components/challenges/
  ChallengeCard.tsx
  ChallengeCardHeader.tsx
  ChallengeScore.tsx
  ChallengeProgress.tsx
  ChallengeStats.tsx
  ChallengeToday.tsx
  ChallengeActions.tsx
  ChallengeRoutinePreview.tsx
  ChallengeStatusBadge.tsx
  ChallengeDetail.tsx
  ChallengeRoutineEditor.tsx
  ChallengeLeaderboard.tsx
```
`CommunityView` → `ChallengeSection` → `ChallengeCard` / `ChallengeDetail` (don't cram everything into one top-level view file).

### Mobile (example: Flutter)
```
lib/widgets/challenges/
  challenge_card.dart
  challenge_card_header.dart
  challenge_score.dart
  challenge_progress.dart
  challenge_stats.dart
  challenge_today.dart
  challenge_status_badge.dart
  challenge_actions.dart
  challenge_routine_preview.dart

lib/screens/
  community_screen.dart
  challenge_detail_screen.dart
  challenge_routine_editor_screen.dart
```

### Card View Model (shared concept, both platforms)
```ts
type ChallengeCardModel = {
  id: string;
  name: string;
  category: string;
  status: ChallengeStatus;
  startAt: string;
  endAt: string;
  score: number | null;
  rank: number | null;
  memberCount: number;
  completion: number | null;
  consistency: number | null;
  participation: number | null;
  currentDay: number;
  totalDays: number;
  routineLocked: boolean;
  todayBlocks: ChallengeRoutineBlock[];
};
```

**Rule:** The UI never computes scores or ranks itself. It only displays what the backend returns (e.g. `challenge_scores()`, `locked_at`, `final_score`, `final_rank`). No duplicate scoring logic in the frontend, on either platform.

---

## 9. Challenge Creation Flow

Replace a single long form with a **guided 3-step wizard**: the user is defining a commitment/rulebook, not filling out a database record.

### Step 1 — Basics
- Challenge name
- Category (with icon)
- Duration (preset chips: 7 / 30 / 60 days, or custom)

### Step 2 — Schedule
- Day-of-week selector
- Time block(s) per day, with add/edit/remove
- Live preview of the resulting weekly routine as it's built

### Step 3 — Review
- Summary card (name, category, duration, computed date range)
- Full routine preview grouped by day
- Explicit warning: *"This routine becomes locked when the first member joins."*
- Back / Create actions

### Post-creation
Show a success screen (not just a closed modal): confirmation, note that the routine remains editable until first join, and a direct link into the new Challenge Card/Detail.

### Derived fields
Don't ask for both duration **and** end date — compute `end date = start date + duration` and display it as a read-only confirmation (e.g. "30 days · Jan 15 → Feb 13").

### Validation checklist
- Name: required, trimmed, reasonable max length
- Category: required, valid enum
- Duration: within accepted bounds (e.g. 7–90 days)
- Schedule: at least one time block
- Time blocks: start < end, no exact duplicates, explicit handling (prevent or define) for overlapping blocks per day

### Draft state model (shared concept)
```ts
type ChallengeDraft = {
  name: string;
  category: string;
  durationDays: number;
  startDate: string;
  schedule: {
    dayOfWeek: number;
    blocks: { startTime: string; endTime: string; category: string }[];
  }[];
};
```
The wizard mutates this local draft across steps; only submit to the backend once, after Review.

### Mobile-specific schedule UX
Avoid a dense weekly grid on small screens — use expandable per-day sections (Mon ✓ / Tue ✓ / ...) each revealing its own time-block editor.

### Creation flow components

**Web**
```
src/components/challenges/
  CreateChallengeModal.tsx
  CreateChallengeWizard.tsx
  steps/
    ChallengeBasicsStep.tsx
    ChallengeScheduleStep.tsx
    ChallengeReviewStep.tsx
  ChallengeNameInput.tsx
  ChallengeCategoryPicker.tsx
  ChallengeDurationPicker.tsx
  ChallengeDayPicker.tsx
  ChallengeTimeBlockEditor.tsx
  ChallengeRoutinePreview.tsx
  ChallengeReview.tsx
  ChallengeCreatedSuccess.tsx
```

**Mobile**
```
lib/screens/challenges/
  create_challenge_screen.dart
  challenge_basics_step.dart
  challenge_schedule_step.dart
  challenge_review_step.dart
  challenge_created_screen.dart

lib/widgets/challenges/
  challenge_category_picker.dart
  challenge_duration_picker.dart
  challenge_day_selector.dart
  challenge_time_block_editor.dart
  challenge_routine_preview.dart
  challenge_step_indicator.dart
```

### Lifecycle states to support explicitly
```
Draft (in wizard, not yet submitted)
Created — editable (no members joined yet)
Created — locked (first member joined; routine is read-only, with an explanation shown to the creator)
```

### Data flow (creation)
```
Frontend draft → Validation → create_challenge() RPC
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                              ▼
              challenges table              challenge_routines table
                                                     │
Later: activity logging → routine matching → challenge_logs → challenge_scores() → leaderboard
```
Keep this pipeline entirely backend-owned; the UI only renders its outputs.

---

## 10. Implementation Phases

**Phase 1 — Card visual redesign (mock data)**
Header, Score, Progress, Stats, Today's task, CTA — on both Web and Mobile, before wiring real data.

**Phase 2 — Card state variants**
Upcoming, Active, Finalized, Cancelled, Creator-unlocked, Locked.

**Phase 3 — Card real data wiring**
Connect scoring/leaderboard/routine/member-count/date RPCs. No changes to scoring logic.

**Phase 4 — Challenge Detail screen**
Move full breakdown, full routine, full leaderboard here.

**Phase 5 — Creation wizard**
Build Basics → Schedule → Review steps, draft state model, validation, RPC integration, success screen.

**Phase 6 — Routine editor**
Editable when unlocked, read-only with explanation when locked.

**Phase 7 — Polish**
Loading skeletons, error states, transitions/animation, button feedback, empty states, accessibility pass.

---

## 11. Non-Goals / Guardrails

- Don't change backend scoring/ranking logic to make the UI simpler — the UI adapts to the data model, not the other way around.
- Don't duplicate score computation in frontend code (web or mobile).
- Don't display the full weekly routine inside every card — only today's block(s).
- Don't allow an "Edit routine" action to be shown when it would fail server-side (locked state) — reflect the true state in the UI.
- Don't surface raw backend error strings to the user.
