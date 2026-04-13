"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, RefreshCw, Loader2 } from "lucide-react";
import Link from "next/link";

type TopicWithCounts = {
  id: string;
  title: string;
  description: string;
  totalSentences: number;
  dueSentences: number;
};

export function TopicsList({ topics }: { topics: TopicWithCounts[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState<string | null>(null);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startReview() {
    if (selected.size === 0) return;
    const ids = Array.from(selected).join(",");
    router.push(`/learn?topics=${ids}`);
  }

  async function generateSentences(topicId: string) {
    setGenerating(topicId);
    await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId }),
    });
    setGenerating(null);
    router.refresh();
  }

  const totalDue = topics
    .filter((t) => selected.has(t.id))
    .reduce((sum, t) => sum + t.dueSentences, 0);

  return (
    <>
      <div className="space-y-3">
        {topics.map((t) => (
          <Card
            key={t.id}
            className={`cursor-pointer transition-colors ${
              selected.has(t.id)
                ? "ring-2 ring-primary bg-accent"
                : "hover:bg-accent/50"
            }`}
            onClick={() => toggleSelect(t.id)}
          >
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div className="space-y-1 flex-1">
                <CardTitle className="text-base">{t.title}</CardTitle>
                <CardDescription className="line-clamp-1">
                  {t.description}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 ml-4">
                {t.dueSentences > 0 ? (
                  <Badge variant="default">
                    {t.dueSentences} due
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    all done
                  </Badge>
                )}
                <Badge variant="outline">{t.totalSentences} total</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    generateSentences(t.id);
                  }}
                  disabled={generating === t.id}
                >
                  {generating === t.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
          <div className="max-w-2xl mx-auto">
            <Button
              className="w-full"
              size="lg"
              onClick={startReview}
              disabled={totalDue === 0}
            >
              <Play className="h-4 w-4 mr-2" />
              Review {totalDue} sentences from {selected.size} topic
              {selected.size > 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
