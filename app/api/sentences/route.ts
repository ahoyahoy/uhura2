import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { languageClass, sentence, sentenceProgress, topic } from "@/db/schema";
import { eq, and, asc, isNull } from "drizzle-orm";
import { voiceName } from "@/lib/voice-names";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const topicId = req.nextUrl.searchParams.get("topicId");
  if (!topicId || !UUID.test(topicId)) {
    return NextResponse.json({ error: "Invalid lesson ID" }, { status: 400 });
  }

  const [t] = await db.select().from(topic).where(and(eq(topic.id, topicId), isNull(topic.deletedAt)));
  if (!t || t.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const course = t.classId ? (await db.select({ targetLanguage: languageClass.targetLanguage })
    .from(languageClass)
    .where(and(eq(languageClass.id, t.classId), eq(languageClass.userId, session.user.id))))[0] : null;

  const rows = await db
    .select({
      id: sentence.id,
      sourceText: sentence.sourceText,
      targetText: sentence.targetText,
      voiceId: sentence.voiceId,
      position: sentence.position,
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
    .orderBy(asc(sentence.position));

  const sentences = rows.map((r) => ({
    id: r.id,
    sourceText: r.sourceText,
    targetText: r.targetText,
    voiceId: r.voiceId,
    voiceName: voiceName(r.voiceId, course?.targetLanguage ?? "en"),
    position: r.position,
    progress: r.level !== null
      ? { level: r.level, lastGrade: r.lastGrade, nextReviewAt: r.nextReviewAt }
      : null,
  }));

  return NextResponse.json({ sentences, topic: {
    id: t.id, title: t.title, description: t.description, level: t.level,
    goalKind: t.goalKind, focus: t.focus, practiceStyle: t.practiceStyle, register: t.register,
  } });
}
