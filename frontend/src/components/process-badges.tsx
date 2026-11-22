import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  STAGES,
  STATUS_LABELS,
  TYPE_LABELS,
  type FormType,
  type ProcessStage,
  type ProcessStatus,
  type ProcessType,
} from "@/lib/api";
import { cn, daysUntil, formatDate } from "@/lib/utils";

const STATUS_VARIANT = {
  not_started: "default",
  in_progress: "default",
  completed: "accent",
  overdue: "warning",
} as const;

export function StatusBadge({ status }: { status: ProcessStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function stageIndex(stage: ProcessStage): number {
  return STAGES.findIndex((s) => s.id === stage);
}

export function stageLabel(stage: ProcessStage): string {
  const idx = stageIndex(stage);
  return `${idx + 1}/${STAGES.length} ${STAGES[idx]?.label ?? stage}`;
}

/** "Pierwsza ocena · Arkusz A" / "Ocena okresowa · Arkusz C". */
export function typeLabel(type: ProcessType, form: FormType | null): string {
  const sheet = type === "first" ? "A" : form;
  return sheet ? `${TYPE_LABELS[type]} · Arkusz ${sheet}` : TYPE_LABELS[type];
}

/** Six segments: finished steps solid, the current one light, the rest neutral. */
export function StageSegments({ stage, done }: { stage: ProcessStage; done?: boolean }) {
  const current = done ? STAGES.length : stageIndex(stage);
  return (
    <div className="flex gap-1" aria-hidden>
      {STAGES.map((s, i) => (
        <span
          key={s.id}
          className={cn(
            "h-1 w-8 rounded-[2px]",
            i < current ? "bg-primary" : i === current ? "bg-primary-border" : "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

export function relativeDeadline(iso?: string | null, done?: boolean): { text: string; overdue: boolean } | null {
  const days = daysUntil(iso);
  if (done || days == null) return null;
  if (days < 0) return { text: `${Math.abs(days)} dni po terminie`, overdue: true };
  return { text: days === 0 ? "dziś" : `za ${days} dni`, overdue: false };
}

/** Inline deadline, e.g. in the wizard header: "21.12.2026 (za 30 dni)". */
export function Deadline({ iso, done }: { iso?: string; done?: boolean }) {
  const rel = relativeDeadline(iso, done);
  return (
    <span>
      {formatDate(iso)}
      {iso && rel && <span className={cn(rel.overdue && "text-warning")}> ({rel.text})</span>}
    </span>
  );
}

/** Stacked deadline block with a label, clock icon and relative note. */
export function DeadlineBlock({ iso, done }: { iso?: string; done?: boolean }) {
  const rel = relativeDeadline(iso, done);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-faint-foreground">Termin</span>
      <span className="flex items-center gap-1.5 text-[13px] font-medium">
        <Clock aria-hidden absoluteStrokeWidth strokeWidth={1.6} className="size-3.5" />
        {formatDate(iso)}
      </span>
      {rel && (
        <span className={cn("text-xs", rel.overdue ? "font-medium text-warning" : "text-faint-foreground")}>
          {rel.text}
        </span>
      )}
    </div>
  );
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .replace(/\(.*\)/, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toLocaleUpperCase("pl-PL"))
    .join("");
}

export function Avatar({
  name,
  tone = "neutral",
  className,
}: {
  name?: string | null;
  tone?: "neutral" | "accent";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium",
        tone === "accent" ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
