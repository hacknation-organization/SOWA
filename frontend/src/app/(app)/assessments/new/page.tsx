"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { EmployeeCombobox } from "@/components/employee-combobox";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioDot } from "@/components/ui/choice";
import { api, TYPE_LABELS, type ProcessType } from "@/lib/api";
import { assessmentPath } from "@/lib/routes";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

export default function NewAssessmentPage() {
  return (
    <Suspense fallback={<p className="p-8 text-muted-foreground">Ładowanie…</p>}>
      <NewAssessmentForm />
    </Suspense>
  );
}

const TYPE_OPTIONS: { type: ProcessType; sheet: string; hint: string }[] = [
  {
    type: "periodic",
    sheet: "Arkusz B / C",
    hint: "Dla członka korpusu służby cywilnej. Arkusz B lub C wybierzesz w pierwszym kroku.",
  },
  {
    type: "first",
    sheet: "Arkusz A",
    hint: "Dla osoby zatrudnionej po raz pierwszy w służbie cywilnej, przed upływem okresu umowy na czas określony.",
  },
];

const FLOW = [
  ["Opis stanowiska", "Opcjonalnie wklej OSP — dostaniesz sugestie kryteriów."],
  ["Kryteria", "Wybierz kompetencje do oceny."],
  ["Ocena zachowań", "Dla każdego wskaźnika wybierz opis zachowania."],
  ["Podsumowanie", "Zatwierdź poziom dla każdej kompetencji."],
  ["Rozmowa", "Omów ocenę z pracownikiem."],
  ["Dokument", "Pobierz arkusz do podpisu."],
] as const;

function NewAssessmentForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialType: ProcessType = params.get("type") === "first" ? "first" : "periodic";
  const [type, setType] = useState<ProcessType>(initialType);
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: employees } = useApi(() => api.getEmployees());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) {
      setError("Wybierz pracownika.");
      return;
    }
    setBusy(true);
    try {
      const created = await api.createProcess({ employee_id: employeeId, type, form: null });
      router.push(assessmentPath(created.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się utworzyć oceny");
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Nowa ocena"
        description="Wybierz rodzaj oceny i pracownika. Resztę poprowadzimy krok po kroku."
      />
      <div className="flex items-start gap-6 px-10 pb-12 pt-6">
        <Card className="min-w-0 flex-1 p-7">
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <fieldset className="flex flex-col gap-4">
              <legend className="mb-4 text-base font-black">Rodzaj oceny</legend>
              {TYPE_OPTIONS.map((o) => {
                const checked = type === o.type;
                return (
                  <label
                    key={o.type}
                    className={cn(
                      "flex cursor-pointer items-start gap-4 rounded-xl p-[18px] transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-primary/25",
                      checked
                        ? "border-2 border-primary bg-primary-soft"
                        : "border bg-card hover:border-primary-light",
                    )}
                  >
                    <input
                      type="radio"
                      name="type"
                      value={o.type}
                      checked={checked}
                      onChange={() => setType(o.type)}
                      className="peer sr-only"
                    />
                    <RadioDot checked={checked} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex items-center gap-2 text-[17px] font-black">
                        {TYPE_LABELS[o.type]}
                        <Badge variant={checked ? "onSoft" : "default"}>{o.sheet}</Badge>
                      </span>
                      <span className="text-[13px] font-medium leading-[19px] text-muted-foreground">
                        {o.hint}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <div className="mt-1 flex flex-col gap-4">
              <label htmlFor="employee" className="text-base font-black">
                Pracownik
              </label>
              <EmployeeCombobox
                id="employee"
                employees={employees ?? []}
                value={employeeId}
                invalid={!!error && !employeeId}
                onChange={(value) => {
                  setEmployeeId(value);
                  setError(null);
                }}
              />
            </div>

            {error && <Alert variant="danger">{error}</Alert>}

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Tworzenie…" : "Rozpocznij ocenę"}
                <ArrowRight absoluteStrokeWidth strokeWidth={2} aria-hidden />
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.back()}>
                Anuluj
              </Button>
            </div>
          </form>
        </Card>

        <Card className="flex w-80 shrink-0 flex-col gap-3.5 p-6">
          <h2 className="text-base font-black">Jak przebiega ocena</h2>
          <ol className="flex flex-col gap-3.5">
            {FLOW.map(([title, hint], i) => (
              <li key={title} className="flex items-start gap-3">
                <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-black text-primary">
                  {i + 1}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold">{title}</span>
                  <span className="text-xs font-medium leading-[17px] text-muted-foreground">{hint}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}
