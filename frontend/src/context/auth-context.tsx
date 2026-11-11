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
import { useRouter } from "next/navigation";
import { authApi, type AuthUser } from "@/lib/api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      if (typeof window !== "undefined") {
        const token = localStorage.getItem("audit_token");
        if (!token) {
          setUser(null);
          return;
        }
        if (!document.cookie.includes("audit_token=")) {
          document.cookie = `audit_token=${encodeURIComponent(token)}; path=/; max-age=${8 * 60 * 60}; SameSite=Lax`;
        }
      }
      const res = await authApi.me();
      setUser(res.data);
    } catch {
      if (typeof window !== "undefined") {
        localStorage.removeItem("audit_token");
        document.cookie = "audit_token=; path=/; max-age=0";
      }
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await authApi.login(username, password);
      setUser(res.data.user);
      if (typeof window !== "undefined" && res.data.token) {
        localStorage.setItem("audit_token", res.data.token);
        document.cookie = `audit_token=${encodeURIComponent(res.data.token)}; path=/; max-age=${8 * 60 * 60}; SameSite=Lax`;
      }
      router.push("/");
      router.refresh();
    },
    [router]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("audit_token");
        document.cookie = "audit_token=; path=/; max-age=0";
      }
      router.push("/login");
      router.refresh();
    }
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser }),
    [user, loading, login, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
