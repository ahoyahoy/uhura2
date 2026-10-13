import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { quiz, quizQuestion, quizGeneration } from "@/db/schema";
import { and, eq, isNull, lt, ne, or } from "drizzle-orm";
import { generateQuizBatch } from "@/lib/quiz-generation";
import { MAX_QUIZ_QUESTIONS, type QuizMode } from "@/lib/quiz-config";
import { reserveQuizBatch, UUID } from "@/lib/quiz-server";
import { generationError } from "@/lib/generation-error";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid quiz" }, { status: 400 });
  const [entry] = await db.select().from(quiz)
    .where(and(eq(quiz.id, id), eq(quiz.userId, session.user.id), isNull(quiz.deletedAt)));
  if (!entry) return NextResponse.json({ error: "Quiz not found" }, { status: 404 });

  const [newLock] = await db.insert(quizGeneration).values({ quizId: id })
    .onConflictDoNothing().returning({ quizId: quizGeneration.quizId });
  const [reclaimed] = newLock ? [] : await db.update(quizGeneration)
    .set({ status: "generating", updatedAt: new Date() })
    .where(and(eq(quizGeneration.quizId, id), or(ne(quizGeneration.status, "generating"), lt(quizGeneration.updatedAt, new Date(Date.now() - 2 * 60_000)))))
    .returning({ quizId: quizGeneration.quizId });
  if (!newLock && !reclaimed) return NextResponse.json({ error: "Quiz is already generating" }, { status: 409 });

  try {
    const existing = await db.select().from(quizQuestion).where(eq(quizQuestion.quizId, id)).orderBy(quizQuestion.position);
    if (existing.length >= MAX_QUIZ_QUESTIONS) return NextResponse.json({ error: "This quiz is full" }, { status: 409 });
    if (!await reserveQuizBatch(session.user.id)) return NextResponse.json({ error: "Today's quiz limit has been reached" }, { status: 429 });
    const generated = await generateQuizBatch({
      title: entry.title, description: entry.description, mode: entry.mode as QuizMode,
      level: entry.level, questionLanguage: entry.questionLanguage,
      answerLanguage: entry.answerLanguage, options: entry.options,
    }, existing.map(({ prompt, answerIndex, example, explanation }) => ({ prompt, answerIndex, example, explanation })));
    const [live] = await db.select({ id: quiz.id }).from(quiz)
      .where(and(eq(quiz.id, id), eq(quiz.userId, session.user.id), isNull(quiz.deletedAt)));
    if (!live) return NextResponse.json({ error: "Quiz was removed" }, { status: 409 });
    const questions = await db.insert(quizQuestion).values(generated.slice(0, MAX_QUIZ_QUESTIONS - existing.length).map((item, index) => ({
      quizId: id, position: (existing.at(-1)?.position ?? -1) + index + 1,
      prompt: item.prompt, answerIndex: item.answerIndex,
      example: item.example, explanation: item.explanation,
    }))).returning();
    return NextResponse.json({ questions });
  } catch (error) {
    const failure = generationError(error);
    console.error("Quiz continuation failed", failure.code, error instanceof Error ? error.message.slice(0, 300) : "provider error");
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  } finally {
    await db.update(quizGeneration).set({ status: "completed", updatedAt: new Date() })
      .where(eq(quizGeneration.quizId, id));
  }
}
