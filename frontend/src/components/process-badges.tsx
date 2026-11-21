import { Badge } from "@/components/ui/badge";
import {
  STAGES,
  STATUS_LABELS,
  type FormType,
  type ProcessStage,
  type ProcessStatus,
  type ProcessType,
} from "@/lib/api";
import { cn, daysUntil, formatDate } from "@/lib/utils";

const STATUS_VARIANT = {
  not_started: "outline",
  in_progress: "default",
  completed: "default",
  overdue: "danger",
} as const;

export function StatusBadge({ status }: { status: ProcessStatus }) {
  return (
    <Badge size="md" variant={STATUS_VARIANT[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function stageIndex(stage: ProcessStage): number {
  return STAGES.findIndex((s) => s.id === stage);
}

export function stageLabel(stage: ProcessStage): string {
  const idx = stageIndex(stage);
  return `${idx + 1}/${STAGES.length} ${STAGES[idx]?.label ?? stage}`;
}

/** Six-segment progress bar with the "3/6 Ocena zachowań" caption below it. */
export function StageProgress({ stage, done }: { stage: ProcessStage; done?: boolean }) {
  const reached = done ? STAGES.length : stageIndex(stage) + 1;
  const idx = stageIndex(stage);
  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex gap-1"
        role="img"
        aria-label={`Etap ${reached} z ${STAGES.length}: ${STAGES[idx]?.label ?? stage}`}
      >
        {STAGES.map((s, i) => (
          <span
            key={s.id}
            className={cn("h-1 w-5 rounded-[3px]", i < reached ? "bg-brand-gradient" : "bg-border")}
          />
        ))}
      </div>
      <p className="flex gap-1.5 text-[13px]" aria-hidden>
        <span className="font-black text-primary">
          {reached}/{STAGES.length}
        </span>
        <span>{STAGES[idx]?.label ?? stage}</span>
      </p>
    </div>
  );
}

const URGENT_DAYS = 7;

/** Deadline date with a short relative note ("za 30 dni", "3 dni po terminie"). */
export function Deadline({ iso, done, stacked }: { iso?: string; done?: boolean; stacked?: boolean }) {
  const days = daysUntil(iso);
  let note: string | null = null;
  let tone = "text-primary-bright";
  if (done) {
    note = "zakończona";
    tone = "text-muted-foreground font-medium";
  } else if (days != null) {
    if (days < 0) {
      note = `${Math.abs(days)} dni po terminie`;
      tone = "text-destructive";
    } else {
      note = days === 0 ? "dziś" : `za ${days} dni`;
      if (days <= URGENT_DAYS) tone = "text-destructive";
    }
  }
  if (!stacked) {
    return (
      <span>
        {formatDate(iso)}
        {iso && note && !done ? <span className={cn("font-bold", tone)}> ({note})</span> : null}
      </span>
    );
  }
  return (
    <span className="flex flex-col gap-[3px]">
      <span className="text-sm font-bold">{formatDate(iso)}</span>
      {iso && note && <span className={cn("text-xs font-bold", tone)}>{note}</span>}
    </span>
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
  tone = "soft",
  className,
}: {
  name?: string | null;
  tone?: "soft" | "solid" | "neutral";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-[38px] shrink-0 items-center justify-center rounded-full text-[13px] font-black",
        tone === "soft" && "bg-primary-soft text-primary",
        tone === "solid" && "bg-primary text-primary-foreground",
        tone === "neutral" && "bg-secondary text-foreground",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/** Small square tag with the sheet letter: A for the first assessment, B/C for periodic ones. */
export function FormTag({ type, form }: { type: ProcessType; form: FormType | null }) {
  const letter = type === "first" ? "A" : form;
  if (!letter) return null;
  return (
    <span
      className="inline-flex rounded-sm bg-primary-soft px-1.5 py-px text-[11px] font-black text-primary"
      title={`Arkusz ${letter}`}
    >
      {letter}
    </span>
  );
}
