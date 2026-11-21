"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/form";
import { api, type LevelValue, type Rating } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { StepProps } from "./types";

type Choice = LevelValue | "none";

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
        <button className="underline" onClick={() => goTo("criteria")}>
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
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[16rem_minmax(0,1fr)]">
      <nav aria-label="Wskaźniki do oceny" className="text-sm">
        <p className="mb-2 font-medium" aria-live="polite">
          Ocenione: {answered} z {items.length}
        </p>
        <div
          className="mb-3 h-2 rounded-sm bg-muted"
          role="progressbar"
          aria-label="Postęp oceny"
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={answered}
        >
          <div
            className="h-2 rounded-sm bg-primary"
            style={{ width: `${(answered / items.length) * 100}%` }}
          />
        </div>
        <ol className="flex max-h-48 xl:max-h-[60vh] flex-col gap-0.5 overflow-y-auto pr-1">
          {items.map((it, i) => {
            const r = ratings.get(it.indicator.id);
            const showHeader = i === 0 || items[i - 1].competency.id !== it.competency.id;
            return (
              <li key={it.indicator.id}>
                {showHeader && (
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {it.competency.name}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-current={i === index ? "step" : undefined}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-sm px-2 py-1 text-left hover:bg-muted",
                    i === index && "bg-primary-soft",
                  )}
                >
                  <span aria-hidden className="w-4 shrink-0 text-center">
                    {r ? (r.level ? r.level : "–") : "○"}
                  </span>
                  <span className="line-clamp-2">
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

      <div className="flex max-w-3xl flex-col gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {item.competency.name} · wskaźnik {index + 1} z {items.length}
          </p>
          <p className="mt-1 text-sm">
            Wybierz opis, który najlepiej oddaje zachowanie pracownika zaobserwowane w ocenianym
            okresie.
          </p>
        </div>

        <fieldset ref={fieldsetRef} tabIndex={-1} className="flex flex-col gap-2 outline-none">
          <legend className="mb-3 text-base font-semibold">{item.indicator.name}</legend>
          {item.indicator.levels.map((l) => (
            <label
              key={l.level}
              className="flex cursor-pointer items-start gap-3 rounded-md border bg-card p-3 hover:border-border-strong has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
            >
              <input
                type="radio"
                name={groupName}
                checked={choice === l.level}
                onChange={() => save(l.level, example)}
                className="mt-1"
              />
              <span className="flex-1 text-sm">
                <span className="block">{l.description}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {l.label}
                </span>
              </span>
              <kbd className="rounded-sm border px-1.5 font-mono text-xs text-muted-foreground" aria-hidden>
                {l.level}
              </kbd>
            </label>
          ))}
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-dashed bg-card p-3 has-[:checked]:border-primary has-[:checked]:bg-muted">
            <input
              type="radio"
              name={groupName}
              checked={choice === "none"}
              onChange={() => save("none", example)}
              className="mt-1"
            />
            <span className="flex-1 text-sm">
              <span className="block">Brak podstaw do oceny</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Nie było okazji zaobserwować tego zachowania – wskaźnik nie wpłynie na sugerowany poziom.
              </span>
            </span>
            <kbd className="rounded-sm border px-1.5 font-mono text-xs text-muted-foreground" aria-hidden>
              0
            </kbd>
          </label>
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor="example">Przykład zachowania (opcjonalnie)</Label>
          <Textarea
            id="example"
            rows={3}
            value={example}
            onChange={(e) => setExample(e.target.value)}
            onBlur={() => choice !== undefined && example !== (rating?.example ?? "") && save(choice, example)}
            placeholder="Konkretna sytuacja z ocenianego okresu, która uzasadnia wybór."
          />
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <p className="text-xs text-muted-foreground">
          Skróty: <kbd className="font-mono">1</kbd>–<kbd className="font-mono">5</kbd> wybór
          poziomu, <kbd className="font-mono">0</kbd> brak podstaw, <kbd className="font-mono">N</kbd>{" "}
          następny, <kbd className="font-mono">P</kbd> poprzedni (poza polem tekstowym).
        </p>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => move(-1)} disabled={index === 0}>
            Poprzedni wskaźnik
          </Button>
          {!isLast ? (
            <Button onClick={() => move(1)}>Następny wskaźnik</Button>
          ) : (
            <Button
              onClick={async () => {
                await move(0);
                await goToSummary();
              }}
              disabled={answered === 0}
            >
              Dalej: podsumowanie
            </Button>
          )}
          {!isLast && answered === items.length && (
            <Button variant="secondary" onClick={goToSummary}>
              Wszystko ocenione – przejdź do podsumowania
            </Button>
          )}
        </div>
        {isLast && answered < items.length && (
          <p className="text-sm text-muted-foreground">
            Nieocenione wskaźniki ({items.length - answered}) zostaną pominięte w wyliczeniu
            sugerowanego poziomu.
          </p>
        )}
      </div>
    </div>
  );
}
