import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Figma "Etykieta statusu": Neutralny = information, Akcent = approved/positive, Ostrzeżenie = needs attention.
// Always carries text — status is never conveyed by color alone.
const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-[6px] px-2 py-0.5 text-xs font-medium leading-4",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        accent: "bg-primary-soft text-primary",
        warning: "bg-warning-soft text-warning",
        danger: "bg-danger-soft text-destructive",
        outline: "border bg-card text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
