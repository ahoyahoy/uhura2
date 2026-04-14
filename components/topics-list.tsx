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
import { ArrowRight, ArrowUpRight, RefreshCw, Trash2, MoreVertical, Loader2 } from "lucide-react";
import Link from "next/link";
import { FloatingBar } from "@/components/floating-bar";
import { ActionButton } from "@/components/action-button";
import { useDeleteTopic, useGenerateSentences } from "@/lib/hooks/use-mutations";

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
  const deleteMutation = useDeleteTopic();
  const generateMutation = useGenerateSentences();

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

  function generateSentences(topicId: string) {
    generateMutation.mutate(topicId);
  }

  function deleteTopic(topicId: string) {
    if (!confirm("Delete this topic and all its sentences?")) return;
    deleteMutation.mutate(topicId);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(topicId);
      return next;
    });
  }

  const totalDue = topics
    .filter((t) => selected.has(t.id))
    .reduce((sum, t) => sum + t.dueSentences, 0);

  return (
    <>
      <div className="-mx-6">
        {topics.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-8 py-3 cursor-pointer transition-colors ${
              selected.has(t.id)
                ? "bg-primary/10"
                : "hover:bg-primary/5"
            }`}
            onClick={() => toggleSelect(t.id)}
          >
            <span className="flex-1 truncate">
              {t.title} <span className="text-xs text-muted-foreground font-normal">{t.level}</span>
            </span>
            <Badge variant={t.dueSentences > 0 ? "default" : "secondary"}>
              {t.dueSentences}
            </Badge>
            {generateMutation.isPending && generateMutation.variables === t.id ? (
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

      <FloatingBar>
        {selected.size > 0 ? (
          <ActionButton
            onClick={startReview}
            disabled={totalDue === 0}
            icon={<ArrowRight className="h-5 w-5" />}
          >
            Start practicing{"\u2003"}<span className="font-light">{totalDue}</span>
          </ActionButton>
        ) : (
          <Link href={`/classes/${classId}/new`}>
            <ActionButton variant="soft" icon={<ArrowUpRight className="h-5 w-5" />}>
              Create new topic
            </ActionButton>
          </Link>
        )}
      </FloatingBar>
    </>
  );
}
