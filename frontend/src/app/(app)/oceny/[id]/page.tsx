"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AssistantChat } from "@/components/assistant-chat";
import { Deadline, StatusBadge } from "@/components/process-badges";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AssessmentStep } from "@/components/wizard/assessment-step";
import { CriteriaStep } from "@/components/wizard/criteria-step";
import { DocumentStep } from "@/components/wizard/document-step";
import { InterviewStep } from "@/components/wizard/interview-step";
import { JobDescriptionStep } from "@/components/wizard/job-description-step";
import { Stepper } from "@/components/wizard/stepper";
import { SummaryStep } from "@/components/wizard/summary-step";
import type { StepProps } from "@/components/wizard/types";
import { api, STAGES, TYPE_LABELS, type ProcessStage } from "@/lib/api";
import { useApi } from "@/lib/use-api";

const STEP_COMPONENTS: Record<ProcessStage, React.ComponentType<StepProps>> = {
  job_description: JobDescriptionStep,
  criteria: CriteriaStep,
  assessment: AssessmentStep,
  summary: SummaryStep,
  interview: InterviewStep,
  document: DocumentStep,
};

export default function WizardPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, setData } = useApi(
    async () => {
      const [process, competencies, employees] = await Promise.all([
        api.getProcess(id),
        api.getCompetencies(),
        api.getEmployees(),
      ]);
      return { process, competencies, employee: employees.find((e) => e.id === process.employee_id) };
    },
    [id],
  );
  const [step, setStep] = useState<ProcessStage | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(true);

  if (loading && !data) return <p className="p-8 text-muted-foreground">Ładowanie oceny…</p>;
  if (error || !data)
    return (
      <div className="p-8">
        <Alert variant="danger">{error ?? "Nie znaleziono oceny"}</Alert>
        <Link href="/" className="mt-4 inline-block text-primary underline">
          Wróć do pulpitu
        </Link>
      </div>
    );

  const { process, competencies, employee } = data;
  const current = step ?? process.stage;
  const Step = STEP_COMPONENTS[current];
  const stepIndex = STAGES.findIndex((s) => s.id === current);

  const goTo = (stage: ProcessStage) => {
    setStep(stage);
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => document.getElementById("step-heading")?.focus());
  };

  return (
    <div className="flex min-h-screen">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b bg-card px-8 pb-3 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">
                <Link href="/" className="underline underline-offset-2 hover:no-underline">
                  Pulpit
                </Link>{" "}
                / {TYPE_LABELS[process.type]}
                {process.form ? ` – arkusz ${process.form}` : ""}
              </p>
              <h1 className="text-xl font-semibold">
                {employee?.full_name ?? process.employee_name ?? "Pracownik"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {employee?.position}, {employee?.unit} · termin:{" "}
                <Deadline iso={process.deadline} done={process.status === "completed"} />
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={process.status} />
              <Button
                variant="outline"
                size="sm"
                aria-expanded={assistantOpen}
                aria-controls="assistant-panel"
                onClick={() => setAssistantOpen((o) => !o)}
              >
                {assistantOpen ? "Ukryj asystenta" : "Pokaż asystenta"}
              </Button>
            </div>
          </div>
          <Stepper current={current} reached={process.stage} onSelect={goTo} />
        </header>

        <section aria-labelledby="step-heading" className="flex-1 p-8">
          <h2 id="step-heading" tabIndex={-1} className="mb-4 text-lg font-semibold outline-none">
            Krok {stepIndex + 1}. {STAGES[stepIndex].label}
          </h2>
          <Step
            process={process}
            competencies={competencies}
            onProcess={(p) => setData({ ...data, process: p })}
            goTo={goTo}
          />
        </section>
      </div>

      {assistantOpen && (
        <aside
          id="assistant-panel"
          aria-label="Asystent – zasady i przepisy"
          className="sticky top-0 flex h-screen shrink-0 flex-col border-l bg-card p-4"
          style={{ width: "var(--kk-assistant-width)" }}
        >
          <h2 className="mb-1 font-semibold">Asystent</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Pytania o zasady i wymagania formalne. Odpowiedzi ze wskazaniem źródła.
          </p>
          <AssistantChat processId={process.id} allowModeSwitch={false} compact />
        </aside>
      )}
    </div>
  );
}
