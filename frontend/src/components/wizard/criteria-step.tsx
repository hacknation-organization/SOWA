"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { ICON } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckSquare } from "@/components/ui/choice";
import { api } from "@/lib/api";
import { MAX_ADDITIONAL_CRITERIA, mandatoryCriteria } from "@/lib/domain";
import { plural } from "@/lib/download";
import { JOB_DESCRIPTION_SAMPLES } from "@/lib/job-description-samples";
import { cn } from "@/lib/utils";
import { StepActions, StepCard } from "./step-card";
import type { StepProps } from "./types";

const COMPETENCY_KEYWORDS: { pattern: RegExp; id: string }[] = [
  { pattern: /kryzys|incydent/i, id: "K11" },
  { pattern: /negocj|uzgadni/i, id: "K08" },
  { pattern: /analiz|ocen[ay] prawa|orzecznic/i, id: "K07" },
  { pattern: /klient|interesant|obsług/i, id: "K10" },
  { pattern: /wystąpie|konferencj|wydarze/i, id: "K09" },
  { pattern: /strateg|polityk/i, id: "K12" },
  { pattern: /innowac|nowych rozwiązań|nowe zasady/i, id: "K05" },
  { pattern: /kieruje|koordynuje pracę zespołu|delegow/i, id: "K13" },
  { pattern: /decyzj/i, id: "K14" },
];

function suggestFromJobDescription(text: string): string[] {
  if (!text.trim()) return [];
  const sample = JOB_DESCRIPTION_SAMPLES.find((s) => s.text === text);
  const ids = new Set(sample?.suggested_competency_ids ?? []);
  for (const k of COMPETENCY_KEYWORDS) if (k.pattern.test(text)) ids.add(k.id);
  return [...ids];
}

export function CriteriaStep({ process, competencies, onProcess, goTo }: StepProps) {
  const mandatory = mandatoryCriteria(process.type, process.form);
  const suggested = useMemo(
    () => suggestFromJobDescription(process.job_description ?? "").filter((id) => !mandatory.includes(id)),
    [process.job_description, mandatory],
  );
  const [selected, setSelected] = useState<string[]>(() => {
    const initial = process.competency_ids?.length ? process.competency_ids : [];
    return [...new Set([...mandatory, ...initial])];
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  const periodic = process.type === "periodic";
  const additional = selected.filter((id) => !mandatory.includes(id));
  const limitReached = periodic && additional.length >= MAX_ADDITIONAL_CRITERIA;

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function next() {
    if (selected.length === 0) {
      setError("Wybierz co najmniej jedną kompetencję.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ordered = competencies.map((c) => c.id).filter((id) => selected.includes(id));
      await api.setCriteria(process.id, ordered);
      const p = await api.updateProcess(process.id, { stage: "assessment" });
      onProcess(p);
      goTo("assessment");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać kryteriów");
    } finally {
      setBusy(false);
    }
  }

  const q = filter.trim().toLocaleLowerCase("pl-PL");
  const visible = q ? competencies.filter((c) => c.name.toLocaleLowerCase("pl-PL").includes(q)) : competencies;

  return (
    <StepCard
      stage="criteria"
      description={
        periodic
          ? `Kryteria obowiązkowe arkusza ${process.form} są zaznaczone na stałe. Możesz dodać nie więcej niż ${MAX_ADDITIONAL_CRITERIA} kryteria dodatkowe — najlepiej te powiązane z zadaniami z OSP.`
          : "Wybierz kompetencje, które będą podstawą pierwszej oceny — najlepiej te powiązane z zadaniami z OSP."
      }
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-[13px] leading-[19px]" aria-live="polite">
          <span className="font-medium text-primary">Wybrano {selected.length}</span>{" "}
          <span className="text-muted-foreground">
            z {competencies.length} kompetencji
            {periodic && ` · dodatkowe: ${additional.length} z ${MAX_ADDITIONAL_CRITERIA}`}
          </span>
        </p>
        <label className="flex h-[39px] w-60 items-center gap-2 rounded-md border bg-card px-3 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15">
          <Search {...ICON} className="size-4 text-faint-foreground" />
          <span className="sr-only">Filtruj kompetencje</span>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtruj kompetencje"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint-foreground"
          />
        </label>
      </div>

      <fieldset>
        <legend className="sr-only">Kompetencje do oceny</legend>
        {visible.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Żadna kompetencja nie pasuje do „{filter}”.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2.5 @2xl:grid-cols-2">
            {visible.map((c) => {
              const isMandatory = mandatory.includes(c.id);
              const checked = selected.includes(c.id);
              const disabled = isMandatory || (!checked && limitReached);
              const n = c.indicators.length;
              return (
                <li key={c.id} className="flex">
                  <label
                    className={cn(
                      "flex flex-1 items-center gap-3 rounded-lg border px-3.5 py-3 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-primary/25",
                      checked ? "border-primary-border bg-primary-soft" : "bg-card",
                      disabled && !isMandatory && "cursor-not-allowed opacity-50",
                      !disabled && "cursor-pointer",
                      !checked && !disabled && "hover:bg-subtle",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(c.id)}
                      className="sr-only"
                      aria-describedby={`${c.id}-meta`}
                    />
                    <CheckSquare checked={checked} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[13px] font-medium leading-[19px]">{c.name}</span>
                      <span id={`${c.id}-meta`} className="text-xs leading-4 text-faint-foreground">
                        {n} {plural(n, "wskaźnik", "wskaźniki", "wskaźników")}
                        {isMandatory && <span className="sr-only">, obowiązkowe</span>}
                      </span>
                    </span>
                    {isMandatory ? (
                      <Badge aria-hidden>Obowiązkowe</Badge>
                    ) : (
                      suggested.includes(c.id) && <Badge variant="accent">Pasuje do OSP</Badge>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      {error && <Alert variant="danger">{error}</Alert>}

      <StepActions>
        <Button variant="outline" onClick={() => goTo("job_description")}>
          Wstecz
        </Button>
        <span className="flex-1" />
        <Button onClick={next} disabled={busy}>
          {busy ? "Zapisywanie…" : "Dalej: ocena zachowań"}
          <ArrowRight {...ICON} />
        </Button>
      </StepActions>
    </StepCard>
  );
}
