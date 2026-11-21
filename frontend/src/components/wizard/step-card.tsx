import { Card } from "@/components/ui/card";
import { STAGES, type ProcessStage } from "@/lib/api";
import { cn } from "@/lib/utils";

/** White card wrapping one wizard step, with the numbered step title from the design. */
export function StepCard({
  stage,
  description,
  className,
  children,
}: {
  stage: ProcessStage;
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const idx = STAGES.findIndex((s) => s.id === stage);
  return (
    <Card className={cn("flex flex-col gap-5 p-7", className)}>
      {/* The page owns the accessible step heading; this one is visual only. */}
      <div className="flex flex-col gap-1.5" aria-hidden>
        <div className="flex items-center gap-2.5">
          <span className="flex size-[30px] items-center justify-center rounded-md bg-primary-soft text-sm font-black text-primary">
            {idx + 1}
          </span>
          <span className="text-xl font-black">{STAGES[idx]?.label}</span>
        </div>
      </div>
      {description && (
        <p className="-mt-3.5 text-sm font-medium leading-[21px] text-muted-foreground">{description}</p>
      )}
      {children}
    </Card>
  );
}

/** Footer row: secondary action on the left, primary action on the right. */
export function StepActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2.5 pt-1.5">{children}</div>;
}
