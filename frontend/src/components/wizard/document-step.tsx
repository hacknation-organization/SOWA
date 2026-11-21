"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckDot } from "@/components/ui/choice";
import { api, API_MODE, LEVEL_LABELS } from "@/lib/api";
import { LEVEL_POINTS } from "@/lib/domain";
import { downloadProcessPdf } from "@/lib/download";
import { ROUTES } from "@/lib/routes";
import { useApi } from "@/lib/use-api";
import { StepActions, StepCard } from "./step-card";
import type { StepProps } from "./types";

const SHORT_LEVEL: Record<number, string> = {
  1: "Znacznie poniżej",
  2: "Poniżej",
  3: "Na poziomie",
  4: "Powyżej",
  5: "Znacznie powyżej",
};

const COLUMNS = "grid grid-cols-[120px_110px_170px_minmax(0,1fr)] gap-3 px-[18px]";

function planItems(plan?: string): string[] {
  return (plan ?? "")
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•–]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

export function DocumentStep({ process, competencies, goTo }: StepProps) {
  const { data: summary } = useApi(() => api.getSummary(process.id), [process.id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sheet = process.type === "first" ? "Arkusz pierwszej oceny" : "Arkusz oceny okresowej";
  const filename = `${sheet}${process.employee_name ? ` — ${process.employee_name}` : ""}.pdf`;
  const total = (summary ?? []).reduce(
    (sum, s) => sum + (s.manager_level ? LEVEL_POINTS[s.manager_level] : 0),
    0,
  );
  const plan = planItems(process.development_plan);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      await downloadProcessPdf(process.id, filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się wygenerować PDF");
    } finally {
      setBusy(false);
    }
  }

  return (
    <StepCard stage="document" description="Sprawdź oceny cząstkowe i pobierz dokument do podpisu.">
      {API_MODE === "mock" && (
        <Alert variant="warning">
          Tryb demonstracyjny: PDF jest uproszczoną zaślepką. Arkusz zgodny ze wzorem z rozporządzenia generuje
          backend.
        </Alert>
      )}

      <div className="overflow-hidden rounded-xl border" role="table" aria-label="Oceny cząstkowe">
        <div role="row" className={`${COLUMNS} bg-muted py-3 text-[13px] font-bold text-muted-foreground`}>
          <span role="columnheader">Kompetencja</span>
          <span role="columnheader">Sugerowany</span>
          <span role="columnheader">Decyzja przełożonego</span>
          <span role="columnheader">Uzasadnienie</span>
        </div>
        {summary?.map((s) => (
          <div role="row" key={s.competency_id} className={`${COLUMNS} items-center border-t py-3.5`}>
            <span role="cell" className="text-sm font-black">
              {competencies.find((c) => c.id === s.competency_id)?.name}
            </span>
            <span role="cell" className="text-[13px] font-medium text-muted-foreground">
              {s.suggested_level ? SHORT_LEVEL[s.suggested_level] : "—"}
            </span>
            <span role="cell" className="flex flex-col items-start gap-1">
              {s.manager_level ? (
                <>
                  <span className="text-[13px] font-bold">{LEVEL_LABELS[s.manager_level]}</span>
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-black text-primary">
                    {LEVEL_POINTS[s.manager_level]} pkt
                  </span>
                </>
              ) : (
                <span className="text-[13px] text-muted-foreground">—</span>
              )}
            </span>
            <span role="cell" className="text-[13px] font-medium leading-[19px] text-muted-foreground">
              {s.justification || "—"}
            </span>
          </div>
        ))}
        <div role="row" className="flex items-center gap-3 bg-primary-soft px-[18px] py-3.5 text-primary">
          <span role="cell" className="flex-1 text-sm font-black">
            Suma punktów
          </span>
          <span role="cell" className="text-lg font-black">
            {total} pkt
          </span>
        </div>
      </div>

      {plan.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold">Plan rozwoju</h3>
          <ul className="flex flex-col gap-2 rounded-lg bg-muted px-4 py-3.5">
            {plan.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm font-medium leading-5">
                <CheckDot className="mt-px" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-3.5 rounded-lg border py-3.5 pl-3.5 pr-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <FileText aria-hidden absoluteStrokeWidth strokeWidth={2} className="size-[22px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{filename}</p>
          <p className="text-xs font-medium text-muted-foreground">Gotowy do podpisu</p>
        </div>
        <Button onClick={download} disabled={busy} className="px-4">
          <Download aria-hidden absoluteStrokeWidth strokeWidth={2} />
          {busy ? "Generowanie…" : "Pobierz PDF"}
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <StepActions>
        <Button variant="outline" onClick={() => goTo("interview")}>
          Wstecz
        </Button>
        <span className="flex-1" />
        <Button asChild variant="link">
          <Link href={ROUTES.dashboard}>Wróć do pulpitu</Link>
        </Button>
      </StepActions>
    </StepCard>
  );
}
