"use client";

import { useRouter } from "next/navigation";
import { SowaBrand } from "@/components/app-shell";
import { useState } from "react";
import { API_MODE, type Role } from "@/lib/api";
import { ROLE_LABELS, homeFor, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form";
import { Alert } from "@/components/ui/alert";

const DEMO_PASSWORD = "demo123";

const DEMO_ROLES: { role: Role; description: string }[] = [
  { role: "przelozony", description: "Prowadzi oceny swoich pracowników krok po kroku." },
  { role: "hr", description: "Monitoruje statusy i terminy ocen, wysyła przypomnienia." },
  { role: "admin", description: "Ma dostęp do wszystkich widoków." },
];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("przelozony");
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(user: string, pass: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await login(user, pass);
      router.replace(homeFor(res.role));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Logowanie nie powiodło się");
      setBusy(false);
    }
  }

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-8 sm:p-8">
      <div className="w-full max-w-3xl">
        <div className="mb-6 flex flex-col gap-3 sm:mb-8">
          <SowaBrand size="login" as="h1" />
          <p className="text-muted-foreground">Pierwsza ocena i ocena okresowa w służbie cywilnej.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Wejdź jako użytkownik demonstracyjny</CardTitle>
              <CardDescription>Wybierz rolę, aby zobaczyć odpowiedni widok.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2">
                {DEMO_ROLES.map(({ role, description }) => (
                  <li key={role}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => submit(role, DEMO_PASSWORD)}
                      className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-subtle disabled:opacity-50"
                    >
                      <span className="block font-medium">{ROLE_LABELS[role]}</span>
                      <span className="block text-[13px] leading-[19px] text-muted-foreground">{description}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Logowanie</CardTitle>
              <CardDescription>
                {API_MODE === "mock"
                  ? "Tryb demonstracyjny: login to nazwa roli (przelozony, hr, admin)."
                  : "Zaloguj się kontem nadanym przez administratora."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit(username, password);
                }}
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="username">Login</Label>
                  <Input
                    id="username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Hasło</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {error && <Alert variant="danger">{error}</Alert>}
                <Button type="submit" disabled={busy}>
                  {busy ? "Logowanie…" : "Zaloguj"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
