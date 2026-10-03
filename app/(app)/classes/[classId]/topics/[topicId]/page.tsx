"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useScreenBg } from "@/lib/hooks/use-screen-bg";

type Lesson = { id: string; title: string; focus: string; level: string; practiceStyle: string };
type Sentence = { id: string; sourceText: string; targetText: string; voiceName: string; position: number };

export default function ReviewLessonPage() {
  useScreenBg("tinted");
  const { classId, topicId } = useParams<{ classId: string; topicId: string }>();
  const queryClient = useQueryClient();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/sentences?topicId=${encodeURIComponent(topicId)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load sentences");
        return data as { topic: Lesson; sentences: Sentence[] };
      })
      .then((data) => { if (active) { setLesson(data.topic); setSentences(data.sentences); setLoading(false); } })
      .catch((cause) => { if (active) { setError(cause.message); setLoading(false); } });
    return () => { active = false; };
  }, [topicId]);

  function startEdit(row: Sentence) {
    setEditing(row.id);
    setSource(row.sourceText);
    setTarget(row.targetText);
    setError(null);
  }

  async function save(id: string) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/sentences/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText: source, targetText: target }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save sentence");
      setSentences((rows) => rows.map((row) => row.id === id
        ? { ...row, sourceText: data.sentence.sourceText, targetText: data.sentence.targetText } : row));
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["sync"] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save sentence");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this sentence from the lesson?")) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/sentences/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not remove sentence");
      setSentences((rows) => rows.filter((row) => row.id !== id));
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["sync"] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove sentence");
    } finally {
      setSaving(false);
    }
  }

  return <div className="w-full max-w-2xl mx-auto p-6 pb-24">
    <Link href={`/classes/${classId}`} aria-label="Back to course" className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-primary/10 text-primary"><ArrowLeft className="h-4 w-4" /></Link>
    <h1 className="mt-8 text-3xl font-normal">Review sentences</h1>
    {loading && <div className="py-12 flex justify-center"><Loader2 className="animate-spin" /></div>}
    {lesson && <>
      <p className="mt-2 text-muted-foreground">{lesson.title} · {lesson.level}</p>
      {lesson.focus && <p className="mt-1 text-sm text-muted-foreground">Focus: {lesson.focus}</p>}
      <p className="mt-4 text-sm text-muted-foreground">{sentences.length} sentences · Edit an awkward translation or remove a sentence that does not fit the goal. Edited sentences return to review; their previous audio remains in the shared cache.</p>
    </>}
    {error && <p role="alert" className="mt-5 text-sm text-destructive">{error}</p>}
    <div className="mt-8 space-y-3">
      {sentences.map((row, index) => <article key={row.id} className="rounded-xl bg-card p-4 space-y-3">
        <div className="flex justify-between text-xs text-muted-foreground"><span>{index + 1}</span><span>{row.voiceName}</span></div>
        {editing === row.id ? <>
          <label className="block text-xs text-muted-foreground">Source sentence</label>
          <textarea aria-label="Source sentence" value={source} onChange={(event) => setSource(event.target.value)} rows={2} maxLength={350} className="w-full rounded-lg bg-background p-3 text-sm" />
          <label className="block text-xs text-muted-foreground">Target sentence</label>
          <textarea aria-label="Target sentence" value={target} onChange={(event) => setTarget(event.target.value)} rows={2} maxLength={350} className="w-full rounded-lg bg-background p-3 text-sm" />
          <div className="flex gap-4 text-sm"><button disabled={saving || !source.trim() || !target.trim()} onClick={() => save(row.id)} className="text-primary disabled:opacity-50">Save</button><button disabled={saving} onClick={() => setEditing(null)}>Cancel</button></div>
        </> : <>
          <p className="text-sm">{row.sourceText}</p>
          <p className="text-sm text-muted-foreground">{row.targetText}</p>
          <div className="flex gap-4 text-xs"><button disabled={saving} onClick={() => startEdit(row)} className="text-primary">Edit</button><button disabled={saving} onClick={() => remove(row.id)} className="text-destructive">Remove</button></div>
        </>}
      </article>)}
    </div>
  </div>;
}
