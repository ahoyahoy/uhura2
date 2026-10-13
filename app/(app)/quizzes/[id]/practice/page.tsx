"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight, Loader2, Volume2 } from "lucide-react";
import { FloatingBackButton } from "@/components/floating-back-button";
import { FloatingBar } from "@/components/floating-bar";
import { ActionButton } from "@/components/action-button";
import { useQuizDetail } from "@/lib/hooks/use-quizzes";
import { getQuizAudioUrl } from "@/lib/audio-cache";
import { voiceVolume } from "@/lib/voice-volume";
import { SessionEngine, type SessionSentence } from "@/lib/session-engine";
import { weightedShuffle } from "@/lib/spaced-repetition";
import type { QuizDetail } from "@/lib/quiz-types";

type AudioState = "loading" | "playing" | "ready";

export default function QuizPracticePage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuizDetail(id);
  const engineRef = useRef(new SessionEngine());
  const initializedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioRequestRef = useRef(0);
  const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittingRef = useRef(false);
  const [current, setCurrent] = useState<SessionSentence | null>(null);
  const [ready, setReady] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [initialCount, setInitialCount] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answerSaved, setAnswerSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [audioState, setAudioState] = useState<AudioState>("loading");

  const questions = useMemo(() => new Map(data?.questions.map((item) => [item.id, item]) ?? []), [data?.questions]);
  const question = current ? questions.get(current.id) : undefined;
  const correct = question && selectedIndex !== null ? selectedIndex === question.answerIndex : false;

  useEffect(() => {
    if (!data || initializedRef.current) return;
    initializedRef.current = true;
    const due = dueQuestions(data);
    const engine = engineRef.current;
    engine.init(due.map((item) => ({ id: item.question.id, sourceText: item.question.prompt,
      targetText: data.quiz.options[item.question.answerIndex], voiceId: data.quiz.voiceId,
      topicTitle: data.quiz.title, progress: item.progress })));
    setInitialCount(engine.initialCount);
    setRemaining(engine.remaining);
    setCurrent(engine.getNext());
    setReady(true);
  }, [data]);

  useEffect(() => {
    const requestCounter = audioRequestRef;
    return () => {
      requestCounter.current++;
      if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
      audioRef.current?.pause();
    };
  }, []);

  const currentId = current?.id;
  const voiceId = data?.quiz.voiceId;
  useEffect(() => {
    if (!currentId || !voiceId) return;
    const request = ++audioRequestRef.current;
    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;
    audio.pause();
    setAudioState("loading");
    void getQuizAudioUrl(currentId).then(async (url) => {
      if (request !== audioRequestRef.current) return;
      audio.src = url;
      audio.currentTime = 0;
      audio.volume = voiceVolume(voiceId);
      audio.onended = () => { if (request === audioRequestRef.current) setAudioState("ready"); };
      await audio.play();
      if (request === audioRequestRef.current) setAudioState("playing");
    }).catch(() => { if (request === audioRequestRef.current) setAudioState("ready"); });
    return () => { audio.pause(); };
  }, [currentId, voiceId]);

  async function replay() {
    if (!currentId || !voiceId) return;
    const request = ++audioRequestRef.current;
    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;
    audio.pause();
    setAudioState("loading");
    try {
      audio.src = await getQuizAudioUrl(currentId);
      if (request !== audioRequestRef.current) return;
      audio.currentTime = 0;
      audio.volume = voiceVolume(voiceId);
      audio.onended = () => { if (request === audioRequestRef.current) setAudioState("ready"); };
      await audio.play();
      if (request === audioRequestRef.current) setAudioState("playing");
    } catch { if (request === audioRequestRef.current) setAudioState("ready"); }
  }

  function advance(preselected?: SessionSentence | null) {
    audioRequestRef.current++;
    audioRef.current?.pause();
    setSelectedIndex(null);
    setAnswerSaved(false);
    setSaveFailed(false);
    submittingRef.current = false;
    const engine = engineRef.current;
    setCurrent(preselected === undefined ? engine.getNext() : preselected);
    setRemaining(engine.remaining);
  }

  async function submit(index: number) {
    if (!current || !question || !data || submittingRef.current || answerSaved) return;
    submittingRef.current = true;
    setSelectedIndex(index);
    setSaveFailed(false);
    const started = performance.now();
    try {
      const res = await fetch(`/api/quizzes/${id}/answer`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, selectedIndex: index }) });
      if (!res.ok) throw new Error("Answer not saved");
      const result = await res.json() as { correct: boolean; progress: { level: number; lastGrade: string | null; lastReviewedAt: string; nextReviewAt: string; repetitions: number } };
      const engine = engineRef.current;
      engine.evaluate(question.id, result.correct ? (current.repeatCount > 0 ? 2 : 1) : 5);
      setRemaining(engine.remaining);
      setAnswerSaved(true);
      queryClient.setQueryData<QuizDetail>(["quiz", id], (old) => {
        if (!old) return old;
        return { ...old, progress: [...old.progress.filter((item) => item.questionId !== question.id),
          { questionId: question.id, ...result.progress }] };
      });
      void queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      if (result.correct) {
        const next = engine.getNext();
        if (next) void getQuizAudioUrl(next.id).catch(() => {});
        nextTimerRef.current = setTimeout(() => advance(next), Math.max(0, 1000 - (performance.now() - started)));
      } else submittingRef.current = false;
    } catch {
      setSaveFailed(true);
      submittingRef.current = false;
    }
  }

  const backUrl = `/quizzes/${id}`;
  if (isLoading || !ready && !isError) return <>
    <FloatingBackButton href={backUrl} label="Back to quiz" />
    <div className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  </>;
  if (isError || !data) return <>
    <FloatingBackButton href={backUrl} label="Back to quiz" />
    <div className="flex flex-1 items-center justify-center"><button onClick={() => void refetch()} className="text-sm underline">Try again</button></div>
  </>;
  if (!current || !question) return <div className="w-full max-w-2xl mx-auto min-h-svh p-6 pb-40 flex flex-col">
    <FloatingBackButton href={backUrl} label="Back to quiz" />
    <h1 className="mt-auto text-4xl font-normal">{initialCount ? "All done for today" : "Nothing to practice right now"}</h1>
    <FloatingBar><Link href={backUrl}><ActionButton icon={<ArrowRight className="h-5 w-5" />}>Finish</ActionButton></Link></FloatingBar>
  </div>;

  return <div className="w-full max-w-2xl mx-auto min-h-svh p-6 pt-22 pb-48">
    <FloatingBackButton href={backUrl} label="Back to quiz" />
    <div className="flex items-center justify-between gap-4 mb-8">
      <p className="min-w-0 truncate text-xs text-muted-foreground">{data.quiz.title}</p>
      <span className="shrink-0 text-xs text-muted-foreground">{initialCount - remaining} done · {remaining} left</span>
    </div>
    <div className="flex items-start gap-4 mb-8">
      <h1 className="flex-1 text-2xl leading-snug font-normal">{question.prompt}</h1>
      <button type="button" aria-label={audioState === "playing" ? "Replay question" : "Play question"}
        onClick={() => void replay()} disabled={audioState === "loading"}
        className={`shrink-0 flex h-11 w-11 items-center justify-center rounded-full border border-border/50 bg-card ${audioState === "playing" ? "text-primary" : "text-foreground"}`}>
        {audioState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
      </button>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {data.quiz.options.map((option, index) => {
        const markedCorrect = selectedIndex !== null && index === question.answerIndex;
        const markedWrong = selectedIndex === index && !correct;
        return <button key={index} type="button" onClick={() => void submit(index)}
          disabled={selectedIndex !== null}
          className={`min-h-20 rounded-2xl border px-5 py-4 text-left text-base transition-colors ${markedCorrect
            ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            : markedWrong ? "border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300"
            : "border-border/50 bg-card text-foreground hover:bg-primary/5"}`}>
          {option}
        </button>;
      })}
    </div>
    {selectedIndex !== null && !correct && <div className="mt-6 space-y-2" role="status">
      <p className="text-sm">{data.quiz.options[question.answerIndex]}</p>
      <p className="text-sm text-muted-foreground">{question.example}</p>
      <p className="text-sm text-muted-foreground">{question.explanation}</p>
    </div>}
    {saveFailed && <p className="mt-6 text-xs text-muted-foreground" role="status">Tap below to keep your progress.</p>}
    {selectedIndex !== null && (!correct || saveFailed) && <FloatingBar>
      <ActionButton onClick={() => saveFailed ? void submit(selectedIndex) : advance()} disabled={!answerSaved && !saveFailed}
        icon={answerSaved ? <ArrowRight className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}>
        {saveFailed ? "Save and continue" : answerSaved ? "Continue" : "Saving…"}
      </ActionButton>
    </FloatingBar>}
  </div>;
}

function dueQuestions(data: QuizDetail) {
  const progress = new Map(data.progress.map((item) => [item.questionId, item]));
  const now = Date.now();
  const due = data.questions.filter((item) => !progress.has(item.id) || new Date(progress.get(item.id)!.nextReviewAt).getTime() <= now)
    .map((question) => ({ question, lastReviewedAt: progress.get(question.id)?.lastReviewedAt ?? null,
      level: progress.get(question.id)?.level ?? 0,
      progress: progress.has(question.id) ? { level: progress.get(question.id)!.level,
        lastGrade: progress.get(question.id)!.lastGrade } : null }));
  return weightedShuffle(due);
}
