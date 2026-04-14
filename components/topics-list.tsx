"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, RefreshCw, Trash2, Loader2 } from "lucide-react";
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

  function generateForSelected() {
    for (const id of selected) {
      generateMutation.mutate(id);
    }
  }

  function deleteSelected() {
    if (!confirm(`Delete ${selected.size} topic${selected.size > 1 ? "s" : ""} and all sentences?`)) return;
    for (const id of selected) {
      deleteMutation.mutate(id);
    }
    setSelected(new Set());
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
                ? "bg-primary/10 text-primary"
                : "hover:bg-primary/5"
            }`}
            onClick={() => toggleSelect(t.id)}
          >
            <span className="flex-1 truncate">
              {t.title} <span className="text-xs text-muted-foreground font-normal">{t.level}</span>
            </span>
            <span>{t.dueSentences}</span>
            {generateMutation.isPending && generateMutation.variables === t.id && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 flex items-center justify-center gap-3 text-xs text-muted-foreground pb-12">
          <button
            className="cursor-pointer hover:text-foreground/70 transition-colors"
            onClick={generateForSelected}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? "Generating..." : "Generate more"}
          </button>
          <span>·</span>
          <button
            className="cursor-pointer hover:text-foreground/70 transition-colors"
            onClick={deleteSelected}
            disabled={deleteMutation.isPending}
          >
            Remove
          </button>
        </div>
      )}
    </>
  );
}
