"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { FloatingBackButton } from "@/components/floating-back-button";
import { FloatingBar } from "@/components/floating-bar";
import { ActionButton } from "@/components/action-button";
import { useSync } from "@/lib/hooks/use-sync";
import { useStoredString } from "@/lib/hooks/use-stored-string";
import { LANGUAGES, getLanguageLabel } from "@/lib/languages";
import { VOICES } from "@/lib/voice-catalog";
import { voiceName } from "@/lib/voice-names";
import { DEFAULT_VOICE_ID } from "@/lib/voices";
import { tenseOptions, type QuizMode } from "@/lib/quiz-config";

const DEFAULT_DESCRIPTION = "Recognize which of the four English tense families best expresses the situation. Use short natural examples with clear time or result clues, varied everyday contexts, and all four answer types.";
const FORM_DESCRIPTION = "Choose the natural English verb form for each situation. Compare four forms of the same subject and verb; learn how time, duration and result determine the answer.";

export default function NewQuizPage() {
  return <Suspense fallback={<div className="flex flex-1 items-center justify-center"><Loader2 className="animate-spin" /></div>}><NewQuizContent /></Suspense>;
}

function NewQuizContent() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const { data: sync } = useSync();
  const lastClassId = useStoredString("lastClassId", null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const candidate = selectedClassId ?? params.get("classId") ?? lastClassId;
  const course = sync?.classes.find((item) => item.id === candidate) ?? sync?.classes[0];
  const [mode, setMode] = useState<QuizMode>("tense_family");
  const [title, setTitle] = useState("Recognize English tense families");
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
  const [level, setLevel] = useState("B1");
  const [questionLanguageDraft, setQuestionLanguageDraft] = useState<string | null>(null);
  const questionLanguage = questionLanguageDraft ?? course?.sourceLanguage ?? "cs";
  const [answerLanguage, setAnswerLanguage] = useState("en");
  const [customOptions, setCustomOptions] = useState(["", "", "", ""]);
  const [voiceId, setVoiceId] = useState<string>(DEFAULT_VOICE_ID);
  const [isCreating, setIsCreating] = useState(false);
  const [failed, setFailed] = useState(false);
  const options = mode === "tense_family" ? tenseOptions(answerLanguage) ?? []
    : mode === "tense_form" ? [] : customOptions.map((value) => value.trim()).filter(Boolean);
  const valid = Boolean(course && title.trim().length >= 3 && description.trim().length >= 10 &&
    (mode === "tense_form" || options.length >= 2) &&
    new Set(options.map((value) => value.toLowerCase())).size === options.length &&
    (mode !== "custom" || customOptions.every((value) => value.trim().length > 0)));

  async function createQuiz() {
    if (!valid || !course || isCreating) return;
    setIsCreating(true);
    setFailed(false);
    try {
      const res = await fetch("/api/quizzes", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: course.id, mode, title, description, level, questionLanguage, answerLanguage, options, voiceId }) });
      if (!res.ok) throw new Error("Quiz generation failed");
      const data = await res.json() as { quiz: { id: string } };
      await queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      router.replace(`/quizzes/${data.quiz.id}`);
    } catch {
      setFailed(true);
      setIsCreating(false);
    }
  }

  return <>
    <FloatingBackButton href="/quizzes" label="Back to quizzes" />
    <div className="w-full max-w-2xl mx-auto min-h-svh p-6 pt-22 pb-44 space-y-6">
      <h1 className="text-4xl font-normal">New quiz</h1>
      <label className="block text-xs text-muted-foreground">Course
        <select className="mt-2 block w-full rounded-xl border border-border/50 bg-card px-4 py-3 text-sm text-foreground" value={course?.id ?? ""}
          onChange={(event) => setSelectedClassId(event.target.value)}>
          {sync?.classes.map((item) => <option key={item.id} value={item.id}>{getLanguageLabel(item.sourceLanguage)} → {getLanguageLabel(item.targetLanguage)}</option>)}
        </select>
      </label>
      <div>
        <p className="mb-2 text-xs text-muted-foreground">Quiz type</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={mode === "tense_family"} onClick={() => { setMode("tense_family"); setTitle("Recognize English tense families"); setDescription(DEFAULT_DESCRIPTION); if (!tenseOptions(answerLanguage)) setAnswerLanguage("en"); }}
            className={`rounded-full px-4 py-2 text-sm ${mode === "tense_family" ? "bg-primary text-primary-foreground" : "bg-card"}`}>English tense families</button>
          <button type="button" aria-pressed={mode === "tense_form"} onClick={() => { setMode("tense_form"); setTitle("Choose the English verb form"); setDescription(FORM_DESCRIPTION); setAnswerLanguage("en"); }}
            className={`rounded-full px-4 py-2 text-sm ${mode === "tense_form" ? "bg-primary text-primary-foreground" : "bg-card"}`}>English verb forms</button>
          <button type="button" aria-pressed={mode === "custom"} onClick={() => { setMode("custom"); setTitle(""); setDescription(""); }}
            className={`rounded-full px-4 py-2 text-sm ${mode === "custom" ? "bg-primary text-primary-foreground" : "bg-card"}`}>Custom answers</button>
        </div>
      </div>
      <label className="block text-xs text-muted-foreground">Name
        <input aria-label="Quiz name" maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)}
          className="mt-2 block w-full rounded-xl border border-border/50 bg-card px-4 py-3 text-sm text-foreground" />
      </label>
      <label className="block text-xs text-muted-foreground">What should the questions teach?
        <textarea aria-label="Quiz goal" maxLength={600} rows={4} value={description} onChange={(event) => setDescription(event.target.value)}
          className="mt-2 block w-full resize-y rounded-xl border border-border/50 bg-card px-4 py-3 text-sm text-foreground" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-muted-foreground">Question language
          <select value={questionLanguage} onChange={(event) => setQuestionLanguageDraft(event.target.value)}
            className="mt-2 block w-full rounded-xl border border-border/50 bg-card px-3 py-3 text-sm text-foreground">
            {LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">Answer language
          <select value={answerLanguage} disabled={mode === "tense_form"} onChange={(event) => setAnswerLanguage(event.target.value)}
            className="mt-2 block w-full rounded-xl border border-border/50 bg-card px-3 py-3 text-sm text-foreground">
            {(mode === "tense_family" ? LANGUAGES.filter((language) => tenseOptions(language.code))
              : mode === "tense_form" ? LANGUAGES.filter((language) => language.code === "en") : LANGUAGES)
              .map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
          </select>
        </label>
      </div>
      <div>
        <p className="mb-2 text-xs text-muted-foreground">Answer choices · shown while the question is read</p>
        {mode === "tense_form" ? <p className="rounded-xl border border-border/50 bg-card px-4 py-3 text-sm text-muted-foreground">
          Each question gets four forms of the same verb, such as “I work / I’m working / I’ve worked / I’ve been working”.
        </p> : mode === "tense_family" ? <div className="grid grid-cols-2 gap-2">
          {options.map((value) => <div key={value} className="rounded-xl border border-border/50 bg-card px-4 py-3 text-sm">{value}</div>)}
        </div> : <div className="space-y-2">
          {customOptions.map((value, index) => <input key={index} aria-label={`Answer choice ${index + 1}`} maxLength={80}
            value={value} onChange={(event) => setCustomOptions((previous) => previous.map((old, i) => i === index ? event.target.value : old))}
            className="w-full rounded-xl border border-border/50 bg-card px-4 py-3 text-sm" placeholder={`Choice ${index + 1}`} />)}
          <div className="flex gap-4 text-xs text-muted-foreground">
            <button type="button" disabled={customOptions.length >= 6} onClick={() => setCustomOptions((old) => [...old, ""])}>Add choice</button>
            <button type="button" disabled={customOptions.length <= 2} onClick={() => setCustomOptions((old) => old.slice(0, -1))}>Remove last</button>
          </div>
        </div>}
      </div>
      <div>
        <p className="mb-2 text-xs text-muted-foreground">Level</p>
        <div className="flex flex-wrap gap-2">{["A1", "A2", "B1", "B2", "C1", "C2"].map((value) =>
          <button key={value} type="button" aria-pressed={level === value} onClick={() => setLevel(value)}
            className={`rounded-full px-3 py-1.5 text-xs ${level === value ? "bg-primary text-primary-foreground" : "bg-card"}`}>{value}</button>)}</div>
      </div>
      <label className="block text-xs text-muted-foreground">Question voice
        <select value={voiceId} onChange={(event) => setVoiceId(event.target.value)}
          className="mt-2 block w-full rounded-xl border border-border/50 bg-card px-4 py-3 text-sm text-foreground">
          {VOICES.map((voice) => <option key={voice.id} value={voice.id}>{voiceName(voice.id, questionLanguage)}</option>)}
        </select>
      </label>
    </div>
    <FloatingBar>
      <ActionButton onClick={() => void createQuiz()} disabled={!valid || isCreating}
        icon={isCreating ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}>
        {isCreating ? "Creating quiz…" : failed ? "Try again" : "Create quiz"}
      </ActionButton>
    </FloatingBar>
  </>;
}
