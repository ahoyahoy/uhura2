import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { topic, sentence, sentenceProgress, languageClass } from "@/db/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";
import { TopicsList } from "@/components/topics-list";
import { getLanguageLabel, getLanguageFlag } from "@/lib/languages";

export default async function ClassTopicsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const { classId } = await params;

  const [cls] = await db
    .select()
    .from(languageClass)
    .where(
      and(
        eq(languageClass.id, classId),
        eq(languageClass.userId, session.user.id)
      )
    );

  if (!cls) redirect("/classes");

  const now = new Date();

  const topics = await db
    .select({
      id: topic.id,
      title: topic.title,
      description: topic.description,
      level: topic.level,
      createdAt: topic.createdAt,
    })
    .from(topic)
    .where(and(eq(topic.classId, classId), eq(topic.userId, session.user.id)))
    .orderBy(desc(topic.createdAt));

  const topicsWithCounts = await Promise.all(
    topics.map(async (t) => {
      const [totalResult] = await db
        .select({ value: count() })
        .from(sentence)
        .where(eq(sentence.topicId, t.id));

      const [dueResult] = await db
        .select({ value: count() })
        .from(sentence)
        .leftJoin(
          sentenceProgress,
          and(
            eq(sentenceProgress.sentenceId, sentence.id),
            eq(sentenceProgress.userId, session.user.id)
          )
        )
        .where(
          and(
            eq(sentence.topicId, t.id),
            sql`(${sentenceProgress.nextReviewAt} IS NULL OR ${sentenceProgress.nextReviewAt} <= ${now})`
          )
        );

      return {
        ...t,
        totalSentences: totalResult.value,
        dueSentences: dueResult.value,
      };
    })
  );

  return (
    <div className="w-full max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/classes"
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold">
            {getLanguageFlag(cls.sourceLanguage)} → {getLanguageFlag(cls.targetLanguage)}{" "}
            <span className="text-base font-normal text-muted-foreground">
              {getLanguageLabel(cls.targetLanguage)}
            </span>
          </h1>
        </div>
        <Link href={`/classes/${classId}/new`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Topic
          </Button>
        </Link>
      </div>

      {topicsWithCounts.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          No topics yet. Create your first one!
        </p>
      ) : (
        <TopicsList topics={topicsWithCounts} classId={classId} />
      )}
    </div>
  );
}
