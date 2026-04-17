"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ChevronDown } from "lucide-react";
import { useSync } from "@/lib/hooks/use-sync";
import { useSession } from "@/lib/auth-client";
import { getLanguageFlag, getLanguageLabel } from "@/lib/languages";
import { getGreeting } from "@/lib/greetings";
import Link from "next/link";

export default function HomePage() {
  const router = useRouter();
  const { data, isLoading } = useSync();
  const { data: session } = useSession();
  const [classId, setClassId] = useState<string | null>(null);

  useEffect(() => {
    setClassId(localStorage.getItem("lastClassId"));
  }, []);

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
          {session?.user?.image ? (
            <img
              src={session.user.image}
              alt=""
              className="h-9 w-9 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-primary/10" />
          )}
        </div>
        {cls && (
          <Link
            href="/classes"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm transition-transform duration-200 active:translate-y-0.5 active:duration-0"
          >
            <span>{getLanguageLabel(cls.targetLanguage)}</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </Link>
        )}
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
