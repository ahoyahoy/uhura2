"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { idb, type IDBClass, type IDBTopic, type IDBSentence, type IDBProgress } from "@/lib/idb";

export type SyncData = {
  classes: IDBClass[];
  topics: IDBTopic[];
  sentences: IDBSentence[];
  progress: IDBProgress[];
};

type ApiClass = Omit<IDBClass, "createdAt"> & { createdAt: string | number };
type ApiTopic = Omit<IDBTopic, "createdAt"> & { createdAt: string | number; deletedAt: string | null };
type ApiSentence = Omit<IDBSentence, "createdAt"> & { createdAt: string | number };
type ApiProgress = Omit<IDBProgress, "lastReviewedAt" | "nextReviewAt"> & {
  lastReviewedAt: string | number | null;
  nextReviewAt: string | number;
};

function toISOString(val: unknown): string {
  if (typeof val === "string") return val;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "number") return new Date(val).toISOString();
  throw new Error("Invalid timestamp from sync API");
}

async function fetchAndPersist(): Promise<SyncData> {
  const res = await fetch("/api/sync");
  if (!res.ok) throw new Error("Sync failed");
  const data = await res.json() as {
    classes: ApiClass[]; topics: ApiTopic[]; sentences: ApiSentence[]; progress: ApiProgress[];
  };

  const classes: IDBClass[] = data.classes.map((c) => ({
    id: c.id,
    sourceLanguage: c.sourceLanguage,
    targetLanguage: c.targetLanguage,
    createdAt: toISOString(c.createdAt),
  }));

  // Filter out soft-deleted topics, persist only active
  const liveTopics: IDBTopic[] = data.topics
    .filter((t) => !t.deletedAt)
    .map((t) => ({
      id: t.id,
      classId: t.classId,
      title: t.title,
      description: t.description,
      level: t.level,
      goalKind: t.goalKind,
      focus: t.focus,
      practiceStyle: t.practiceStyle,
      register: t.register,
      voiceIds: t.voiceIds,
      createdAt: toISOString(t.createdAt),
    }));

  const sentences: IDBSentence[] = data.sentences.map((s) => ({
    id: s.id,
    topicId: s.topicId,
    sourceText: s.sourceText,
    targetText: s.targetText,
    createdAt: toISOString(s.createdAt),
  }));

  const progress: IDBProgress[] = data.progress.map((p) => ({
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
