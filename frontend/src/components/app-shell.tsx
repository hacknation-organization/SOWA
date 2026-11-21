"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { FilePlus, LayoutGrid, LogOut, MessageSquare, Users, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/process-badges";
import { api, API_MODE, type Role } from "@/lib/api";
import { ROLE_LABELS, homeFor, useAuth } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { useApi } from "@/lib/use-api";
import { cn, formatDate } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
}

const NAV: NavItem[] = [
  { href: ROUTES.dashboard, label: "Pulpit", icon: LayoutGrid, roles: ["przelozony", "admin"] },
  { href: ROUTES.newAssessment, label: "Nowa ocena", icon: FilePlus, roles: ["przelozony", "admin"] },
  { href: ROUTES.hr, label: "Monitoring ocen", icon: Users, roles: ["hr", "admin"] },
  { href: ROUTES.assistant, label: "Asystent", icon: MessageSquare, roles: ["przelozony", "hr", "admin"] },
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
  // The deepest matching route wins, so "/assessments/new" does not also light up a parent entry.
  const activeHref = items
    .filter((n) =>
      n.href === ROUTES.dashboard ? pathname === n.href : pathname === n.href || pathname.startsWith(n.href + "/"),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="flex min-h-screen">
      <aside
        className="sticky top-0 z-10 flex h-screen shrink-0 flex-col overflow-y-auto bg-card px-4 pb-5 pt-7 shadow-sidebar"
        style={{ width: "var(--kk-sidebar-width)" }}
      >
        <Link href={homeFor(session.role)} className="mb-7 flex items-center gap-3 rounded-md pl-2">
          {/* Static brand mark exported from the Figma file. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sowa-logo.svg" alt="" width={38} height={38} className="size-[38px] shrink-0" />
          <span className="flex flex-col gap-px">
            <span className="text-[22px] font-black leading-[26px] tracking-[0.06em] text-primary">SOWA</span>
            <span className="text-[11px] font-medium leading-[14px] text-muted-foreground">
              System Oceny, Wsparcia i Analizy
            </span>
          </span>
        </Link>

        <nav aria-label="Główna nawigacja">
          <p className="px-3.5 pb-2 pt-[18px] text-[11px] font-bold tracking-[0.08em] text-faint-foreground">
            MENU
          </p>
          <ul className="flex flex-col gap-1">
            {items.map((n) => {
              const active = n.href === activeHref;
              const Icon = n.icon;
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md py-[11px] pl-3.5 pr-3 text-[15px] transition-colors",
                      active
                        ? "bg-primary font-bold text-primary-foreground shadow-primary"
                        : "font-medium text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon
                      aria-hidden
                      absoluteStrokeWidth
                      strokeWidth={2}
                      className={cn("size-5 shrink-0", active ? "text-primary-foreground" : "text-muted-foreground")}
                    />
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex-1" />

        {session.role !== "hr" && <CycleCard />}

        <div className="mt-4 flex items-center gap-3 border-t pl-2 pr-1 pt-4">
          <Avatar name={session.display_name} tone="solid" className="size-10 text-sm font-bold" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold" title={session.display_name}>
              {session.display_name.replace(/\s*\(.*\)/, "")}
            </p>
            <p className="text-xs font-medium text-muted-foreground">{ROLE_LABELS[session.role]}</p>
          </div>
          <button
            type="button"
            aria-label="Wyloguj"
            title="Wyloguj"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => {
              logout();
              router.replace(ROUTES.login);
            }}
          >
            <LogOut aria-hidden absoluteStrokeWidth strokeWidth={2} className="size-[18px]" />
          </button>
        </div>
        {API_MODE === "mock" && (
          <p className="mt-3 px-2 text-[11px] leading-4 text-muted-foreground">
            Tryb demonstracyjny – dane przykładowe zapisane w przeglądarce.
          </p>
        )}
      </aside>
      <main id="main" className="min-w-0 flex-1" tabIndex={-1}>
        {forbidden ? (
          <div className="px-10 py-8">
            <h1 className="mb-2 text-[28px] font-black">Brak dostępu</h1>
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

/** Progress of the current assessment cycle: completed vs. all assessments of this manager. */
function CycleCard() {
  const { data: processes } = useApi(() => api.getProcesses());
  if (!processes?.length) return null;
  const done = processes.filter((p) => p.status === "completed").length;
  const deadlines = processes.map((p) => p.deadline).filter((d): d is string => !!d).sort();
  const last = deadlines[deadlines.length - 1];
  const year = new Date(last ?? Date.now()).getFullYear();
  const pct = Math.round((done / processes.length) * 100);
  return (
    <section aria-label={`Cykl ocen ${year}`} className="flex flex-col gap-2.5 rounded-xl bg-primary-soft p-[18px]">
      <p className="flex items-center gap-2 text-sm">
        <span className="flex-1 font-bold">Cykl ocen {year}</span>
        <span className="font-black text-primary">
          {done}/{processes.length}
        </span>
      </p>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-card"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={processes.length}
        aria-label="Zakończone oceny"
      >
        <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${pct}%` }} />
      </div>
      {last && (
        <p className="text-xs font-medium leading-4 text-muted-foreground">
          Termin ostatniej oceny: {formatDate(last)}
        </p>
      )}
    </section>
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
    <header className="flex items-start justify-between gap-4 px-10 pt-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-black leading-tight">{title}</h1>
        {description && <p className="text-[15px] font-medium text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
