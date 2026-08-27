import { createContext, useContext } from "react";
import type { HealthStatus } from "./api";

export type User = {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
  provider: string;
  created_at: string;
};

export type OAuthProvider = "github" | "google";

/**
 * What a signup or code request left us with. `"session"` means Supabase signed
 * the user straight in (email confirmation is off); `"code"` means it emailed a
 * one-time code and is waiting for `codeVerify`.
 */
export type EmailStep = "session" | "code";

export type AuthContextValue = {
  user: User | null;
  /** Supabase access token; also the "we are synced" signal for useOrdoCloud. */
  token: string | null;
  health: HealthStatus["status"] | null;
  loading: boolean;
  configured: boolean;
  signup: (email: string, password: string, name?: string) => Promise<EmailStep>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  codeRequest: (email: string) => Promise<void>;
  codeVerify: (email: string, code: string) => Promise<void>;
  oauthSignIn: (provider: OAuthProvider) => Promise<void>;
  refresh: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The context, its types and this hook live apart from `<AuthProvider>` so that
 * `auth.tsx` exports a component and nothing else — a module mixing the two
 * makes React Fast Refresh remount the whole tree on every edit.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
