"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { API_MODE, type Role } from "@/lib/api";
import { ROLE_LABELS, homeFor, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  roles: Role[];
}

const NAV: NavItem[] = [
  { href: ROUTES.dashboard, label: "Pulpit", roles: ["przelozony", "admin"] },
  { href: ROUTES.newAssessment, label: "Nowa ocena", roles: ["przelozony", "admin"] },
  { href: ROUTES.hr, label: "Monitoring ocen", roles: ["hr", "admin"] },
  { href: ROUTES.assistant, label: "Asystent", roles: ["przelozony", "hr", "admin"] },
];

const GUARDS: { prefix: string; roles: Role[] }[] = [
  { prefix: ROUTES.hr, roles: ["hr", "admin"] },
  { prefix: ROUTES.assessments, roles: ["przelozony", "admin"] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, ready, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const guard = GUARDS.find((g) => pathname.startsWith(g.prefix));
  const hrOnDashboard = session?.role === "hr" && pathname === ROUTES.dashboard;
  const forbidden = !!session && ((guard && !guard.roles.includes(session.role)) || hrOnDashboard);

  useEffect(() => {
    if (!ready) return;
    if (!session) router.replace(ROUTES.login);
    else if (hrOnDashboard) router.replace(homeFor(session.role));
  }, [ready, session, hrOnDashboard, router]);

  if (!ready || !session) {
    return <p className="p-8 text-muted-foreground">Ładowanie…</p>;
  }

  const items = NAV.filter((n) => n.roles.includes(session.role));
  const isActive = (href: string) =>
    href === ROUTES.dashboard
      ? pathname === ROUTES.dashboard
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex min-h-screen">
      <aside
        className="sticky top-0 flex h-screen shrink-0 flex-col border-r bg-card"
        style={{ width: "var(--kk-sidebar-width)" }}
      >
        <div className="border-b p-4">
          <p className="font-semibold">Kompas kompetencji</p>
          <p className="text-xs text-muted-foreground">Oceny w służbie cywilnej</p>
        </div>
        <nav aria-label="Główna nawigacja" className="flex-1 p-2">
          <ul className="flex flex-col gap-1">
            {items.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={isActive(n.href) ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm hover:bg-muted",
                    isActive(n.href) && "bg-primary-soft font-medium",
                  )}
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t p-4 text-sm">
          <p className="font-medium">{session.display_name}</p>
          <p className="mb-3 text-xs text-muted-foreground">Rola: {ROLE_LABELS[session.role]}</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              logout();
              router.replace(ROUTES.login);
            }}
          >
            Wyloguj
          </Button>
          {API_MODE === "mock" && (
            <p className="mt-3 text-xs text-muted-foreground">
              Tryb demonstracyjny – dane przykładowe zapisane w przeglądarce.
            </p>
          )}
        </div>
      </aside>
      <main id="main" className="min-w-0 flex-1" tabIndex={-1}>
        {forbidden ? (
          <div className="p-8">
            <h1 className="mb-2 text-xl font-semibold">Brak dostępu</h1>
            <p className="text-muted-foreground">
              Ta część aplikacji nie jest dostępna dla roli „{ROLE_LABELS[session.role]}”.
            </p>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 border-b bg-card px-8 py-5">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
