"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { FloatingBackButton } from "@/components/floating-back-button";
import { FloatingBar } from "@/components/floating-bar";
import { ActionButton } from "@/components/action-button";
import { useSync } from "@/lib/hooks/use-sync";
import { getLanguageLabel } from "@/lib/languages";
import { splitArticleParagraphs, validateArticleText } from "@/lib/article-paragraphs";

export default function NewArticlePage() {
  const { classId } = useParams<{ classId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data } = useSync();
  const course = data?.classes.find((item) => item.id === classId);
  const targetLanguage = getLanguageLabel(course?.targetLanguage ?? "");
  const sourceLanguage = getLanguageLabel(course?.sourceLanguage ?? "");
  const [title, setTitle] = useState("");
  const [titleTranslation, setTitleTranslation] = useState("");
  const [targetText, setTargetText] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const targetCount = useMemo(() => splitArticleParagraphs(targetText).length, [targetText]);
  const sourceCount = useMemo(() => splitArticleParagraphs(sourceText).length, [sourceText]);

  async function save() {
    if (pending) return;
    if (!title.trim() || !titleTranslation.trim()) { setMessage("Add a title in both languages."); return; }
    const validation = validateArticleText(targetText, sourceText);
    if (validation.error) { setMessage(validation.error); return; }
    setMessage("");
    setPending(true);
    try {
      const response = await fetch("/api/articles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, title, titleTranslation, targetText, sourceText }),
      });
      if (!response.ok) throw new Error("Save failed");
      const result = await response.json() as { id: string };
      void queryClient.invalidateQueries({ queryKey: ["articles", classId] });
      router.push(`/classes/${classId}/articles/${result.id}`);
    } catch {
      setMessage("The article wasn’t saved. Try again.");
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col p-6 pb-44 pt-24">
      <FloatingBackButton href={`/classes/${classId}/articles`} label="Back to articles" />
      <h1 className="mb-8 text-4xl font-normal">Add article</h1>
      <p className="mb-8 text-sm text-muted-foreground">Paste both versions with a blank line between paragraphs. Matching paragraphs will appear together while reading.</p>
      <div className="space-y-7">
        <div className="space-y-2">
          <label htmlFor="target-title" className="text-xs text-muted-foreground">{targetLanguage} title</label>
          <input id="target-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160}
            lang={course?.targetLanguage} dir={course?.targetLanguage === "ar" ? "rtl" : "auto"}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none focus:border-primary" />
        </div>
        <div className="space-y-2">
          <label htmlFor="source-title" className="text-xs text-muted-foreground">{sourceLanguage} title</label>
          <input id="source-title" value={titleTranslation} onChange={(event) => setTitleTranslation(event.target.value)} maxLength={160}
            lang={course?.sourceLanguage} dir={course?.sourceLanguage === "ar" ? "rtl" : "auto"}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none focus:border-primary" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground"><label htmlFor="target-text">{targetLanguage} article</label><span>{targetCount} paragraphs</span></div>
          <textarea id="target-text" value={targetText} onChange={(event) => setTargetText(event.target.value)} rows={10} maxLength={25_000}
            lang={course?.targetLanguage} dir={course?.targetLanguage === "ar" ? "rtl" : "auto"}
            className="w-full resize-y rounded-xl border border-border bg-card px-4 py-3 leading-relaxed text-foreground outline-none focus:border-primary" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground"><label htmlFor="source-text">{sourceLanguage} translation</label><span>{sourceCount} paragraphs</span></div>
          <textarea id="source-text" value={sourceText} onChange={(event) => setSourceText(event.target.value)} rows={10} maxLength={25_000}
            lang={course?.sourceLanguage} dir={course?.sourceLanguage === "ar" ? "rtl" : "auto"}
            className="w-full resize-y rounded-xl border border-border bg-card px-4 py-3 leading-relaxed text-foreground outline-none focus:border-primary" />
        </div>
        {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      </div>
      <FloatingBar>
        <ActionButton onClick={() => void save()} disabled={pending || !course} icon={<ArrowRight className="h-5 w-5" />}>
          {pending ? "Saving…" : "Save article"}
        </ActionButton>
      </FloatingBar>
    </div>
  );
}
