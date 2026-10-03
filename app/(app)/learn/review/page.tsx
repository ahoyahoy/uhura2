"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Volume2, Loader2 } from "lucide-react";
import Link from "next/link";
import {
  SessionEngine,
  type SessionSentence,
} from "@/lib/session-engine";
import { getAudioUrl } from "@/lib/audio-cache";
import NumberFlow from "@number-flow/react";
import { FloatingBar } from "@/components/floating-bar";
import { useScreenBg } from "@/lib/hooks/use-screen-bg";
import { ActionButton } from "@/components/action-button";
import { useSentencesDue } from "@/lib/hooks/use-sentences-due";
import { useRateSentence } from "@/lib/hooks/use-mutations";
import { useStoredString } from "@/lib/hooks/use-stored-string";
import { voiceVolume } from "@/lib/voice-volume";
import { FloatingBackButton } from "@/components/floating-back-button";

export default function LearnPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LearnPage />
    </Suspense>
  );
}

type Grade = 1 | 2 | 3 | 4 | 5;

const GRADE_LABELS: Record<Grade, string> = {
  1: "Perfect",
  2: "Slow",
  3: "So-so",
  4: "Bad",
  5: "No idea",
};

const GRADE_LETTERS: Record<Grade, string> = {
  1: "A",
  2: "B",
  3: "C",
  4: "D",
  5: "E",
};

function AudioProgress({ duration }: { duration: number }) {
  return (
    <div
      className="absolute inset-y-0 left-0 bg-primary/15 rounded-full animate-audio-progress"
      style={{ animationDuration: `${duration}s` }}
    />
  );
}

function LearnPage() {
  useScreenBg("tinted");

  const searchParams = useSearchParams();
  const topicIds = searchParams.get("topics")?.split(",") ?? [];
  const classId = searchParams.get("classId") ?? "";
  const backUrl = classId ? `/classes/${classId}` : "/classes";

  const engineRef = useRef(new SessionEngine());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioRequestRef = useRef(0);
  const answerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
  const gradeStyle = useStoredString("gradeStyle", "numbers");

  const [current, setCurrent] = useState<SessionSentence | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [initialCount, setInitialCount] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playingTts, setPlayingTts] = useState<false | "loading" | "normal" | "slow">(false);
  const [ttsDuration, setTtsDuration] = useState(0);
  const [ttsKey, setTtsKey] = useState(0);

  const { sentences: dueSentences, isLoading: syncLoading } = useSentencesDue(topicIds);
  const rateMutation = useRateSentence();

  // Initialize session when due sentences arrive
  useEffect(() => {
    if (syncLoading || initializedRef.current) return;
    initializedRef.current = true;

    const engine = engineRef.current;
    engine.init(dueSentences);
    setInitialCount(engine.initialCount);
    setRemaining(engine.remaining);
    setCurrent(engine.getNext());
    setLoading(false);
  }, [syncLoading, dueSentences]);

  // Use a persistent audio element for mobile compatibility
  useEffect(() => {
    const requestCounter = audioRequestRef;
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    return () => {
      requestCounter.current++;
      if (answerTimerRef.current) clearTimeout(answerTimerRef.current);
      audioRef.current?.pause();
    };
  }, []);

  const currentSentenceId = current?.id;
  useEffect(() => {
    if (!currentSentenceId) return;
    // Start loading only the visible card; playback reuses this cached request.
    void getAudioUrl(currentSentenceId).catch(() => {});
  }, [currentSentenceId]);

  const ttsSlowRef = useRef(false);

  async function playTts(sentenceId: string, voiceId?: string | null) {
    const audio = audioRef.current!;
    const slow = ttsSlowRef.current;
    const request = ++audioRequestRef.current;

    audio.pause();
    setPlayingTts("loading");
    try {
      const url = await getAudioUrl(sentenceId);
      if (request !== audioRequestRef.current) return;
      audio.currentTime = 0;
      audio.onended = () => setPlayingTts(false);
      audio.src = url;
      await new Promise<void>((resolve, reject) => {
        audio.onloadedmetadata = () => resolve();
        audio.onerror = () => reject(new Error("Audio could not be played"));
        audio.load();
      });
      if (request !== audioRequestRef.current) return;
      audio.playbackRate = slow ? 0.75 : 1;
      audio.volume = voiceVolume(voiceId);
      setTtsDuration(audio.duration / audio.playbackRate);
      setTtsKey((k) => k + 1);
      await audio.play();
      if (request !== audioRequestRef.current) { audio.pause(); return; }
      setPlayingTts(slow ? "slow" : "normal");
    } catch (error) {
      if (request === audioRequestRef.current) {
        console.warn("Sentence audio playback failed", error);
        setPlayingTts(false);
      }
    }
  }

  function rateSentence(grade: Grade) {
    if (!current) return;
    const engine = engineRef.current;

    // Evaluate locally (manages pool)
    const wasPass = engine.evaluate(current.id, grade);

    // Save to DB only on pass (same behavior as before)
    if (wasPass) {
      rateMutation.mutate({ sentenceId: current.id, grade });
    }

    setShowAnswer(false);
    setRemaining(engine.remaining);
    ttsSlowRef.current = false;
    audioRequestRef.current++;
    if (answerTimerRef.current) clearTimeout(answerTimerRef.current);
    audioRef.current?.pause();
    setPlayingTts(false);

    // Pick next from pool - delay content swap to halfway through flip animation
    const next = engine.getNext();
    setTimeout(() => setCurrent(next), 175);
  }

  if (loading) {
    return (
      <>
        <FloatingBackButton href={backUrl} label="Back to course" />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  // Session done
  if (!current) {
    return (
      <div className="flex flex-col min-h-svh w-full max-w-2xl mx-auto p-6 pb-44">
        <FloatingBackButton href={backUrl} label="Back to course" />
        <h1 className="mt-auto mb-4 text-4xl font-normal">All done for today</h1>
        <p className="text-muted-foreground">
          {initialCount > 0
            ? `${initialCount} sentences reviewed`
            : "No sentences due for review"}
        </p>
        <FloatingBar>
          <Link href={backUrl}>
            <ActionButton icon={<ArrowRight className="h-5 w-5" />}>
              Finish
            </ActionButton>
          </Link>
        </FloatingBar>
      </div>
    );
  }

  const completed = initialCount - remaining;

  return (
    <div className="w-full max-w-2xl mx-auto p-6 pb-44 space-y-6">
      <FloatingBackButton href={backUrl} label="Back to course" />
      <div className="flex items-center justify-between">
        <div className="h-9 w-9" aria-hidden="true" />
        <p className="text-xs text-muted-foreground">{current.topicTitle}</p>
      </div>

      <div className="flip-container">
        <div className={`flip-card bg-card rounded-xl min-h-64 ${showAnswer ? "flipped" : ""}`}>
          <div className="flip-front py-8 px-6">
            <p className="text-xl">{current.sourceText}</p>
          </div>
          <div className="flip-back py-8 px-6 space-y-10">
            <p className="text-xl">{current.targetText}</p>
            <p className="text-sm text-muted-foreground">
              {current.sourceText}
            </p>
          </div>
        </div>
      </div>

      {current.repeatCount > 0 && showAnswer && (
        <p className="text-xs text-muted-foreground text-center -mt-4">
          {current.repeatCount}×
        </p>
      )}

      <FloatingBar compact className="space-y-3">
        {!showAnswer ? (
          <ActionButton
            variant="soft"
            onClick={() => {
              setShowAnswer(true);
              answerTimerRef.current = setTimeout(() => playTts(current.id, current.voiceId), 200);
            }}
            icon={<ArrowRight className="h-5 w-5" />}
          >
            Answer
          </ActionButton>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-center">
              <button
                aria-label="Play sentence audio"
                disabled={playingTts === "loading"}
                className={`relative overflow-hidden flex items-center justify-center h-7 px-12 rounded-full cursor-pointer transition-colors ${
                  playingTts
                    ? "bg-primary/20 text-primary"
                    : "bg-primary/10 text-muted-foreground hover:bg-primary/15"
                }`}
                onClick={() => { ttsSlowRef.current = false; playTts(current.id, current.voiceId); }}
              >
                {playingTts && playingTts !== "loading" && <AudioProgress key={ttsKey} duration={ttsDuration} />}
                {playingTts === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin relative z-10" /> : <Volume2 className="h-3.5 w-3.5 relative z-10" />}
              </button>
            </div>
            <div className="grid h-14 grid-cols-5 overflow-hidden rounded-full bg-primary/10">
              {([1, 2, 3, 4, 5] as Grade[]).map((grade) => (
                <button
                  key={grade}
                  className="flex h-full items-center justify-center text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                  onClick={() => rateSentence(grade)}
                >
                  <span className="flex flex-col items-center leading-none">
                    <span className="text-lg">{gradeStyle === "letters" ? GRADE_LETTERS[grade] : grade}</span>
                    <span className="text-[7px] font-medium uppercase tracking-[0.1em] text-foreground/30 font-[family-name:var(--font-inter)]">
                      {GRADE_LABELS[grade]}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-center">
          <div className="flex items-center gap-3 px-4 py-1.5 text-xs text-muted-foreground">
            <span><NumberFlow value={completed} /> done</span>
            <span>·</span>
            <span><NumberFlow value={remaining} /> left</span>
          </div>
        </div>
      </FloatingBar>
    </div>
  );
}
