"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { ICON } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckDot } from "@/components/ui/choice";
import { Label, LabelHint, Select, Textarea } from "@/components/ui/form";
import { api, type LevelValue, type Rating } from "@/lib/api";
import { cn } from "@/lib/utils";
import { StepActions } from "./step-card";
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
  const groupRef = useRef<HTMLDivElement>(null);

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
      groupRef.current?.focus();
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
        <button className="font-medium underline" onClick={() => goTo("criteria")}>
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
    <div className="flex flex-col gap-4 @3xl:flex-row @3xl:items-start @3xl:gap-5">
      {/* Narrow column: progress and a select to jump between indicators instead of the side list. */}
      <Card className="flex flex-col gap-3 p-4 @3xl:hidden">
        <p className="flex items-center justify-between text-[13px] leading-[19px]">
          <span className="font-medium">Ocenione</span>
          <span className="text-faint-foreground">
            {answered} z {items.length}
          </span>
        </p>
        <div className="h-1 overflow-hidden rounded-[2px] bg-muted" aria-hidden>
          <div className="h-full rounded-[2px] bg-primary" style={{ width: `${(answered / items.length) * 100}%` }} />
        </div>
        <Select
          aria-label="Przejdź do wskaźnika"
          value={String(index)}
          onChange={(e) => setIndex(Number(e.target.value))}
        >
          {items.map((it, i) => {
            const r = ratings.get(it.indicator.id);
            return (
              <option key={it.indicator.id} value={i}>
                {r ? "✓ " : ""}
                {i + 1}. {it.competency.name} – {it.indicator.name}
              </option>
            );
          })}
        </Select>
      </Card>

      <Card className="sticky top-6 hidden w-[248px] shrink-0 px-4 pb-4 pt-5 @3xl:block">
        <nav aria-label="Wskaźniki do oceny" className="flex flex-col gap-1.5">
          <p className="flex items-center justify-between text-[13px] leading-[19px]" aria-live="polite">
            <span className="font-medium">Ocenione</span>
            <span className="text-faint-foreground">
              {answered} z {items.length}
            </span>
          </p>
          <div
            className="mb-2 h-1 overflow-hidden rounded-[2px] bg-muted"
            role="progressbar"
            aria-label="Postęp oceny"
            aria-valuemin={0}
            aria-valuemax={items.length}
            aria-valuenow={answered}
          >
            <div className="h-full rounded-[2px] bg-primary" style={{ width: `${(answered / items.length) * 100}%` }} />
          </div>
          <ol className="flex max-h-[calc(100vh-12rem)] flex-col gap-0.5 overflow-y-auto">
            {items.map((it, i) => {
              const r = ratings.get(it.indicator.id);
              const current = i === index;
              const showHeader = i === 0 || items[i - 1].competency.id !== it.competency.id;
              return (
                <li key={it.indicator.id}>
                  {showHeader && (
                    <p className="px-2 pb-1 pt-3 text-[11px] font-medium uppercase leading-4 tracking-[0.6px] text-faint-foreground">
                      {it.competency.name}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-current={current ? "step" : undefined}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left text-[13px] leading-[19px] transition-colors",
                      current
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-subtle hover:text-foreground",
                    )}
                  >
                    {r ? (
                      <CheckDot className="mt-px" />
                    ) : (
                      <span aria-hidden className="mt-px size-[18px] shrink-0 rounded-full border border-border-strong bg-card" />
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

      <Card className="flex min-w-0 flex-1 flex-col gap-6 p-5 sm:p-7">
        <div className="flex flex-col gap-3">
          <p className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">{item.competency.name}</Badge>
            <span className="text-xs text-faint-foreground">
              Wskaźnik {index + 1} z {items.length}
            </span>
          </p>
          <h3 id={`${groupName}-title`} className="text-[17px] font-semibold leading-6 tracking-[-0.1px]">
            {item.indicator.name}
          </h3>
          <p id={`${groupName}-hint`} className="text-[13px] leading-[19px] text-muted-foreground">
            Wybierz opis, który najlepiej oddaje zachowanie pracownika zaobserwowane w ocenianym okresie.
          </p>
        </div>

        <div
          ref={groupRef}
          role="radiogroup"
          tabIndex={-1}
          aria-labelledby={`${groupName}-title`}
          aria-describedby={`${groupName}-hint`}
          className="flex flex-col gap-2 outline-none"
        >
          {item.indicator.levels.map((l) => {
            const checked = choice === l.level;
            return (
              <label
                key={l.level}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg p-3.5 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-primary/25",
                  checked ? "border-[1.5px] border-primary bg-primary-soft" : "border bg-card hover:bg-subtle",
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
                    "flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-medium",
                    checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {l.level}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span
                    className={cn("text-xs leading-4", checked ? "font-medium text-primary" : "text-faint-foreground")}
                  >
                    {l.label}
                  </span>
                  <span className={cn("leading-[21px]", checked && "font-medium")}>{l.description}</span>
                </span>
              </label>
            );
          })}
          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border border-dashed p-3.5 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-primary/25",
              choice === "none" ? "border-foreground bg-muted" : "border-border-strong bg-subtle hover:bg-muted",
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
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-medium",
                choice === "none" ? "bg-foreground text-card" : "bg-muted text-muted-foreground",
              )}
            >
              0
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[13px] font-medium leading-[19px]">Brak podstaw do oceny</span>
              <span className="text-xs leading-4 text-muted-foreground">
                Nie było okazji zaobserwować tego zachowania — wskaźnik nie wpłynie na sugerowany poziom.
              </span>
            </span>
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="example">
            Przykład zachowania <LabelHint>opcjonalnie</LabelHint>
          </Label>
          <Textarea
            id="example"
            value={example}
            onChange={(e) => setExample(e.target.value)}
            onBlur={() => choice !== undefined && example !== (rating?.example ?? "") && save(choice, example)}
            placeholder="Konkretna sytuacja z ocenianego okresu, która uzasadnia wybór."
            className="h-[88px] resize-y"
          />
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <p
          className="-mt-2 hidden flex-wrap items-center gap-4 @3xl:flex"
          aria-label="Skróty klawiszowe (poza polem tekstowym)"
        >
          {SHORTCUTS.map(([key, label]) => (
            <span key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <kbd className="rounded-sm border border-border-strong bg-card px-1.5 py-px font-mono text-[11px] leading-4 text-foreground">
                {key}
              </kbd>
              {label}
            </span>
          ))}
        </p>

        <StepActions>
          <Button variant="outline" onClick={() => move(-1)} disabled={index === 0}>
            Poprzedni
          </Button>
          <span className="flex-1" />
          {!isLast && answered === items.length && (
            <Button variant="ghost" onClick={goToSummary}>
              Wszystko ocenione — przejdź do podsumowania
            </Button>
          )}
          {!isLast ? (
            <Button onClick={() => move(1)}>
              Następny wskaźnik
              <ArrowRight {...ICON} />
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
              <ArrowRight {...ICON} />
            </Button>
          )}
        </StepActions>
        {isLast && answered < items.length && (
          <p className="-mt-3 text-xs text-faint-foreground sm:text-right">
            Nieocenione wskaźniki ({items.length - answered}) zostaną pominięte w wyliczeniu sugerowanego poziomu.
          </p>
        )}
      </Card>
    </div>
  );
}
