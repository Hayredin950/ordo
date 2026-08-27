/**
 * Two server-side Supabase clients:
 *
 * - `userClient(request)` forwards the caller's access token, so every query is
 *   still filtered by row level security. Use this for anything acting on behalf
 *   of a signed-in person.
 * - `serviceClient()` uses the service role key and bypasses RLS. Only the
 *   Telegram webhook and the cron tick need it, because they act with no user
 *   session at all.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverConfig } from "./config.server";

const noPersist = { auth: { persistSession: false, autoRefreshToken: false } } as const;

export function bearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? null;
}

/** RLS-scoped client for the signed-in caller. Null when there is no token. */
export function userClient(request: Request): SupabaseClient | null {
  const token = bearer(request);
  if (!token || !serverConfig.supabaseUrl || !serverConfig.supabaseAnonKey) return null;
  return createClient(serverConfig.supabaseUrl, serverConfig.supabaseAnonKey, {
    ...noPersist,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

let cachedService: SupabaseClient | null = null;

/** Service-role client. Throws rather than silently running unauthorized. */
export function serviceClient(): SupabaseClient {
  if (cachedService) return cachedService;
  if (!serverConfig.supabaseUrl || !serverConfig.supabaseServiceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  cachedService = createClient(
    serverConfig.supabaseUrl,
    serverConfig.supabaseServiceRoleKey,
    noPersist,
  );
  return cachedService;
}

export const serviceConfigured = (): boolean =>
  Boolean(serverConfig.supabaseUrl && serverConfig.supabaseServiceRoleKey);

/** Resolve the caller's user id from their token, or null if it is not valid. */
export async function currentUserId(request: Request): Promise<string | null> {
  const client = userClient(request);
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}
