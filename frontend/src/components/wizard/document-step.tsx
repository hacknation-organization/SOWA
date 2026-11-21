"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, API_MODE, LEVEL_LABELS } from "@/lib/api";
import { LEVEL_POINTS } from "@/lib/domain";
import { ROUTES } from "@/lib/routes";
import { useApi } from "@/lib/use-api";
import type { StepProps } from "./types";

export function DocumentStep({ process, competencies, goTo }: StepProps) {
  const { data: summary } = useApi(() => api.getSummary(process.id), [process.id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const blob = await api.getPdf(process.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ocena-${process.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się wygenerować PDF");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Sprawdź oceny cząstkowe i pobierz dokument do podpisu.
      </p>
      {API_MODE === "mock" && (
        <Alert variant="warning">
          Tryb demonstracyjny: PDF jest uproszczoną zaślepką. Arkusz zgodny ze wzorem z rozporządzenia
          generuje backend.
        </Alert>
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kompetencja</TableHead>
              <TableHead>Sugerowany</TableHead>
              <TableHead>Decyzja przełożonego</TableHead>
              <TableHead>Uzasadnienie</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary?.map((s) => (
              <TableRow key={s.competency_id}>
                <TableCell className="font-medium">
                  {competencies.find((c) => c.id === s.competency_id)?.name}
                </TableCell>
                <TableCell>{s.suggested_level ? LEVEL_LABELS[s.suggested_level] : "—"}</TableCell>
                <TableCell>
                  {s.manager_level
                    ? `${LEVEL_LABELS[s.manager_level]} (${LEVEL_POINTS[s.manager_level]} pkt)`
                    : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{s.justification || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {process.development_plan && (
        <div>
          <h3 className="mb-1 text-sm font-semibold">Plan rozwoju</h3>
          <p className="whitespace-pre-line rounded-md border bg-card p-3 text-sm">
            {process.development_plan}
          </p>
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => goTo("interview")}>
          Wstecz
        </Button>
        <Button onClick={download} disabled={busy}>
          {busy ? "Generowanie…" : "Pobierz PDF"}
        </Button>
        <Button asChild variant="ghost">
          <Link href={ROUTES.dashboard}>Wróć do pulpitu</Link>
        </Button>
      </div>
    </div>
  );
}
