import { useCallback, useEffect, useRef } from "react";
import { useOrdo, type OrdoState } from "./ordo";
import { useAuth } from "./auth-context";
import { loadState, saveState } from "./db";

/**
 * The save currently on the wire, shared across mounts on purpose. Moving
 * between routes tears this hook down and builds a fresh one, and the new
 * instance's initial load must not read `user_state` while the old instance's
 * last write is still travelling — it would pull the pre-change document back
 * over the change the user just made.
 */
let pendingWrite: Promise<void> | null = null;

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
  const dirtyRef = useRef(false);
  const stateRef = useRef<OrdoState | null>(null);
  stateRef.current = state;

  const saveNow = useCallback(async (s: OrdoState) => {
    const write = (async () => {
      try {
        await saveState(s);
      } catch (err) {
        console.error("[sync] save failed", err);
      }
    })();
    pendingWrite = write;
    await write;
    if (pendingWrite === write) pendingWrite = null;
  }, []);

  // Initial load: prefer stored state over local, adopt local if none exists.
  useEffect(() => {
    if (!token || initializedRef.current) return;
    initializedRef.current = true;

    void (async () => {
      try {
        await pendingWrite;
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
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      dirtyRef.current = false;
      void saveNow(state);
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, token, saveNow]);

  // Unmounting with a debounced write still queued — the cleanup above only
  // drops the timer, which would silently lose a setting flipped a moment
  // before leaving the page. Flush it instead.
  useEffect(
    () => () => {
      if (dirtyRef.current && stateRef.current) {
        dirtyRef.current = false;
        void saveNow(stateRef.current);
      }
    },
    [saveNow],
  );

  return { state, update, reset };
}
