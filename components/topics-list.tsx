"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Play, RefreshCw, Trash2, MoreVertical, Loader2 } from "lucide-react";

type TopicWithCounts = {
  id: string;
  title: string;
  description: string;
  level: string;
  totalSentences: number;
  dueSentences: number;
};

export function TopicsList({ topics, classId }: { topics: TopicWithCounts[]; classId?: string }) {
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
    router.push(`/learn?topics=${ids}${classId ? `&classId=${classId}` : ""}`);
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

  async function deleteTopic(topicId: string) {
    if (!confirm("Delete this topic and all its sentences?")) return;
    await fetch(`/api/topics/${topicId}`, { method: "DELETE" });
    router.refresh();
  }

  const totalDue = topics
    .filter((t) => selected.has(t.id))
    .reduce((sum, t) => sum + t.dueSentences, 0);

  return (
    <>
      <div className="space-y-2">
        {topics.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
              selected.has(t.id)
                ? "ring-2 ring-primary bg-accent"
                : "hover:bg-accent/50"
            }`}
            onClick={() => toggleSelect(t.id)}
          >
            <span className="flex-1 font-medium truncate">
              {t.title} <span className="text-xs text-muted-foreground font-normal">{t.level}</span>
            </span>
            <Badge variant={t.dueSentences > 0 ? "default" : "secondary"}>
              {t.dueSentences}
            </Badge>
            {generating === t.id ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent"
                >
                  <MoreVertical className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      generateSentences(t.id);
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Generate more
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTopic(t.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
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
              Start practicing ({totalDue} sentences)
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
