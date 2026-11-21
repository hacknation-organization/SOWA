import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva("rounded-lg border px-4 py-3.5 text-sm leading-[21px]", {
  variants: {
    variant: {
      default: "bg-card",
      info: "border-transparent bg-primary-soft text-foreground",
      warning: "border-transparent bg-warning-soft text-foreground",
      danger: "border-destructive/30 bg-danger-soft text-destructive",
      success: "border-success/30 bg-success-soft text-success",
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
  return <p className={cn("mb-1 font-bold", className)} {...props} />;
}

export { Alert, AlertTitle };
