"use client";

import { cn } from "@/lib/utils";

export function FloatingBar({
  children,
  className,
  compact = false,
}: {
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn(
      "!m-0 fixed bottom-0 left-0 right-0 z-10 px-6 py-4 bg-[var(--background)]/70 backdrop-blur-sm",
      compact ? "pb-[max(1.5rem,env(safe-area-inset-bottom))]" : "pb-22",
    )}>
      <div className={cn("w-full max-w-[43rem] mx-auto space-y-2", className)}>
        {children}
      </div>
    </div>
  );
}
