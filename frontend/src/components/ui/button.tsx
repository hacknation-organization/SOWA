import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Figma "Przycisk": Główny = the one main action per view, Drugorzędny = helper actions,
// Tekstowy = low-weight actions (Anuluj, Pomiń).
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        destructive: "bg-destructive text-primary-foreground hover:bg-destructive/90",
        outline: "border border-border-strong bg-card text-foreground hover:bg-subtle",
        secondary: "bg-muted text-foreground hover:bg-border",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        link: "px-0 text-muted-foreground hover:text-foreground",
      },
      size: {
        default: "h-[39px] px-4",
        sm: "h-8 px-3 text-[13px]",
        lg: "h-11 px-5",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    compoundVariants: [{ variant: "ghost", size: "default", className: "px-2.5" }],
    defaultVariants: { variant: "default", size: "default" },
  },
);

// React 19 passes `ref` as a regular prop, so including it here is enough to forward it.
export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
