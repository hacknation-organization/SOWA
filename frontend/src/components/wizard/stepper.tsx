import { Fragment } from "react";
import { Check, ChevronRight } from "lucide-react";
import { STAGES, type ProcessStage } from "@/lib/api";
import { cn } from "@/lib/utils";

export function Stepper({
  current,
  reached,
  completed,
  onSelect,
}: {
  current: ProcessStage;
  reached: ProcessStage;
  completed?: boolean;
  onSelect: (s: ProcessStage) => void;
}) {
  const reachedIdx = STAGES.findIndex((s) => s.id === reached);
  const currentIdx = STAGES.findIndex((s) => s.id === current);
  return (
    // Container query: when the column is too narrow for all labels, only the current step keeps its label.
    <nav aria-label="Kroki oceny" className="@container rounded-xl bg-card px-5 py-4 shadow-card">
      <ol className="flex items-center justify-between gap-1">
        {STAGES.map((s, i) => {
          const isCurrent = i === currentIdx;
          const available = i <= reachedIdx;
          const done = !isCurrent && (i < reachedIdx || (completed && i <= reachedIdx));
          return (
            <Fragment key={s.id}>
              {i > 0 && (
                <li aria-hidden className="text-muted-foreground">
                  <ChevronRight absoluteStrokeWidth strokeWidth={2} className="size-3.5" />
                </li>
              )}
              <li>
                <button
                  type="button"
                  disabled={!available}
                  aria-current={isCurrent ? "step" : undefined}
                  title={s.label}
                  onClick={() => onSelect(s.id)}
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-md py-0.5 text-[13px] transition-colors disabled:cursor-not-allowed",
                    available && !isCurrent && "hover:bg-muted",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-[22px] items-center justify-center rounded-full text-[11px]",
                      isCurrent || done
                        ? "bg-primary font-black text-primary-foreground"
                        : "border-[1.5px] border-border-strong bg-card font-bold text-muted-foreground",
                    )}
                  >
                    {done ? <Check absoluteStrokeWidth strokeWidth={2.5} className="size-3" /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      isCurrent ? "font-black text-primary" : done ? "font-bold" : "font-bold text-muted-foreground",
                      !isCurrent && "@max-[50rem]:sr-only",
                    )}
                  >
                    {s.label}
                    {done && <span className="sr-only"> (gotowe)</span>}
                  </span>
                </button>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
