import { STAGES, type ProcessStage } from "@/lib/api";
import { cn } from "@/lib/utils";

export function Stepper({
  current,
  reached,
  onSelect,
}: {
  current: ProcessStage;
  reached: ProcessStage;
  onSelect: (s: ProcessStage) => void;
}) {
  const reachedIdx = STAGES.findIndex((s) => s.id === reached);
  return (
    <nav aria-label="Kroki oceny" className="mt-4">
      <ol className="flex gap-1">
        {STAGES.map((s, i) => {
          const isCurrent = s.id === current;
          const available = i <= reachedIdx;
          const done = i < reachedIdx;
          return (
            <li key={s.id} className="flex-1">
              <button
                type="button"
                disabled={!available}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => onSelect(s.id)}
                className={cn(
                  "w-full border-b-4 px-1 pb-2 pt-1 text-left text-sm disabled:cursor-not-allowed disabled:text-muted-foreground",
                  isCurrent ? "border-primary font-semibold" : done ? "border-border-strong" : "border-border",
                  available && !isCurrent && "hover:bg-muted",
                )}
              >
                <span className="block text-xs text-muted-foreground">
                  Krok {i + 1}
                  {done ? " · gotowe" : ""}
                </span>
                {s.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
