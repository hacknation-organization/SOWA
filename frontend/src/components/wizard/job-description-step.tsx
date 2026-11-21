"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioDot } from "@/components/ui/choice";
import { Label, Select, Textarea } from "@/components/ui/form";
import { api, type FormType } from "@/lib/api";
import { FORM_DESCRIPTIONS } from "@/lib/domain";
import { JOB_DESCRIPTION_SAMPLES } from "@/lib/job-description-samples";
import { cn } from "@/lib/utils";
import { StepActions, StepCard } from "./step-card";
import type { StepProps } from "./types";

export function JobDescriptionStep({ process, onProcess, goTo }: StepProps) {
  const [text, setText] = useState(process.job_description ?? "");
  const [form, setForm] = useState<FormType | null>(process.form);
  const [sampleId, setSampleId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const periodic = process.type === "periodic";

  const managesPeople =
    JOB_DESCRIPTION_SAMPLES.find((s) => s.id === sampleId)?.manages_people ??
    /kieruje|koordynuje pracę|podległ/i.test(text.replace(/brak podległych/gi, ""));

  function pickSample(id: string) {
    setSampleId(id);
    const s = JOB_DESCRIPTION_SAMPLES.find((x) => x.id === id);
    if (s) {
      setText(s.text);
      if (periodic && !form) setForm(s.manages_people ? "B" : "C");
    }
  }

  async function next() {
    if (periodic && !form) {
      setError("Wybierz arkusz oceny okresowej (B lub C).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const p = await api.updateProcess(process.id, {
        job_description: text,
        form: periodic ? form : null,
        stage: "criteria",
      });
      onProcess(p);
      goTo("criteria");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać");
    } finally {
      setBusy(false);
    }
  }

  return (
    <StepCard
      stage="job_description"
      description="Opis stanowiska pracy (OSP) pomaga dobrać kryteria oceny do zadań i zakresu odpowiedzialności pracownika. Wybierz przykładowy OSP lub wklej treść z dokumentu."
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="job-description-sample">Przykładowy opis stanowiska</Label>
        <Select id="job-description-sample" value={sampleId} onChange={(e) => pickSample(e.target.value)}>
          <option value="">Nie wybrano — wkleję własny opis</option>
          {JOB_DESCRIPTION_SAMPLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="job-description-text">Treść opisu stanowiska</Label>
        <Textarea
          id="job-description-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Wklej cel istnienia stanowiska, zadania dominujące i opis złożoności…"
          aria-describedby="job-description-hint"
          className="h-[260px] resize-y"
        />
        <p id="job-description-hint" className="text-xs font-medium text-muted-foreground">
          Krok jest opcjonalny — bez OSP przejdziesz dalej, ale nie dostaniesz sugestii kryteriów.
        </p>
      </div>

      {periodic && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-bold">Arkusz oceny okresowej</legend>
          {(["B", "C"] as FormType[]).map((f) => {
            const checked = form === f;
            const recommended = !!text && (managesPeople ? f === "B" : f === "C");
            return (
              <label
                key={f}
                className={cn(
                  "flex cursor-pointer items-start gap-4 rounded-xl p-4 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-primary/25",
                  checked ? "border-2 border-primary bg-primary-soft" : "border bg-card hover:border-primary-light",
                )}
              >
                <input
                  type="radio"
                  name="form"
                  value={f}
                  checked={checked}
                  onChange={() => setForm(f)}
                  className="sr-only"
                />
                <RadioDot checked={checked} />
                <span className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 text-[15px] font-black">
                    Arkusz {f}
                    {recommended && (
                      <Badge variant={checked ? "onSoft" : "default"}>sugerowany na podstawie OSP</Badge>
                    )}
                  </span>
                  <span className="text-[13px] font-medium leading-[19px] text-muted-foreground">
                    {FORM_DESCRIPTIONS[f]}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      <StepActions>
        <span className="flex-1" />
        <Button onClick={next} disabled={busy}>
          {busy ? "Zapisywanie…" : "Dalej: kryteria"}
          <ArrowRight absoluteStrokeWidth strokeWidth={2} aria-hidden />
        </Button>
      </StepActions>
    </StepCard>
  );
}
