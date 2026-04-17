"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Volume2, Turtle, Eye, Loader2, Check } from "lucide-react";
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

const GRADE_COLORS: Record<Grade, string> = {
  1: "bg-green-600 hover:bg-green-700",
  2: "bg-lime-600 hover:bg-lime-700",
  3: "bg-yellow-500 hover:bg-yellow-600",
  4: "bg-orange-500 hover:bg-orange-600",
  5: "bg-red-500 hover:bg-red-600",
};

const GRADE_LABELS: Record<Grade, string> = {
  1: "Perfect",
  2: "Slow",
  3: "So-so",
  4: "Bad",
  5: "No idea",
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
  const initializedRef = useRef(false);

  const [current, setCurrent] = useState<SessionSentence | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [initialCount, setInitialCount] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playingTts, setPlayingTts] = useState<false | "normal" | "slow">(false);
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
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  // Prefetch audio while user reads Czech sentence
  useEffect(() => {
    if (current && !showAnswer) {
      getAudioUrl(current.targetText).catch(() => {});
    }
  }, [current, showAnswer]);

  const ttsSlowRef = useRef(false);

  async function playTts(text: string) {
    const audio = audioRef.current!;
    const slow = ttsSlowRef.current;

    setPlayingTts(slow ? "slow" : "normal");
    try {
      const url = await getAudioUrl(text);
      audio.pause();
      audio.currentTime = 0;
      audio.onended = () => setPlayingTts(false);
      audio.onerror = () => setPlayingTts(false);
      audio.src = url;
      await new Promise<void>((res) => { audio.onloadedmetadata = () => res(); audio.load(); });
      audio.playbackRate = slow ? 0.75 : 1;
      setTtsDuration(audio.duration / audio.playbackRate);
      setTtsKey((k) => k + 1);
      await audio.play().catch(() => setPlayingTts(false));
    } catch {
      setPlayingTts(false);
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

    // Pick next from pool - delay content swap to halfway through flip animation
    const next = engine.getNext();
    setTimeout(() => setCurrent(next), 175);
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Session done
  if (!current) {
    return (
      <div className="w-full max-w-2xl mx-auto p-6 space-y-6">
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <Check className="h-12 w-12 mx-auto text-green-500" />
            <h2 className="text-xl font-semibold">All done for now!</h2>
            <p className="text-muted-foreground">
              {initialCount > 0
                ? `You reviewed ${initialCount} sentences.`
                : "No sentences due for review."}
            </p>
            <Link href={backUrl}>
              <Button>Back to Topics</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completed = initialCount - remaining;

  return (
    <div className="w-full max-w-2xl mx-auto p-6 pb-44 space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={backUrl}
          className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition-transform duration-200 active:translate-y-0.5 active:duration-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <p className="text-xs text-muted-foreground">{current.topicTitle}</p>
      </div>

      <div className="flip-container">
        <div className={`flip-card bg-white rounded-xl min-h-64 ${showAnswer ? "flipped" : ""}`}>
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

      <FloatingBar>
        {!showAnswer ? (
          <ActionButton
            variant="soft"
            onClick={() => {
              setShowAnswer(true);
              setTimeout(() => playTts(current.targetText), 200);
            }}
            icon={<ArrowRight className="h-5 w-5" />}
          >
            Answer
          </ActionButton>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-center gap-2">
              <button
                className={`relative overflow-hidden flex items-center justify-center h-7 px-12 rounded-full cursor-pointer transition-colors ${
                  playingTts === "normal"
                    ? "bg-primary/20 text-primary"
                    : "bg-primary/10 text-muted-foreground hover:bg-primary/15"
                }`}
                onClick={() => { ttsSlowRef.current = false; playTts(current.targetText); }}
              >
                {playingTts === "normal" && <AudioProgress key={ttsKey} duration={ttsDuration} />}
                <Volume2 className="h-3.5 w-3.5 relative z-10" />
              </button>
              <button
                className={`relative overflow-hidden flex items-center justify-center h-7 w-7 rounded-full cursor-pointer transition-colors ${
                  playingTts === "slow"
                    ? "bg-primary/20 text-primary"
                    : "bg-primary/10 text-muted-foreground hover:bg-primary/15"
                }`}
                onClick={() => { ttsSlowRef.current = true; playTts(current.targetText); }}
              >
                {playingTts === "slow" && <AudioProgress key={ttsKey} duration={ttsDuration} />}
                <Turtle className="h-3.5 w-3.5 relative z-10" />
              </button>
            </div>
            <div className="grid grid-cols-5 bg-primary/10 rounded-lg overflow-hidden h-14">
              {([1, 2, 3, 4, 5] as Grade[]).map((grade) => (
                <button
                  key={grade}
                  className="h-14 text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                  onClick={() => rateSentence(grade)}
                >
                  <span className="flex flex-col items-center leading-none">
                    <span className="text-lg">{grade}</span>
                    <span className="text-[10px] font-normal text-foreground/30">
                      {GRADE_LABELS[grade]}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </FloatingBar>
      <div className="fixed bottom-0 left-0 right-0 flex items-center justify-center gap-3 text-xs text-muted-foreground pb-12">
        <span><NumberFlow value={completed} /> done</span>
        <span>·</span>
        <span><NumberFlow value={remaining} /> left</span>
      </div>
    </div>
  );
}
