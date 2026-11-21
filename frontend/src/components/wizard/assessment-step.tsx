"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckDot, RadioDot } from "@/components/ui/choice";
import { Textarea } from "@/components/ui/form";
import { api, type LevelValue, type Rating } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { StepProps } from "./types";

type Choice = LevelValue | "none";

const SHORTCUTS = [
  ["1–5", "poziom"],
  ["0", "brak podstaw"],
  ["N", "następny"],
  ["P", "poprzedni"],
] as const;

export function AssessmentStep({ process, competencies, onProcess, goTo }: StepProps) {
  const items = useMemo(
    () =>
      competencies
        .filter((c) => process.competency_ids?.includes(c.id))
        .flatMap((c) => c.indicators.map((indicator) => ({ competency: c, indicator }))),
    [competencies, process.competency_ids],
  );
  const ratings = useMemo(
    () => new Map((process.ratings ?? []).map((r) => [r.indicator_id, r] as const)),
    [process.ratings],
  );
  const firstOpen = items.findIndex((it) => !ratings.has(it.indicator.id));
  const [index, setIndex] = useState(firstOpen === -1 ? 0 : firstOpen);
  const [example, setExample] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);

  const item = items[index];
  const rating: Rating | undefined = item ? ratings.get(item.indicator.id) : undefined;
  const choice: Choice | undefined = rating ? (rating.level ?? "none") : undefined;
  const answered = items.filter((it) => ratings.has(it.indicator.id)).length;

  useEffect(() => {
    setExample(rating?.example ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.indicator.id]);

  const save = useCallback(
    async (c: Choice, ex: string) => {
      if (!item) return;
      setError(null);
      try {
        const p = await api.setRating(process.id, item.indicator.id, {
          level: c === "none" ? null : c,
          example: ex.trim() || undefined,
        });
        onProcess(p);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nie udało się zapisać oceny");
      }
    },
    [item, process.id, onProcess],
  );

  const move = useCallback(
    async (delta: number) => {
      if (choice !== undefined && example !== (rating?.example ?? "")) await save(choice, example);
      setIndex((i) => Math.min(items.length - 1, Math.max(0, i + delta)));
      fieldsetRef.current?.focus();
    },
    [choice, example, rating?.example, save, items.length],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("textarea, input[type=text], select, [contenteditable]")) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[1-5]$/.test(e.key)) {
        e.preventDefault();
        void save(Number(e.key) as LevelValue, example);
      } else if (e.key === "0") {
        e.preventDefault();
        void save("none", example);
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        void move(1);
      } else if (e.key.toLowerCase() === "p") {
        e.preventDefault();
        void move(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, move, example]);

  if (items.length === 0) {
    return (
      <Alert variant="warning">
        Nie wybrano kryteriów.{" "}
        <button className="font-bold text-primary underline" onClick={() => goTo("criteria")}>
          Wróć do wyboru kryteriów
        </button>
      </Alert>
    );
  }

  const isLast = index === items.length - 1;

  async function goToSummary() {
    const p = await api.updateProcess(process.id, { stage: "summary" });
    onProcess(p);
    goTo("summary");
  }
  const groupName = `indicator-${item.indicator.id}`;

  return (
    <div className="flex items-start gap-5">
      <Card className="sticky top-6 flex w-[250px] shrink-0 flex-col gap-1.5 px-4 pb-4 pt-5">
        <nav aria-label="Wskaźniki do oceny">
          <p className="flex items-center px-1 text-sm" aria-live="polite">
            <span className="flex-1 font-bold">Ocenione</span>
            <span className="font-black text-primary">
              {answered} z {items.length}
            </span>
          </p>
          <div className="px-1 pb-2 pt-1.5">
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Postęp oceny"
              aria-valuemin={0}
              aria-valuemax={items.length}
              aria-valuenow={answered}
            >
              <div
                className="h-full rounded-full bg-brand-gradient"
                style={{ width: `${(answered / items.length) * 100}%` }}
              />
            </div>
          </div>
          <ol className="flex max-h-[calc(100vh-12rem)] flex-col gap-1.5 overflow-y-auto">
            {items.map((it, i) => {
              const r = ratings.get(it.indicator.id);
              const current = i === index;
              const showHeader = i === 0 || items[i - 1].competency.id !== it.competency.id;
              return (
                <li key={it.indicator.id}>
                  {showHeader && (
                    <p className="pb-0.5 pl-1.5 pt-2.5 text-[13px] font-bold text-muted-foreground">
                      {it.competency.name}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-current={current ? "step" : undefined}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-md px-2 py-[9px] text-left text-[13px] leading-[18px] transition-colors",
                      current ? "bg-primary-soft font-bold text-primary" : "font-medium hover:bg-muted",
                    )}
                  >
                    {r ? (
                      <CheckDot />
                    ) : (
                      <span aria-hidden className="size-[18px] shrink-0 rounded-full border-2 border-border-strong" />
                    )}
                    <span className="line-clamp-3">
                      {it.indicator.name}
                      <span className="sr-only">
                        {r ? (r.level ? `, oceniono: ${r.level}` : ", brak podstaw") : ", nieocenione"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </Card>

      <Card className="flex min-w-0 flex-1 flex-col gap-4 p-7">
        <p className="flex items-center gap-2">
          <Badge variant="solid" className="px-2.5 py-[3px] text-xs">
            {item.competency.name}
          </Badge>
          <span className="text-[13px] font-bold text-muted-foreground">
            Wskaźnik {index + 1} z {items.length}
          </span>
        </p>

        <fieldset ref={fieldsetRef} tabIndex={-1} className="flex flex-col gap-4 outline-none">
          <legend className="text-[19px] font-black leading-[26px]">{item.indicator.name}</legend>
          <p className="text-sm font-medium leading-5 text-muted-foreground">
            Wybierz opis, który najlepiej oddaje zachowanie pracownika zaobserwowane w ocenianym okresie.
          </p>
          <div className="flex flex-col gap-2.5">
            {item.indicator.levels.map((l) => {
              const checked = choice === l.level;
              return (
                <label
                  key={l.level}
                  className={cn(
                    "flex cursor-pointer items-center gap-3.5 rounded-lg py-3.5 pl-3.5 pr-4 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-primary/25",
                    checked ? "border-2 border-primary bg-primary-soft" : "border bg-card hover:border-primary-light",
                  )}
                >
                  <input
                    type="radio"
                    name={groupName}
                    checked={checked}
                    onChange={() => save(l.level, example)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-[38px] shrink-0 items-center justify-center rounded-lg text-base font-black",
                      checked ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary",
                    )}
                  >
                    {l.level}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <span className={cn("text-sm leading-5", checked ? "font-bold" : "font-medium")}>
                      {l.description}
                    </span>
                    <span className={cn("text-xs font-bold leading-4", checked ? "text-primary" : "text-muted-foreground")}>
                      {l.label}
                    </span>
                  </span>
                  <RadioDot checked={checked} />
                </label>
              );
            })}
            <label
              className={cn(
                "flex cursor-pointer items-center gap-3.5 rounded-lg border border-dashed py-3.5 pl-3.5 pr-4 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-primary/25",
                choice === "none" ? "border-primary bg-muted" : "bg-subtle hover:border-primary-light",
              )}
            >
              <input
                type="radio"
                name={groupName}
                checked={choice === "none"}
                onChange={() => save("none", example)}
                className="sr-only"
              />
              <span
                aria-hidden
                className="flex size-[38px] shrink-0 items-center justify-center rounded-lg bg-muted text-base font-black text-muted-foreground"
              >
                0
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="text-sm font-bold leading-5">Brak podstaw do oceny</span>
                <span className="text-xs font-medium leading-4 text-muted-foreground">
                  Nie było okazji zaobserwować tego zachowania — wskaźnik nie wpłynie na sugerowany poziom.
                </span>
              </span>
              <RadioDot checked={choice === "none"} />
            </label>
          </div>
        </fieldset>

        <div className="flex flex-col gap-2 pt-1.5">
          <label htmlFor="example" className="text-sm font-bold">
            Przykład zachowania <span className="font-medium text-muted-foreground">(opcjonalnie)</span>
          </label>
          <Textarea
            id="example"
            value={example}
            onChange={(e) => setExample(e.target.value)}
            onBlur={() => choice !== undefined && example !== (rating?.example ?? "") && save(choice, example)}
            placeholder="Konkretna sytuacja z ocenianego okresu, która uzasadnia wybór."
            className="h-24"
          />
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <p className="flex flex-wrap items-center gap-3.5" aria-label="Skróty klawiszowe (poza polem tekstowym)">
          {SHORTCUTS.map(([key, label]) => (
            <span key={key} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <kbd className="rounded-[5px] border border-border-strong bg-muted px-1.5 py-0.5 font-sans text-[11px] font-bold text-foreground">
                {key}
              </kbd>
              {label}
            </span>
          ))}
        </p>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <Button variant="outline" onClick={() => move(-1)} disabled={index === 0}>
            Poprzedni wskaźnik
          </Button>
          <span className="flex-1" />
          {!isLast && answered === items.length && (
            <Button variant="secondary" onClick={goToSummary}>
              Wszystko ocenione — podsumowanie
            </Button>
          )}
          {!isLast ? (
            <Button onClick={() => move(1)}>
              Następny wskaźnik
              <ArrowRight absoluteStrokeWidth strokeWidth={2} aria-hidden />
            </Button>
          ) : (
            <Button
              onClick={async () => {
                await move(0);
                await goToSummary();
              }}
              disabled={answered === 0}
            >
              Dalej: podsumowanie
              <ArrowRight absoluteStrokeWidth strokeWidth={2} aria-hidden />
            </Button>
          )}
        </div>
        {isLast && answered < items.length && (
          <p className="text-[13px] font-medium text-muted-foreground">
            Nieocenione wskaźniki ({items.length - answered}) zostaną pominięte w wyliczeniu sugerowanego
            poziomu.
          </p>
        )}
      </Card>
    </div>
  );
}
