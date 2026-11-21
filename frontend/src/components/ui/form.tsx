import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const fieldBase =
  "flex w-full rounded-lg border border-input bg-card text-sm font-medium text-foreground transition-colors placeholder:text-faint-foreground hover:border-primary-light focus-visible:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50";

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-11 px-3.5", className)} {...props} />;
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "min-h-24 px-3.5 py-3 leading-5", className)} {...props} />;
}

function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative w-full">
      <select className={cn(fieldBase, "h-11 appearance-none pl-3.5 pr-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        aria-hidden
        absoluteStrokeWidth
        strokeWidth={2}
        className="pointer-events-none absolute right-3.5 top-1/2 size-[18px] -translate-y-1/2 text-foreground"
      />
    </div>
  );
}

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-sm font-bold leading-none", className)} {...props} />;
}

export { Input, Textarea, Select, Label };
