/**
 * Thin client for the handful of routes that still need a server: the ones that
 * hold a private key (the AI coach) or report deployment config (health).
 * Everything else goes straight to Postgres via `src/lib/supabase.ts`.
 */
import { supabase } from "./supabase";

/** Same-origin on Vercel; override only when pointing at another deployment. */
export const API_URL: string = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (init.json !== undefined) headers["content-type"] = "application/json";

  // The server routes verify this token against Supabase before doing any work.
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  const token = data.session?.access_token;
  if (token) headers["authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  } as RequestInit);

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export type HealthStatus = {
  ok: boolean;
  status: {
    github: boolean;
    google: boolean;
    telegram: boolean;
    slack: boolean;
    anthropic: boolean;
    /** Bot handle, so the UI can build a t.me deep link. */
    telegramBot: string;
  };
};

export const health = () => apiFetch<HealthStatus>("/api/health");
