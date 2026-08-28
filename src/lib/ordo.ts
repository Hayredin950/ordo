import { useCallback, useEffect, useState } from "react";
import { BUILTIN_CATEGORIES, type Category, type CategoryId } from "./categories";

/**
 * Re-exported so the dozen modules that already import `CategoryId` from here
 * keep working now that the category list itself lives in `categories.ts`.
 */
export type { CategoryId };

/** How the app prints a wall-clock time. Chosen by the user, stored per account. */
export type HourFormat = "24h" | "12h";

export type Settings = {
  hourFormat: HourFormat;
};

export const DEFAULT_SETTINGS: Settings = { hourFormat: "24h" };

/**
 * First-run guess from the browser's own locale, so an en-US visitor sees
 * "9:00 AM" before touching anything. Falls back to 24h during SSR.
 */
export function detectHourFormat(): HourFormat {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().hour12 ? "12h" : "24h";
  } catch {
    return "24h";
  }
}

/** Documents saved before settings existed have none — read through this. */
export const settingsOf = (state: OrdoState | null | undefined): Settings => ({
  ...DEFAULT_SETTINGS,
  ...(state?.settings ?? {}),
});

export const hourFormatOf = (state: OrdoState | null | undefined): HourFormat =>
  settingsOf(state).hourFormat;

/** `"14:05"` → `"14:05"` or `"2:05 PM"`. Garbage in comes straight back out. */
export function formatTime(hhmm: string, format: HourFormat = "24h"): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm?.trim() ?? "");
  if (!m) return hhmm ?? "";
  const hours = Number(m[1]);
  const minutes = m[2]!;
  if (!Number.isFinite(hours) || hours > 23) return hhmm;
  if (format === "24h") return `${String(hours).padStart(2, "0")}:${minutes}`;
  const suffix = hours < 12 ? "AM" : "PM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes} ${suffix}`;
}

/** The pair as one label: `"09:00–10:30"` or `"9:00 AM – 10:30 AM"`. */
export function formatTimeRange(start: string, end: string, format: HourFormat = "24h"): string {
  return format === "24h"
    ? `${formatTime(start, format)}–${formatTime(end, format)}`
    : `${formatTime(start, format)} – ${formatTime(end, format)}`;
}

export type Block = {
  id: string;
  title: string;
  start: string; // HH:MM
  end: string;
  category: CategoryId;
  priority: "must" | "nice";
  goalId?: string;
};

export type Goal = {
  id: string;
  title: string;
  period: "year" | "semester" | "month" | "week" | "day";
  category: CategoryId;
  target: number; // target completion %
  parentId?: string;
};

/** dateKey -> blockId -> percent complete (0-100) */
export type LogMap = Record<string, Record<string, number>>;

export type OrdoState = {
  /** 0 = Sunday .. 6 = Saturday */
  routine: Record<number, Block[]>;
  overrides: Record<string, Block[]>;
  templates: { id: string; name: string; blocks: Block[] }[];
  goals: Goal[];
  log: LogMap;
  journal: Record<string, string>;
  /** Absent in documents written before preferences existed. */
  settings?: Settings;
};

export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const startOfWeek = (d: Date) => addDays(d, -d.getDay());

const uid = () => Math.random().toString(36).slice(2, 10);

const b = (
  title: string,
  start: string,
  end: string,
  category: CategoryId,
  priority: "must" | "nice" = "must",
): Block => ({ id: uid(), title, start, end, category, priority });

const weekday: Block[] = [
  b("Fajr + reflection", "05:30", "06:00", "spiritual"),
  b("Workout", "06:00", "07:00", "health"),
  b("Deep work block", "09:00", "11:30", "work"),
  b("Study: algorithms", "14:00", "16:00", "study"),
  b("Read 30 pages", "21:00", "22:00", "study", "nice"),
];

const weekend: Block[] = [
  b("Long run", "07:00", "08:30", "health"),
  b("Weekly review", "10:00", "11:00", "work"),
  b("Family time", "16:00", "18:00", "relationships", "nice"),
  b("Budget check", "19:00", "19:30", "finance", "nice"),
];

const seedGoals: Goal[] = [
  {
    id: "g-year",
    title: "Become undeniably disciplined",
    period: "year",
    category: "work",
    target: 80,
  },
  {
    id: "g-sem",
    title: "Ship Ordo + pass semester",
    period: "semester",
    category: "study",
    target: 85,
    parentId: "g-year",
  },
  {
    id: "g-month",
    title: "Train 20 days this month",
    period: "month",
    category: "health",
    target: 75,
    parentId: "g-sem",
  },
  {
    id: "g-week",
    title: "10h focused study",
    period: "week",
    category: "study",
    target: 90,
    parentId: "g-month",
  },
];

function seedLog(routine: Record<number, Block[]>): LogMap {
  const log: LogMap = {};
  const today = new Date();
  for (let i = 1; i <= 70; i++) {
    const d = addDays(today, -i);
    const blocks = routine[d.getDay()] ?? [];
    const key = dateKey(d);
    log[key] = {};
    const bias = 0.45 + 0.4 * Math.sin(i / 9) + (d.getDay() === 0 ? -0.2 : 0);
    blocks.forEach((blk, idx) => {
      const r = Math.abs(Math.sin(i * 3.7 + idx * 1.3));
      log[key]![blk.id] = r < bias ? 100 : r < bias + 0.18 ? 50 : 0;
    });
  }
  return log;
}

export const defaultState = (): OrdoState => {
  const routine: Record<number, Block[]> = {
    0: weekend.map((x) => ({ ...x, id: uid() })),
    1: weekday.map((x) => ({ ...x, id: uid() })),
    2: weekday.map((x) => ({ ...x, id: uid() })),
    3: weekday.map((x) => ({ ...x, id: uid() })),
    4: weekday.map((x) => ({ ...x, id: uid() })),
    5: weekday.map((x) => ({ ...x, id: uid() })),
    6: weekend.map((x) => ({ ...x, id: uid() })),
  };
  return {
    routine,
    overrides: {},
    templates: [
      { id: uid(), name: "Exam week", blocks: weekday.map((x) => ({ ...x, id: uid() })) },
    ],
    goals: seedGoals,
    log: seedLog(routine),
    journal: {},
    settings: { ...DEFAULT_SETTINGS, hourFormat: detectHourFormat() },
  };
};

const KEY = "ordo.state.v1";

export function useOrdo() {
  const [state, setState] = useState<OrdoState | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      setState(raw ? (JSON.parse(raw) as OrdoState) : defaultState());
    } catch {
      setState(defaultState());
    }
  }, []);

  useEffect(() => {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  const update = useCallback((fn: (s: OrdoState) => OrdoState) => {
    setState((s) => (s ? fn(s) : s));
  }, []);

  // Reset wipes the plan and the log, not the preferences — the clock format is
  // a display choice, not data the user asked to throw away.
  const reset = useCallback(() => {
    setState((prev) => ({ ...defaultState(), settings: settingsOf(prev) }));
  }, []);

  return { state, update, reset };
}

export function blocksFor(state: OrdoState, d: Date): Block[] {
  const key = dateKey(d);
  const list = state.overrides[key] ?? state.routine[d.getDay()] ?? [];
  return [...list].sort((a, x) => a.start.localeCompare(x.start));
}

export function dayScore(state: OrdoState, d: Date): number | null {
  const blocks = blocksFor(state, d);
  if (!blocks.length) return null;
  const entries = state.log[dateKey(d)] ?? {};
  const total = blocks.reduce((sum, blk) => sum + (entries[blk.id] ?? 0), 0);
  return Math.round(total / blocks.length);
}

export function rangeScore(state: OrdoState, from: Date, days: number): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < days; i++) {
    const s = dayScore(state, addDays(from, i));
    if (s !== null) {
      sum += s;
      n++;
    }
  }
  return n ? Math.round(sum / n) : 0;
}

export function streak(state: OrdoState, threshold = 70): { current: number; best: number } {
  let current = 0;
  let best = 0;
  let run = 0;
  for (let i = 120; i >= 0; i--) {
    const s = dayScore(state, addDays(new Date(), -i));
    if (s !== null && s >= threshold) {
      run++;
      best = Math.max(best, run);
    } else if (s !== null) {
      run = 0;
    }
    if (i === 0 || run > 0) current = run;
  }
  return { current, best };
}

/**
 * Mean completion per category over `days`. The category list is passed in
 * because it is no longer a constant — an admin can add to it — and any id found
 * in the plan but missing from the list is still reported, under its raw id, so
 * a deleted category does not silently drop history.
 */
export function categoryBreakdown(
  state: OrdoState,
  days = 28,
  cats: Pick<Category, "id" | "label">[] = BUILTIN_CATEGORIES,
) {
  const acc: Record<string, { sum: number; n: number }> = {};
  for (let i = 0; i < days; i++) {
    const d = addDays(new Date(), -i);
    const entries = state.log[dateKey(d)] ?? {};
    for (const blk of blocksFor(state, d)) {
      const a = (acc[blk.category] ??= { sum: 0, n: 0 });
      a.sum += entries[blk.id] ?? 0;
      a.n += 1;
    }
  }
  const known = cats.map((c) => ({ id: c.id, label: c.label }));
  const extra = Object.keys(acc)
    .filter((id) => !known.some((c) => c.id === id))
    .map((id) => ({ id, label: id }));
  return [...known, ...extra].map((c) => ({
    category: c.label,
    id: c.id,
    value: acc[c.id]?.n ? Math.round(acc[c.id]!.sum / acc[c.id]!.n) : 0,
  }));
}

export function missedDebt(state: OrdoState) {
  const out: { date: string; block: Block }[] = [];
  for (let i = 1; i <= 14; i++) {
    const d = addDays(new Date(), -i);
    const entries = state.log[dateKey(d)] ?? {};
    for (const blk of blocksFor(state, d)) {
      if (blk.priority === "must" && (entries[blk.id] ?? 0) < 50) {
        out.push({ date: dateKey(d), block: blk });
      }
    }
  }
  return out.slice(0, 8);
}

export const newBlock = (): Block => ({
  id: uid(),
  title: "New block",
  start: "08:00",
  end: "09:00",
  category: "work",
  priority: "must",
});

export const cloneBlocks = (blocks: Block[]) => blocks.map((x) => ({ ...x, id: uid() }));
export const newId = uid;

/**
 * The clock preference without mounting the document hooks — for pages like the
 * admin console that print times but have no business loading someone's plan.
 * Falls back to the browser locale during SSR or before a first save.
 */
export function storedHourFormat(): HourFormat {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return hourFormatOf(JSON.parse(raw) as OrdoState);
  } catch {
    /* unreadable storage is not worth an error */
  }
  return detectHourFormat();
}
