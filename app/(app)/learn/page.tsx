"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Volume2, Eye, Loader2, Check } from "lucide-react";
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
  const [playingTts, setPlayingTts] = useState(false);

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

  async function playTts(text: string) {
    setPlayingTts(true);
    try {
      const url = await getAudioUrl(text);
      const audio = audioRef.current!;
      audio.pause();
      audio.onended = () => setPlayingTts(false);
      audio.onerror = () => setPlayingTts(false);
      audio.src = url;
      audio.load();
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

    // Pick next from pool
    const next = engine.getNext();
    setCurrent(next);
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
          className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
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

      {current.repeatCount > 0 && (
        <p className="text-xs text-muted-foreground text-center -mt-4">
          {current.repeatCount}×
        </p>
      )}

      <FloatingBar>
        <div className="h-[6rem] flex flex-col justify-end space-y-2 overflow-hidden">
          {!showAnswer ? (
            <ActionButton
              variant="soft"
              onClick={() => {
                setShowAnswer(true);
                playTts(current.targetText);
              }}
              icon={<ArrowRight className="h-5 w-5" />}
            >
              Answer
            </ActionButton>
          ) : (
            <>
              <button
                className="w-full h-8 shrink-0 flex items-center justify-center gap-2 text-sm text-foreground/50 bg-primary/10 rounded-lg border-0 cursor-pointer hover:bg-primary/15 transition-colors"
                onClick={() => playTts(current.targetText)}
                disabled={playingTts}
              >
                <Volume2 className="h-4 w-4" />
                {playingTts ? "Playing..." : "Listen"}
              </button>
              <div className="grid grid-cols-5 bg-primary/10 rounded-lg overflow-hidden h-14 shrink-0">
                {([1, 2, 3, 4, 5] as Grade[]).map((grade) => (
                  <button
                    key={grade}
                    className="h-14 text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                    onClick={() => rateSentence(grade)}
                  >
                    <span className="flex flex-col items-center leading-none">
                      <span className="text-lg font-bold">{grade}</span>
                      <span className="text-[10px] font-normal opacity-70">
                        {GRADE_LABELS[grade]}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground pt-1">
          <span><NumberFlow value={completed} /> done</span>
          <span>·</span>
          <span><NumberFlow value={remaining} /> left</span>
        </div>
      </FloatingBar>
    </div>
  );
}
