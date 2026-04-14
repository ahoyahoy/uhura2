"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { getLanguageLabel, getLanguageFlag } from "@/lib/languages";
import { useSync } from "@/lib/hooks/use-sync";
import Link from "next/link";

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
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Courses</h1>
        <div className="flex items-center gap-2">
          <Link href="/classes/new">
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              New Course
            </Button>
          </Link>
          <SignOutButton />
        </div>
      </div>

      <div className="space-y-2">
        {sortedClasses.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 px-4 py-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
            onClick={() => {
              localStorage.setItem("lastClassId", c.id);
              router.push(`/classes/${c.id}`);
            }}
          >
            <span className="text-lg">
              {getLanguageFlag(c.sourceLanguage)}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="text-lg">
              {getLanguageFlag(c.targetLanguage)}
            </span>
            <span className="flex-1 font-medium">
              {getLanguageLabel(c.sourceLanguage)} → {getLanguageLabel(c.targetLanguage)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
