"use client";

import Link from "next/link";
import { PageHeader } from "@/components/app-shell";
import { Deadline, StatusBadge, stageLabel } from "@/components/process-badges";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, TYPE_LABELS } from "@/lib/api";
import { useApi } from "@/lib/use-api";

export default function DashboardPage() {
  const { data: processes, error, loading } = useApi(() => api.getProcesses());

  const active = processes?.filter((p) => p.status !== "completed") ?? [];
  const done = processes?.filter((p) => p.status === "completed") ?? [];

  return (
    <>
      <PageHeader
        title="Pulpit przełożonego"
        description="Oceny Twoich pracowników i ich terminy."
      />
      <div className="flex flex-col gap-6 p-8">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Pierwsza ocena</CardTitle>
              <CardDescription>
                Dla osoby podejmującej po raz pierwszy pracę w służbie cywilnej.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/oceny/nowa?typ=first">Rozpocznij pierwszą ocenę</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Ocena okresowa</CardTitle>
              <CardDescription>Arkusz B (stanowiska kierownicze) lub C (pozostałe).</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/oceny/nowa?typ=periodic">Rozpocznij ocenę okresową</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <section aria-labelledby="active-heading">
          <h2 id="active-heading" className="mb-2 text-base font-semibold">
            Oceny w toku ({active.length})
          </h2>
          {loading ? (
            <p className="text-muted-foreground">Ładowanie…</p>
          ) : (
            <ProcessTable processes={active} empty="Brak ocen w toku." />
          )}
        </section>

        <section aria-labelledby="done-heading">
          <h2 id="done-heading" className="mb-2 text-base font-semibold">
            Zakończone ({done.length})
          </h2>
          {!loading && <ProcessTable processes={done} empty="Brak zakończonych ocen." />}
        </section>
      </div>
    </>
  );
}

function ProcessTable({
  processes,
  empty,
}: {
  processes: import("@/lib/api").Process[];
  empty: string;
}) {
  if (processes.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pracownik</TableHead>
            <TableHead>Rodzaj</TableHead>
            <TableHead>Etap</TableHead>
            <TableHead>Termin</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>
              <span className="sr-only">Akcje</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {processes.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.employee_name ?? p.employee_id}</TableCell>
              <TableCell>
                {TYPE_LABELS[p.type]}
                {p.form ? ` (arkusz ${p.form})` : ""}
              </TableCell>
              <TableCell>{stageLabel(p.stage)}</TableCell>
              <TableCell>
                <Deadline iso={p.deadline} done={p.status === "completed"} />
              </TableCell>
              <TableCell>
                <StatusBadge status={p.status} />
              </TableCell>
              <TableCell className="text-right">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/oceny/${p.id}`}>
                    {p.status === "completed" ? "Otwórz" : "Kontynuuj"}
                    <span className="sr-only"> ocenę: {p.employee_name}</span>
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
