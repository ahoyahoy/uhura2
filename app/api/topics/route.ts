import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { topic, sentence, languageClass } from "@/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { generateSentenceBatch, GOAL_KINDS, PRACTICE_STYLES, REGISTERS, type GoalKind, type PracticeStyle, type Register } from "@/lib/sentence-generation";
import { DEFAULT_VOICE_ID, pickVoice, validateVoiceIds } from "@/lib/voices";
import { generationError } from "@/lib/generation-error";
import { readLessonImage, validateLessonImage } from "@/lib/lesson-image";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const topics = await db.select().from(topic).where(and(eq(topic.userId, session.user.id), isNull(topic.deletedAt))).orderBy(desc(topic.createdAt));
  return NextResponse.json({ topics });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const submittedDescription = typeof body.description === "string" ? body.description.trim() : "";
  const submittedFocus = typeof body.focus === "string" ? body.focus.trim() : "";
  const requestedGoalKind = body.goalKind ?? "situation";
  const practiceStyle = body.practiceStyle ?? "varied";
  const register = body.register ?? "neutral_spoken";
  const voiceIds = validateVoiceIds(body.voiceIds ?? [DEFAULT_VOICE_ID]);
  if (submittedDescription.length > 1000 || submittedFocus.length > 200 ||
    typeof body.classId !== "string" || !UUID.test(body.classId) ||
    !LEVELS.includes(String(body.level)) || !GOAL_KINDS.includes(requestedGoalKind as GoalKind) ||
    !PRACTICE_STYLES.includes(practiceStyle as PracticeStyle) || !REGISTERS.includes(register as Register) ||
    !voiceIds || (!submittedDescription && !body.image)) {
    return NextResponse.json({ error: "Check the lesson goal, level and voices" }, { status: 400 });
  }

  const [cls] = await db.select().from(languageClass).where(and(eq(languageClass.id, body.classId), eq(languageClass.userId, session.user.id)));
  if (!cls) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  let imageBrief;
  if (body.image !== undefined) {
    let image: string;
    try { image = validateLessonImage(body.image); }
    catch { return NextResponse.json({ error: "Choose a PNG, JPEG or WebP image under 1.5 MB" }, { status: 400 }); }
    try { imageBrief = await readLessonImage(image, cls.targetLanguage); }
    catch (error) {
      const failure = generationError(error);
      console.error("Lesson image reading failed", failure.code,
        error instanceof Error && !("status" in error) ? error.message.slice(0, 300) : "provider error");
      return NextResponse.json({ error: failure.message }, { status: failure.status });
    }
  }
  const description = submittedDescription || imageBrief?.description || "";
  const goalKind = (!submittedDescription && imageBrief ? imageBrief.goalKind : requestedGoalKind) as GoalKind;
  const focus = goalKind === "grammar" && (!submittedFocus || /^(?:tenses?|verb tenses|grammar|gramatika|časy)$/i.test(submittedFocus))
    ? description.slice(0, 200) : submittedFocus || imageBrief?.focus || "";
  const referenceNotes = imageBrief?.referenceNotes || "";
  if ((goalKind === "vocabulary" || goalKind === "contrast") && !focus) {
    return NextResponse.json({ error: "Add a learning focus" }, { status: 400 });
  }
  let generated;
  try {
    generated = await generateSentenceBatch({
      description, referenceNotes, goalKind, focus, practiceStyle: practiceStyle as PracticeStyle,
      register: register as Register, level: String(body.level),
      sourceLanguage: cls.sourceLanguage, targetLanguage: cls.targetLanguage,
    }, []);
  } catch (error) {
    const failure = generationError(error);
    console.error("Lesson generation failed", failure.code,
      error instanceof Error && !("status" in error) ? error.message.slice(0, 300) : "provider error");
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }

  const [created] = await db.insert(topic).values({
    userId: session.user.id, classId: cls.id, title: generated.title, description, referenceNotes,
    level: String(body.level), goalKind, focus,
    practiceStyle: practiceStyle as PracticeStyle, register: register as Register, voiceIds,
  }).returning();

  let previous: string | null = null;
  try {
    const inserted = await db.insert(sentence).values(generated.sentences.map((pair, position) => {
      const voiceId = pickVoice(voiceIds, previous);
      previous = voiceId;
      return { topicId: created.id, sourceText: pair.source, targetText: pair.target, voiceId, position };
    })).returning();
    return NextResponse.json({ topic: created, sentences: inserted }, { status: 201 });
  } catch (error) {
    await db.delete(topic).where(eq(topic.id, created.id));
    console.error("Lesson save failed", error);
    return NextResponse.json({ error: "Could not save the lesson" }, { status: 500 });
  }
}
