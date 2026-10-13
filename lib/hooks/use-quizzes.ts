"use client";

import { useQuery } from "@tanstack/react-query";
import type { QuizDetail, QuizRecord } from "@/lib/quiz-types";

export function useQuizzes(classId: string | null) {
  return useQuery<{ quizzes: QuizRecord[] }>({
    queryKey: ["quizzes", classId],
    enabled: Boolean(classId),
    queryFn: async () => {
      const res = await fetch(`/api/quizzes?classId=${encodeURIComponent(classId!)}`);
      if (!res.ok) throw new Error("Could not load quizzes");
      return res.json();
    },
  });
}

export function useQuizDetail(id: string) {
  return useQuery<QuizDetail>({
    queryKey: ["quiz", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await fetch(`/api/quizzes/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error("Could not load this quiz");
      return res.json();
    },
  });
}
