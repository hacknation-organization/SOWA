"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/form";
import { api, type FormType } from "@/lib/api";
import { FORM_DESCRIPTIONS } from "@/lib/domain";
import { OSP_SAMPLES } from "@/lib/osp-samples";
import type { StepProps } from "./types";

export function JobDescriptionStep({ process, onProcess, goTo }: StepProps) {
  const [text, setText] = useState(process.job_description ?? "");
  const [form, setForm] = useState<FormType | null>(process.form);
  const [sampleId, setSampleId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const periodic = process.type === "periodic";

  const managesPeople =
    OSP_SAMPLES.find((s) => s.id === sampleId)?.manages_people ??
    /kieruje|koordynuje pracę|podległ/i.test(text.replace(/brak podległych/gi, ""));

  function pickSample(id: string) {
    setSampleId(id);
    const s = OSP_SAMPLES.find((x) => x.id === id);
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
    <div className="flex max-w-3xl flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Opis stanowiska pracy (OSP) pomaga dobrać kryteria oceny do zadań i zakresu odpowiedzialności
        pracownika. Wybierz przykładowy OSP lub wklej treść z dokumentu.
      </p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="osp-sample">Przykładowy opis stanowiska</Label>
        <Select id="osp-sample" value={sampleId} onChange={(e) => pickSample(e.target.value)}>
          <option value="">Nie wybrano – wkleję własny opis</option>
          {OSP_SAMPLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="osp-text">Treść opisu stanowiska</Label>
        <Textarea
          id="osp-text"
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Wklej cel istnienia stanowiska, zadania dominujące i opis złożoności…"
        />
        <p className="text-xs text-muted-foreground">
          Krok jest opcjonalny – bez OSP przejdziesz dalej, ale nie dostaniesz sugestii kryteriów.
        </p>
      </div>

      {periodic && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Arkusz oceny okresowej</legend>
          {(["B", "C"] as FormType[]).map((f) => (
            <label
              key={f}
              className="flex cursor-pointer items-start gap-3 rounded-md border bg-card p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
            >
              <input
                type="radio"
                name="form"
                value={f}
                checked={form === f}
                onChange={() => setForm(f)}
                className="mt-1"
              />
              <span className="text-sm">
                <span className="block font-medium">
                  Arkusz {f}
                  {text && (managesPeople ? f === "B" : f === "C") && (
                    <span className="ml-2 font-normal text-muted-foreground">
                      (sugerowany na podstawie OSP)
                    </span>
                  )}
                </span>
                {FORM_DESCRIPTIONS[f]}
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      <div>
        <Button onClick={next} disabled={busy}>
          {busy ? "Zapisywanie…" : "Dalej: kryteria"}
        </Button>
      </div>
    </div>
  );
}
