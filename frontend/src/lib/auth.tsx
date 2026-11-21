"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, SESSION_STORAGE_KEY, type LoginResponse, type Role } from "@/lib/api";

interface AuthState {
  session: LoginResponse | null;
  /** false do czasu odczytania sesji z localStorage (unikamy migotania przekierowań). */
  ready: boolean;
  login: (username: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) setSession(JSON.parse(raw) as LoginResponse);
    } catch {
      /* brak dostępu do localStorage */
    }
    setReady(true);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login({ username, password });
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(res));
    } catch {
      /* sesja tylko w pamięci */
    }
    setSession(res);
    return res;
  }, []);

  const logout = useCallback(() => {
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      /* ignorujemy */
    }
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, ready, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth wymaga AuthProvider");
  return ctx;
}

export const ROLE_LABELS: Record<Role, string> = {
  przelozony: "Przełożony",
  hr: "HR",
  admin: "Administrator",
};

export function homeFor(role: Role): string {
  return role === "przelozony" ? "/" : "/hr";
}
