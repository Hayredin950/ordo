import { useCallback, useEffect, useRef } from "react";
import { useOrdo, type OrdoState } from "./ordo";
import { useAuth } from "./auth-context";
import { loadState, saveState } from "./db";

/**
 * useOrdoCloud — same API as useOrdo, but syncs the document to Postgres when a
 * user is signed in. Signed out it behaves exactly like the local-only hook.
 * Writes go through the save_state() function, which also maintains the undo
 * history, so the client never writes user_state directly.
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
      await saveState(s);
    } catch (err) {
      console.error("[sync] save failed", err);
    }
  }, []);

  // Initial load: prefer stored state over local, adopt local if none exists.
  useEffect(() => {
    if (!token || initializedRef.current) return;
    initializedRef.current = true;

    void (async () => {
      try {
        const remote = await loadState();
        if (remote) {
          update(() => remote);
        } else if (stateRef.current) {
          await saveNow(stateRef.current);
        }
      } catch (err) {
        console.error("[sync] load failed", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Signing out ends the session; a later sign-in must re-sync from scratch.
  useEffect(() => {
    if (!token) initializedRef.current = false;
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
