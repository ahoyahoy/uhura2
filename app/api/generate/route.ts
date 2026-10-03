import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { sentence, topic, languageClass, topicGeneration } from "@/db/schema";
import { and, eq, isNull, ne } from "drizzle-orm";
import { generateSentenceBatch, type GoalKind, type PracticeStyle, type Register } from "@/lib/sentence-generation";
import { DEFAULT_VOICE_ID, pickVoice } from "@/lib/voices";
import { generationError } from "@/lib/generation-error";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { topicId?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body.topicId !== "string" || !UUID.test(body.topicId)) {
    return NextResponse.json({ error: "Invalid lesson ID" }, { status: 400 });
  }
  const [row] = await db.select({ lesson: topic, cls: languageClass })
    .from(topic).innerJoin(languageClass, eq(topic.classId, languageClass.id))
    .where(and(eq(topic.id, body.topicId), eq(topic.userId, session.user.id), eq(languageClass.userId, session.user.id), isNull(topic.deletedAt)));
  if (!row) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

  // One paid generation at a time per lesson, including across server instances.
  const [insertedLock] = await db.insert(topicGeneration).values({ topicId: body.topicId })
    .onConflictDoNothing().returning({ topicId: topicGeneration.topicId });
  const [reclaimedLock] = insertedLock ? [] : await db.update(topicGeneration)
    .set({ status: "generating", updatedAt: new Date() })
    .where(and(eq(topicGeneration.topicId, body.topicId), ne(topicGeneration.status, "generating")))
    .returning({ topicId: topicGeneration.topicId });
  if (!insertedLock && !reclaimedLock) {
    return NextResponse.json({ error: "This lesson is already generating. Please wait." }, { status: 409 });
  }

  try {
    const existingRows = await db.select({ source: sentence.sourceText, target: sentence.targetText, voiceId: sentence.voiceId, position: sentence.position })
      .from(sentence).where(eq(sentence.topicId, body.topicId)).orderBy(sentence.position);
    const generated = await generateSentenceBatch({
      description: row.lesson.description, goalKind: row.lesson.goalKind as GoalKind,
      focus: row.lesson.focus, practiceStyle: row.lesson.practiceStyle as PracticeStyle,
      register: row.lesson.register as Register, level: row.lesson.level,
      sourceLanguage: row.cls.sourceLanguage, targetLanguage: row.cls.targetLanguage,
    }, existingRows.map(({ source, target }) => ({ source, target })));

    // Re-check deletion after a possibly long AI call.
    const [live] = await db.select({ id: topic.id }).from(topic)
      .where(and(eq(topic.id, body.topicId), eq(topic.userId, session.user.id), isNull(topic.deletedAt)));
    if (!live) return NextResponse.json({ error: "Lesson was removed" }, { status: 409 });

    const voiceIds = row.lesson.voiceIds.length ? row.lesson.voiceIds : [DEFAULT_VOICE_ID];
    let previous = existingRows.at(-1)?.voiceId ?? null;
    const nextPosition = (existingRows.at(-1)?.position ?? -1) + 1;
    const inserted = await db.insert(sentence).values(generated.sentences.map((pair, index) => {
      const voiceId = pickVoice(voiceIds, previous);
      previous = voiceId;
      return { topicId: body.topicId as string, sourceText: pair.source, targetText: pair.target, voiceId, position: nextPosition + index };
    })).returning();
    await db.update(topicGeneration).set({ status: "completed", updatedAt: new Date() })
      .where(eq(topicGeneration.topicId, body.topicId));
    return NextResponse.json({ sentences: inserted });
  } catch (error) {
    await db.update(topicGeneration).set({ status: "failed", updatedAt: new Date() })
      .where(eq(topicGeneration.topicId, body.topicId));
    const failure = generationError(error);
    console.error("Lesson continuation failed", failure.code);
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
}
