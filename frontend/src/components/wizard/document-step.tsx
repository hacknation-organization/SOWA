"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Download, FileText } from "lucide-react";
import { ICON } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const COLUMNS = "grid grid-cols-[150px_120px_190px_minmax(0,1fr)] gap-3 px-[18px]";

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
    <StepCard stage="document" description="Sprawdź oceny cząstkowe i pobierz arkusz do podpisu.">
      {API_MODE === "mock" && (
        <Alert variant="warning">
          Tryb demonstracyjny: PDF jest uproszczoną zaślepką. Arkusz zgodny ze wzorem z rozporządzenia generuje
          backend.
        </Alert>
      )}

      <div className="overflow-hidden rounded-xl border" role="table" aria-label="Oceny cząstkowe">
        <div
          role="row"
          className={`${COLUMNS} border-b bg-subtle py-2.5 text-[11px] font-medium uppercase leading-4 tracking-[0.6px] text-faint-foreground`}
        >
          <span role="columnheader">Kompetencja</span>
          <span role="columnheader">Sugerowany</span>
          <span role="columnheader">Decyzja</span>
          <span role="columnheader">Uzasadnienie</span>
        </div>
        {summary?.map((s) => {
          const changed = s.manager_level != null && s.suggested_level != null && s.manager_level !== s.suggested_level;
          return (
            <div role="row" key={s.competency_id} className={`${COLUMNS} items-start border-b py-3.5 text-[13px] leading-[19px]`}>
              <span role="cell" className="font-medium">
                {competencies.find((c) => c.id === s.competency_id)?.name}
              </span>
              <span role="cell" className="text-muted-foreground">
                {s.suggested_level ? SHORT_LEVEL[s.suggested_level] : "—"}
              </span>
              <span role="cell" className="flex flex-col items-start gap-1.5">
                {s.manager_level ? (
                  <>
                    <span className="font-medium">{LEVEL_LABELS[s.manager_level]}</span>
                    <span className="flex gap-1.5">
                      <Badge>{LEVEL_POINTS[s.manager_level]} pkt</Badge>
                      {changed && <Badge variant="warning">zmieniono</Badge>}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>
              <span role="cell" className="text-muted-foreground">
                {s.justification || "—"}
              </span>
            </div>
          );
        })}
        <div role="row" className="flex items-center justify-between bg-subtle px-[18px] py-3.5">
          <span role="cell" className="text-[13px] font-medium">
            Suma punktów
          </span>
          <span role="cell" className="text-lg font-semibold">
            {total} pkt
          </span>
        </div>
      </div>

      {plan.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <h3 className="text-[15px] font-semibold leading-[22px]">Plan rozwoju</h3>
          <ul className="flex flex-col gap-2">
            {plan.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px] leading-[19px]">
                <Check {...ICON} className="mt-0.5 size-4 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-3.5 rounded-lg border bg-subtle p-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <FileText {...ICON} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{filename}</p>
          <p className="text-xs leading-4 text-faint-foreground">Gotowy do podpisu</p>
        </div>
        <Button onClick={download} disabled={busy}>
          <Download {...ICON} />
          {busy ? "Generowanie…" : "Pobierz PDF"}
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <StepActions>
        <Button variant="outline" onClick={() => goTo("interview")}>
          Wstecz
        </Button>
        <span className="flex-1" />
        <Button asChild variant="ghost">
          <Link href={ROUTES.dashboard}>
            Wróć do pulpitu
            <ArrowRight {...ICON} />
          </Link>
        </Button>
      </StepActions>
    </StepCard>
  );
}
