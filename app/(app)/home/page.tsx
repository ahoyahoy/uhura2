"use client";

import { useMemo } from "react";
import { Loader2, ChevronDown, Download } from "lucide-react";
import { useSync } from "@/lib/hooks/use-sync";
import { getLanguageLabel } from "@/lib/languages";
import { useStoredString } from "@/lib/hooks/use-stored-string";
import { getGreeting } from "@/lib/greetings";
import Link from "next/link";
import { usePwaInstall } from "@/components/pwa-install-provider";

export default function HomePage() {
  const { data, isLoading } = useSync();
  const classId = useStoredString("lastClassId", null);
  const { canInstall, isInstalled, install } = usePwaInstall();

  const cls = data?.classes.find((c) => c.id === classId) ?? data?.classes[0];

  const greeting = useMemo(() => {
    if (!cls) return "";
    return getGreeting(cls.targetLanguage);
  }, [cls]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-svh p-8 pt-16">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-normal text-muted-foreground">{greeting}</h1>
          <div className="h-9 w-9 shrink-0" aria-hidden="true" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cls && (
            <Link
              href="/classes"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm transition-transform duration-200 active:translate-y-0.5 active:duration-0"
            >
              <span>{getLanguageLabel(cls.targetLanguage)}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </Link>
          )}
          {!isInstalled && (canInstall ? (
            <button
              type="button"
              onClick={() => void install()}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-card px-4 py-2 text-sm text-foreground transition-colors hover:bg-primary/10"
            >
              <Download className="h-4 w-4" />
              Install Uhura
            </button>
          ) : (
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm text-foreground transition-colors hover:bg-primary/10"
            >
              <Download className="h-4 w-4" />
              How to install
            </Link>
          ))}
        </div>
      </div>

      <nav className="mt-auto space-y-4 pb-8">
        <Link
          href={cls ? `/classes/${cls.id}` : "/classes"}
          className="block text-5xl font-normal tracking-[-0.05em] text-foreground hover:text-primary transition-colors"
        >
          Sentences
        </Link>
        <Link
          href="#"
          className="block text-5xl font-normal tracking-[-0.05em] text-muted-foreground/40"
        >
          Articles
        </Link>
        <Link
          href="#"
          className="block text-5xl font-normal tracking-[-0.05em] text-muted-foreground/40"
        >
          Stats
        </Link>
      </nav>
    </div>
  );
}
