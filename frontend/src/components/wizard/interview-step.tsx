"use client";

import { useState } from "react";
import { AssistantChat } from "@/components/assistant-chat";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Textarea } from "@/components/ui/form";
import { api } from "@/lib/api";
import type { StepProps } from "./types";

/** Wyciąga sekcję „plan rozwoju” z odpowiedzi asystenta (jeśli występuje). */
function extractPlan(answer: string): string {
  const match = /plan\p{L}* rozwoju[^\n]*\n/iu.exec(answer);
  if (!match) return answer;
  return answer.slice(match.index + match[0].length).trim();
}

export function InterviewStep({ process, onProcess, goTo }: StepProps) {
  const [notes, setNotes] = useState(process.interview_notes ?? "");
  const [plan, setPlan] = useState(process.development_plan ?? "");
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    <div className="grid grid-cols-2 gap-6">
      <Card className="flex h-[70vh] flex-col">
        <CardHeader>
          <CardTitle>Przygotowanie rozmowy</CardTitle>
          <p className="text-sm text-muted-foreground">
            Asystent proponuje pytania, tematy i plan rozwoju na podstawie Twoich ocen. To propozycje
            – dostosuj je do sytuacji.
          </p>
        </CardHeader>
        <CardContent className="min-h-0 flex-1">
          <AssistantChat
            processId={process.id}
            defaultMode="interview"
            allowModeSwitch={false}
            onAnswer={(res) => res.confidence !== "none" && setLastAnswer(res.answer)}
          />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="notes">Notatki z rozmowy</Label>
          <Textarea
            id="notes"
            rows={8}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Najważniejsze ustalenia, stanowisko pracownika, uwagi."
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-end justify-between gap-2">
            <Label htmlFor="plan">Plan rozwoju</Label>
            {lastAnswer && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPlan((p) => (p ? p + "\n" : "") + extractPlan(lastAnswer))}
              >
                Wstaw propozycję asystenta
              </Button>
            )}
          </div>
          <Textarea
            id="plan"
            rows={8}
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            placeholder="Cele rozwojowe, działania, wsparcie, termin przeglądu."
          />
        </div>
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => goTo("summary")}>
            Wstecz
          </Button>
          <Button variant="secondary" onClick={() => persist()} disabled={busy}>
            Zapisz
          </Button>
          <Button onClick={() => persist("document")} disabled={busy}>
            Dalej: dokument
          </Button>
        </div>
      </div>
    </div>
  );
}
