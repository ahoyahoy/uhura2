"use client";

import { cn } from "@/lib/utils";

export function FloatingBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="!m-0 fixed bottom-0 left-0 right-0 z-10 px-8 py-4 pb-22 bg-[var(--background)]/70 backdrop-blur-sm">
      <div className={cn("w-full max-w-2xl mx-auto space-y-2", className)}>
        {children}
      </div>
    </div>
  );
}
