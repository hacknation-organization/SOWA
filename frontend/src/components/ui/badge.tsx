import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-bold", {
  variants: {
    variant: {
      default: "bg-primary-soft text-primary",
      solid: "bg-primary text-primary-foreground",
      onSoft: "bg-card text-primary",
      outline: "border bg-muted text-muted-foreground",
      success: "bg-success-soft text-success",
      warning: "bg-warning-soft text-warning",
      danger: "bg-danger-soft text-destructive",
      muted: "bg-secondary text-muted-foreground",
    },
    size: {
      sm: "px-2 py-0.5 text-[11px]",
      md: "px-3 py-[5px] text-xs",
    },
  },
  defaultVariants: { variant: "default", size: "sm" },
});

function Badge({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
