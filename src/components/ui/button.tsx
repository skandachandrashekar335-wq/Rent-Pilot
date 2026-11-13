import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "destructive" | "ghost";
  size?: "sm" | "default" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "default", disabled, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all duration-150 select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary",
          "active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed",
          // Responsive touch target: minimum 44px (h-11) on mobile (<640px)
          size === "default" && "h-11 sm:h-9 px-4 text-sm rounded-md",
          size === "sm" && "h-11 sm:h-8 px-3 text-xs rounded-md",
          size === "lg" && "h-12 sm:h-11 px-6 text-base rounded-md",
          size === "icon" && "h-11 w-11 sm:h-9 sm:w-9 rounded-md",
          // Variants
          variant === "primary" &&
            "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
          variant === "secondary" &&
            "bg-surface-muted text-text-primary hover:bg-surface-hover border border-border/40",
          variant === "outline" &&
            "border border-border bg-transparent text-text-primary hover:bg-surface-hover",
          variant === "destructive" &&
            "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
          variant === "ghost" &&
            "bg-transparent text-text-primary hover:bg-surface-hover",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
