import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { sentence, sentenceProgress, topic } from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { weightedShuffle } from "@/lib/spaced-repetition";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const topicIds = req.nextUrl.searchParams.get("topics")?.split(",") ?? [];
  if (topicIds.length === 0) {
    return NextResponse.json({ sentences: [] });
  }

  const now = new Date();

  const rows = await db
    .select({
      id: sentence.id,
      cz: sentence.cz,
      en: sentence.en,
      topicTitle: topic.title,
      level: sentenceProgress.level,
      lastGrade: sentenceProgress.lastGrade,
      nextReviewAt: sentenceProgress.nextReviewAt,
    })
    .from(sentence)
    .innerJoin(topic, eq(topic.id, sentence.topicId))
    .leftJoin(
      sentenceProgress,
      and(
        eq(sentenceProgress.sentenceId, sentence.id),
        eq(sentenceProgress.userId, session.user.id)
      )
    )
    .where(
      and(
        inArray(sentence.topicId, topicIds),
        eq(topic.userId, session.user.id),
        sql`(${sentenceProgress.nextReviewAt} IS NULL OR ${sentenceProgress.nextReviewAt} <= ${now})`
      )
    );

  // Weighted shuffle - prioritizuje věty, které jsi déle neviděl a jsou těžší
  const mapped = rows.map((r) => ({
    id: r.id,
    cz: r.cz,
    en: r.en,
    topicTitle: r.topicTitle,
    lastReviewedAt: r.nextReviewAt,
    level: r.level,
    progress:
      r.level !== null
        ? { level: r.level, lastGrade: r.lastGrade }
        : null,
  }));

  const sentences = weightedShuffle(mapped).map(
    ({ lastReviewedAt, level, ...rest }) => rest
  );

  return NextResponse.json({ sentences }, {
    headers: { "Cache-Control": "no-store" },
  });
}
