"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FilePlus, LayoutGrid, LogOut, Menu, MessageSquare, Users, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BootScreen } from "@/components/loading-states";
import { Avatar } from "@/components/process-badges";
import { api, API_MODE, type Role } from "@/lib/api";
import { ROLE_LABELS, homeFor, useAuth } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

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

export const ICON = { absoluteStrokeWidth: true, strokeWidth: 1.6, "aria-hidden": true } as const;

const BRAND_SIZES = {
  sidebar: { mark: "h-10", gap: "gap-2.5", title: "text-2xl leading-7", tagline: "whitespace-nowrap text-[11px] leading-4" },
  // Mobile top bar: the wordmark alone, the tagline would not fit next to the menu button.
  topbar: { mark: "h-8", gap: "gap-2", title: "text-xl leading-6", tagline: "hidden" },
  login: {
    mark: "h-12 sm:h-16",
    gap: "gap-3 sm:gap-4",
    title: "text-[32px] leading-9 sm:text-[40px] sm:leading-[44px]",
    tagline: "text-[13px] leading-[19px] sm:text-sm sm:leading-5",
  },
} as const;

/** Logo lockup: owl mark, "SOWA" wordmark in the brand typeface and the tagline. */
export function SowaBrand({ size = "sidebar", as: Title = "span" }: { size?: keyof typeof BRAND_SIZES; as?: "span" | "h1" }) {
  const s = BRAND_SIZES[size];
  return (
    <span className={cn("flex items-center", s.gap)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/sowa-logo.svg" alt="" width={182} height={185} className={cn("w-auto shrink-0", s.mark)} />
      <span className="flex flex-col gap-0.5">
        <Title className={cn("font-brand font-bold tracking-[0.02em] text-primary-hover", s.title)}>SOWA</Title>
        <span className={cn("text-muted-foreground", s.tagline)}>System Oceny, Wsparcia i Analizy</span>
      </span>
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, ready } = useAuth();
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
    return <BootScreen />;
  }

  const items = NAV.filter((n) => n.roles.includes(session.role));
  // The deepest matching route wins, so "/assessments/new" does not also light up a parent entry.
  const activeHref = items
    .filter((n) =>
      n.href === ROUTES.dashboard ? pathname === n.href : pathname === n.href || pathname.startsWith(n.href + "/"),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Desktop: fixed sidebar. Below 1024px the same content lives in a drawer behind the top bar. */}
      <aside
        className="sticky top-0 z-10 hidden h-screen shrink-0 overflow-y-auto border-r bg-subtle px-3 pb-4 pt-5 lg:flex"
        style={{ width: "var(--kk-sidebar-width)" }}
      >
        <SidebarContent items={items} activeHref={activeHref} />
      </aside>
      <MobileNav items={items} activeHref={activeHref} pathname={pathname} />
      <main id="main" className="min-w-0 flex-1" tabIndex={-1}>
        {forbidden ? (
          <div className="page-x py-8">
            <h1 className="mb-2 text-display">Brak dostępu</h1>
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

/** Brand, navigation, cycle progress and the signed-in user; shared by the sidebar and the mobile drawer. */
function SidebarContent({
  items,
  activeHref,
  onNavigate,
  hideBrand,
}: {
  items: NavItem[];
  activeHref?: string;
  onNavigate?: () => void;
  hideBrand?: boolean;
}) {
  const { session, logout } = useAuth();
  const router = useRouter();
  if (!session) return null;
  return (
    <div className="flex min-h-full w-full flex-col justify-between gap-6">
      <div className="flex flex-col gap-7">
        {!hideBrand && (
          <Link href={homeFor(session.role)} aria-label="SOWA — pulpit" className="rounded-md" onClick={onNavigate}>
            <SowaBrand />
          </Link>
        )}

        <nav aria-label="Główna nawigacja" className="flex flex-col gap-0.5">
          <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase leading-4 tracking-[0.6px] text-faint-foreground">
            Ocena
          </p>
          <ul className="flex flex-col gap-0.5">
            {items.map((n) => {
              const active = n.href === activeHref;
              const Icon = n.icon;
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      // Taller rows in the drawer, where the list is used with a finger.
                      "flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] leading-[19px] transition-colors max-lg:py-2.5 max-lg:text-sm",
                      active
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <Icon {...ICON} className="size-[18px] shrink-0" />
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="flex flex-col gap-3">
        {session.role !== "hr" && <CycleCard />}
        <div className="h-px bg-border" />
        <div className="flex items-center gap-2.5 px-1.5 py-0.5">
          <Avatar name={session.display_name} tone="accent" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium leading-[19px]" title={session.display_name}>
              {session.display_name.replace(/\s*\(.*\)/, "")}
            </p>
            <p className="text-xs leading-4 text-faint-foreground">{ROLE_LABELS[session.role]}</p>
          </div>
          <button
            type="button"
            aria-label="Wyloguj"
            title="Wyloguj"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => {
              onNavigate?.();
              logout();
              router.replace(ROUTES.login);
            }}
          >
            <LogOut {...ICON} className="size-[18px]" />
          </button>
        </div>
        {API_MODE === "mock" && (
          <p className="px-2 text-[11px] leading-4 text-faint-foreground">
            Tryb demonstracyjny – dane przykładowe zapisane w przeglądarce.
          </p>
        )}
      </div>
    </div>
  );
}

/** Below 1024px: top bar with the brand and a menu button that opens the navigation as a drawer. */
function MobileNav({ items, activeHref, pathname }: { items: NavItem[]; activeHref?: string; pathname: string }) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on navigation, e.g. browser back while the drawer is open.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  if (!session) return null;
  return (
    <>
      <header
        className="sticky top-0 z-30 flex shrink-0 items-center justify-between gap-3 border-b bg-subtle page-x lg:hidden"
        style={{ height: "var(--kk-topbar-height)" }}
      >
        <Link href={homeFor(session.role)} aria-label="SOWA — pulpit" className="rounded-md">
          <SowaBrand size="topbar" />
        </Link>
        <Button
          ref={triggerRef}
          variant="ghost"
          size="icon"
          aria-label="Otwórz menu"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen(true)}
          className="-mr-2"
        >
          <Menu {...ICON} className="!size-[22px]" />
        </Button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div aria-hidden className="kk-fade-in absolute inset-0 bg-foreground/25" onClick={() => setOpen(false)} />
          <div
            id="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="kk-slide-in-left absolute inset-y-0 left-0 flex w-[min(20rem,calc(100vw-3rem))] flex-col gap-6 overflow-y-auto border-r bg-subtle px-3 pb-4 pt-4"
          >
            <div className="flex items-center justify-between gap-2">
              <Link
                href={homeFor(session.role)}
                aria-label="SOWA — pulpit"
                className="rounded-md"
                onClick={() => setOpen(false)}
              >
                <SowaBrand />
              </Link>
              <Button ref={closeRef} variant="ghost" size="icon" aria-label="Zamknij menu" onClick={() => setOpen(false)}>
                <X {...ICON} className="!size-5" />
              </Button>
            </div>
            <div className="flex flex-1">
              <SidebarContent items={items} activeHref={activeHref} onNavigate={() => setOpen(false)} hideBrand />
            </div>
          </div>
        </div>
      )}
    </>
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
    <section aria-label={`Cykl ocen ${year}`} className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      <p className="flex items-center justify-between">
        <span className="text-[13px] font-medium leading-[19px]">Cykl ocen {year}</span>
        <span className="text-xs text-muted-foreground">
          {done} z {processes.length} ocen
        </span>
      </p>
      <div
        className="h-1 overflow-hidden rounded-[2px] bg-muted"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={processes.length}
        aria-label="Zakończone oceny"
      >
        <div className="h-full rounded-[2px] bg-primary" style={{ width: `${pct}%` }} />
      </div>
      {last && (
        <p className="text-xs leading-4 text-faint-foreground">
          Termin ostatniej oceny:{" "}
          {new Date(last).toLocaleDateString("pl-PL", { day: "numeric", month: "long" })}
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
    <header className="flex flex-col gap-4 page-x pt-6 sm:flex-row sm:items-center sm:justify-between lg:pt-8">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-display">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
