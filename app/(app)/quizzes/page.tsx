"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { FloatingBackButton } from "@/components/floating-back-button";
import { FloatingBar } from "@/components/floating-bar";
import { ActionButton } from "@/components/action-button";
import { useStoredString, setStoredString } from "@/lib/hooks/use-stored-string";
import { useSync } from "@/lib/hooks/use-sync";
import { useQuizzes } from "@/lib/hooks/use-quizzes";
import { getLanguageLabel } from "@/lib/languages";

export default function QuizzesPage() {
  return <Suspense fallback={<div className="flex flex-1 items-center justify-center"><Loader2 className="animate-spin" /></div>}><QuizzesContent /></Suspense>;
}

function QuizzesContent() {
  const params = useSearchParams();
  const { data: sync, isLoading: loadingClasses } = useSync();
  const lastClassId = useStoredString("lastClassId", null);
  const [chosen, setChosen] = useState<string | null>(null);
  const candidate = chosen ?? params.get("classId") ?? lastClassId;
  const course = sync?.classes.find((item) => item.id === candidate) ?? sync?.classes[0];
  const { data, isLoading, isError, refetch } = useQuizzes(course?.id ?? null);

  return <>
    <FloatingBackButton href="/home" label="Back to home" />
    <div className="w-full max-w-2xl mx-auto min-h-svh p-6 pt-22 pb-40">
      <h1 className="text-4xl font-normal mb-8">Quizzes</h1>
      {course && <label className="block mb-8 text-xs text-muted-foreground">
        Course
        <select className="mt-2 block w-full rounded-xl border border-border/50 bg-card px-4 py-3 text-sm text-foreground"
          value={course.id} onChange={(event) => { setChosen(event.target.value); setStoredString("lastClassId", event.target.value); }}>
          {sync?.classes.map((item) => <option key={item.id} value={item.id}>
            {getLanguageLabel(item.sourceLanguage)} → {getLanguageLabel(item.targetLanguage)}
          </option>)}
        </select>
      </label>}
      {(loadingClasses || isLoading) && <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>}
      {isError && <button className="text-sm text-muted-foreground underline" onClick={() => void refetch()}>Try again</button>}
      {!loadingClasses && !isLoading && !isError && data?.quizzes.length === 0 &&
        <p className="py-12 text-center text-muted-foreground">No quizzes yet. Create one to start practicing.</p>}
      <div className="space-y-3">
        {data?.quizzes.map((item) => <Link key={item.id} href={`/quizzes/${item.id}`}
          className="block rounded-2xl border border-border/50 bg-card p-5 transition-colors hover:bg-primary/5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg leading-snug">{item.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{getLanguageLabel(item.questionLanguage)} → {getLanguageLabel(item.answerLanguage)} · {item.level}</p>
            </div>
            <span className="shrink-0 text-sm text-muted-foreground">{item.dueCount}/{item.questionCount}</span>
          </div>
        </Link>)}
      </div>
    </div>
    <FloatingBar>
      <Link href={course ? `/quizzes/new?classId=${course.id}` : "/classes"}>
        <ActionButton variant="soft" icon={<ArrowUpRight className="h-5 w-5" />}>New quiz</ActionButton>
      </Link>
    </FloatingBar>
  </>;
}
