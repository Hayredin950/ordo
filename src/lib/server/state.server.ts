/**
 * The slice of `user_state.state` the server needs. The full shape lives in
 * `src/lib/ordo.ts`, but that module is client-oriented; server code only ever
 * reads routine/overrides/log/journal/goals, so it keeps its own narrow type.
 */
import { userClient } from "./supabase.server";

export type ServerBlock = {
  id: string;
  title: string;
  start: string;
  end: string;
  category: string;
  priority?: string;
};

export type ServerState = {
  routine?: Record<string, ServerBlock[]>;
  overrides?: Record<string, ServerBlock[]>;
  log?: Record<string, Record<string, number>>;
  journal?: Record<string, string>;
  goals?: { id: string; title: string; period: string; target: number }[];
};

export const dateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** An override for that exact date wins; otherwise the weekday's routine. */
export const blocksForDay = (state: ServerState, d: Date): ServerBlock[] =>
  state.overrides?.[dateKey(d)] ?? state.routine?.[String(d.getDay())] ?? [];

export const logForDay = (state: ServerState, d: Date): Record<string, number> =>
  state.log?.[dateKey(d)] ?? {};

/** Streak of days scoring >= 70%; days with no plan are skipped, not broken. */
export function computeStreak(state: ServerState): { current: number; best: number } {
  let current = 0;
  let best = 0;
  let run = 0;
  const today = new Date();
  for (let i = 90; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const blocks = state.routine?.[String(d.getDay())] ?? [];
    if (!blocks.length) continue;
    const entries = logForDay(state, d);
    const score = blocks.reduce((s, b) => s + (entries[b.id] ?? 0), 0) / blocks.length;
    if (score >= 70) {
      run++;
      best = Math.max(best, run);
      if (i === 0) current = run;
    } else {
      run = 0;
      if (i === 0) current = 0;
    }
  }
  return { current, best };
}

/**
 * The caller's own state, read through their access token so row level security
 * is what enforces ownership — the route never has to check a user id itself.
 * Returns null when the token is missing or rejected.
 */
export async function callerState(request: Request): Promise<ServerState | null> {
  const client = userClient(request);
  if (!client) return null;
  const { data, error } = await client.from("user_state").select("state").maybeSingle();
  if (error) {
    console.error("[state] read failed", error.message);
    return null;
  }
  return ((data?.state as ServerState | undefined) ?? {}) as ServerState;
}
