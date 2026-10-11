"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { FloatingBackButton } from "@/components/floating-back-button";
import { FloatingBar } from "@/components/floating-bar";
import { ActionButton } from "@/components/action-button";

type ArticleSummary = { id: string; title: string; titleTranslation: string; createdAt: string };

export default function ArticlesPage() {
  const { classId } = useParams<{ classId: string }>();
  const { data, isLoading } = useQuery<ArticleSummary[]>({
    queryKey: ["articles", classId],
    queryFn: async () => {
      const response = await fetch(`/api/articles?classId=${encodeURIComponent(classId)}`);
      if (!response.ok) throw new Error("Could not load articles");
      const result = await response.json() as { articles: ArticleSummary[] };
      return result.articles;
    },
  });

  return (
    <>
      <FloatingBackButton href="/home" label="Back to home" />
      <div className="fixed inset-x-0 top-0 z-10 bg-[var(--background)]/70 px-6 py-6 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-center">
          <h1 className="text-2xl font-normal">Articles</h1>
        </div>
      </div>
      <div className="mx-auto w-full max-w-2xl space-y-3 p-6 pt-24 pb-44">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
        ) : !data ? (
          <p className="py-12 text-center text-muted-foreground">Articles are unavailable right now.</p>
        ) : data.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">No articles yet. Add one to start reading.</p>
        ) : data.map((item) => (
          <Link key={item.id} href={`/classes/${classId}/articles/${item.id}`}
            className="block rounded-2xl border border-border px-5 py-5 transition-colors hover:border-primary/40">
            <h2 className="text-xl leading-snug">{item.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{item.titleTranslation}</p>
          </Link>
        ))}
      </div>
      <FloatingBar>
        <Link href={`/classes/${classId}/articles/new`}>
          <ActionButton icon={<ArrowUpRight className="h-5 w-5" />}>Add article</ActionButton>
        </Link>
      </FloatingBar>
    </>
  );
}
