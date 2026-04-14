"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { idb, type IDBClass, type IDBTopic, type IDBSentence, type IDBProgress } from "@/lib/idb";

export type SyncData = {
  classes: IDBClass[];
  topics: IDBTopic[];
  sentences: IDBSentence[];
  progress: IDBProgress[];
};

function toISOString(val: unknown): string {
  if (typeof val === "string") return val;
  if (val instanceof Date) return val.toISOString();
  return new Date(val as any).toISOString();
}

async function fetchAndPersist(): Promise<SyncData> {
  const res = await fetch("/api/sync");
  if (!res.ok) throw new Error("Sync failed");
  const data = await res.json();

  const classes: IDBClass[] = data.classes.map((c: any) => ({
    id: c.id,
    sourceLanguage: c.sourceLanguage,
    targetLanguage: c.targetLanguage,
    createdAt: toISOString(c.createdAt),
  }));

  // Filter out soft-deleted topics, persist only active
  const liveTopics: IDBTopic[] = data.topics
    .filter((t: any) => !t.deletedAt)
    .map((t: any) => ({
      id: t.id,
      classId: t.classId,
      title: t.title,
      description: t.description,
      level: t.level,
      createdAt: toISOString(t.createdAt),
    }));

  const sentences: IDBSentence[] = data.sentences.map((s: any) => ({
    id: s.id,
    topicId: s.topicId,
    sourceText: s.sourceText,
    targetText: s.targetText,
    createdAt: toISOString(s.createdAt),
  }));

  const progress: IDBProgress[] = data.progress.map((p: any) => ({
    sentenceId: p.sentenceId,
    level: p.level,
    lastGrade: p.lastGrade,
    lastReviewedAt: p.lastReviewedAt ? toISOString(p.lastReviewedAt) : null,
    nextReviewAt: toISOString(p.nextReviewAt),
    repetitions: p.repetitions,
  }));

  // Full replace in IDB
  await idb.transaction("rw", [idb.classes, idb.topics, idb.sentences, idb.progress], async () => {
    await idb.classes.clear();
    await idb.topics.clear();
    await idb.sentences.clear();
    await idb.progress.clear();
    if (classes.length > 0) await idb.classes.bulkPut(classes);
    if (liveTopics.length > 0) await idb.topics.bulkPut(liveTopics);
    if (sentences.length > 0) await idb.sentences.bulkPut(sentences);
    if (progress.length > 0) await idb.progress.bulkPut(progress);
  });

  return { classes, topics: liveTopics, sentences, progress };
}

export function useSync() {
  const queryClient = useQueryClient();

  return useQuery<SyncData>({
    queryKey: ["sync"],
    queryFn: async () => {
      // Step 1: If TQ cache already has data, this is a refetch → go to API
      const existing = queryClient.getQueryData<SyncData>(["sync"]);
      if (existing) {
        return fetchAndPersist();
      }

      // Step 2: Try IDB
      const [classes, topics, sentences, progress] = await Promise.all([
        idb.classes.toArray(),
        idb.topics.toArray(),
        idb.sentences.toArray(),
        idb.progress.toArray(),
      ]);

      if (topics.length > 0 || classes.length > 0) {
        // IDB has data → return immediately, schedule background refetch
        setTimeout(() => queryClient.invalidateQueries({ queryKey: ["sync"] }), 1);
        return { classes, topics, sentences, progress };
      }

      // Step 3: IDB empty → full fetch
      return fetchAndPersist();
    },
  });
}
