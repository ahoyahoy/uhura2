"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { FloatingBackButton } from "@/components/floating-back-button";
import { FloatingBar } from "@/components/floating-bar";
import { ActionButton } from "@/components/action-button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useQuizDetail } from "@/lib/hooks/use-quizzes";
import { getLanguageLabel } from "@/lib/languages";
import { quizQuestionOptions } from "@/lib/quiz-types";

export default function QuizDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuizDetail(id);
  const [dialog, setDialog] = useState<"generate" | "remove" | "verbForms" | null>(null);
  const [pending, setPending] = useState(false);
  const [generationFailed, setGenerationFailed] = useState(false);
  const [cloneFailed, setCloneFailed] = useState(false);
  const dueCount = useMemo(() => {
    if (!data) return 0;
    const progress = new Map(data.progress.map((item) => [item.questionId, item]));
    const now = Date.now();
    return data.questions.filter((item) => !progress.has(item.id) || new Date(progress.get(item.id)!.nextReviewAt).getTime() <= now).length;
  }, [data]);

  async function generateMore() {
    if (pending) return;
    setDialog(null);
    setPending(true);
    setGenerationFailed(false);
    try {
      const res = await fetch(`/api/quizzes/${id}/generate`, { method: "POST" });
      if (!res.ok) throw new Error("Generation failed");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["quiz", id] }),
        queryClient.invalidateQueries({ queryKey: ["quizzes"] }),
      ]);
    } catch { setGenerationFailed(true); }
    finally { setPending(false); }
  }

  async function removeQuiz() {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch(`/api/quizzes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Remove failed");
      await queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      router.replace("/quizzes");
    } catch { setPending(false); setDialog(null); }
  }

  async function createVerbFormsQuiz() {
    if (pending) return;
    setDialog(null);
    setPending(true);
    setCloneFailed(false);
    try {
      const res = await fetch(`/api/quizzes/${id}/verb-forms`, { method: "POST" });
      if (!res.ok) throw new Error("Could not make the quiz");
      const result = await res.json() as { quiz: { id: string } };
      await queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      router.push(`/quizzes/${result.quiz.id}`);
    } catch { setCloneFailed(true); setPending(false); }
  }

  return <>
    <FloatingBackButton href="/quizzes" label="Back to quizzes" />
    <div className="w-full max-w-2xl mx-auto min-h-svh p-6 pt-22 pb-48">
      {(isLoading || !data && !isError) && <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>}
      {isError && <button onClick={() => void refetch()} className="text-sm text-muted-foreground underline">Try again</button>}
      {data && <>
        <h1 className="text-3xl font-normal leading-tight">{data.quiz.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{data.quiz.description}</p>
        <p className="mt-4 text-xs text-muted-foreground">{getLanguageLabel(data.quiz.questionLanguage)} → {getLanguageLabel(data.quiz.answerLanguage)} · {data.quiz.level} · {dueCount} ready / {data.questions.length} questions</p>
        <div className="mt-10 space-y-3">
          {data.questions.map((item, index) => <div key={item.id} className="rounded-2xl border border-border/50 bg-card p-5">
            <p className="text-xs text-muted-foreground">{index + 1}</p>
            <p className="mt-2 text-base">{item.prompt}</p>
            <p className="mt-3 text-sm text-primary">{quizQuestionOptions(data.quiz, item)[item.answerIndex]}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.example}</p>
          </div>)}
        </div>
      </>}
    </div>
    {data && <FloatingBar compact className="space-y-3">
      <Link href={`/quizzes/${id}/practice`} aria-disabled={dueCount === 0} className={dueCount === 0 ? "pointer-events-none opacity-50" : ""}>
        <ActionButton disabled={dueCount === 0} icon={<ArrowRight className="h-5 w-5" />}>Start practicing {dueCount}</ActionButton>
      </Link>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {data.quiz.mode === "tense_family" && <>
          <button onClick={() => setDialog("verbForms")} disabled={pending} className="hover:text-foreground">
            {cloneFailed ? "Try verb forms again" : "Practice verb forms"}
          </button>
          <span>·</span>
        </>}
        <button onClick={() => setDialog("generate")} disabled={pending} className="hover:text-foreground">
          {pending ? "Generating…" : generationFailed ? "Try again" : "Generate more"}
        </button>
        <span>·</span>
        <button onClick={() => setDialog("remove")} disabled={pending} className="hover:text-foreground">Remove</button>
      </div>
    </FloatingBar>}
    <ConfirmDialog open={dialog === "generate"} title="Add more questions?"
      description="Add fresh questions using this quiz’s goal, languages and answer choices."
      confirmLabel="Generate more" onCancel={() => setDialog(null)} onConfirm={() => void generateMore()} />
    <ConfirmDialog open={dialog === "verbForms"} title="Practice the verb forms?"
      description="Make a new quiz from these situations. Choose the English verb form in each question."
      confirmLabel="Create quiz" onCancel={() => setDialog(null)} onConfirm={() => void createVerbFormsQuiz()} />
    <ConfirmDialog open={dialog === "remove"} title="Remove this quiz?"
      description="This quiz will disappear from your list, including its practice history."
      confirmLabel="Remove quiz" destructive pending={pending}
      onCancel={() => setDialog(null)} onConfirm={() => void removeQuiz()} />
  </>;
}
