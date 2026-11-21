"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, SESSION_STORAGE_KEY, type LoginResponse, type Role } from "@/lib/api";
import { ROUTES } from "@/lib/routes";

interface AuthState {
  session: LoginResponse | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function tryStorage(action: (storage: Storage) => void): void {
  try {
    action(window.localStorage);
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    tryStorage((storage) => {
      const raw = storage.getItem(SESSION_STORAGE_KEY);
      if (raw) setSession(JSON.parse(raw) as LoginResponse);
    });
    setReady(true);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login({ username, password });
    tryStorage((storage) => storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(res)));
    setSession(res);
    return res;
  }, []);

  const logout = useCallback(() => {
    tryStorage((storage) => storage.removeItem(SESSION_STORAGE_KEY));
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
  return role === "przelozony" ? ROUTES.dashboard : ROUTES.hr;
}
