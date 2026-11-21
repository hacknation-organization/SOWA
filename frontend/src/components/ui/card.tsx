import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("rounded-xl bg-card text-card-foreground shadow-card", className)} {...props} />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 p-6 pb-3", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("text-base font-black", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-6 pt-3", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-2 p-6 pt-0", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
