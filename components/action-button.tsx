"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type ActionButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: React.ReactNode;
  variant?: "primary" | "soft";
};

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ children, icon, className, variant = "primary", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "w-full h-14 flex items-center justify-between px-6 text-base font-normal rounded-lg cursor-pointer transition-transform duration-200 active:translate-y-0.5 active:duration-0",
          variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
          variant === "soft" && "bg-primary/10 text-primary hover:bg-primary/15",
          props.disabled && "opacity-50 cursor-not-allowed",
          className,
        )}
        {...props}
      >
        <span>{children}</span>
        {icon && <span>{icon}</span>}
      </button>
    );
  }
);
ActionButton.displayName = "ActionButton";
