import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { languageClass, quiz, quizQuestion, quizProgress } from "@/db/schema";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { generateQuizBatch } from "@/lib/quiz-generation";
import { parseQuizPlan, reserveQuizBatch, UUID } from "@/lib/quiz-server";
import { generationError } from "@/lib/generation-error";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const classId = req.nextUrl.searchParams.get("classId");
  if (classId && !UUID.test(classId)) return NextResponse.json({ error: "Invalid course" }, { status: 400 });
  const quizzes = await db.select().from(quiz)
    .where(and(eq(quiz.userId, session.user.id), isNull(quiz.deletedAt), classId ? eq(quiz.classId, classId) : undefined))
    .orderBy(desc(quiz.createdAt));
  if (!quizzes.length) return NextResponse.json({ quizzes: [] });
  const questions = await db.select({ id: quizQuestion.id, quizId: quizQuestion.quizId }).from(quizQuestion)
    .where(inArray(quizQuestion.quizId, quizzes.map((item) => item.id)));
  const progress = questions.length ? await db.select({ questionId: quizProgress.questionId, nextReviewAt: quizProgress.nextReviewAt })
    .from(quizProgress)
    .where(and(eq(quizProgress.userId, session.user.id), inArray(quizProgress.questionId, questions.map((item) => item.id)))) : [];
  const nextById = new Map(progress.map((item) => [item.questionId, item.nextReviewAt]));
  const now = Date.now();
  return NextResponse.json({ quizzes: quizzes.map((item) => {
    const own = questions.filter((question) => question.quizId === item.id);
    return { ...item, questionCount: own.length,
      dueCount: own.filter((question) => !nextById.has(question.id) || nextById.get(question.id)!.getTime() <= now).length };
  }) });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const plan = parseQuizPlan(body);
  if (!plan) return NextResponse.json({ error: "Check the quiz settings" }, { status: 400 });
  const [course] = await db.select({ id: languageClass.id }).from(languageClass)
    .where(and(eq(languageClass.id, plan.classId), eq(languageClass.userId, session.user.id)));
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  if (!await reserveQuizBatch(session.user.id)) return NextResponse.json({ error: "Today's quiz limit has been reached" }, { status: 429 });

  let generated;
  try { generated = await generateQuizBatch(plan, []); }
  catch (error) {
    const failure = generationError(error);
    console.error("Quiz generation failed", failure.code, error instanceof Error ? error.message.slice(0, 300) : "provider error");
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
  const [created] = await db.insert(quiz).values({
    classId: plan.classId, userId: session.user.id, title: plan.title, description: plan.description,
    mode: plan.mode, level: plan.level, questionLanguage: plan.questionLanguage,
    answerLanguage: plan.answerLanguage, options: plan.options, voiceId: plan.voiceId,
  }).returning();
  try {
    const questions = await db.insert(quizQuestion).values(generated.map((item, position) => ({
      quizId: created.id, position, prompt: item.prompt, answerIndex: item.answerIndex,
      example: item.example, explanation: item.explanation,
    }))).returning();
    return NextResponse.json({ quiz: created, questions }, { status: 201 });
  } catch (error) {
    await db.delete(quiz).where(eq(quiz.id, created.id));
    console.error("Quiz save failed", error);
    return NextResponse.json({ error: "Could not save the quiz" }, { status: 500 });
  }
}
