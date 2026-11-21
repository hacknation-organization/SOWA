"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PanelRight } from "lucide-react";
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
import { competencyDisplayName } from "@/lib/domain";
import { ROUTES } from "@/lib/routes";
import { useApi } from "@/lib/use-api";

const WIDE_SCREEN_MIN_WIDTH = 1440;

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

  useEffect(() => {
    if (window.innerWidth >= WIDE_SCREEN_MIN_WIDTH) setAssistantOpen(true);
  }, []);

  if (loading && !data) return <p className="px-10 py-8 text-muted-foreground">Ładowanie oceny…</p>;
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
      <div className="flex min-w-0 flex-1 flex-col gap-6 px-10 pb-12 pt-7">
        <header className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[13px]">
            <Link href={ROUTES.dashboard} className="font-bold text-primary hover:underline">
              Pulpit
            </Link>
            <span aria-hidden className="text-faint-foreground">
              /
            </span>
            <span className="font-medium text-muted-foreground">
              {TYPE_LABELS[process.type]}
              {process.form ? ` – arkusz ${process.form}` : ""}
            </span>
            <span className="flex-1" />
            <StatusBadge status={process.status} />
            <Button
              variant="surface"
              size="sm"
              aria-expanded={assistantOpen}
              aria-controls="assistant-panel"
              onClick={() => setAssistantOpen((open) => !open)}
            >
              <PanelRight absoluteStrokeWidth strokeWidth={2} aria-hidden />
              {assistantOpen ? "Ukryj asystenta" : "Pokaż asystenta"}
            </Button>
          </div>
          <h1 className="text-[26px] font-black leading-8">
            {employee?.full_name ?? process.employee_name ?? "Pracownik"}
          </h1>
          <p className="text-sm font-medium text-muted-foreground">
            {meta && `${meta} · `}termin: <Deadline iso={process.deadline} done={process.status === "completed"} />
          </p>
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
          className="sticky top-0 flex h-screen shrink-0 flex-col gap-[18px] border-l bg-card px-6 pb-6 pt-7"
          style={{ width: "var(--kk-assistant-width)" }}
        >
          <div className="flex flex-col gap-0.5">
            <h2 className="text-lg font-black">Asystent</h2>
            <p className="text-xs font-medium text-muted-foreground">Zasady i wymagania formalne</p>
          </div>
          <div className="min-h-0 flex-1">
            <AssistantChat processId={process.id} allowModeSwitch={false} compact />
          </div>
        </aside>
      )}
    </div>
  );
}
