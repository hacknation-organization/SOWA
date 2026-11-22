"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { ICON } from "@/components/app-shell";
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
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Below 1280px the assistant is an overlay: Escape closes it, focus moves in and back out,
  // and the page behind it does not scroll. On desktop it is an ordinary side column.
  useEffect(() => {
    if (!assistantOpen) return;
    const overlay = window.matchMedia("(width < 80rem)");
    if (!overlay.matches) return;
    const toggle = toggleRef.current;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAssistantOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      toggle?.focus();
    };
  }, [assistantOpen]);

  if (loading && !data) return <WizardSkeleton />;
  if (error || !data)
    return (
      <div className="flex flex-col items-start gap-4 page-x py-6 lg:py-8">
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
      <div className="flex min-w-0 flex-1 flex-col gap-5 page-x pb-12 pt-6 lg:gap-6 lg:px-8 lg:pt-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
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
            <h1 className="text-display break-words">
              {employee?.full_name ?? process.employee_name ?? "Pracownik"}
            </h1>
            <p className="text-[13px] leading-[19px] text-muted-foreground">
              {meta && `${meta} · `}termin <Deadline iso={process.deadline} done={process.status === "completed"} />
            </p>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-start">
            <StatusBadge status={process.status} />
            <Button
              ref={toggleRef}
              variant="outline"
              aria-expanded={assistantOpen}
              aria-controls="assistant-panel"
              onClick={() => setAssistantOpen((open) => !open)}
            >
              <MessageSquare {...ICON} />
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
        <div
          aria-hidden
          className="kk-fade-in fixed inset-0 z-40 bg-foreground/25 xl:hidden"
          onClick={() => setAssistantOpen(false)}
        />
      )}
      {assistantOpen && (
        // Desktop (1280px+): side column next to the step. Smaller screens: a sheet over the page,
        // full screen on phones and 400px wide from the right on tablets.
        <aside
          id="assistant-panel"
          aria-label="Asystent – zasady i przepisy"
          className="kk-slide-in-right fixed inset-0 z-50 flex h-dvh flex-col gap-5 bg-card px-4 pb-4 pt-5 sm:left-auto sm:w-[400px] sm:border-l sm:px-5 sm:pb-5 sm:pt-6 xl:sticky xl:top-0 xl:z-auto xl:h-screen xl:w-[var(--kk-assistant-width)] xl:shrink-0"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-[17px] font-semibold leading-6 tracking-[-0.1px]">Asystent</h2>
              <p className="text-[13px] leading-[19px] text-muted-foreground">Zasady i wymagania formalne</p>
            </div>
            <Button
              ref={closeRef}
              variant="ghost"
              size="icon-sm"
              aria-label="Zamknij asystenta"
              onClick={() => setAssistantOpen(false)}
            >
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
