import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const fieldBase =
  "flex w-full rounded-md border border-input bg-card text-sm text-foreground transition-colors placeholder:text-faint-foreground hover:border-faint-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive";

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-[43px] px-3", className)} {...props} />;
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "min-h-24 p-3 leading-[21px]", className)} {...props} />;
}

function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative w-full">
      <select className={cn(fieldBase, "h-[43px] appearance-none pl-3 pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        aria-hidden
        absoluteStrokeWidth
        strokeWidth={1.6}
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-[13px] font-medium leading-[19px]", className)} {...props} />;
}

/** Muted inline hint next to a label, e.g. "opcjonalnie". */
function LabelHint({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("ml-1.5 text-xs font-normal text-faint-foreground", className)} {...props} />;
}

export { Input, Textarea, Select, Label, LabelHint };
