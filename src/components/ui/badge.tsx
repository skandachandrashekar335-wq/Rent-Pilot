import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "paid" | "pending" | "overdue" | "neutral" | "outline";
}

export function Badge({
  className,
  variant = "neutral",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide",
        variant === "paid" &&
          "bg-status-paid-bg text-status-paid-fg border border-status-paid-fg/20",
        variant === "pending" &&
          "bg-status-pending-bg text-status-pending-fg border border-status-pending-fg/20",
        variant === "overdue" &&
          "bg-status-overdue-bg text-status-overdue-fg border border-status-overdue-fg/20",
        variant === "neutral" &&
          "bg-surface-muted text-text-muted border border-border/40",
        variant === "outline" && "border border-border text-text-primary",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
