"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select, Textarea } from "@/components/ui/form";
import { api, LEVEL_LABELS, type CompetencySummary, type LevelValue } from "@/lib/api";
import { LEVEL_POINTS } from "@/lib/domain";
import { useApi } from "@/lib/use-api";
import type { StepProps } from "./types";

const LEVELS = [1, 2, 3, 4, 5] as LevelValue[];

export function SummaryStep({ process, competencies, onProcess, goTo }: StepProps) {
  const { data, setData, error, loading } = useApi(() => api.getSummary(process.id), [process.id]);
  const [stepError, setStepError] = useState<string | null>(null);

  if (loading && !data) return <p className="text-muted-foreground">Wyliczanie sugerowanych poziomów…</p>;
  if (error || !data) return <Alert variant="danger">{error}</Alert>;

  const missing = data.filter((s) => s.manager_level == null);

  async function next() {
    if (missing.length) {
      setStepError(`Zatwierdź poziom dla wszystkich kompetencji (pozostało: ${missing.length}).`);
      return;
    }
    const p = await api.updateProcess(process.id, { stage: "interview" });
    onProcess(p);
    goTo("interview");
  }

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <Alert variant="info">
        System sugeruje poziom na podstawie wybranych zachowań. <strong>Ostateczną decyzję podejmujesz Ty</strong> –
        jeśli wybierzesz inny poziom niż sugerowany, podaj uzasadnienie.
      </Alert>

      {data.map((s) => (
        <DecisionCard
          key={s.competency_id}
          summary={s}
          name={competencies.find((c) => c.id === s.competency_id)?.name ?? s.competency_id}
          onSave={async (level, justification) => {
            const updated = await api.setDecision(process.id, s.competency_id, { level, justification });
            setData(updated);
          }}
        />
      ))}

      {missing.some((s) => s.suggested_level != null) && (
        <div className="flex items-center gap-3 rounded-md border border-dashed p-3 text-sm">
          <span className="flex-1">
            Niezatwierdzone kompetencje: {missing.length}. Możesz przyjąć dla nich sugerowane poziomy
            jednym kliknięciem – zmiany w pojedynczych kartach zapisuj przyciskiem „Zatwierdź poziom”.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              let latest = data;
              for (const s of missing) {
                if (s.suggested_level == null) continue;
                latest = await api.setDecision(process.id, s.competency_id, {
                  level: s.suggested_level,
                  justification: "",
                });
              }
              setData(latest);
            }}
          >
            Przyjmij sugerowane poziomy
          </Button>
        </div>
      )}

      {stepError && missing.length > 0 && <Alert variant="danger">{stepError}</Alert>}

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => goTo("assessment")}>
          Wstecz: ocena zachowań
        </Button>
        <Button onClick={next}>Dalej: rozmowa</Button>
      </div>
    </div>
  );
}

function DecisionCard({
  summary: s,
  name,
  onSave,
}: {
  summary: CompetencySummary;
  name: string;
  onSave: (level: LevelValue, justification: string) => Promise<void>;
}) {
  const [level, setLevel] = useState<LevelValue | "">(s.manager_level ?? s.suggested_level ?? "");
  const [justification, setJustification] = useState(s.justification ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = s.competency_id;
  const differs = level !== "" && level !== s.suggested_level;
  const saved =
    s.manager_level != null && s.manager_level === level && (s.justification ?? "") === justification;

  async function save() {
    if (level === "") {
      setError("Wybierz poziom.");
      return;
    }
    if (differs && !justification.trim()) {
      setError("Poziom różni się od sugerowanego – uzasadnienie jest wymagane.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(level, justification.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>{name}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Ocenione wskaźniki: {s.rated} z {s.total}
            {s.no_basis ? ` · brak podstaw: ${s.no_basis}` : ""}
          </p>
        </div>
        {saved ? <Badge variant="success">Zatwierdzono</Badge> : <Badge variant="muted">Do zatwierdzenia</Badge>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="rounded-md bg-muted px-3 py-2 text-sm">
          <p>
            Sugerowany poziom:{" "}
            <strong>
              {s.suggested_level
                ? `${LEVEL_LABELS[s.suggested_level]} (${LEVEL_POINTS[s.suggested_level]} pkt)`
                : "brak – za mało ocen"}
            </strong>
          </p>
          <p className="mt-1 text-muted-foreground">{s.explanation}</p>
        </div>

        <div className="grid grid-cols-[18rem_minmax(0,1fr)] gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`level-${id}`}>Twoja decyzja</Label>
            <Select
              id={`level-${id}`}
              value={level}
              onChange={(e) => setLevel(e.target.value ? (Number(e.target.value) as LevelValue) : "")}
            >
              <option value="">Wybierz poziom…</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABELS[l]} ({LEVEL_POINTS[l]} pkt)
                  {l === s.suggested_level ? " – sugerowany" : ""}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`just-${id}`}>
              Uzasadnienie{differs ? " (wymagane – poziom różni się od sugerowanego)" : " (opcjonalnie)"}
            </Label>
            <Textarea
              id={`just-${id}`}
              rows={2}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              aria-required={differs}
              aria-invalid={differs && !justification.trim() ? true : undefined}
            />
          </div>
        </div>
        {error && <Alert variant="danger">{error}</Alert>}
        <div>
          <Button size="sm" variant={saved ? "outline" : "default"} onClick={save} disabled={busy}>
            {saved ? "Zapisano" : busy ? "Zapisywanie…" : "Zatwierdź poziom"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
