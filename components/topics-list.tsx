"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { FloatingBar } from "@/components/floating-bar";
import { ActionButton } from "@/components/action-button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useDeleteTopic, useGenerateSentences } from "@/lib/hooks/use-mutations";
import NumberFlow from "@number-flow/react";

type TopicWithCounts = {
  id: string;
  title: string;
  description: string;
  level: string;
  goalKind?: string;
  focus?: string;
  practiceStyle?: string;
  register?: string;
  voiceIds?: string[];
  totalSentences: number;
  dueSentences: number;
};

const BRAILLE_FRAMES = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];

function BrailleSpinner() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % BRAILLE_FRAMES.length), 80);
    return () => clearInterval(id);
  }, []);
  return <span className="inline-block w-4 text-center text-primary">{BRAILLE_FRAMES[frame]}</span>;
}

export function TopicsList({ topics, classId }: { topics: TopicWithCounts[]; classId?: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmation, setConfirmation] = useState<"generate" | "remove" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteMutation = useDeleteTopic();
  const generateMutation = useGenerateSentences();

  function toggleSelect(id: string) {
    if (deleting) return;
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
    router.push(`/learn/review?topics=${ids}${classId ? `&classId=${classId}` : ""}`);
  }

  function generateForSelected() {
    if (selected.size !== 1) return;
    setConfirmation(null);
    generateMutation.mutate([...selected][0]);
  }

  async function deleteSelected() {
    const ids = [...selected];
    setConfirmation(null);
    setDeleting(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => deleteMutation.mutateAsync(id)));
      setSelected(new Set(ids.filter((_, index) => results[index].status === "rejected")));
    } finally {
      setDeleting(false);
    }
  }

  const selectedTopic = topics.find((topic) => selected.has(topic.id));
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
                ? "bg-primary/10 text-primary topic-selected"
                : "hover:bg-primary/5"
            }`}
            onClick={() => toggleSelect(t.id)}
          >
            <span className="flex-1 min-w-0">
              <span className="block truncate">{t.title} <span className="text-xs text-muted-foreground font-normal">{t.level}</span></span>
              {t.focus && <span className="block truncate text-xs text-muted-foreground font-normal">
                {t.focus} · {t.practiceStyle === "fixed" ? "Fixed pattern" : t.practiceStyle === "situational" ? "In context" : "Varied use"}
              </span>}
            </span>
            {generateMutation.isPending && generateMutation.variables === t.id && (
              <BrailleSpinner />
            )}
            <span><NumberFlow value={t.dueSentences} /></span>
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
            Start practicing{"\u2003"}<span className="font-light"><NumberFlow value={totalDue} /></span>
          </ActionButton>
        ) : (
          <Link href={`/classes/${classId}/new`}>
            <ActionButton variant="soft" icon={<ArrowUpRight className="h-5 w-5" />}>
              New topic
            </ActionButton>
          </Link>
        )}
      </FloatingBar>
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-center pb-10">
          <div className="flex items-center gap-3 text-xs text-muted-foreground bg-primary/10 rounded-full px-4 py-1.5">
            {selected.size === 1 && <><Link href={`/classes/${classId}/topics/${[...selected][0]}`} className="hover:text-foreground/70">Review sentences</Link><span>·</span></>}
            <button
              className="cursor-pointer hover:text-foreground/70 transition-colors"
              onClick={() => setConfirmation("generate")}
              disabled={generateMutation.isPending || selected.size !== 1}
              title={selected.size !== 1 ? "Select one lesson to add sentences" : undefined}
            >
              {generateMutation.isPending ? "Generating..." : generateMutation.isError ? "Try again" : "Generate more"}
            </button>
            <span>·</span>
            <button
              className="cursor-pointer hover:text-foreground/70 transition-colors"
              onClick={() => setConfirmation("remove")}
              disabled={deleting || generateMutation.isPending}
            >
              {deleting ? "Removing…" : "Remove"}
            </button>
          </div>
          {generateMutation.isSuccess && <p role="status" className="absolute top-9 text-xs text-muted-foreground">Added {generateMutation.data.sentences.length} sentences</p>}
        </div>
      )}
      <ConfirmDialog
        open={confirmation === "generate"}
        title="Add more sentences?"
        description={`Add fresh practice sentences to “${selectedTopic?.title ?? "this topic"}” following its goal, level, and style.`}
        confirmLabel="Generate more"
        onCancel={() => setConfirmation(null)}
        onConfirm={generateForSelected}
      />
      <ConfirmDialog
        open={confirmation === "remove"}
        title={selected.size === 1 ? "Remove this topic?" : `Remove ${selected.size} topics?`}
        description={selected.size === 1
          ? `“${selectedTopic?.title ?? "This topic"}” and its sentences will be removed. This can’t be undone.`
          : "These topics and their sentences will be removed. This can’t be undone."}
        confirmLabel={selected.size === 1 ? "Remove topic" : "Remove topics"}
        destructive
        onCancel={() => setConfirmation(null)}
        onConfirm={() => { void deleteSelected(); }}
      />
    </>
  );
}
