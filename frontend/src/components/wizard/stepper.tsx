import { Fragment } from "react";
import { Check } from "lucide-react";
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
  const isDone = (i: number) => i !== currentIdx && (i < reachedIdx || (!!completed && i <= reachedIdx));
  return (
    // Container query: when the column is too narrow for all labels, only the current step keeps its label.
    <nav aria-label="Kroki oceny" className="@container rounded-xl border bg-card px-3.5 py-3 sm:px-5 sm:py-3.5">
      <ol className="flex items-center gap-1.5 @[30rem]:gap-2.5">
        {STAGES.map((s, i) => {
          const isCurrent = i === currentIdx;
          const available = i <= reachedIdx;
          const done = isDone(i);
          return (
            <Fragment key={s.id}>
              {i > 0 && (
                <li
                  aria-hidden
                  className={cn(
                    "h-px min-w-0 flex-1 transition-colors duration-300 motion-reduce:transition-none",
                    isDone(i - 1) ? "bg-primary-border" : "bg-border",
                  )}
                />
              )}
              <li>
                <button
                  type="button"
                  disabled={!available}
                  aria-current={isCurrent ? "step" : undefined}
                  title={s.label}
                  onClick={() => onSelect(s.id)}
                  className={cn(
                    // The pseudo-element enlarges the touch target around the small step circle.
                    "relative flex items-center whitespace-nowrap rounded-md text-[13px] leading-[19px] transition-colors after:absolute after:-inset-2 after:content-[''] disabled:cursor-not-allowed",
                    available && !isCurrent && "hover:text-foreground",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-[22px] shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors duration-300 motion-reduce:transition-none",
                      done && "bg-primary text-primary-foreground",
                      isCurrent && "border-[1.5px] border-primary bg-card text-primary",
                      !done && !isCurrent && "border border-border-strong bg-card text-faint-foreground",
                    )}
                  >
                    {done ? <Check absoluteStrokeWidth strokeWidth={2} className="size-3" /> : i + 1}
                  </span>
                  {/* In a narrow column only the current step keeps its label. The label collapses by animating
                      its grid track (0fr <-> 1fr), so neighbours and connectors resize smoothly; the text stays
                      in the accessibility tree because nothing is display:none. */}
                  <span
                    className={cn(
                      "grid grid-cols-[1fr] opacity-100 transition-[grid-template-columns,opacity,color] duration-300 ease-out motion-reduce:transition-none",
                      isCurrent && "font-medium text-foreground",
                      done && "text-muted-foreground",
                      !done && !isCurrent && "text-faint-foreground",
                      !isCurrent && "@max-[46rem]:grid-cols-[0fr] @max-[46rem]:opacity-0",
                      // Phones: circles only; the current step is named in the caption below.
                      "@max-[30rem]:grid-cols-[0fr] @max-[30rem]:opacity-0",
                    )}
                  >
                    <span className="relative overflow-hidden">
                      <span className="block pl-2">
                        {s.label}
                        {done && <span className="sr-only"> (gotowe)</span>}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            </Fragment>
          );
        })}
      </ol>
      <p aria-hidden className="mt-2.5 hidden text-[13px] leading-[19px] @max-[30rem]:block">
        <span className="text-faint-foreground">
          Krok {currentIdx + 1} z {STAGES.length} ·{" "}
        </span>
        <span className="font-medium">{STAGES[currentIdx]?.label}</span>
      </p>
    </nav>
  );
}
