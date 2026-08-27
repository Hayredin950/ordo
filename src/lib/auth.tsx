import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { health as fetchHealth, type HealthStatus } from "./api";
import { dbError, requireSupabase, supabase, supabaseConfigured } from "./supabase";
import {
  AuthContext,
  type AuthContextValue,
  type EmailStep,
  type OAuthProvider,
  type User,
} from "./auth-context";

/**
 * Where Supabase should send the user back to. Omitted entirely during SSR
 * rather than passed as undefined, because `exactOptionalPropertyTypes` (and
 * supabase-js) treat "absent" and "undefined" as different things.
 */
function redirectOption(
  path: string,
  key: "emailRedirectTo" | "redirectTo" = "emailRedirectTo",
): Record<string, string> {
  if (typeof window === "undefined") return {};
  return { [key]: `${window.location.origin}${path}` };
}

/** Session user + profile row, reconciled into the shape the UI already uses. */
function toUser(session: Session, profile: Partial<User> | null): User {
  const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = meta[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    return "";
  };
  return {
    id: session.user.id,
    email: profile?.email || session.user.email || "",
    name: profile?.name || pick("name", "full_name", "user_name"),
    avatar_url: profile?.avatar_url || pick("avatar_url", "picture"),
    provider: profile?.provider || session.user.app_metadata?.provider || "email",
    created_at: profile?.created_at || session.user.created_at,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus["status"] | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);
  const sessionRef = useRef<Session | null>(null);

  /** Fill in name/avatar from `profiles`; the trigger populates it on signup. */
  const hydrate = useCallback(async (session: Session | null) => {
    sessionRef.current = session;
    setToken(session?.access_token ?? null);
    if (!session) {
      setUser(null);
      return;
    }
    setUser(toUser(session, null));
    try {
      const { data } = await requireSupabase()
        .from("profiles")
        .select("email, name, avatar_url, provider, created_at")
        .eq("id", session.user.id)
        .maybeSingle();
      if (sessionRef.current?.user.id === session.user.id) {
        setUser(toUser(session, data as Partial<User> | null));
      }
    } catch {
      /* the metadata-derived user is good enough */
    }
  }, []);

  useEffect(() => {
    void fetchHealth()
      .then((h) => setHealth(h.status))
      .catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      await hydrate(data.session);
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      void hydrate(session).then(() => {
        if (active) setLoading(false);
      });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [hydrate]);

  const refresh = useCallback(async () => {
    try {
      const h = await fetchHealth();
      setHealth(h.status);
    } catch {
      setHealth(null);
    }
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    await hydrate(data.session);
  }, [hydrate]);

  const signup = useCallback(
    async (email: string, password: string, name?: string): Promise<EmailStep> => {
      const { data, error } = await requireSupabase().auth.signUp({
        email,
        password,
        options: {
          data: name ? { name } : {},
          ...redirectOption("/login"),
        },
      });
      if (error) throw dbError(error, "Could not create the account");
      // No session means email confirmation is on and a code is in flight; the
      // caller shows the code screen rather than treating this as a failure.
      return data.session ? "session" : "code";
    },
    [],
  );

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await requireSupabase().auth.signInWithPassword({ email, password });
    if (error) throw dbError(error, "Wrong email or password");
  }, []);

  const logout = useCallback(async () => {
    await supabase?.auth.signOut();
    setUser(null);
    setToken(null);
  }, []);

  const codeRequest = useCallback(async (email: string) => {
    const { error } = await requireSupabase().auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        ...redirectOption("/login"),
      },
    });
    if (error) throw dbError(error, "Could not send the code");
  }, []);

  /**
   * One verifier for both flows. `type: "email"` accepts a signup-confirmation
   * code and a sign-in code alike — checked against this project by minting each
   * kind with admin/generate_link and verifying it — so the UI never has to know
   * which email the code came from.
   */
  const codeVerify = useCallback(async (email: string, code: string) => {
    const { error } = await requireSupabase().auth.verifyOtp({
      email,
      token: code.replace(/\D/g, ""),
      type: "email",
    });
    if (error) throw dbError(error, "That code is wrong or has expired");
  }, []);

  const oauthSignIn = useCallback(async (provider: OAuthProvider) => {
    const { error } = await requireSupabase().auth.signInWithOAuth({
      provider,
      options: { ...redirectOption("/", "redirectTo") },
    });
    if (error) throw dbError(error, `Could not start ${provider} sign-in`);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      health,
      loading,
      configured: supabaseConfigured,
      signup,
      login,
      logout,
      codeRequest,
      codeVerify,
      oauthSignIn,
      refresh,
    }),
    [
      user,
      token,
      health,
      loading,
      signup,
      login,
      logout,
      codeRequest,
      codeVerify,
      oauthSignIn,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
