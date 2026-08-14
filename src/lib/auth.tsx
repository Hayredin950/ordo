import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, getToken, setToken, type HealthStatus } from "./api";

export type User = {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
  provider: string;
  created_at: string;
};

type AuthContextValue = {
  user: User | null;
  token: string | null;
  health: HealthStatus["status"] | null;
  loading: boolean;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  magicRequest: (email: string) => Promise<{ devCode?: string }>;
  magicVerify: (email: string, code: string) => Promise<void>;
  oauthUrl: (provider: "github" | "google") => string;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [health, setHealth] = useState<HealthStatus["status"] | null>(null);
  const [loading, setLoading] = useState(true);

  const applyToken = useCallback((t: string | null) => {
    setToken(t);
    setTokenState(t);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const h = await apiFetch<HealthStatus>("/api/health");
      setHealth(h.status);
    } catch {
      setHealth(null);
    }
    const t = getToken();
    if (!t) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiFetch<{ user: User }>("/api/auth/me");
      setUser(me.user);
    } catch {
      applyToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [applyToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // OAuth callback lands as /#/auth?token=...
  useEffect(() => {
    if (window.location.hash.startsWith("#/auth")) {
      const params = new URLSearchParams(window.location.hash.slice(6));
      const t = params.get("token");
      if (t) {
        applyToken(t);
        window.location.hash = "";
      }
    }
  }, [applyToken]);

  const signup = useCallback(
    async (email: string, password: string, name?: string) => {
      const res = await apiFetch<{ token: string; user: User }>("/api/auth/signup", {
        method: "POST",
        json: { email, password, name },
      });
      applyToken(res.token);
      setUser(res.user);
    },
    [applyToken],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch<{ token: string; user: User }>("/api/auth/login", {
        method: "POST",
        json: { email, password },
      });
      applyToken(res.token);
      setUser(res.user);
    },
    [applyToken],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    applyToken(null);
    setUser(null);
  }, [applyToken]);

  const magicRequest = useCallback(async (email: string) => {
    return apiFetch<{ devCode?: string }>("/api/auth/magic", { method: "POST", json: { email } });
  }, []);

  const magicVerify = useCallback(
    async (email: string, code: string) => {
      const res = await apiFetch<{ token: string; user: User }>("/api/auth/magic/verify", {
        method: "POST",
        json: { email, code },
      });
      applyToken(res.token);
      setUser(res.user);
    },
    [applyToken],
  );

  const oauthUrl = useCallback((provider: "github" | "google") => {
    return `${import.meta.env["VITE_API_URL"] ?? "http://localhost:8787"}/api/auth/${provider}`;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, health, loading, signup, login, logout, magicRequest, magicVerify, oauthUrl, refresh }),
    [user, token, health, loading, signup, login, logout, magicRequest, magicVerify, oauthUrl, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
