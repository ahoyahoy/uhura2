import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { sentence, sentenceProgress, topic } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const topicId = req.nextUrl.searchParams.get("topicId");
  if (!topicId) {
    return NextResponse.json({ error: "Missing topicId" }, { status: 400 });
  }

  const [t] = await db.select().from(topic).where(eq(topic.id, topicId));
  if (!t || t.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db
    .select({
      id: sentence.id,
      cz: sentence.cz,
      en: sentence.en,
      createdAt: sentence.createdAt,
      level: sentenceProgress.level,
      lastGrade: sentenceProgress.lastGrade,
      nextReviewAt: sentenceProgress.nextReviewAt,
    })
    .from(sentence)
    .leftJoin(
      sentenceProgress,
      and(
        eq(sentenceProgress.sentenceId, sentence.id),
        eq(sentenceProgress.userId, session.user.id)
      )
    )
    .where(eq(sentence.topicId, topicId))
    .orderBy(asc(sentenceProgress.nextReviewAt));

  const sentences = rows.map((r) => ({
    id: r.id,
    cz: r.cz,
    en: r.en,
    progress: r.level !== null
      ? {
          level: r.level,
          lastGrade: r.lastGrade,
          nextReviewAt: r.nextReviewAt,
        }
      : null,
  }));

  // Sort: due for review first, then new (no progress), then future
  const now = new Date();
  sentences.sort((a, b) => {
    const aDue = !a.progress || new Date(a.progress.nextReviewAt!) <= now;
    const bDue = !b.progress || new Date(b.progress.nextReviewAt!) <= now;
    if (aDue && !bDue) return -1;
    if (!aDue && bDue) return 1;
    return 0;
  });

  return NextResponse.json({ sentences, topicTitle: t.title });
}
