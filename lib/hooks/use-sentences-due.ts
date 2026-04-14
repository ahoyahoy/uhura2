"use client";

import { useMemo } from "react";
import { useSync } from "./use-sync";
import { weightedShuffle } from "@/lib/spaced-repetition";
import type { InputSentence } from "@/lib/session-engine";

export function useSentencesDue(topicIds: string[]) {
  const { data, isLoading } = useSync();

  const sentences = useMemo((): InputSentence[] => {
    if (!data || topicIds.length === 0) return [];
    const now = new Date();
    const topicIdSet = new Set(topicIds);

    // Build a map for fast progress lookup
    const progressMap = new Map(data.progress.map((p) => [p.sentenceId, p]));
    // Build a map for fast topic lookup
    const topicMap = new Map(data.topics.map((t) => [t.id, t]));

    const due = data.sentences
      .filter((s) => topicIdSet.has(s.topicId))
      .filter((s) => {
        const p = progressMap.get(s.id);
        if (!p) return true;
        return new Date(p.nextReviewAt) <= now;
      })
      .map((s) => {
        const topic = topicMap.get(s.topicId);
        const p = progressMap.get(s.id);
        return {
          id: s.id,
          sourceText: s.sourceText,
          targetText: s.targetText,
          topicTitle: topic?.title ?? "",
          lastReviewedAt: p?.nextReviewAt ?? null,
          level: p?.level ?? 0,
          progress: p ? { level: p.level, lastGrade: p.lastGrade } : null,
        };
      });

    // Apply weighted shuffle (same algo as server used to do)
    const shuffled = weightedShuffle(due);

    // Strip fields that SessionEngine doesn't need
    return shuffled.map(({ lastReviewedAt, level, ...rest }) => rest);
  }, [data, topicIds]);

  return { sentences, isLoading };
}
