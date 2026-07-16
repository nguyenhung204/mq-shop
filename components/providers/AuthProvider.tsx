"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi } from "@/lib/api/auth";
import { clearTokens, getAccessToken } from "@/lib/api/client";
import type { AuthUser, Role } from "@/lib/api/types";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  hasRole: (role: Role) => boolean;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
  login: (identifier: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = "mq_user";

function readCachedUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function cacheUser(user: AuthUser | null) {
  if (typeof window === "undefined") return;
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const setUser = useCallback((next: AuthUser | null) => {
    setUserState(next);
    cacheUser(next);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      return;
    }
    const me = await authApi.me();
    setUser(me);
  }, [setUser]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getAccessToken();
      if (!token) {
        if (!cancelled) {
          setUserState(null);
          setLoading(false);
        }
        return;
      }
      const cached = readCachedUser();
      if (cached && !cancelled) setUserState(cached);
      try {
        const me = await authApi.me();
        if (!cancelled) setUser(me);
      } catch {
        clearTokens();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const onLogout = () => {
      clearTokens();
      setUser(null);
    };
    window.addEventListener("mq:auth-logout", onLogout);
    return () => {
      cancelled = true;
      window.removeEventListener("mq:auth-logout", onLogout);
    };
  }, [setUser]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const data = await authApi.login({ identifier, password });
      setUser(data.user);
      return data.user;
    },
    [setUser],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      clearTokens();
    }
    setUser(null);
  }, [setUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      hasRole: (role) => !!user?.roles?.includes(role),
      hasPermission: (code) => {
        if (!user) return false;
        if (user.roles?.includes("SUPER_ADMIN")) return true;
        return !!user.permissions?.includes(code);
      },
      hasAnyPermission: (codes) => {
        if (!user) return false;
        if (user.roles?.includes("SUPER_ADMIN")) return true;
        return codes.some((c) => user.permissions?.includes(c));
      },
      login,
      logout,
      refreshUser,
      setUser,
    }),
    [user, loading, login, logout, refreshUser, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
