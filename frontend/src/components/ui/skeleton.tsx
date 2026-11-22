import * as React from "react";
import { cn } from "@/lib/utils";

/** shadcn-style placeholder block. Calm pulse, no shimmer gradient; static when the user prefers reduced motion. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-muted motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

/** Announces loading to assistive tech once, while the visual skeleton stays aria-hidden. */
function LoadingRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Thin indeterminate bar in the accent color (progress is one of the few places the brand color is used). */
function ProgressLine({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative h-0.5 overflow-hidden rounded-full bg-muted", className)}>
      <div className="kk-progress-line absolute inset-y-0 w-1/3 rounded-full bg-primary" />
    </div>
  );
}

/** Three softly bouncing dots, e.g. while the assistant searches its sources. */
function TypingDots({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex items-center gap-1", className)}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-bounce rounded-full bg-faint-foreground motion-reduce:animate-none"
          style={{ animationDelay: `${i * 140}ms` }}
        />
      ))}
    </span>
  );
}

export { Skeleton, LoadingRegion, ProgressLine, TypingDots };
