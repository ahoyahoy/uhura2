"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { getLanguageLabel } from "@/lib/languages";
import { useSync } from "@/lib/hooks/use-sync";
import Link from "next/link";
import { FloatingBackButton, floatingIconButtonClassName } from "@/components/floating-back-button";

export default function ClassesPage() {
  const router = useRouter();
  const { data, isLoading } = useSync();

  // Sort classes by most recent practice activity (lastReviewedAt in progress)
  const sortedClasses = useMemo(() => {
    if (!data) return [];

    // Build classId → max lastReviewedAt map
    const topicToClass = new Map<string, string | null>();
    for (const t of data.topics) topicToClass.set(t.id, t.classId);

    const sentenceToTopic = new Map<string, string>();
    for (const s of data.sentences) sentenceToTopic.set(s.id, s.topicId);

    const classLastActivity = new Map<string, number>();
    for (const p of data.progress) {
      if (!p.lastReviewedAt) continue;
      const topicId = sentenceToTopic.get(p.sentenceId);
      if (!topicId) continue;
      const classId = topicToClass.get(topicId);
      if (!classId) continue;
      const ts = new Date(p.lastReviewedAt).getTime();
      const current = classLastActivity.get(classId) ?? 0;
      if (ts > current) classLastActivity.set(classId, ts);
    }

    return [...data.classes].sort((a, b) => {
      const aTs = classLastActivity.get(a.id) ?? 0;
      const bTs = classLastActivity.get(b.id) ?? 0;
      if (bTs !== aTs) return bTs - aTs; // most recent first
      return a.id.localeCompare(b.id); // stable tiebreaker
    });
  }, [data]);

  // No courses → redirect to new course page
  const dataReady = !isLoading && data !== undefined;
  const noClasses = dataReady && sortedClasses.length === 0;
  useEffect(() => {
    if (noClasses) {
      router.replace("/classes/new");
    }
  }, [noClasses, router]);

  if (!dataReady || sortedClasses.length === 0) {
    return (
      <>
        <FloatingBackButton href="/home" label="Back to home" />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col justify-center min-h-svh p-8 space-y-4">
      <FloatingBackButton href="/home" label="Back to home" />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30">
        <div className="mx-auto flex w-full max-w-2xl justify-end px-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
          <Link
            href="/classes/new"
            aria-label="New class"
            className={floatingIconButtonClassName}
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </div>
      {sortedClasses.map((c) => (
        <div
          key={c.id}
          className="cursor-pointer transition-transform duration-200 active:translate-y-0.5 active:duration-0"
          onClick={() => {
            localStorage.setItem("lastClassId", c.id);
            router.push(`/home`);
          }}
        >
          <span className="text-4xl font-normal">{getLanguageLabel(c.targetLanguage)}</span>
          <span className="text-lg text-muted-foreground ml-3">{getLanguageLabel(c.sourceLanguage)}</span>
        </div>
      ))}
    </div>
  );
}
