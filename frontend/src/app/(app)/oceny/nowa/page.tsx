"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/form";
import { api, TYPE_LABELS, type ProcessType } from "@/lib/api";
import { useApi } from "@/lib/use-api";

export default function NewAssessmentPage() {
  return (
    <Suspense fallback={<p className="p-8 text-muted-foreground">Ładowanie…</p>}>
      <NewAssessmentForm />
    </Suspense>
  );
}

const TYPE_HINTS: Record<ProcessType, string> = {
  first:
    "Pierwsza ocena – dla osoby zatrudnionej po raz pierwszy w służbie cywilnej, przed upływem okresu umowy na czas określony.",
  periodic:
    "Ocena okresowa – dla członka korpusu służby cywilnej; arkusz B lub C wybierzesz w pierwszym kroku.",
};

function NewAssessmentForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialType: ProcessType = params.get("typ") === "first" ? "first" : "periodic";
  const [type, setType] = useState<ProcessType>(initialType);
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: employees } = useApi(() => api.getEmployees());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) {
      setError("Wybierz pracownika.");
      return;
    }
    setBusy(true);
    try {
      const p = await api.createProcess({ employee_id: employeeId, type, form: null });
      router.push(`/oceny/${p.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się utworzyć oceny");
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Nowa ocena" description="Wybierz pracownika i rodzaj oceny." />
      <div className="max-w-2xl p-8">
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={submit} className="flex flex-col gap-6">
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">Rodzaj oceny</legend>
                {(["periodic", "first"] as ProcessType[]).map((t) => (
                  <label
                    key={t}
                    className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
                  >
                    <input
                      type="radio"
                      name="type"
                      value={t}
                      checked={type === t}
                      onChange={() => setType(t)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-medium">{TYPE_LABELS[t]}</span>
                      <span className="block text-sm text-muted-foreground">{TYPE_HINTS[t]}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              <div className="flex flex-col gap-2">
                <Label htmlFor="employee">Pracownik</Label>
                <Select
                  id="employee"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  required
                >
                  <option value="">Wybierz z listy…</option>
                  {employees?.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} – {e.position}, {e.unit}
                    </option>
                  ))}
                </Select>
              </div>

              {error && <Alert variant="danger">{error}</Alert>}

              <div className="flex gap-2">
                <Button type="submit" disabled={busy}>
                  {busy ? "Tworzenie…" : "Rozpocznij ocenę"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => router.back()}>
                  Anuluj
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
