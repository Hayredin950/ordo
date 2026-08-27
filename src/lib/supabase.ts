/**
 * Supabase browser client. This is Ordo's backend: the database enforces access
 * control through row level security, so the app talks to Postgres directly and
 * only keeps a couple of server routes for things that need a private key.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) ?? "";
const anonKey = (import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined) ?? "";

/** False when the env vars are missing, so the UI can say so instead of hanging. */
export const supabaseConfigured: boolean = Boolean(url && anonKey);

const isBrowser = typeof window !== "undefined";

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: isBrowser,
        autoRefreshToken: isBrowser,
        // OAuth and magic links come back as a hash fragment on /login.
        detectSessionInUrl: isBrowser,
        flowType: "pkce",
        storageKey: "ordo.auth.v1",
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY",
    );
  }
  return supabase;
}

/** Short alias; reads well at call sites: `await sb().from("...")`. */
export const sb = requireSupabase;

/**
 * Postgres errors arrive with codes we raise deliberately in the migration.
 * Surface the message we wrote rather than a generic failure.
 */
export function dbError(err: unknown, fallback: string): Error {
  if (err && typeof err === "object" && "message" in err) {
    const message = String((err as { message?: unknown }).message ?? "").trim();
    if (message) return new Error(message);
  }
  return new Error(fallback);
}
