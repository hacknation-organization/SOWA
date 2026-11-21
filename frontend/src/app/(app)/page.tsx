"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Clock, Download, Search } from "lucide-react";
import { Avatar, Deadline, FormTag, StageProgress, StatusBadge } from "@/components/process-badges";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, TYPE_LABELS, type Employee, type Process, type ProcessType } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { downloadProcessPdf, plural } from "@/lib/download";
import { assessmentPath, newAssessmentPath } from "@/lib/routes";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const ICON = { absoluteStrokeWidth: true, strokeWidth: 2, "aria-hidden": true } as const;

type SortKey = "deadline" | "name";

function today(): string {
  const text = new Date().toLocaleDateString("pl-PL", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return text.charAt(0).toLocaleUpperCase("pl-PL") + text.slice(1).replace(".", "");
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "long" });
}

export default function DashboardPage() {
  const { session } = useAuth();
  const { data, error, loading } = useApi(async () => {
    const [processes, employees] = await Promise.all([api.getProcesses(), api.getEmployees()]);
    return { processes, employees };
  });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("deadline");
  const [year, setYear] = useState("");

  const employees = useMemo(
    () => new Map((data?.employees ?? []).map((e) => [e.id, e] as const)),
    [data?.employees],
  );
  const all = data?.processes ?? [];
  const nameOf = (p: Process) => p.employee_name ?? employees.get(p.employee_id)?.full_name ?? "";

  const q = query.trim().toLocaleLowerCase("pl-PL");
  const matches = (p: Process) =>
    !q ||
    [nameOf(p), employees.get(p.employee_id)?.position, TYPE_LABELS[p.type]]
      .filter(Boolean)
      .some((s) => s!.toLocaleLowerCase("pl-PL").includes(q));

  const active = all
    .filter((p) => p.status !== "completed")
    .sort((a, b) =>
      sort === "name"
        ? nameOf(a).localeCompare(nameOf(b), "pl")
        : (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"),
    );
  const done = all.filter((p) => p.status === "completed");
  const years = [...new Set(done.map((p) => yearOf(p)).filter(Boolean))].sort().reverse();
  const doneShown = done.filter((p) => matches(p) && (!year || yearOf(p) === year));
  const activeShown = active.filter(matches);

  const firstName = session?.display_name.split(/\s+/)[0] ?? "";
  const overdue = active.filter((p) => p.status === "overdue");
  const next = overdue[0] ?? active.find((p) => p.deadline);

  return (
    <div className="flex flex-col gap-7 px-10 pb-12 pt-6">
      <section
        aria-label="Powitanie"
        className="flex flex-col items-start gap-3 rounded-2xl bg-brand-gradient py-7 pl-8 pr-10 shadow-hero"
      >
        <h1 className="text-[32px] font-black leading-[38px] text-primary-foreground">
          Dzień dobry{firstName ? `, ${firstName}` : ""}!
        </h1>
        <p className="text-[15px] font-medium leading-[22px] text-on-dark-muted">
          {loading
            ? "Wczytuję Twoje oceny…"
            : active.length === 0
              ? "Nie masz ocen w toku. Rozpocznij nową ocenę poniżej."
              : `Masz ${active.length} ${plural(active.length, "ocenę", "oceny", "ocen")} w toku.` +
                (overdue.length
                  ? ` Po terminie: ${overdue.length} — m.in. ${nameOf(overdue[0])}.`
                  : next?.deadline
                    ? ` Najbliższy termin mija ${longDate(next.deadline)} — ${nameOf(next)}.`
                    : "")}
        </p>
        {active[0] && (
          <Button asChild className="h-10 bg-card text-primary hover:bg-primary-soft">
            <Link href={assessmentPath((next ?? active[0]).id)}>
              Wróć do oceny
              <ArrowRight {...ICON} />
            </Link>
          </Button>
        )}
      </section>

      <section aria-labelledby="start-heading" className="flex flex-col gap-3.5">
        <h2 id="start-heading" className="text-lg font-black">
          Rozpocznij nową ocenę
        </h2>
        <div className="grid grid-cols-2 gap-5">
          <StartTile
            type="first"
            title="Pierwsza ocena"
            sheet="Arkusz A"
            description="Dla osoby, która po raz pierwszy podjęła pracę w służbie cywilnej."
          />
          <StartTile
            type="periodic"
            title="Ocena okresowa"
            sheet="Arkusz B / C"
            description="B — stanowiska kierownicze, C — pozostałe stanowiska."
          />
        </div>
      </section>

      <div className="flex items-center gap-4">
        <label className="flex h-[41px] max-w-[811px] flex-1 items-center gap-2.5 rounded-md bg-card px-3.5 shadow-card focus-within:ring-2 focus-within:ring-primary/30">
          <span className="sr-only">Szukaj pracownika lub oceny</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj pracownika lub oceny…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint-foreground"
          />
          <Search {...ICON} className="size-[18px] text-primary" />
        </label>
        <div className="flex-1" />
        <p className="flex h-[41px] items-center gap-2 rounded-md bg-card px-3.5 text-[13px] font-bold shadow-card">
          <Clock {...ICON} className="size-4 text-primary" />
          {today()}
        </p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <ProcessCard
        title="Oceny w toku"
        count={activeShown.length}
        loading={loading}
        empty={q ? "Brak ocen w toku pasujących do wyszukiwania." : "Brak ocen w toku."}
        control={
          <Select
            aria-label="Sortuj oceny w toku"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-8 border-0 bg-muted pl-3 pr-8 text-[13px] font-bold"
          >
            <option value="deadline">Sortuj: termin</option>
            <option value="name">Sortuj: pracownik</option>
          </Select>
        }
        processes={activeShown}
        employees={employees}
      />

      <ProcessCard
        title="Zakończone"
        count={doneShown.length}
        loading={loading}
        empty={q || year ? "Brak zakończonych ocen dla wybranych filtrów." : "Brak zakończonych ocen."}
        control={
          years.length > 0 && (
            <Select
              aria-label="Rok zakończenia"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="h-8 border-0 bg-muted pl-3 pr-8 text-[13px] font-bold"
            >
              <option value="">Rok: wszystkie</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  Rok: {y}
                </option>
              ))}
            </Select>
          )
        }
        processes={doneShown}
        employees={employees}
      />
    </div>
  );
}

function yearOf(p: Process): string {
  const iso = p.updated_at ?? p.deadline;
  return iso ? String(new Date(iso).getFullYear()) : "";
}

function StartTile({
  type,
  title,
  sheet,
  description,
}: {
  type: ProcessType;
  title: string;
  sheet: string;
  description: string;
}) {
  return (
    <Card className="flex items-center gap-[18px] p-[22px]">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="flex items-center gap-2 text-lg font-black">
          {title}
          <Badge>{sheet}</Badge>
        </h3>
        <p className="text-[13px] font-medium leading-[19px] text-muted-foreground">{description}</p>
      </div>
      <Button asChild>
        <Link href={newAssessmentPath(type)}>
          Rozpocznij
          <span className="sr-only">: {title.toLocaleLowerCase("pl-PL")}</span>
          <ArrowRight {...ICON} />
        </Link>
      </Button>
    </Card>
  );
}

function ProcessCard({
  title,
  count,
  control,
  processes,
  employees,
  loading,
  empty,
}: {
  title: string;
  count: number;
  control?: React.ReactNode;
  processes: Process[];
  employees: Map<string, Employee>;
  loading: boolean;
  empty: string;
}) {
  const id = `table-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 pb-4 pt-5">
        <h2 id={id} className="text-lg font-black">
          {title}
        </h2>
        <Badge variant="solid" className="px-[9px] text-xs" aria-label={`${count} pozycji`}>
          {count}
        </Badge>
        <div className="flex-1" />
        {control && <div className="w-44">{control}</div>}
      </div>
      {loading ? (
        <p className="px-6 pb-6 text-sm text-muted-foreground">Ładowanie…</p>
      ) : processes.length === 0 ? (
        <p className="border-t px-6 py-6 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <Table aria-labelledby={id} className="table-fixed">
          <colgroup>
            <col className="w-[248px]" />
            <col className="w-[184px]" />
            <col className="w-[204px]" />
            <col className="w-[124px]" />
            <col className="w-[124px]" />
            <col />
          </colgroup>
          <TableHeader>
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead>Pracownik</TableHead>
              <TableHead className="px-0">Rodzaj oceny</TableHead>
              <TableHead className="px-0">Etap</TableHead>
              <TableHead className="px-0">Termin</TableHead>
              <TableHead className="px-0">Status</TableHead>
              <TableHead>
                <span className="sr-only">Akcje</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processes.map((p) => (
              <ProcessRow key={p.id} process={p} employee={employees.get(p.employee_id)} />
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

function ProcessRow({ process: p, employee }: { process: Process; employee?: Employee }) {
  const [busy, setBusy] = useState(false);
  const done = p.status === "completed";
  const name = p.employee_name ?? employee?.full_name ?? "Pracownik";
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar name={name} tone={done ? "neutral" : "soft"} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{name}</p>
            {employee?.position && (
              <p className="truncate text-xs font-medium text-muted-foreground">{employee.position}</p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="px-0">
        <span className="flex items-center gap-2 font-medium">
          {TYPE_LABELS[p.type]}
          <FormTag type={p.type} form={p.form} />
        </span>
      </TableCell>
      <TableCell className="px-0">
        <StageProgress stage={p.stage} done={done} />
      </TableCell>
      <TableCell className="px-0">
        <Deadline iso={p.deadline} done={done} stacked />
      </TableCell>
      <TableCell className="px-0">
        <StatusBadge status={p.status} />
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          {done && (
            <Button
              variant="secondary"
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
              <Download {...ICON} className={cn("!size-[18px]", busy && "animate-pulse")} />
            </Button>
          )}
          <Button asChild variant={done ? "outline" : "default"}>
            <Link href={assessmentPath(p.id)}>
              {done ? "Otwórz" : "Kontynuuj"}
              <span className="sr-only"> ocenę: {name}</span>
              <ArrowRight {...ICON} />
            </Link>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
