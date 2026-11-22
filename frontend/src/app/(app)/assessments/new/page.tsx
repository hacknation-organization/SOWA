"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowRight } from "lucide-react";
import { ICON, PageHeader } from "@/components/app-shell";
import { EmployeeCombobox } from "@/components/employee-combobox";
import { StepCardSkeleton } from "@/components/loading-states";
import { LoadingRegion } from "@/components/ui/skeleton";
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
    <Suspense
      fallback={
        <LoadingRegion label="Wczytywanie formularza" className="page-x py-6 lg:py-8">
          <StepCardSkeleton />
        </LoadingRegion>
      }
    >
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
  ["Opis stanowiska", "Opcjonalnie wklej OSP — asystent zasugeruje kryteria."],
  ["Kryteria", "Wybierz kompetencje, na których oprzesz ocenę."],
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
        description="Wybierz rodzaj oceny i pracownika — resztę przeprowadzimy krok po kroku."
      />
      <div className="flex flex-col gap-6 page-x pb-12 pt-6 lg:flex-row lg:items-start">
        <Card className="min-w-0 flex-1 p-5 sm:p-7">
          <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-2.5 text-[13px] font-medium leading-[19px]">Rodzaj oceny</legend>
              {TYPE_OPTIONS.map((o) => {
                const checked = type === o.type;
                return (
                  <label
                    key={o.type}
                    className={cn(
                      "flex cursor-pointer items-start gap-3.5 rounded-lg p-4 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-primary/25",
                      checked
                        ? "border-[1.5px] border-primary bg-primary-soft"
                        : "border border-border-strong bg-card hover:bg-subtle",
                    )}
                  >
                    <input
                      type="radio"
                      name="type"
                      value={o.type}
                      checked={checked}
                      onChange={() => setType(o.type)}
                      className="sr-only"
                    />
                    <RadioDot checked={checked} className="mt-0.5" />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                        {TYPE_LABELS[o.type]}
                        <Badge>{o.sheet}</Badge>
                      </span>
                      <span className="text-[13px] leading-[19px] text-muted-foreground">{o.hint}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <div className="flex flex-col gap-2">
              <label htmlFor="employee" className="text-[13px] font-medium leading-[19px]">
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

            <div className="h-px bg-border" />

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              <Button type="submit" disabled={busy}>
                {busy ? "Tworzenie…" : "Rozpocznij ocenę"}
                <ArrowRight {...ICON} />
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.back()}>
                Anuluj
              </Button>
            </div>
          </form>
        </Card>

        <Card className="flex w-full flex-col gap-4 p-5 sm:p-6 lg:w-[340px] lg:shrink-0">
          <h2 className="text-[15px] font-semibold leading-[22px]">Jak przebiega ocena</h2>
          <ol className="flex flex-col">
            {FLOW.map(([title, hint], i) => (
              <li key={title} className="flex gap-3">
                <span className="flex flex-col items-center gap-1">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border-strong bg-card text-xs font-medium text-muted-foreground">
                    {i + 1}
                  </span>
                  {i < FLOW.length - 1 && <span aria-hidden className="w-px flex-1 bg-border" />}
                </span>
                <span className={cn("flex flex-1 flex-col gap-0.5 pt-0.5", i < FLOW.length - 1 && "pb-4")}>
                  <span className="text-[13px] font-medium leading-[19px]">{title}</span>
                  <span className="text-xs leading-4 text-muted-foreground">{hint}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="h-px bg-border" />
          <p className="text-xs leading-4 text-faint-foreground">
            Ok. 30 minut. Postęp zapisuje się automatycznie — możesz wrócić w dowolnym momencie.
          </p>
        </Card>
      </div>
    </>
  );
}
