"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Deadline, StatusBadge, stageLabel } from "@/components/process-badges";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  api,
  STATUS_LABELS,
  TYPE_LABELS,
  type HrProcessFilters,
  type ProcessStatus,
  type ProcessType,
} from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/lib/use-api";
import { daysUntil, formatDate } from "@/lib/utils";

const EMPTY_FILTERS: HrProcessFilters = { status: "", unit: "", type: "" };
const DEADLINE_SOON_DAYS = 14;
const TONE_CLASS = { danger: "text-destructive", warning: "text-warning" } as const;

export default function HrPage() {
  const [filters, setFilters] = useState<HrProcessFilters>(EMPTY_FILTERS);
  const { data, error, loading, reload } = useApi(
    () => api.getHrProcesses(filters),
    [filters.status, filters.unit, filters.type],
  );
  const { data: employees } = useApi(() => api.getEmployees());
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const units = useMemo(
    () => [...new Set(employees?.map((e) => e.unit) ?? [])].sort(),
    [employees],
  );
  const processes = useMemo(
    () =>
      [...(data ?? [])].sort(
        (a, b) => new Date(a.deadline ?? 0).getTime() - new Date(b.deadline ?? 0).getTime(),
      ),
    [data],
  );
  const open = processes.filter((p) => p.status !== "completed");
  const counts = {
    overdue: processes.filter((p) => p.status === "overdue").length,
    soon: open.filter((p) => {
      const d = daysUntil(p.deadline);
      return d != null && d >= 0 && d <= DEADLINE_SOON_DAYS;
    }).length,
    completed: processes.filter((p) => p.status === "completed").length,
  };

  const remindable = open.map((p) => p.id);
  const allSelected = remindable.length > 0 && remindable.every((id) => selected.includes(id));

  async function remind(ids: string[]) {
    if (!ids.length) return;
    const res = await api.sendReminders(ids);
    setNotice(`Wysłano przypomnienia: ${res.sent}.`);
    setSelected([]);
    void reload();
  }

  const updateFilter = (key: keyof HrProcessFilters) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setFilters((f) => ({ ...f, [key]: e.target.value }));

  return (
    <>
      <PageHeader
        title="Monitoring ocen"
        description="Statusy procesów oceny, terminy i przypomnienia dla przełożonych."
      />
      <div className="flex flex-col gap-6 page-x pb-12 pt-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <Stat label="Po terminie" value={counts.overdue} tone="danger" />
          <Stat label={`Termin w ciągu ${DEADLINE_SOON_DAYS} dni`} value={counts.soon} tone="warning" />
          <Stat label="Zakończone" value={counts.completed} />
        </div>

        <form
          aria-label="Filtry"
          className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,16rem))_auto]"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="f-status">Status</Label>
            <Select id="f-status" value={filters.status} onChange={updateFilter("status")}>
              <option value="">Wszystkie</option>
              {(Object.keys(STATUS_LABELS) as ProcessStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="f-unit">Komórka organizacyjna</Label>
            <Select id="f-unit" value={filters.unit} onChange={updateFilter("unit")}>
              <option value="">Wszystkie</option>
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="f-type">Rodzaj oceny</Label>
            <Select id="f-type" value={filters.type} onChange={updateFilter("type")}>
              <option value="">Wszystkie</option>
              {(Object.keys(TYPE_LABELS) as ProcessType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="justify-self-start"
            onClick={() => setFilters(EMPTY_FILTERS)}
          >
            Wyczyść filtry
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => remind(selected)} disabled={selected.length === 0}>
            Wyślij przypomnienie ({selected.length})
          </Button>
          <div aria-live="polite" className="text-sm">
            {notice}
          </div>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <Card className="overflow-hidden xl:hidden">
          {loading && !data ? (
            <ul aria-hidden className="divide-y">
              {Array.from({ length: 3 }, (_, i) => (
                <li key={i} className="flex flex-col gap-2.5 p-4">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-full max-w-64" />
                  <Skeleton className="h-3 w-32" />
                </li>
              ))}
            </ul>
          ) : processes.length === 0 ? (
            <p className="p-4 text-[13px] text-muted-foreground">Brak procesów spełniających kryteria.</p>
          ) : (
            <>
              {remindable.length > 0 && (
                <label className="flex cursor-pointer items-center gap-3 border-b bg-subtle px-4 py-2.5 text-[13px] text-muted-foreground">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? [] : remindable)}
                  />
                  Zaznacz wszystkie otwarte ({remindable.length})
                </label>
              )}
              <ul className="divide-y" aria-label="Procesy oceny posortowane według terminu">
                {processes.map((p) => {
                  const done = p.status === "completed";
                  return (
                    <li key={p.id} className="flex items-start gap-3 p-4">
                      <span className="flex size-5 shrink-0 items-center justify-center pt-0.5">
                        {!done && (
                          <input
                            type="checkbox"
                            className="size-4"
                            aria-label={`Zaznacz: ${p.employee_name}`}
                            checked={selected.includes(p.id)}
                            onChange={() =>
                              setSelected((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))
                            }
                          />
                        )}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <p className="font-medium">{p.employee_name}</p>
                          <StatusBadge status={p.status} />
                        </div>
                        <p className="text-[13px] leading-[19px] text-muted-foreground">{p.unit}</p>
                        <p className="text-[13px] leading-[19px]">
                          {TYPE_LABELS[p.type]}
                          {p.form ? ` (${p.form})` : ""} · {stageLabel(p.stage)}
                        </p>
                        <p className="text-[13px] leading-[19px] text-muted-foreground">
                          Termin: <Deadline iso={p.deadline} done={done} />
                          {p.reminder_sent_at && <> · przypomnienie {formatDate(p.reminder_sent_at)}</>}
                        </p>
                        {!done && (
                          <Button size="sm" variant="outline" className="mt-1 self-start" onClick={() => remind([p.id])}>
                            Przypomnij
                            <span className="sr-only"> w sprawie: {p.employee_name}</span>
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>

        <Card className="max-xl:hidden">
          <CardContent className="p-0">
            <Table className="[&_td]:px-4 [&_th]:px-4">
              <TableCaption className="sr-only">Procesy oceny posortowane według terminu</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Zaznacz wszystkie otwarte procesy"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? [] : remindable)}
                    />
                  </TableHead>
                  <TableHead>Pracownik</TableHead>
                  <TableHead className="max-2xl:hidden">Komórka</TableHead>
                  <TableHead>Rodzaj</TableHead>
                  <TableHead>Etap</TableHead>
                  <TableHead>Termin</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="max-2xl:hidden">Ostatnie przypomnienie</TableHead>
                  <TableHead>
                    <span className="sr-only">Akcje</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !data ? (
                  Array.from({ length: 4 }, (_, i) => (
                    <TableRow key={i} aria-hidden className="hover:bg-transparent">
                      {Array.from({ length: 9 }, (_, c) => (
                        <TableCell key={c} className={c === 2 || c === 7 ? "max-2xl:hidden" : undefined}>
                          <Skeleton className={c === 0 ? "size-4" : "h-3 w-full max-w-28"} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : processes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground">
                      Brak procesów spełniających kryteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  processes.map((p) => {
                    const done = p.status === "completed";
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          {!done && (
                            <input
                              type="checkbox"
                              aria-label={`Zaznacz: ${p.employee_name}`}
                              checked={selected.includes(p.id)}
                              onChange={() =>
                                setSelected((s) =>
                                  s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id],
                                )
                              }
                            />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{p.employee_name}</TableCell>
                        <TableCell className="max-w-56 text-muted-foreground max-2xl:hidden">{p.unit}</TableCell>
                        <TableCell>
                          {TYPE_LABELS[p.type]}
                          {p.form ? ` (${p.form})` : ""}
                        </TableCell>
                        <TableCell>{stageLabel(p.stage)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Deadline iso={p.deadline} done={done} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={p.status} />
                        </TableCell>
                        <TableCell className="max-2xl:hidden">
                          {p.reminder_sent_at ? formatDate(p.reminder_sent_at) : "—"}
                        </TableCell>
                        <TableCell>
                          {!done && (
                            <Button size="sm" variant="outline" onClick={() => remind([p.id])}>
                              Przypomnij
                              <span className="sr-only"> w sprawie: {p.employee_name}</span>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" | "warning" }) {
  const color = tone ? TONE_CLASS[tone] : "";
  return (
    <Card className="flex items-center justify-between gap-3 px-5 py-4 sm:flex-col sm:items-start sm:gap-1">
      <p className="text-[13px] leading-[19px] text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold leading-8 ${color}`}>{value}</p>
    </Card>
  );
}
