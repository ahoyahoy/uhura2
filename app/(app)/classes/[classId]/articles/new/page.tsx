"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Link2 } from "lucide-react";
import { FloatingBackButton } from "@/components/floating-back-button";
import { FloatingBar } from "@/components/floating-bar";
import { ActionButton } from "@/components/action-button";
import { useSync } from "@/lib/hooks/use-sync";

export default function NewArticlePage() {
  const { classId } = useParams<{ classId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data } = useSync();
  const course = data?.classes.find((item) => item.id === classId);
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function addArticle() {
    if (pending || !course) return;
    try {
      const link = new URL(url.trim());
      if (!["https:", "http:"].includes(link.protocol)) throw new Error("Invalid link");
    } catch {
      setMessage("Paste a valid article link.");
      return;
    }
    setMessage("");
    setPending(true);
    try {
      const response = await fetch("/api/articles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, url: url.trim() }),
      });
      if (!response.ok) throw new Error("Import failed");
      const result = await response.json() as { id: string };
      void queryClient.invalidateQueries({ queryKey: ["articles", classId] });
      router.push(`/classes/${classId}/articles/${result.id}`);
    } catch {
      setMessage("We couldn’t add this article. Check the link or try another one.");
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col p-6 pb-44 pt-24">
      <FloatingBackButton href={`/classes/${classId}/articles`} label="Back to articles" />
      <h1 className="mb-6 text-4xl font-normal">Add article</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Paste a link to a public article in the language you’re learning. We’ll prepare it for reading in both languages, paragraph by paragraph.
      </p>
      <div className="space-y-2">
        <label htmlFor="article-url" className="text-xs text-muted-foreground">Article link</label>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 focus-within:border-primary">
          <Link2 className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input id="article-url" type="url" inputMode="url" autoComplete="url" value={url}
            onChange={(event) => { setUrl(event.target.value); setMessage(""); }}
            onKeyDown={(event) => { if (event.key === "Enter") void addArticle(); }}
            placeholder="https://..." disabled={pending}
            className="min-w-0 w-full bg-transparent py-4 text-foreground outline-none" />
        </div>
      </div>
      {pending && <p role="status" className="mt-5 text-sm text-muted-foreground">Preparing the article…</p>}
      {message && <p role="status" className="mt-5 text-sm text-muted-foreground">{message}</p>}
      <FloatingBar>
        <ActionButton onClick={() => void addArticle()} disabled={pending || !course || !url.trim()} icon={<ArrowRight className="h-5 w-5" />}>
          {pending ? "Preparing…" : "Add article"}
        </ActionButton>
      </FloatingBar>
    </div>
  );
}
