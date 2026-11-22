"use client";

import { useState } from "react";
import { ArrowRight, Info } from "lucide-react";
import { ICON } from "@/components/app-shell";
import { SummarySkeleton } from "@/components/loading-states";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label, LabelHint, Select, Textarea } from "@/components/ui/form";
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

  if (loading && !data) return <SummarySkeleton />;
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
    <StepCard stage="summary" description="Zatwierdź poziom dla każdej z wybranych kompetencji.">
      <div className="flex items-start gap-3 rounded-lg bg-muted px-4 py-3">
        <Info {...ICON} className="mt-px size-4 shrink-0 text-muted-foreground" />
        <p className="text-[13px] leading-[19px] text-muted-foreground">
          System sugeruje poziom na podstawie ocen wskaźników. Ostateczna decyzja należy do Ciebie — jeśli wybierzesz
          inny poziom niż sugerowany, podaj uzasadnienie.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {data.map((s) => (
          <DecisionCard
            key={s.competency_id}
            summary={s}
            name={competencies.find((c) => c.id === s.competency_id)?.name ?? s.competency_id}
            onRate={() => goTo("assessment")}
            onSave={async (level, justification) => {
              const updated = await api.setDecision(process.id, s.competency_id, { level, justification });
              setData(updated);
            }}
          />
        ))}
      </div>

      <StepActions>
        <Button variant="outline" onClick={() => goTo("assessment")}>
          Wstecz
        </Button>
        {missing.some((s) => s.suggested_level != null) && (
          <Button variant="ghost" onClick={acceptSuggested} disabled={accepting}>
            {accepting ? "Zapisywanie…" : "Przyjmij sugerowane poziomy"}
          </Button>
        )}
        <span className="flex-1" />
        <span id="summary-progress" className="text-xs text-faint-foreground max-sm:text-center">
          Zatwierdzono {data.length - missing.length} z {data.length}
        </span>
        <Button
          onClick={next}
          disabled={missing.length > 0}
          aria-describedby="summary-progress"
          title={missing.length > 0 ? "Zatwierdź poziom dla wszystkich kompetencji" : undefined}
        >
          Dalej: rozmowa
          <ArrowRight {...ICON} />
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
          <span className={cn("h-1 w-full rounded-[2px]", l === suggested ? "bg-primary" : "bg-muted")} />
          <span
            className={cn(
              "text-center text-xs leading-4 @xl:whitespace-nowrap",
              l === suggested ? "font-medium text-primary" : "text-faint-foreground",
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
  onRate,
}: {
  summary: CompetencySummary;
  name: string;
  onSave: (level: LevelValue, justification: string) => Promise<void>;
  onRate: () => void;
}) {
  const [level, setLevel] = useState<LevelValue | "">(s.manager_level ?? s.suggested_level ?? "");
  const [justification, setJustification] = useState(s.justification ?? "");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = s.competency_id;
  const differs = level !== "" && level !== s.suggested_level;
  const approved = s.manager_level != null && !editing;
  const noRatings = s.suggested_level == null && s.rated === 0;

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
      className={cn("flex flex-col gap-4 rounded-xl border p-4 sm:p-5", approved && "border-primary-border")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <h3 id={`comp-${id}`} className="text-[15px] font-semibold leading-[22px]">
            {name}
          </h3>
          <p className="text-xs leading-4 text-faint-foreground">
            Ocenione wskaźniki: {s.rated} z {s.total}
            {s.no_basis ? ` · brak podstaw: ${s.no_basis}` : ""}
          </p>
        </div>
        {approved ? (
          <Badge variant="accent">Zatwierdzono</Badge>
        ) : noRatings ? (
          <Badge variant="warning">Brak ocen wskaźników</Badge>
        ) : (
          <Badge>Do zatwierdzenia</Badge>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-subtle px-3.5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] leading-[19px]">
            <span className="text-muted-foreground">Sugerowany poziom: </span>
            <span className="font-medium">
              {s.suggested_level ? levelText(s.suggested_level) : "brak — za mało ocen"}
            </span>
          </p>
          {noRatings && (
            <Button variant="link" size="sm" onClick={onRate}>
              Oceń wskaźniki
              <ArrowRight {...ICON} />
            </Button>
          )}
        </div>
        <LevelScale suggested={s.suggested_level} />
        {noRatings ? (
          <p className="text-xs leading-4 text-faint-foreground">
            Oceń przynajmniej jeden wskaźnik, aby system mógł zasugerować poziom.
          </p>
        ) : (
          s.no_basis > 0 && (
            <p className="text-xs leading-4 text-faint-foreground">
              Wskaźnik oznaczony jako „brak podstaw” nie wpływa na sugerowany poziom.
            </p>
          )
        )}
      </div>

      {approved ? (
        <div className="flex items-start gap-2">
          <p className="flex-1 text-[13px] leading-[19px]">
            <span className="text-muted-foreground">Twoja decyzja: </span>
            <span className="font-medium">{levelText(s.manager_level!)}</span>
            {s.justification && <span className="mt-1 block text-muted-foreground">{s.justification}</span>}
          </p>
          <Button variant="ghost" onClick={() => setEditing(true)}>
            Zmień
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
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
                Uzasadnienie
                <LabelHint className={cn(differs && "text-warning")}>
                  {differs ? "wymagane — inny poziom niż sugerowany" : "opcjonalnie"}
                </LabelHint>
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
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={save} disabled={busy || level === ""}>
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
