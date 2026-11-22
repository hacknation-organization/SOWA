import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva("rounded-lg px-4 py-3 text-[13px] leading-[19px]", {
  variants: {
    variant: {
      default: "border bg-card",
      info: "bg-muted text-muted-foreground",
      warning: "bg-warning-soft text-warning",
      danger: "bg-danger-soft text-destructive",
      success: "bg-primary-soft text-primary",
    },
  },
  defaultVariants: { variant: "default" },
});

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div role="status" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("mb-1 font-medium", className)} {...props} />;
}

export { Alert, AlertTitle };
