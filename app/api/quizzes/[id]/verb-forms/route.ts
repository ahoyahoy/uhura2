import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { quiz, quizQuestion } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { QUIZ_BATCH_SIZE, type QuizPlan } from "@/lib/quiz-config";
import { generateTenseFormBatch } from "@/lib/quiz-tense-form";
import { reserveQuizBatch, UUID } from "@/lib/quiz-server";
import { generationError } from "@/lib/generation-error";

const TITLE = "Choose the English verb form";
const DESCRIPTION = "Choose the natural English verb form for each situation. Every set of answers uses the same subject and verb; the explanation shows why the time, duration or result calls for that form.";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid quiz" }, { status: 400 });
  const [source] = await db.select().from(quiz)
    .where(and(eq(quiz.id, id), eq(quiz.userId, session.user.id), eq(quiz.mode, "tense_family"), isNull(quiz.deletedAt)));
  if (!source) return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  const [previous] = await db.select({ id: quiz.id }).from(quiz)
    .where(and(eq(quiz.sourceQuizId, id), eq(quiz.userId, session.user.id), isNull(quiz.deletedAt)));
  if (previous) return NextResponse.json({ quiz: previous });
  const sources = (await db.select().from(quizQuestion).where(eq(quizQuestion.quizId, id)).orderBy(quizQuestion.position))
    .slice(0, QUIZ_BATCH_SIZE)
    .map(({ position, prompt, answerIndex, example, explanation }) => ({ position, prompt, answerIndex, example, explanation }));
  if (!sources.length) return NextResponse.json({ error: "No questions yet" }, { status: 409 });
  if (!await reserveQuizBatch(session.user.id)) return NextResponse.json({ error: "Today's quiz limit has been reached" }, { status: 429 });
  const plan: QuizPlan = { title: TITLE, description: DESCRIPTION, mode: "tense_form", level: source.level,
    questionLanguage: source.questionLanguage, answerLanguage: "en", options: [] };
  let generated;
  try { generated = await generateTenseFormBatch(plan, [], sources); }
  catch (error) {
    const failure = generationError(error);
    console.error("Verb-form quiz creation failed", failure.code, error instanceof Error ? error.message.slice(0, 300) : "provider error");
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
  const [created] = await db.insert(quiz).values({ classId: source.classId, userId: session.user.id,
    title: TITLE, description: DESCRIPTION, mode: "tense_form", level: source.level,
    questionLanguage: source.questionLanguage, answerLanguage: "en", options: [],
    sourceQuizId: source.id, voiceId: source.voiceId }).returning({ id: quiz.id });
  try {
    await db.insert(quizQuestion).values(generated.map((item, position) => ({
      quizId: created.id, position, prompt: item.prompt, answerIndex: item.answerIndex,
      options: item.options ?? [], familyIndex: item.familyIndex ?? null,
      example: item.example, explanation: item.explanation,
    })));
    return NextResponse.json({ quiz: created }, { status: 201 });
  } catch (error) {
    await db.delete(quiz).where(eq(quiz.id, created.id));
    console.error("Verb-form quiz save failed", error);
    return NextResponse.json({ error: "Could not save the quiz" }, { status: 500 });
  }
}
