"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Volume2, Eye, Loader2, Check } from "lucide-react";
import Link from "next/link";
import {
  SessionEngine,
  type SessionSentence,
  type InputSentence,
} from "@/lib/session-engine";

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
  2: "Good",
  3: "So-so",
  4: "Bad",
  5: "No idea",
};

function LearnPage() {
  const searchParams = useSearchParams();
  const topicIds = searchParams.get("topics")?.split(",") ?? [];

  const engineRef = useRef(new SessionEngine());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [current, setCurrent] = useState<SessionSentence | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [initialCount, setInitialCount] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playingTts, setPlayingTts] = useState(false);

  const topicKey = topicIds.join(",");

  const initSession = useCallback(async () => {
    if (topicIds.length === 0) {
      setLoading(false);
      return;
    }
    const res = await fetch(
      `/api/sentences/due?topics=${topicKey}&t=${Date.now()}`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      const sentences: InputSentence[] = data.sentences;
      const engine = engineRef.current;
      engine.init(sentences);
      setInitialCount(engine.initialCount);
      setRemaining(engine.remaining);
      setCurrent(engine.getNext());
    }
    setLoading(false);
  }, [topicKey]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  // Use a persistent audio element for mobile compatibility
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  async function playTts(text: string) {
    setPlayingTts(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = audioRef.current!;
        audio.pause();
        audio.onended = () => {
          setPlayingTts(false);
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => {
          setPlayingTts(false);
          URL.revokeObjectURL(url);
        };
        audio.src = url;
        audio.load();
        await audio.play().catch(() => setPlayingTts(false));
      } else {
        setPlayingTts(false);
      }
    } catch {
      setPlayingTts(false);
    }
  }

  async function rateSentence(grade: Grade) {
    if (!current) return;
    const engine = engineRef.current;

    // Evaluate locally (manages pool)
    const wasPass = engine.evaluate(current.id, grade);

    // Save to DB (pass = schedule future, fail = record rating)
    if (wasPass) {
      fetch("/api/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentenceId: current.id, grade }),
      });
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
            <Link href="/topics">
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
          href="/topics"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Topics
        </Link>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">
            {completed} / {initialCount} done
          </Badge>
          <Badge variant="outline">{remaining} left</Badge>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">{current.topicTitle}</p>

      <Card>
        <CardContent className="py-8 space-y-6">
          {!showAnswer ? (
            <>
              {/* Czech sentence */}
              <div className="text-center space-y-2">
                <p className="text-xl font-medium">{current.cz}</p>
              </div>
            </>
          ) : (
            <>
              {/* English sentence (main) */}
              <div className="text-center space-y-2">
                <p className="text-xl font-medium">{current.en}</p>
              </div>
              {/* Czech sentence (small) */}
              <p className="text-center text-sm text-muted-foreground">
                {current.cz}
              </p>
            </>
          )}

          {/* Session info */}
          {current.repeatCount > 0 && (
            <div className="text-center text-xs text-muted-foreground">
              Repeated {current.repeatCount}x in this session
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-10 bg-background border-t">
        <div className="w-full max-w-2xl mx-auto space-y-2">
          {!showAnswer ? (
            <Button
              className="w-full h-14"
              onClick={() => {
                setShowAnswer(true);
                playTts(current.en);
              }}
            >
              <Eye className="h-4 w-4 mr-2" />
              Show Answer
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => playTts(current.en)}
                disabled={playingTts}
              >
                <Volume2 className="h-4 w-4 mr-2" />
                {playingTts ? "Playing..." : "Listen"}
              </Button>
              <div className="grid grid-cols-5 gap-2">
                {([1, 2, 3, 4, 5] as Grade[]).map((grade) => (
                  <Button
                    key={grade}
                    className={`${GRADE_COLORS[grade]} text-white font-bold h-14 w-full`}
                    onClick={() => rateSentence(grade)}
                  >
                    <span className="flex flex-col items-center">
                      <span className="text-lg">{grade}</span>
                      <span className="text-[10px] font-normal opacity-80">
                        {GRADE_LABELS[grade]}
                      </span>
                    </span>
                  </Button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
