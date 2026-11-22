"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { X } from "lucide-react";
import { AssistantChat } from "@/components/assistant-chat";
import { WizardSkeleton } from "@/components/loading-states";
import { Deadline, StatusBadge, typeLabel } from "@/components/process-badges";
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
import { api, STAGES, type ProcessStage } from "@/lib/api";
import { competencyDisplayName } from "@/lib/domain";
import { ROUTES } from "@/lib/routes";
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
      return {
        process,
        competencies: competencies.map((c) => ({ ...c, name: competencyDisplayName(c.name) })),
        employee: employees.find((e) => e.id === process.employee_id),
      };
    },
    [id],
  );
  const [step, setStep] = useState<ProcessStage | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);

  if (loading && !data) return <WizardSkeleton />;
  if (error || !data)
    return (
      <div className="flex flex-col items-start gap-4 px-10 py-8">
        <Alert variant="danger">{error ?? "Nie znaleziono oceny"}</Alert>
        <Button asChild variant="outline">
          <Link href={ROUTES.dashboard}>Wróć do pulpitu</Link>
        </Button>
      </div>
    );

  const { process, competencies, employee } = data;
  const current = step ?? process.stage;
  const Step = STEP_COMPONENTS[current];
  const stepIndex = STAGES.findIndex((s) => s.id === current);
  const meta = [employee?.position, employee?.unit ?? process.unit].filter(Boolean).join(" · ");

  const goTo = (stage: ProcessStage) => {
    setStep(stage);
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => document.getElementById("step-heading")?.focus());
  };

  return (
    <div className="flex min-h-screen">
      <div className="flex min-w-0 flex-1 flex-col gap-6 px-8 pb-12 pt-8">
        <header className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <nav aria-label="Okruszki" className="flex items-center gap-1.5 text-[13px] leading-[19px]">
              <Link href={ROUTES.dashboard} className="text-muted-foreground hover:text-foreground hover:underline">
                Pulpit
              </Link>
              <span aria-hidden className="text-faint-foreground">
                /
              </span>
              <span className="text-muted-foreground">{typeLabel(process.type, process.form)}</span>
            </nav>
            <h1 className="text-display">
              {employee?.full_name ?? process.employee_name ?? "Pracownik"}
            </h1>
            <p className="text-[13px] leading-[19px] text-muted-foreground">
              {meta && `${meta} · `}termin <Deadline iso={process.deadline} done={process.status === "completed"} />
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <StatusBadge status={process.status} />
            <Button
              variant="outline"
              aria-expanded={assistantOpen}
              aria-controls="assistant-panel"
              onClick={() => setAssistantOpen((open) => !open)}
            >
              {assistantOpen ? "Ukryj asystenta" : "Pokaż asystenta"}
            </Button>
          </div>
        </header>

        <Stepper
          current={current}
          reached={process.stage}
          completed={process.status === "completed"}
          onSelect={goTo}
        />

        <section aria-labelledby="step-heading" className="@container flex flex-col">
          <h2 id="step-heading" tabIndex={-1} className="sr-only">
            Krok {stepIndex + 1}. {STAGES[stepIndex].label}
          </h2>
          {/* Keyed by step so the entry animation replays on every step change. */}
          <div key={current} className="kk-step-in">
            <Step
              process={process}
              competencies={competencies}
              onProcess={(p) => setData({ ...data, process: p })}
              goTo={goTo}
            />
          </div>
        </section>
      </div>

      {assistantOpen && (
        <aside
          id="assistant-panel"
          aria-label="Asystent – zasady i przepisy"
          className="sticky top-0 flex h-screen shrink-0 flex-col gap-5 border-l bg-card px-5 pb-5 pt-6"
          style={{ width: "var(--kk-assistant-width)" }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-[17px] font-semibold leading-6 tracking-[-0.1px]">Asystent</h2>
              <p className="text-[13px] leading-[19px] text-muted-foreground">Zasady i wymagania formalne</p>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Zamknij asystenta" onClick={() => setAssistantOpen(false)}>
              <X absoluteStrokeWidth strokeWidth={1.6} aria-hidden className="!size-[18px]" />
            </Button>
          </div>
          <div className="min-h-0 flex-1">
            <AssistantChat processId={process.id} allowModeSwitch={false} compact />
          </div>
        </aside>
      )}
    </div>
  );
}
