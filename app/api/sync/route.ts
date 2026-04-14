import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { languageClass, topic, sentence, sentenceProgress } from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [classes, topics, sentences, progress] = await Promise.all([
    // All language classes
    db
      .select({
        id: languageClass.id,
        sourceLanguage: languageClass.sourceLanguage,
        targetLanguage: languageClass.targetLanguage,
        createdAt: languageClass.createdAt,
      })
      .from(languageClass)
      .where(eq(languageClass.userId, userId))
      .orderBy(desc(languageClass.createdAt)),

    // All topics including soft-deleted (client needs to know about deletions)
    db
      .select({
        id: topic.id,
        classId: topic.classId,
        title: topic.title,
        description: topic.description,
        level: topic.level,
        createdAt: topic.createdAt,
        deletedAt: topic.deletedAt,
      })
      .from(topic)
      .where(eq(topic.userId, userId)),

    // All sentences for user's active topics (deleted topic's sentences are hard-deleted)
    db
      .select({
        id: sentence.id,
        topicId: sentence.topicId,
        sourceText: sentence.sourceText,
        targetText: sentence.targetText,
        createdAt: sentence.createdAt,
      })
      .from(sentence)
      .innerJoin(
        topic,
        and(eq(topic.id, sentence.topicId), eq(topic.userId, userId), isNull(topic.deletedAt))
      ),

    // All progress for user
    db
      .select({
        sentenceId: sentenceProgress.sentenceId,
        level: sentenceProgress.level,
        lastGrade: sentenceProgress.lastGrade,
        lastReviewedAt: sentenceProgress.lastReviewedAt,
        nextReviewAt: sentenceProgress.nextReviewAt,
        repetitions: sentenceProgress.repetitions,
      })
      .from(sentenceProgress)
      .where(eq(sentenceProgress.userId, userId)),
  ]);

  return NextResponse.json({ classes, topics, sentences, progress });
}
