import { useSyncExternalStore } from "react";
import { getFlag, setFlag, allFlags, resetFlags, type FeatureFlag } from "./feature-flags";

/** Subscribe to localStorage changes so React re-renders when a flag flips. */
function onStorageChange(cb: () => void) {
  // The `storage` event only fires in *other* tabs, but our setFlag() also
  // dispatches a plain "storage" Event on the same window.  For same-tab
  // reactivity we also listen to that custom event.
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

/** Read a single flag reactively. */
export function useFeatureFlag(flag: FeatureFlag): boolean {
  return useSyncExternalStore(
    onStorageChange,
    () => getFlag(flag),
    () => getFlag(flag), // SSR snapshot
  );
}

/** Read all flags reactively. */
export function useFeatureFlags(): Record<FeatureFlag, boolean> {
  return useSyncExternalStore(onStorageChange, allFlags, allFlags);
}

export { setFlag, resetFlags };
export type { FeatureFlag };
