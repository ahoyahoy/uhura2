"use client";

import { useMemo } from "react";
import { useSync } from "./use-sync";

export type TopicWithCounts = {
  id: string;
  classId: string | null;
  title: string;
  description: string;
  level: string;
  createdAt: string;
  totalSentences: number;
  dueSentences: number;
};

export function useTopicsWithCounts(classId: string) {
  const { data, isLoading } = useSync();

  const topicsWithCounts = useMemo((): TopicWithCounts[] => {
    if (!data) return [];
    const now = new Date();

    return data.topics
      .filter((t) => t.classId === classId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((t) => {
        const topicSentences = data.sentences.filter((s) => s.topicId === t.id);
        const totalSentences = topicSentences.length;

        const dueSentences = topicSentences.filter((s) => {
          const p = data.progress.find((p) => p.sentenceId === s.id);
          if (!p) return true;
          return new Date(p.nextReviewAt) <= now;
        }).length;

        return { ...t, totalSentences, dueSentences };
      });
  }, [data, classId]);

  return { topicsWithCounts, isLoading };
}
