import { Badge } from "@/components/ui/badge";
import { STAGES, STATUS_LABELS, type ProcessStage, type ProcessStatus } from "@/lib/api";
import { daysUntil, formatDate } from "@/lib/utils";

const STATUS_VARIANT = {
  not_started: "muted",
  in_progress: "default",
  completed: "success",
  overdue: "danger",
} as const;

const URGENT_DAYS = 7;

export function StatusBadge({ status }: { status: ProcessStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function stageLabel(stage: ProcessStage): string {
  const idx = STAGES.findIndex((s) => s.id === stage);
  return `${idx + 1}/${STAGES.length} ${STAGES[idx]?.label ?? stage}`;
}

export function Deadline({ iso, done }: { iso?: string; done?: boolean }) {
  const days = daysUntil(iso);
  let note = "";
  if (!done && days != null) {
    if (days < 0) note = ` (${Math.abs(days)} dni po terminie)`;
    else if (days <= URGENT_DAYS) note = ` (za ${days} dni)`;
  }
  const urgent = !done && days != null && days <= URGENT_DAYS;
  return (
    <span className={urgent ? "font-medium text-destructive" : undefined}>
      {formatDate(iso)}
      {note}
    </span>
  );
}
