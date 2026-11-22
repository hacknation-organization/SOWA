import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Visual radio indicator for card-style choices; the real <input> stays visually hidden. */
export function RadioDot({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-[18px] shrink-0 items-center justify-center rounded-full bg-card",
        checked ? "border-[1.5px] border-primary" : "border border-border-strong",
        className,
      )}
    >
      {checked && <span className="size-2 rounded-full bg-primary" />}
    </span>
  );
}

/** Visual checkbox indicator for card-style choices. */
export function CheckSquare({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-[18px] shrink-0 items-center justify-center rounded-sm",
        checked ? "bg-primary text-primary-foreground" : "border border-border-strong bg-card",
        className,
      )}
    >
      {checked && <Check absoluteStrokeWidth strokeWidth={2} className="size-3" />}
    </span>
  );
}

/** Filled circle with a check mark, used for completed items. */
export function CheckDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-[18px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground",
        className,
      )}
    >
      <Check absoluteStrokeWidth strokeWidth={2} className="size-[11px]" />
    </span>
  );
}
