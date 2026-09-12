/**
 * Feature flags (§23, D14).
 *
 * Each flag gates a migration phase. Flipping a flag off reverts behaviour
 * without data rollback — all data changes are additive. Flags live in
 * localStorage so they're available synchronously on first paint. A helper
 * `setFlag` writes through and a React hook re-renders on change.
 */

const FLAG_PREFIX = "ordo.ff.";

export type FeatureFlag =
  | "ff_materialize_instances"
  | "ff_tasks_domain"
  | "ff_log_domain"
  | "ff_analytics_v2"
  | "ff_daily_close"
  | "ff_focus_v2"
  | "ff_coach";

/** Default state: every flag OFF until the phase ships. */
const DEFAULTS: Record<FeatureFlag, boolean> = {
  ff_materialize_instances: false,
  ff_tasks_domain: false,
  ff_log_domain: false,
  ff_analytics_v2: false,
  ff_daily_close: false,
  ff_focus_v2: false,
  ff_coach: false,
};

export function getFlag(flag: FeatureFlag): boolean {
  try {
    const raw = localStorage.getItem(FLAG_PREFIX + flag);
    if (raw !== null) return raw === "true";
  } catch {
    /* SSR / private browsing */
  }
  return DEFAULTS[flag];
}

export function setFlag(flag: FeatureFlag, value: boolean): void {
  try {
    localStorage.setItem(FLAG_PREFIX + flag, String(value));
    // Dispatch a storage event so other tabs / hooks pick up the change.
    window.dispatchEvent(new Event("storage"));
  } catch {
    /* SSR / private browsing */
  }
}

export function allFlags(): Record<FeatureFlag, boolean> {
  const out: Record<string, boolean> = {};
  for (const key of Object.keys(DEFAULTS) as FeatureFlag[]) out[key] = getFlag(key);
  return out as Record<FeatureFlag, boolean>;
}

export function resetFlags(): void {
  for (const key of Object.keys(DEFAULTS) as FeatureFlag[]) setFlag(key, DEFAULTS[key]);
}
