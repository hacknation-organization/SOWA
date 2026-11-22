import { Card } from "@/components/ui/card";
import { STAGES, type ProcessStage } from "@/lib/api";
import { cn } from "@/lib/utils";

/** White card wrapping one wizard step: title, optional tag and description, then the content. */
export function StepCard({
  stage,
  description,
  tag,
  className,
  children,
}: {
  stage: ProcessStage;
  description?: React.ReactNode;
  tag?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const idx = STAGES.findIndex((s) => s.id === stage);
  return (
    <Card className={cn("flex flex-col gap-6 p-5 sm:p-7", className)}>
      <div className="flex flex-col gap-1.5">
        {/* The page owns the accessible step heading; this one is visual only. */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1" aria-hidden>
          <span className="text-[21px] font-semibold leading-7 tracking-[-0.2px]">{STAGES[idx]?.label}</span>
          {tag}
        </div>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

/**
 * Classes for a step footer row. Desktop: secondary action(s) on the left, the main action on the right.
 * Phones: full-width buttons stacked with the main action (written last) on top; long labels may wrap.
 */
export const STEP_ACTIONS_ROW =
  "flex flex-col-reverse gap-2.5 sm:flex-row sm:flex-wrap sm:items-center max-sm:[&>a]:h-auto max-sm:[&>a]:min-h-[39px] max-sm:[&>a]:whitespace-normal max-sm:[&>button]:h-auto max-sm:[&>button]:min-h-[39px] max-sm:[&>button]:whitespace-normal max-sm:[&>button]:py-2";

/** Footer: divider, then the action row. */
export function StepActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-px bg-border" />
      <div className={STEP_ACTIONS_ROW}>{children}</div>
    </div>
  );
}
