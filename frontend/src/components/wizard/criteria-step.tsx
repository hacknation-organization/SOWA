"use client";

import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { MAX_ADDITIONAL_CRITERIA, mandatoryCriteria } from "@/lib/domain";
import { JOB_DESCRIPTION_SAMPLES } from "@/lib/job-description-samples";
import { cn } from "@/lib/utils";
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

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {periodic
          ? `Kryteria obowiązkowe arkusza ${process.form} są zaznaczone na stałe. Możesz dodać nie więcej niż ${MAX_ADDITIONAL_CRITERIA} kryteria dodatkowe – najlepiej te, które odpowiadają zadaniom z OSP.`
          : "Wybierz kompetencje, które będą podstawą pierwszej oceny – najlepiej powiązane z zadaniami z OSP."}
      </p>
      {periodic && (
        <p className="text-sm" aria-live="polite">
          Wybrane kryteria dodatkowe: {additional.length} z {MAX_ADDITIONAL_CRITERIA}
        </p>
      )}

      <fieldset>
        <legend className="sr-only">Kompetencje do oceny</legend>
        <ul className="grid grid-cols-2 gap-2">
          {competencies.map((c) => {
            const isMandatory = mandatory.includes(c.id);
            const checked = selected.includes(c.id);
            const disabled = isMandatory || (!checked && limitReached);
            return (
              <li key={c.id}>
                <label
                  className={cn(
                    "flex h-full items-start gap-3 rounded-md border bg-card p-3 has-[:checked]:border-primary",
                    disabled && !isMandatory ? "opacity-60" : "cursor-pointer",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(c.id)}
                    className="mt-1"
                    aria-describedby={`${c.id}-meta`}
                  />
                  <span className="text-sm">
                    <span className="block font-medium">{c.name}</span>
                    <span id={`${c.id}-meta`} className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="text-muted-foreground">
                        {c.indicators.length} wskaźn.
                      </span>
                      {isMandatory && <Badge variant="muted">obowiązkowe</Badge>}
                      {suggested.includes(c.id) && <Badge>sugerowane na podstawie OSP</Badge>}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => goTo("job_description")}>
          Wstecz
        </Button>
        <Button onClick={next} disabled={busy}>
          {busy ? "Zapisywanie…" : "Dalej: ocena zachowań"}
        </Button>
      </div>
    </div>
  );
}
