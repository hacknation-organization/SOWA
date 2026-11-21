import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva("rounded-md border px-4 py-3 text-sm", {
  variants: {
    variant: {
      default: "bg-card",
      info: "border-transparent bg-primary-soft",
      warning: "border-warning/40 bg-warning-soft text-warning",
      danger: "border-destructive/40 bg-danger-soft text-destructive",
      success: "border-success/40 bg-success-soft text-success",
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
  return <p className={cn("mb-1 font-semibold", className)} {...props} />;
}

export { Alert, AlertTitle };
