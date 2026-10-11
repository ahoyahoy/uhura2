"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pause, Play, Trash2, Volume2 } from "lucide-react";
import { FloatingBackButton } from "@/components/floating-back-button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { getLanguageLabel } from "@/lib/languages";
import { setStoredString, useStoredString } from "@/lib/hooks/use-stored-string";

type ReadingMode = "target" | "both" | "source";
type Paragraph = { id: string; position: number; targetText: string; sourceText: string };
type Article = {
  id: string; classId: string; title: string; titleTranslation: string;
  targetLanguage: string; sourceLanguage: string; paragraphs: Paragraph[];
};
type Playback = { index: number; status: "loading" | "playing" } | null;

export default function ArticlePage() {
  const { classId, articleId } = useParams<{ classId: string; articleId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: article, isLoading } = useQuery<Article>({
    queryKey: ["article", articleId],
    queryFn: async () => {
      const response = await fetch(`/api/articles/${encodeURIComponent(articleId)}`);
      if (!response.ok) throw new Error("Could not load article");
      const result = await response.json() as { article: Article };
      if (result.article.classId !== classId) throw new Error("Wrong course");
      return result.article;
    },
  });
  const savedMode = useStoredString("articleReadingMode", "target");
  const mode: ReadingMode = savedMode === "source" || savedMode === "both" ? savedMode : "target";
  const [playback, setPlayback] = useState<Playback>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playAllRef = useRef(false);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audioRef.current = audio;
    return () => { audio.pause(); audio.removeAttribute("src"); audio.load(); audioRef.current = null; };
  }, []);

  function stopAudio() {
    playAllRef.current = false;
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.onended = null; audio.onerror = null; audio.onplaying = null; audio.onwaiting = null; }
    setPlayback(null);
  }

  function playParagraph(index: number, playAll: boolean) {
    const audio = audioRef.current;
    const paragraph = article?.paragraphs[index];
    if (!audio || !paragraph) return;
    if (playback?.index === index && !playAll) { stopAudio(); return; }
    stopAudio();
    playAllRef.current = playAll;
    setPlayback({ index, status: "loading" });
    audio.src = `/api/articles/audio/${paragraph.id}`;
    audio.onwaiting = () => setPlayback({ index, status: "loading" });
    audio.onplaying = () => setPlayback({ index, status: "playing" });
    audio.onerror = () => stopAudio();
    audio.onended = () => {
      if (playAllRef.current && index + 1 < article.paragraphs.length) {
        playParagraph(index + 1, true);
      } else {
        stopAudio();
      }
    };
    void audio.play().catch(() => stopAudio());
  }

  function changeMode(next: ReadingMode) {
    stopAudio();
    setStoredString("articleReadingMode", next);
  }

  async function removeArticle() {
    if (removing) return;
    setRemoving(true);
    try {
      const response = await fetch(`/api/articles/${articleId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      await queryClient.invalidateQueries({ queryKey: ["articles", classId] });
      router.replace(`/classes/${classId}/articles`);
    } catch {
      setRemoving(false);
      setRemoveOpen(false);
    }
  }

  if (isLoading) return <><FloatingBackButton href={`/classes/${classId}/articles`} label="Back to articles" /><div className="flex flex-1 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div></>;
  if (!article) return <><FloatingBackButton href={`/classes/${classId}/articles`} label="Back to articles" /><p className="m-auto text-muted-foreground">Article unavailable.</p></>;

  const targetLabel = getLanguageLabel(article.targetLanguage);
  const sourceLabel = getLanguageLabel(article.sourceLanguage);
  const modes: { value: ReadingMode; label: string }[] = [
    { value: "target", label: targetLabel }, { value: "both", label: "Both" }, { value: "source", label: sourceLabel },
  ];

  return (
    <div className="mx-auto min-h-svh w-full max-w-2xl px-6 pb-36 pt-24">
      <FloatingBackButton href={`/classes/${classId}/articles`} label="Back to articles" />
      <div className="mb-12 flex items-start justify-between gap-4">
        <div>
          {mode === "source" ? (
            <h1 lang={article.sourceLanguage} dir={article.sourceLanguage === "ar" ? "rtl" : "auto"} className="text-4xl leading-tight tracking-[-0.04em]">{article.titleTranslation}</h1>
          ) : (
            <>
              <h1 lang={article.targetLanguage} dir={article.targetLanguage === "ar" ? "rtl" : "auto"} className="text-4xl leading-tight tracking-[-0.04em]">{article.title}</h1>
              {mode === "both" && <p lang={article.sourceLanguage} dir={article.sourceLanguage === "ar" ? "rtl" : "auto"} className="mt-3 text-xl leading-tight text-muted-foreground">{article.titleTranslation}</p>}
            </>
          )}
        </div>
        <button type="button" aria-label="Remove article" onClick={() => setRemoveOpen(true)}
          className="mt-1 shrink-0 cursor-pointer rounded-full p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {mode !== "source" && (
        <button type="button" onClick={() => playback && playAllRef.current ? stopAudio() : playParagraph(0, true)}
          className="mb-5 inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm text-foreground transition-colors hover:bg-primary/15">
          {playback && playAllRef.current ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {playback && playAllRef.current ? "Stop reading" : "Read all"}
        </button>
      )}

      <div>
        {article.paragraphs.map((paragraph, index) => (
          <section key={paragraph.id} className="border-b border-border py-7 first:pt-2 last:border-b-0">
            {mode !== "source" && (
              <div className="flex items-start gap-4">
                <p lang={article.targetLanguage} dir={article.targetLanguage === "ar" ? "rtl" : "auto"} className="min-w-0 flex-1 whitespace-pre-wrap text-lg leading-8 text-foreground">{paragraph.targetText}</p>
                <button type="button" aria-label={`${playback?.index === index ? "Stop" : "Read"} paragraph ${index + 1}`}
                  onClick={() => playParagraph(index, false)}
                  className="mt-1 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/15">
                  {playback?.index === index && playback.status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" />
                    : playback?.index === index ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              </div>
            )}
            {mode !== "target" && <p lang={article.sourceLanguage} dir={article.sourceLanguage === "ar" ? "rtl" : "auto"} className={`${mode === "both" ? "mt-4 text-base leading-7 text-muted-foreground" : "text-lg leading-8 text-foreground"} whitespace-pre-wrap`}>{paragraph.sourceText}</p>}
          </section>
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 bg-[var(--background)]/80 px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-2xl gap-2 rounded-full bg-primary/10 p-1">
          {modes.map((item) => (
            <button key={item.value} type="button" aria-pressed={mode === item.value} onClick={() => changeMode(item.value)}
              className={`min-w-0 flex-1 cursor-pointer truncate rounded-full px-2 py-3 text-xs sm:text-sm transition-colors ${mode === item.value ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-primary/10"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <ConfirmDialog open={removeOpen} title="Remove article?" description="This article will be removed from your course."
        confirmLabel="Remove" destructive pending={removing} onCancel={() => setRemoveOpen(false)} onConfirm={() => void removeArticle()} />
    </div>
  );
}
