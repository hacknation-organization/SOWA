"use client";

import { useCallback, useState } from "react";
import { ArrowRight } from "lucide-react";
import { ListSkeleton } from "@/components/loading-states";
import { Alert } from "@/components/ui/alert";
import { LoadingRegion } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/form";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { STEP_ACTIONS_ROW } from "./step-card";
import type { StepProps } from "./types";

const PLAN_REQUEST = "Zaproponuj plan rozwoju pracownika na podstawie wyników oceny.";
const QUESTIONS_REQUEST =
  "Zaproponuj 6–8 pytań do rozmowy oceniającej z pracownikiem na podstawie wyników oceny. " +
  "Każde pytanie w osobnej linii zaczynającej się od „- ”, bez wstępu i bez podsumowania.";

// Source markers like [1] only make sense next to chat citations, so drop them from the document text.
function stripMarkers(text: string): string {
  return text.replace(/\s*\[\d+\]/g, "").trim();
}

const BULLET = /^\s*(?:[-*•–]|\d+[.)])\s+/;

// The assistant answers in free text; keep the bulleted questions as separate list items.
function parseQuestions(answer: string): string[] {
  const bullets = answer
    .split("\n")
    .filter((line) => BULLET.test(line))
    .map((line) => stripMarkers(line.replace(BULLET, "")))
    .filter(Boolean);
  const questions = bullets.filter((line) => line.includes("?"));
  return questions.length ? questions : bullets;
}

export function InterviewStep({ process, onProcess, goTo }: StepProps) {
  const [notes, setNotes] = useState(process.interview_notes ?? "");
  const [plan, setPlan] = useState(process.development_plan ?? "");
  const [planBusy, setPlanBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [questionsBusy, setQuestionsBusy] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [ownQuestions, setOwnQuestions] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  // AI suggestions are opt-in: nothing is requested until the user asks to see them.
  const [showAi, setShowAi] = useState(false);

  const suggestQuestions = useCallback(async () => {
    setQuestionsBusy(true);
    setQuestionsError(null);
    try {
      const res = await api.ask({ question: QUESTIONS_REQUEST, mode: "interview", process_id: process.id });
      const items = res.confidence === "none" ? [] : parseQuestions(res.answer);
      setQuestions(items);
      if (!items.length) setQuestionsError(res.answer || "Asystent nie zaproponował pytań. Spróbuj ponownie.");
    } catch (e) {
      setQuestionsError(e instanceof Error ? e.message : "Nie udało się pobrać pytań");
    } finally {
      setQuestionsBusy(false);
    }
  }, [process.id]);

  const aiQuestions = showAi ? questions : [];

  function toggleAi() {
    const next = !showAi;
    setShowAi(next);
    if (next && !questions.length && !questionsBusy) void suggestQuestions();
  }

  async function suggestPlan() {
    setPlanBusy(true);
    setError(null);
    try {
      const res = await api.ask({ question: PLAN_REQUEST, mode: "plan", process_id: process.id });
      if (res.confidence === "none" || !res.answer.trim()) {
        setError(res.answer || "Asystent nie przygotował planu. Spróbuj ponownie.");
        return;
      }
      const text = stripMarkers(res.answer);
      setPlan((current) => (current.trim() ? `${current.trim()}\n\n${text}` : text));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się przygotować planu");
    } finally {
      setPlanBusy(false);
    }
  }

  async function persist(stage?: "document") {
    setBusy(true);
    setError(null);
    try {
      const p = await api.updateProcess(process.id, {
        interview_notes: notes,
        development_plan: plan,
        stage,
      });
      onProcess(p);
      if (stage) goTo(stage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać");
    } finally {
      setBusy(false);
    }
  }

  return (
    // Two columns share the height left below the header and stepper, so the step fits the screen.
    <div className="grid grid-cols-1 gap-5 @3xl:h-[max(28rem,calc(100dvh-17.5rem))] @3xl:grid-cols-2">
      <Card className="flex min-h-0 flex-col @3xl:h-full">
        <CardHeader>
          <CardTitle>{showAi ? "Zaproponowane pytania" : "Twoje pytania"}</CardTitle>
          <p className="text-[13px] leading-[19px] text-muted-foreground">
            {showAi
              ? "Asystent proponuje pytania na podstawie Twoich ocen. To propozycje – dostosuj je do sytuacji."
              : "Propozycje asystenta są ukryte. Dodaj własne pytania do rozmowy."}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {showAi && (
              <Button size="sm" variant="outline" onClick={suggestQuestions} disabled={questionsBusy}>
                {questionsBusy ? "Przygotowuję…" : "Zaproponuj inne"}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={toggleAi} aria-pressed={!showAi}>
              {showAi ? "Ukryj propozycje AI" : "Pokaż propozycje AI"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="min-h-0 flex-1 overflow-y-auto max-@3xl:max-h-[24rem]">
            {showAi && questionsBusy && !questions.length && (
              <LoadingRegion label="Przygotowuję pytania" className="mb-3">
                <ListSkeleton rows={5} />
              </LoadingRegion>
            )}
            {showAi && questionsError && !questions.length && (
              <Alert variant="warning" className="mb-3">
                {questionsError}
              </Alert>
            )}
            {!showAi && !ownQuestions.length && (
              <p className="text-[13px] leading-[19px] text-muted-foreground">Nie dodano jeszcze własnych pytań.</p>
            )}
            {aiQuestions.length + ownQuestions.length > 0 && (
              <ol className="divide-y overflow-hidden rounded-lg border">
                {[...aiQuestions, ...ownQuestions].map((q, i) => {
                  const ownIndex = i - aiQuestions.length;
                  return (
                    <li key={i} className="flex items-start gap-3 px-3.5 py-2.5 text-[13px] leading-[19px]">
                      <span className="w-5 shrink-0 text-right text-faint-foreground">{i + 1}.</span>
                      <span className="flex-1">{q}</span>
                      {ownIndex >= 0 && (
                        <>
                          <Badge>Twoje</Badge>
                          <button
                            type="button"
                            className="text-xs text-muted-foreground underline hover:text-foreground"
                            onClick={() => setOwnQuestions((list) => list.filter((_, j) => j !== ownIndex))}
                          >
                            Usuń
                          </button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const text = draft.trim();
              if (!text) return;
              setOwnQuestions((list) => [...list, text]);
              setDraft("");
            }}
          >
            <Input
              aria-label="Własne pytanie"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Dodaj własne pytanie"
            />
            <Button type="submit" variant="outline" disabled={!draft.trim()}>
              Dodaj
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="flex min-h-0 flex-col gap-4 p-5 sm:p-6 @3xl:h-full">
        <div className="flex min-h-0 flex-[2] flex-col gap-2">
          <Label htmlFor="notes">Notatki z rozmowy</Label>
          <Textarea
            id="notes"
            rows={5}
            className="min-h-24 flex-1 resize-none"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Najważniejsze ustalenia, stanowisko pracownika, uwagi."
          />
        </div>
        <div className="flex min-h-0 flex-[3] flex-col gap-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <Label htmlFor="plan">Plan rozwoju</Label>
            <Button size="sm" variant="outline" onClick={suggestPlan} disabled={planBusy}>
              {planBusy ? "Przygotowuję plan…" : "Zaproponuj plan rozwoju"}
            </Button>
          </div>
          <Textarea
            id="plan"
            rows={7}
            className="min-h-32 flex-1 resize-none"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            placeholder="Cele rozwojowe, działania, wsparcie, termin przeglądu."
          />
        </div>
        {error && <Alert variant="danger">{error}</Alert>}
        <div className={cn(STEP_ACTIONS_ROW, "border-t pt-4")}>
          <Button variant="outline" onClick={() => goTo("summary")}>
            Wstecz
          </Button>
          <span className="flex-1" />
          <Button variant="ghost" onClick={() => persist()} disabled={busy}>
            Zapisz
          </Button>
          <Button onClick={() => persist("document")} disabled={busy}>
            Dalej: dokument
            <ArrowRight absoluteStrokeWidth strokeWidth={1.6} aria-hidden />
          </Button>
        </div>
      </Card>
    </div>
  );
}
