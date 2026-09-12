/**
 * Domain layer for the redesign plan (Ordo_Redesign_Implementation_Plan_v3.md).
 *
 * Everything here is pure, deterministic logic over the OrdoState document so
 * that web, Flutter and any future server function can share the exact same
 * definitions (decision D7). No React, no fetch, no localStorage.
 */
import {
  addDays,
  blocksFor,
  cloneBlocks,
  dateKey,
  newId,
  type Block,
  type OrdoState,
} from "./ordo";

// ---------------------------------------------------------------------------
// Tasks (§4)
// ---------------------------------------------------------------------------

export type Task = {
  id: string;
  title: string;
  category?: string;
  priority: "must" | "nice";
  status: "todo" | "done" | "cancelled";
  /** Due date, dateKey format. */
  dueDate?: string;
  /** Time-blocked onto a date, dateKey format. */
  scheduledDate?: string;
  /** HH:MM, only meaningful together with scheduledDate. */
  scheduledStart?: string;
  scheduledEnd?: string;
  goalId?: string;
  createdAt: string;
  updatedAt: string;
};

export function newTask(title: string, init: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  return {
    id: newId(),
    title,
    priority: "must",
    status: "todo",
    createdAt: now,
    updatedAt: now,
    ...init,
  };
}

/** Tasks scheduled onto a date, in time order — the task half of the Planner. */
export function tasksForDate(state: OrdoState, d: Date): Task[] {
  const key = dateKey(d);
  return (state.tasks ?? [])
    .filter((t) => t.status !== "cancelled" && t.scheduledDate === key)
    .sort((a, b) => (a.scheduledStart ?? "99:99").localeCompare(b.scheduledStart ?? "99:99"));
}

// ---------------------------------------------------------------------------
// Templates (§3.6, D4 — snapshots, never live links)
// ---------------------------------------------------------------------------

/**
 * A template is a snapshot of selected days. Legacy documents stored a flat
 * block list (a single unspecified day); those read back through
 * `templateDays()` as an "any day" snapshot under key -1.
 */
export type RoutineTemplate = {
  id: string;
  name: string;
  /** 0=Sun..6=Sat -> blocks. Key -1 = legacy single-day snapshot of no specific day. */
  days: Record<number, Block[]>;
  createdAt: string;
  updatedAt: string;
  /** Provenance only — never a live link. */
  sharedFrom?: string;
};

/** The document shape: legacy templates carry `blocks`, new ones carry `days`. */
export type AnyTemplate = {
  id: string;
  name: string;
  blocks?: Block[];
  days?: Record<number, Block[]>;
};

export function isRoutineTemplate(t: AnyTemplate): t is RoutineTemplate {
  return t.days !== undefined;
}

/** Day -> blocks for both template shapes; legacy snapshots map to key -1. */
export function templateDays(t: AnyTemplate): Record<number, Block[]> {
  return t.days ?? { [-1]: t.blocks ?? [] };
}

export function templateBlockCount(t: AnyTemplate): number {
  return Object.values(templateDays(t)).reduce((n, bs) => n + bs.length, 0);
}

export function templateDayCount(t: AnyTemplate): number {
  return Object.keys(templateDays(t)).filter((k) => Number(k) >= 0).length;
}

export function saveTemplate(
  state: OrdoState,
  name: string,
  days: number[],
): { state: OrdoState; templateId: string } {
  const id = newId();
  const now = new Date().toISOString();
  const snapshot: Record<number, Block[]> = {};
  for (const d of days) snapshot[d] = cloneBlocks(state.routine[d] ?? []);
  const template: RoutineTemplate = { id, name, days: snapshot, createdAt: now, updatedAt: now };
  return { state: { ...state, templates: [...state.templates, template] }, templateId: id };
}

export function deleteTemplate(state: OrdoState, id: string): OrdoState {
  return { ...state, templates: state.templates.filter((t) => t.id !== id) };
}

export function renameTemplate(state: OrdoState, id: string, name: string): OrdoState {
  return {
    ...state,
    templates: state.templates.map((t) =>
      t.id === id ? { ...t, name, updatedAt: new Date().toISOString() } : t,
    ),
  };
}

// ---------------------------------------------------------------------------
// applyRoutineSource (§3.5, D5 + D10)
// ---------------------------------------------------------------------------

export type RoutineSource =
  | { kind: "day"; dayOfWeek: number }
  | { kind: "template"; templateId: string }
  | { kind: "snapshot"; blocks: Block[] };

export type ApplyResult = {
  appliedDays: number[];
  skipped: { day: number; reason: "empty-source" }[];
};

function sourceBlocks(state: OrdoState, source: RoutineSource): Block[] {
  switch (source.kind) {
    case "day":
      return state.routine[source.dayOfWeek] ?? [];
    case "template": {
      const t = state.templates.find((x) => x.id === source.templateId);
      // A legacy snapshot applies to whichever day the caller targets; a
      // multi-day template is handled per-day by applyTemplateToDays.
      return t ? (t.days?.[-1] ?? t.blocks ?? []) : [];
    }
    case "snapshot":
      return source.blocks;
  }
}

/**
 * The one internal copy operation behind both Duplicate Day and Template
 * Apply (D5). Pure: returns the next state and a per-day result. Every cloned
 * block gets a fresh id (D10) so no copy ever aliases its source.
 */
export function applyRoutineSource(
  state: OrdoState,
  source: RoutineSource,
  targetDays: number[],
  mode: "replace" | "merge" = "replace",
): { state: OrdoState; result: ApplyResult } {
  const blocks = cloneBlocks(sourceBlocks(state, source));
  const routine = { ...state.routine };
  const appliedDays: number[] = [];
  const skipped: ApplyResult["skipped"] = [];
  for (const day of targetDays) {
    if (!blocks.length) {
      skipped.push({ day, reason: "empty-source" });
      continue;
    }
    routine[day] =
      mode === "replace" ? cloneBlocks(blocks) : [...(routine[day] ?? []), ...cloneBlocks(blocks)];
    appliedDays.push(day);
  }
  return { state: { ...state, routine }, result: { appliedDays, skipped } };
}

/**
 * Multi-day template apply: each saved day lands on the same weekday of the
 * live routine. Legacy single-day snapshots apply to the explicitly chosen
 * targets instead.
 */
export function applyTemplateToDays(
  state: OrdoState,
  templateId: string,
  targets: number[], // empty for a real multi-day template = use its own days
  mode: "replace" | "merge" = "replace",
): { state: OrdoState; result: ApplyResult } {
  const t = state.templates.find((x) => x.id === templateId);
  if (!t) return { state, result: { appliedDays: [], skipped: [] } };
  const days = templateDays(t);
  const realDays = Object.keys(days)
    .map(Number)
    .filter((d) => d >= 0);
  if (realDays.length && !targets.length) {
    // Apply day-by-day so each weekday gets its own snapshot.
    let next = state;
    const appliedDays: number[] = [];
    for (const d of realDays) {
      const r = applyRoutineSource(next, { kind: "snapshot", blocks: days[d]! }, [d], mode);
      next = r.state;
      appliedDays.push(...r.result.appliedDays);
    }
    return { state: next, result: { appliedDays, skipped: [] } };
  }
  return applyRoutineSource(state, { kind: "template", templateId }, targets, mode);
}

// ---------------------------------------------------------------------------
// Metrics (§14) — authoritative definitions, D3 + D7
// ---------------------------------------------------------------------------

/** α from §14.1: how much a must-do completion counts relative to a nice one. */
export const MUST_WEIGHT = 0.7;

/** §14.1: weighted daily score, null when the day has no planned items. */
export function weightedDayScore(entries: Record<string, number>, blocks: Block[]): number | null {
  if (!blocks.length) return null;
  let contrib = 0;
  let weightSum = 0;
  for (const blk of blocks) {
    const w = blk.priority === "must" ? MUST_WEIGHT : 1 - MUST_WEIGHT;
    contrib += ((entries[blk.id] ?? 0) / 100) * w;
    weightSum += w;
  }
  return weightSum ? Math.round((100 * contrib) / weightSum) : null;
}

/** §14.2: unweighted average completion, null when nothing planned. */
export function completionRate(entries: Record<string, number>, blocks: Block[]): number | null {
  if (!blocks.length) return null;
  const sum = blocks.reduce((n, b) => n + (entries[b.id] ?? 0), 0);
  return Math.round(sum / blocks.length);
}

/** §14.3: must-do completion as a 0–1 fraction; null when no must items. */
export function mustDoCompletion(entries: Record<string, number>, blocks: Block[]): number | null {
  const must = blocks.filter((b) => b.priority === "must");
  if (!must.length) return null;
  const sum = must.reduce((n, b) => n + (entries[b.id] ?? 0), 0);
  return sum / (100 * must.length);
}

/** §14 aggregated over a window — the compact result Insights renders. */
export type RangeMetrics = {
  /** §14.2 unweighted completion, averaged over planned days only. */
  completion: number;
  /** §14.3 must-do completion, averaged over days that have must items. */
  mustDoCompletion: number;
  /** §14.1 weighted daily score, averaged over planned days only. */
  dailyScore: number;
  /** §14.5 consistency over the window; null with fewer than 2 planned days. */
  consistency: number | null;
  /** Days in the window that had a plan. */
  plannedDays: number;
};

export function rangeMetrics(state: OrdoState, from: Date, days: number): RangeMetrics {
  let completionSum = 0;
  let mustSum = 0;
  let scoreSum = 0;
  let plannedDays = 0;
  let mustDays = 0;
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    const blocks = blocksFor(state, d);
    const entries = state.log[dateKey(d)] ?? {};
    const c = completionRate(entries, blocks);
    if (c !== null) {
      completionSum += c;
      plannedDays++;
    }
    const m = mustDoCompletion(entries, blocks);
    if (m !== null) {
      mustSum += m;
      mustDays++;
    }
    const s = weightedDayScore(entries, blocks);
    if (s !== null) scoreSum += s;
  }
  return {
    completion: plannedDays ? Math.round(completionSum / plannedDays) : 0,
    mustDoCompletion: mustDays ? Math.round((mustSum / mustDays) * 100) : 0,
    dailyScore: plannedDays ? Math.round(scoreSum / plannedDays) : 0,
    consistency: consistency(state, from, days),
    plannedDays,
  };
}

/** §14.4: a day qualifies when score ≥ threshold AND must-do completion ≥ 0.5. */
export function dayQualifies(
  state: OrdoState,
  d: Date,
  threshold = 70,
): { qualifies: boolean; hasPlan: boolean } {
  const blocks = blocksFor(state, d);
  const entries = state.log[dateKey(d)] ?? {};
  const score = weightedDayScore(entries, blocks);
  if (score === null) return { qualifies: false, hasPlan: false };
  const must = mustDoCompletion(entries, blocks) ?? 1;
  return { qualifies: score >= threshold && must >= 0.5, hasPlan: true };
}

/**
 * §14.4 streak: run of qualifying days ending today or yesterday. Today not
 * yet qualified does not break the streak — it stays active until end of day.
 */
export function streakDays(state: OrdoState, threshold = 70): { current: number; best: number } {
  let run = 0;
  let best = 0;
  for (let i = 120; i >= 0; i--) {
    const d = addDays(new Date(), -i);
    const { qualifies } = dayQualifies(state, d, threshold);
    if (qualifies) {
      run++;
      best = Math.max(best, run);
    } else if (i > 0) {
      run = 0;
    }
    // i === 0 (today, not yet qualified) leaves the run intact: the streak
    // stays active until end of day per §14.4.
  }
  return { current: run, best };
}

/** §14.5: consistency = 1 − stdev/100 over the period's daily scores. */
export function consistency(state: OrdoState, from: Date, days: number): number | null {
  const scores: number[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    const s = weightedDayScore(state.log[dateKey(d)] ?? {}, blocksFor(state, d));
    if (s !== null) scores.push(s);
  }
  if (scores.length < 2) return null;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
  return Math.max(0, Math.min(1, 1 - Math.sqrt(variance) / 100));
}

// ---------------------------------------------------------------------------
// Debt ledger (§9.4, D2)
// ---------------------------------------------------------------------------

export type DebtEvent = {
  id: string;
  dateKey: string;
  /** +1 per missed must-do commitment, −1 per recovery. */
  delta: number;
  reason: string;
  recordedAt: string;
};

export function debtBalance(state: OrdoState): number {
  return (state.debtEvents ?? []).reduce((n, e) => n + e.delta, 0);
}

/**
 * Append-only: reconciles the ledger against a date's log. Idempotent per
 * (dateKey, blockId) — the entry for a still-missed block is kept, a recovered
 * one gets a compensating −1, and the balance never drifts from reality.
 */
export function reconcileDebtForDate(state: OrdoState, d: Date): OrdoState {
  const key = dateKey(d);
  const events = [...(state.debtEvents ?? [])];
  const entries = state.log[key] ?? {};
  for (const blk of blocksFor(state, d)) {
    if (blk.priority !== "must") continue;
    const missed = (entries[blk.id] ?? 0) < 50;
    const open = events.find((e) => e.dateKey === key && e.reason === blk.id && e.delta > 0);
    const recovered = events.find((e) => e.dateKey === key && e.reason === blk.id && e.delta < 0);
    if (missed && !open) {
      events.push({
        id: newId(),
        dateKey: key,
        delta: 1,
        reason: blk.id,
        recordedAt: new Date().toISOString(),
      });
    } else if (!missed && open && !recovered) {
      events.push({
        id: newId(),
        dateKey: key,
        delta: -1,
        reason: blk.id,
        recordedAt: new Date().toISOString(),
      });
    }
  }
  return { ...state, debtEvents: events };
}

// ---------------------------------------------------------------------------
// Notification preferences (§5.4)
// ---------------------------------------------------------------------------

export type NotificationPreferences = {
  delivery: { push: boolean; email: boolean };
  channels: {
    routineReminder: { enabled: boolean; leadMinutes: number };
    taskDueReminder: { enabled: boolean };
    dailyClose: { enabled: boolean; time: string };
    streakAtRisk: { enabled: boolean; time: string };
    weeklySummary: { enabled: boolean; dayOfWeek: number; time: string };
    coachRecommendation: { enabled: boolean };
    challengeActivity: { enabled: boolean };
  };
  quietHours: { enabled: boolean; start: string; end: string };
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  delivery: { push: true, email: false },
  channels: {
    routineReminder: { enabled: true, leadMinutes: 10 },
    taskDueReminder: { enabled: true },
    dailyClose: { enabled: true, time: "21:30" },
    streakAtRisk: { enabled: true, time: "21:00" },
    weeklySummary: { enabled: true, dayOfWeek: 0, time: "18:00" },
    coachRecommendation: { enabled: true },
    challengeActivity: { enabled: true },
  },
  quietHours: { enabled: true, start: "22:00", end: "07:00" },
};

export function notificationPrefsOf(state: OrdoState): NotificationPreferences {
  return {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...(state.notificationPrefs ?? {}),
    channels: {
      ...DEFAULT_NOTIFICATION_PREFS.channels,
      ...(state.notificationPrefs?.channels ?? {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Focus sessions (§5.5)
// ---------------------------------------------------------------------------

export type FocusSession = {
  id: string;
  linkedItemId?: string;
  linkedItemType?: "routine" | "task";
  plannedDurationSeconds: number;
  startedAt: string;
  pausedIntervals: { start: string; end?: string }[];
  endedAt?: string;
  outcome?: "completed" | "cancelled";
  moodRating?: "good" | "neutral" | "bad";
};

/** Remaining seconds recomputed from timestamps, never a stored countdown. */
export function focusRemaining(session: FocusSession, now = new Date()): number {
  const start = new Date(session.startedAt).getTime();
  const paused = session.pausedIntervals.reduce((ms, p) => {
    const from = new Date(p.start).getTime();
    const to = p.end ? new Date(p.end).getTime() : now.getTime();
    return ms + Math.max(0, to - from);
  }, 0);
  const elapsed = Math.max(0, now.getTime() - start - paused);
  return Math.max(0, session.plannedDurationSeconds - Math.floor(elapsed / 1000));
}

// ---------------------------------------------------------------------------
// Log domain (§9.2, D11) — immutable records of what happened
// ---------------------------------------------------------------------------

export type LogEntry =
  | {
      kind: "completion";
      id: string;
      dateKey: string;
      itemId: string;
      value: 0 | 25 | 50 | 75 | 100;
      recordedAt: string;
    }
  | {
      kind: "journal";
      id: string;
      dateKey: string;
      text: string;
      recordedAt: string;
    }
  | {
      kind: "focus";
      id: string;
      dateKey: string;
      sessionId: string;
      recordedAt: string;
    }
  | {
      kind: "debt_event";
      id: string;
      dateKey: string;
      delta: number;
      reason: string;
      recordedAt: string;
    };

/** Append a completion log entry (§9.2). */
export function recordCompletion(
  state: OrdoState,
  dateKey: string,
  itemId: string,
  value: 0 | 25 | 50 | 75 | 100,
): OrdoState {
  const entry: LogEntry = {
    kind: "completion",
    id: newId(),
    dateKey,
    itemId,
    value,
    recordedAt: new Date().toISOString(),
  };
  // Also update the legacy LogMap for backward compatibility.
  const log = { ...state.log };
  const day = { ...(log[dateKey] ?? {}) };
  day[itemId] = value;
  log[dateKey] = day;
  return {
    ...state,
    log,
    logEntries: [...(state.logEntries ?? []), entry],
  };
}

/** Append a journal log entry (§9.2). */
export function recordJournal(state: OrdoState, dateKey: string, text: string): OrdoState {
  const entry: LogEntry = {
    kind: "journal",
    id: newId(),
    dateKey,
    text,
    recordedAt: new Date().toISOString(),
  };
  return {
    ...state,
    journal: { ...state.journal, [dateKey]: text },
    logEntries: [...(state.logEntries ?? []), entry],
  };
}

/** Append a focus session log entry (§9.2). */
export function recordFocusSession(
  state: OrdoState,
  dateKey: string,
  sessionId: string,
): OrdoState {
  const entry: LogEntry = {
    kind: "focus",
    id: newId(),
    dateKey,
    sessionId,
    recordedAt: new Date().toISOString(),
  };
  return {
    ...state,
    logEntries: [...(state.logEntries ?? []), entry],
  };
}

/** All log entries for a date, optionally filtered by kind. */
export function logEntriesForDate(
  state: OrdoState,
  dk: string,
  kind?: LogEntry["kind"],
): LogEntry[] {
  return (state.logEntries ?? []).filter(
    (e) => e.dateKey === dk && (kind === undefined || e.kind === kind),
  );
}

// ---------------------------------------------------------------------------
// Routine instance materialisation (§4.5, D1)
// ---------------------------------------------------------------------------

/**
 * Materialise (snapshot) the effective routine for a date so that future
 * edits to the weekly routine no longer affect history. Called once on the
 * first log write for a date; idempotent thereafter.
 *
 * The materialised blocks are stored in `state.overrides[dateKey]`, which
 * already takes precedence over the weekly routine via `blocksFor()`.
 */
export function ensureMaterialized(state: OrdoState, dk: string): OrdoState {
  // Already materialised — overrides exist for this date.
  if (state.overrides[dk]) return state;
  const dayDate = new Date(dk + "T12:00:00");
  const effective = blocksFor(state, dayDate);
  if (!effective.length) return state;
  return {
    ...state,
    overrides: { ...state.overrides, [dk]: cloneBlocks(effective) },
  };
}

/**
 * Record a completion entry — materialises first if needed (§4.5).
 * This is the canonical entry point for the Today view's completion buttons.
 */
export function recordCompletionForDate(
  state: OrdoState,
  dk: string,
  itemId: string,
  value: 0 | 25 | 50 | 75 | 100,
): OrdoState {
  let s = ensureMaterialized(state, dk);
  s = recordCompletion(s, dk, itemId, value);
  return s;
}

/**
 * Record a journal entry — materialises first if needed (§4.5).
 * This is the canonical entry point for the Today view's reflection textarea.
 */
export function recordJournalForDate(state: OrdoState, dk: string, text: string): OrdoState {
  let s = ensureMaterialized(state, dk);
  s = recordJournal(s, dk, text);
  return s;
}

// ---------------------------------------------------------------------------
// Task CRUD (§4.6) — service functions over inline state mutations
// ---------------------------------------------------------------------------

/** Create a new task and append it to state. */
export function createTask(
  state: OrdoState,
  title: string,
  init: Partial<Task> = {},
): { state: OrdoState; task: Task } {
  const task = newTask(title, init);
  return { state: { ...state, tasks: [...(state.tasks ?? []), task] }, task };
}

/** Update a task by id. Returns unchanged state if not found. */
export function updateTask(
  state: OrdoState,
  id: string,
  patch: Partial<Omit<Task, "id" | "createdAt">>,
): OrdoState {
  const tasks = (state.tasks ?? []).map((t) =>
    t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t,
  );
  return { ...state, tasks };
}

/** Delete a task by id. */
export function deleteTask(state: OrdoState, id: string): OrdoState {
  return { ...state, tasks: (state.tasks ?? []).filter((t) => t.id !== id) };
}

/** Mark a task as done. */
export function completeTask(state: OrdoState, id: string): OrdoState {
  return updateTask(state, id, { status: "done" });
}

/** Schedule a task onto a date and optional time slot. */
export function scheduleTask(
  state: OrdoState,
  id: string,
  scheduledDate: string,
  start?: string,
  end?: string,
): OrdoState {
  const patch: { scheduledDate: string; scheduledStart?: string; scheduledEnd?: string } = {
    scheduledDate,
  };
  if (start !== undefined) patch.scheduledStart = start;
  if (end !== undefined) patch.scheduledEnd = end;
  return updateTask(state, id, patch);
}

/** Remove a task's schedule (return to inbox). */
export function unscheduleTask(state: OrdoState, id: string): OrdoState {
  const tasks = (state.tasks ?? []).map((t) => {
    if (t.id !== id) return t;
    const { scheduledDate: _sd, scheduledStart: _ss, scheduledEnd: _se, ...rest } = t;
    return { ...rest, updatedAt: new Date().toISOString() } as Task;
  });
  return { ...state, tasks };
}

/** Reschedule a task to a different date/time. */
export function rescheduleTask(
  state: OrdoState,
  id: string,
  scheduledDate: string,
  start?: string,
  end?: string,
): OrdoState {
  return scheduleTask(state, id, scheduledDate, start, end);
}

/** List tasks, optionally filtered by status. */
export function listTasks(state: OrdoState, filter?: { status?: Task["status"] }): Task[] {
  const tasks = state.tasks ?? [];
  if (!filter?.status) return tasks;
  return tasks.filter((t) => t.status === filter.status);
}
