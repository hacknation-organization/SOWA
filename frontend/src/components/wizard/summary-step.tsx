"use client";

import { useState } from "react";
import { ArrowRight, Check, Info } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/form";
import { api, LEVEL_LABELS, type CompetencySummary, type LevelValue } from "@/lib/api";
import { LEVEL_POINTS } from "@/lib/domain";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";
import { StepActions, StepCard } from "./step-card";
import type { StepProps } from "./types";

const LEVELS = [1, 2, 3, 4, 5] as LevelValue[];
const SCALE_LABELS: Record<LevelValue, string> = {
  1: "Znacznie poniżej",
  2: "Poniżej",
  3: "Na poziomie",
  4: "Powyżej",
  5: "Znacznie powyżej",
};

const levelText = (l: LevelValue) => `${LEVEL_LABELS[l]} (${LEVEL_POINTS[l]} pkt)`;

export function SummaryStep({ process, competencies, onProcess, goTo }: StepProps) {
  const { data, setData, error, loading } = useApi(() => api.getSummary(process.id), [process.id]);
  const [accepting, setAccepting] = useState(false);

  if (loading && !data) return <p className="text-muted-foreground">Wyliczanie sugerowanych poziomów…</p>;
  if (error || !data) return <Alert variant="danger">{error}</Alert>;

  const missing = data.filter((s) => s.manager_level == null);

  async function next() {
    const p = await api.updateProcess(process.id, { stage: "interview" });
    onProcess(p);
    goTo("interview");
  }

  async function acceptSuggested() {
    if (!data) return;
    setAccepting(true);
    try {
      let latest = data;
      for (const s of missing) {
        if (s.suggested_level == null) continue;
        latest = await api.setDecision(process.id, s.competency_id, {
          level: s.suggested_level,
          justification: "",
        });
      }
      setData(latest);
    } finally {
      setAccepting(false);
    }
  }

  return (
    <StepCard stage="summary" className="gap-[18px]">
      <div className="flex items-start gap-3 rounded-lg bg-primary-soft px-4 py-3.5">
        <Info aria-hidden absoluteStrokeWidth strokeWidth={2} className="mt-px size-5 shrink-0 text-primary" />
        <p className="text-sm font-medium leading-[21px]">
          System sugeruje poziom na podstawie wybranych zachowań.{" "}
          <strong className="font-black">Ostateczną decyzję podejmujesz Ty</strong> — jeśli wybierzesz inny
          poziom niż sugerowany, podaj uzasadnienie.
        </p>
      </div>

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
        <div className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-[13px] font-medium">
          <span className="flex-1">
            Niezatwierdzone kompetencje: {missing.length}. Możesz przyjąć dla nich sugerowane poziomy jednym
            kliknięciem.
          </span>
          <Button size="sm" variant="secondary" onClick={acceptSuggested} disabled={accepting}>
            {accepting ? "Zapisywanie…" : "Przyjmij sugerowane poziomy"}
          </Button>
        </div>
      )}

      <StepActions>
        <Button variant="outline" onClick={() => goTo("assessment")}>
          Wstecz
        </Button>
        <span className="flex-1" />
        {missing.length > 0 && (
          <span id="summary-missing" className="text-[13px] font-medium text-muted-foreground">
            Zatwierdź poziom dla wszystkich kompetencji (pozostało: {missing.length}).
          </span>
        )}
        <Button onClick={next} disabled={missing.length > 0} aria-describedby={missing.length ? "summary-missing" : undefined}>
          Dalej: rozmowa
          <ArrowRight absoluteStrokeWidth strokeWidth={2} aria-hidden />
        </Button>
      </StepActions>
    </StepCard>
  );
}

function LevelScale({ suggested }: { suggested: LevelValue | null }) {
  return (
    <div className="flex gap-1" aria-hidden>
      {LEVELS.map((l) => (
        <div key={l} className="flex flex-1 flex-col items-center gap-1.5">
          <span
            className={cn(
              "h-2 w-full rounded-[4px]",
              suggested == null || l > suggested
                ? "bg-border"
                : l === suggested
                  ? "bg-brand-gradient"
                  : "bg-primary-light",
            )}
          />
          <span
            className={cn(
              "whitespace-nowrap text-[11px]",
              l === suggested ? "font-black text-primary" : "font-medium text-muted-foreground",
            )}
          >
            {SCALE_LABELS[l]}
          </span>
        </div>
      ))}
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
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = s.competency_id;
  const differs = level !== "" && level !== s.suggested_level;
  const approved = s.manager_level != null && !editing;

  async function save() {
    if (level === "") {
      setError("Wybierz poziom.");
      return;
    }
    if (differs && !justification.trim()) {
      setError("Poziom różni się od sugerowanego — uzasadnienie jest wymagane.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(level, justification.trim());
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby={`comp-${id}`}
      className={cn("flex flex-col gap-4 rounded-xl p-5", approved ? "border-2 border-primary" : "border")}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex flex-col gap-0.5">
          <h3 id={`comp-${id}`} className="text-[17px] font-black">
            {name}
          </h3>
          <p className="text-[13px] font-medium text-muted-foreground">
            Ocenione wskaźniki: {s.rated} z {s.total}
            {s.no_basis ? ` · brak podstaw: ${s.no_basis}` : ""}
          </p>
        </div>
        <span className="flex-1" />
        {approved ? (
          <Badge variant="solid" className="py-1 pl-2.5 pr-3 text-xs">
            <Check aria-hidden absoluteStrokeWidth strokeWidth={2.5} className="size-3" />
            Zatwierdzono
          </Badge>
        ) : (
          <Badge variant="outline" className="px-2.5 py-1 text-xs">
            Do zatwierdzenia
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg bg-muted px-4 py-3.5">
        <p className="flex items-center gap-2 text-sm">
          {/* Figma "icon/sparkle" asset; it has no exact lucide equivalent. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/sparkle.svg" alt="" width={16} height={16} className="size-4" />
          <span className="font-medium text-muted-foreground">Sugerowany poziom:</span>
          <span className={cn("font-black", s.suggested_level ? "text-primary" : "text-foreground")}>
            {s.suggested_level ? levelText(s.suggested_level) : "brak — za mało ocen"}
          </span>
        </p>
        <LevelScale suggested={s.suggested_level} />
        {!approved && s.explanation && (
          <p className="text-[13px] font-medium leading-[19px] text-muted-foreground">{s.explanation}</p>
        )}
      </div>

      {approved ? (
        <div className="flex items-start gap-2 text-sm">
          <p className="flex-1">
            <span className="font-medium text-muted-foreground">Twoja decyzja: </span>
            <span className="font-black">{levelText(s.manager_level!)}</span>
            {s.justification && (
              <span className="mt-1 block text-[13px] font-medium text-muted-foreground">{s.justification}</span>
            )}
          </p>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Zmień
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`level-${id}`}>Twoja decyzja</Label>
              <Select
                id={`level-${id}`}
                value={level}
                onChange={(e) => setLevel(e.target.value ? (Number(e.target.value) as LevelValue) : "")}
                className={cn(level === "" && "text-faint-foreground")}
              >
                <option value="">Wybierz poziom…</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {levelText(l)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`just-${id}`}>
                Uzasadnienie{" "}
                <span className={cn("font-medium", differs ? "text-destructive" : "text-muted-foreground")}>
                  {differs ? "(wymagane — poziom różni się od sugerowanego)" : "(opcjonalnie)"}
                </span>
              </Label>
              <Textarea
                id={`just-${id}`}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Dlaczego wybierasz ten poziom?"
                aria-required={differs}
                aria-invalid={differs && !justification.trim() ? true : undefined}
                className="min-h-[84px]"
              />
            </div>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy}>
              {busy ? "Zapisywanie…" : "Zatwierdź poziom"}
            </Button>
            {s.manager_level != null && (
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Anuluj
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
