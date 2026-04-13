import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { topic, sentence, sentenceProgress } from "@/db/schema";
import { eq, desc, and, lte, sql, count } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { TopicsList } from "@/components/topics-list";

export default async function TopicsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const now = new Date();

  // Get topics with counts of sentences due for review
  const topics = await db
    .select({
      id: topic.id,
      title: topic.title,
      description: topic.description,
      createdAt: topic.createdAt,
    })
    .from(topic)
    .where(eq(topic.userId, session.user.id))
    .orderBy(desc(topic.createdAt));

  // For each topic, count total sentences and due sentences
  const topicsWithCounts = await Promise.all(
    topics.map(async (t) => {
      const [totalResult] = await db
        .select({ value: count() })
        .from(sentence)
        .where(eq(sentence.topicId, t.id));

      // Due = no progress yet OR nextReviewAt <= now
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
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Topics</h1>
        <div className="flex items-center gap-2">
          <SignOutButton />
          <Link href="/topics/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Topic
            </Button>
          </Link>
        </div>
      </div>

      {topicsWithCounts.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          No topics yet. Create your first one!
        </p>
      ) : (
        <TopicsList topics={topicsWithCounts} />
      )}
    </div>
  );
}
