import type { Competency, Process, ProcessStage } from "@/lib/api";

export interface StepProps {
  process: Process;
  competencies: Competency[];
  onProcess: (p: Process) => void;
  goTo: (stage: ProcessStage) => void;
}
