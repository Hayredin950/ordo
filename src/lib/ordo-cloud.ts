import { useCallback, useEffect, useRef } from "react";
import { useOrdo, type OrdoState } from "./ordo";
import { useAuth } from "./auth";
import { apiFetch } from "./api";

/**
 * useOrdoCloud — same API as useOrdo, but syncs to the backend when a user is
 * signed in. Signed out, it behaves exactly like the original local-only hook.
 */
export function useOrdoCloud() {
  const { state, update, reset } = useOrdo();
  const { token } = useAuth();

  const initializedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<OrdoState | null>(null);
  stateRef.current = state;

  const saveNow = useCallback(async (s: OrdoState) => {
    try {
      await apiFetch("/api/state", { method: "PUT", json: { state: s } });
    } catch (err) {
      console.error("[sync] save failed", err);
    }
  }, []);

  // Initial load: prefer server state over local, adopt local if server empty.
  useEffect(() => {
    if (!token || initializedRef.current) return;
    initializedRef.current = true;

    (async () => {
      try {
        const res = await apiFetch<{ state: OrdoState | null }>("/api/state");
        if (res.state) {
          update(() => res.state!);
        } else if (stateRef.current) {
          await saveNow(stateRef.current);
        }
      } catch (err) {
        console.error("[sync] load failed", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Debounced save on every change once initialized.
  useEffect(() => {
    if (!token || !initializedRef.current || !state) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveNow(state);
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, token, saveNow]);

  return { state, update, reset };
}
