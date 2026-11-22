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
    <Card className={cn("flex flex-col gap-6 p-7", className)}>
      <div className="flex flex-col gap-1.5">
        {/* The page owns the accessible step heading; this one is visual only. */}
        <div className="flex items-center gap-2.5" aria-hidden>
          <span className="text-[21px] font-semibold leading-7 tracking-[-0.2px]">{STAGES[idx]?.label}</span>
          {tag}
        </div>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

/** Footer: divider, then secondary action(s) on the left and the main action on the right. */
export function StepActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-px bg-border" />
      <div className="flex flex-wrap items-center gap-2.5">{children}</div>
    </div>
  );
}
