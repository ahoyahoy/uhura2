"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { idb } from "@/lib/idb";
import type { SyncData } from "./use-sync";

// ─── Rate Sentence ───────────────────────────────────────────────

export function useRateSentence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sentenceId, grade }: { sentenceId: string; grade: number }) => {
      const res = await fetch("/api/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentenceId, grade }),
      });
      if (!res.ok) throw new Error("Rate failed");
      return res.json();
    },
    onSuccess: (data) => {
      const progressEntry = {
        sentenceId: data.sentenceId,
        level: data.level,
        lastGrade: data.lastGrade,
        lastReviewedAt: data.lastReviewedAt,
        nextReviewAt: data.nextReviewAt,
        repetitions: data.repetitions,
      };

      // Update IDB
      idb.progress.put(progressEntry);

      // Update TQ cache
      queryClient.setQueryData<SyncData>(["sync"], (old) => {
        if (!old) return old;
        const idx = old.progress.findIndex((p) => p.sentenceId === data.sentenceId);
        const progress = [...old.progress];
        if (idx >= 0) {
          progress[idx] = progressEntry;
        } else {
          progress.push(progressEntry);
        }
        return { ...old, progress };
      });
    },
  });
}

// ─── Delete Topic ────────────────────────────────────────────────

export function useDeleteTopic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (topicId: string) => {
      const res = await fetch(`/api/topics/${topicId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      return topicId;
    },
    onSuccess: (topicId) => {
      // Remove from IDB
      idb.transaction("rw", [idb.topics, idb.sentences, idb.progress], async () => {
        const sentenceIds = await idb.sentences
          .where("topicId")
          .equals(topicId)
          .primaryKeys();
        if (sentenceIds.length > 0) await idb.progress.bulkDelete(sentenceIds);
        await idb.sentences.where("topicId").equals(topicId).delete();
        await idb.topics.delete(topicId);
      });

      // Update TQ cache
      queryClient.setQueryData<SyncData>(["sync"], (old) => {
        if (!old) return old;
        const deletedSentenceIds = new Set(
          old.sentences.filter((s) => s.topicId === topicId).map((s) => s.id)
        );
        return {
          ...old,
          topics: old.topics.filter((t) => t.id !== topicId),
          sentences: old.sentences.filter((s) => s.topicId !== topicId),
          progress: old.progress.filter((p) => !deletedSentenceIds.has(p.sentenceId)),
        };
      });
    },
  });
}

// ─── Create Topic ────────────────────────────────────────────────

export function useCreateTopic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: { description: string; level: string; classId: string }) => {
      const res = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Create topic failed");
      return res.json();
    },
    onSuccess: (data) => {
      const topicEntry = {
        id: data.topic.id,
        classId: data.topic.classId,
        title: data.topic.title,
        description: data.topic.description,
        level: data.topic.level,
        createdAt: typeof data.topic.createdAt === "string"
          ? data.topic.createdAt
          : new Date(data.topic.createdAt).toISOString(),
      };

      const sentenceEntries = (data.sentences ?? []).map((s: any) => ({
        id: s.id,
        topicId: s.topicId,
        sourceText: s.sourceText,
        targetText: s.targetText,
        createdAt: typeof s.createdAt === "string"
          ? s.createdAt
          : new Date(s.createdAt).toISOString(),
      }));

      // Write to IDB
      idb.topics.put(topicEntry);
      if (sentenceEntries.length > 0) idb.sentences.bulkPut(sentenceEntries);

      // Update TQ cache
      queryClient.setQueryData<SyncData>(["sync"], (old) => {
        if (!old) return old;
        return {
          ...old,
          topics: [topicEntry, ...old.topics],
          sentences: [...old.sentences, ...sentenceEntries],
        };
      });
    },
  });
}

// ─── Generate More Sentences ─────────────────────────────────────

export function useGenerateSentences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (topicId: string) => {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId }),
      });
      if (!res.ok) throw new Error("Generate failed");
      return res.json();
    },
    onSuccess: (data) => {
      const sentenceEntries = (data.sentences ?? []).map((s: any) => ({
        id: s.id,
        topicId: s.topicId,
        sourceText: s.sourceText,
        targetText: s.targetText,
        createdAt: typeof s.createdAt === "string"
          ? s.createdAt
          : new Date(s.createdAt).toISOString(),
      }));

      // Write to IDB
      if (sentenceEntries.length > 0) idb.sentences.bulkPut(sentenceEntries);

      // Update TQ cache
      queryClient.setQueryData<SyncData>(["sync"], (old) => {
        if (!old) return old;
        return { ...old, sentences: [...old.sentences, ...sentenceEntries] };
      });
    },
  });
}
