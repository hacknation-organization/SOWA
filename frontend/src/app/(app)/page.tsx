"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Download, Search } from "lucide-react";
import { ICON } from "@/components/app-shell";
import { Avatar, DeadlineBlock, StageSegments, stageIndex, typeLabel } from "@/components/process-badges";
import { ActiveCardSkeleton, TableSkeleton } from "@/components/loading-states";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { LoadingRegion } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, STAGES, TYPE_LABELS, type Employee, type Process } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { LEVEL_POINTS } from "@/lib/domain";
import { downloadProcessPdf } from "@/lib/download";
import { assessmentPath, ROUTES } from "@/lib/routes";
import { useApi } from "@/lib/use-api";
import { formatDate } from "@/lib/utils";

function todayLabel(): string {
  const text = new Date().toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return text.charAt(0).toLocaleUpperCase("pl-PL") + text.slice(1);
}

function yearOf(p: Process): string {
  const iso = p.updated_at ?? p.deadline;
  return iso ? String(new Date(iso).getFullYear()) : "";
}

export default function DashboardPage() {
  const { session } = useAuth();
  const { data, error, loading } = useApi(async () => {
    const [processes, employees] = await Promise.all([api.getProcesses(), api.getEmployees()]);
    // Total points of each completed assessment, from the levels the manager approved.
    const scores = new Map<string, number>();
    await Promise.all(
      processes
        .filter((p) => p.status === "completed")
        .map(async (p) => {
          try {
            const summary = await api.getSummary(p.id);
            scores.set(
              p.id,
              summary.reduce((sum, s) => sum + (s.manager_level ? LEVEL_POINTS[s.manager_level] : 0), 0),
            );
          } catch {}
        }),
    );
    return { processes, employees, scores };
  });
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");

  const employees = useMemo(
    () => new Map((data?.employees ?? []).map((e) => [e.id, e] as const)),
    [data?.employees],
  );
  const all = data?.processes ?? [];
  const nameOf = (p: Process) => p.employee_name ?? employees.get(p.employee_id)?.full_name ?? "Pracownik";

  const q = query.trim().toLocaleLowerCase("pl-PL");
  const matches = (p: Process) =>
    !q ||
    [nameOf(p), employees.get(p.employee_id)?.position, TYPE_LABELS[p.type]]
      .filter(Boolean)
      .some((s) => s!.toLocaleLowerCase("pl-PL").includes(q));

  const active = all
    .filter((p) => p.status !== "completed" && matches(p))
    .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
  const done = all.filter((p) => p.status === "completed");
  const years = [...new Set(done.map(yearOf).filter(Boolean))].sort().reverse();
  const shownYear = year || years[0] || "";
  const doneShown = done.filter((p) => matches(p) && (!shownYear || yearOf(p) === shownYear));

  const firstName = session?.display_name.split(/\s+/)[0] ?? "";
  const cycleEnd = all
    .map((p) => p.deadline)
    .filter((d): d is string => !!d)
    .sort()
    .pop();

  return (
    <div className="flex flex-col gap-8 px-10 pb-12 pt-8">
      <header className="flex items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-display">
            Dzień dobry{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-muted-foreground">
            {todayLabel()}
            {cycleEnd &&
              ` · cykl ocen trwa do ${new Date(cycleEnd).toLocaleDateString("pl-PL", { day: "numeric", month: "long" })}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex h-[39px] w-[280px] items-center gap-2 rounded-md border bg-card px-3 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15">
            <Search {...ICON} className="size-4 text-faint-foreground" />
            <span className="sr-only">Szukaj pracownika lub oceny</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj pracownika lub oceny"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint-foreground"
            />
          </label>
          <Button asChild>
            <Link href={ROUTES.newAssessment}>Nowa ocena</Link>
          </Button>
        </div>
      </header>

      {error && <Alert variant="danger">{error}</Alert>}

      <section aria-labelledby="todo-heading" className="flex flex-col gap-3">
        <SectionTitle id="todo-heading" title="Do dokończenia" count={loading ? undefined : active.length} />
        {loading ? (
          <LoadingRegion label="Wczytywanie ocen w toku">
            <ActiveCardSkeleton />
          </LoadingRegion>
        ) : active.length === 0 ? (
          <Card className="flex items-center justify-between gap-4 px-6 py-5">
            <p className="text-[13px] text-muted-foreground">
              {q ? "Żadna ocena w toku nie pasuje do wyszukiwania." : "Nie masz ocen w toku."}
            </p>
            {!q && (
              <Button asChild variant="outline">
                <Link href={ROUTES.newAssessment}>Rozpocznij nową ocenę</Link>
              </Button>
            )}
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {active.map((p, i) => (
              <li key={p.id}>
                <ActiveCard process={p} employee={employees.get(p.employee_id)} name={nameOf(p)} primary={i === 0} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="done-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <SectionTitle
            id="done-heading"
            title={shownYear ? `Zakończone w ${shownYear}` : "Zakończone"}
            count={loading ? undefined : doneShown.length}
          />
          {years.length > 1 && (
            <div className="w-36">
              <Select
                aria-label="Rok zakończenia"
                value={shownYear}
                onChange={(e) => setYear(e.target.value)}
                className="h-8 border-border text-[13px]"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    Rok: {y}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
        {loading ? (
          <LoadingRegion label="Wczytywanie zakończonych ocen">
            <TableSkeleton rows={3} />
          </LoadingRegion>
        ) : (
          <Card className="overflow-hidden">
            {doneShown.length === 0 ? (
              <p className="px-6 py-5 text-[13px] text-muted-foreground">
                {q ? "Żadna zakończona ocena nie pasuje do wyszukiwania." : "Brak zakończonych ocen."}
              </p>
            ) : (
              <Table aria-labelledby="done-heading" className="table-fixed">
                <colgroup>
                  <col className="w-[344px]" />
                  <col className="w-[260px]" />
                  <col className="w-[190px]" />
                  <col className="w-[110px]" />
                  <col />
                </colgroup>
                <TableHeader>
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableHead>Pracownik</TableHead>
                    <TableHead className="px-0">Rodzaj oceny</TableHead>
                    <TableHead className="px-0">Zakończono</TableHead>
                    <TableHead className="px-0">Wynik</TableHead>
                    <TableHead>
                      <span className="sr-only">Akcje</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doneShown.map((p) => (
                    <DoneRow
                      key={p.id}
                      process={p}
                      employee={employees.get(p.employee_id)}
                      name={nameOf(p)}
                      score={data?.scores.get(p.id)}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        )}
      </section>
    </div>
  );
}

function SectionTitle({ id, title, count }: { id: string; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2">
      <h2 id={id} className="text-[17px] font-semibold leading-6 tracking-[-0.1px]">
        {title}
      </h2>
      {count !== undefined && <Badge aria-label={`${count} pozycji`}>{count}</Badge>}
    </div>
  );
}

function ActiveCard({
  process: p,
  employee,
  name,
  primary,
}: {
  process: Process;
  employee?: Employee;
  name: string;
  primary: boolean;
}) {
  const idx = stageIndex(p.stage);
  return (
    <Card className="flex items-center gap-8 px-6 py-5">
      <div className="flex w-[300px] shrink-0 items-center gap-3">
        <Avatar name={name} className="size-10 text-[13px]" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{name}</p>
          {employee?.position && (
            <p className="truncate text-[13px] leading-[19px] text-muted-foreground">{employee.position}</p>
          )}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-xs leading-4 text-faint-foreground">{typeLabel(p.type, p.form)}</p>
        <p className="text-[13px] font-medium leading-[19px]">
          Krok {idx + 1} z {STAGES.length} — {STAGES[idx]?.label}
        </p>
        <StageSegments stage={p.stage} />
      </div>
      <div className="w-[160px] shrink-0">
        <DeadlineBlock iso={p.deadline} />
      </div>
      <Button asChild variant={primary ? "default" : "outline"}>
        <Link href={assessmentPath(p.id)}>
          Kontynuuj ocenę
          <span className="sr-only">: {name}</span>
          <ArrowRight {...ICON} />
        </Link>
      </Button>
    </Card>
  );
}

function DoneRow({
  process: p,
  employee,
  name,
  score,
}: {
  process: Process;
  employee?: Employee;
  name: string;
  score?: number;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar name={name} />
          <div className="min-w-0">
            <p className="truncate font-medium">{name}</p>
            {employee?.position && (
              <p className="truncate text-xs leading-4 text-faint-foreground">{employee.position}</p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="px-0 text-muted-foreground">{typeLabel(p.type, p.form)}</TableCell>
      <TableCell className="px-0 text-muted-foreground">{formatDate(p.updated_at)}</TableCell>
      <TableCell className="px-0 font-medium">{score !== undefined ? `${score} pkt` : "—"}</TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={busy}
            aria-label={`Pobierz PDF: ${name}`}
            title="Pobierz PDF"
            onClick={async () => {
              setBusy(true);
              try {
                await downloadProcessPdf(p.id);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Download {...ICON} className="!size-[18px]" />
          </Button>
          <Button asChild variant="outline">
            <Link href={assessmentPath(p.id)}>
              Otwórz
              <span className="sr-only"> ocenę: {name}</span>
            </Link>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
