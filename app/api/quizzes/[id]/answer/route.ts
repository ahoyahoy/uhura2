import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { quiz, quizQuestion, quizProgress } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getNextLevel, getNextReviewDate, type Grade } from "@/lib/spaced-repetition";
import { UUID } from "@/lib/quiz-server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  let body: { questionId?: unknown; selectedIndex?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!UUID.test(id) || typeof body.questionId !== "string" || !UUID.test(body.questionId) ||
    !Number.isInteger(body.selectedIndex)) return NextResponse.json({ error: "Invalid answer" }, { status: 400 });
  const [row] = await db.select({ question: quizQuestion, quizOptions: quiz.options })
    .from(quizQuestion).innerJoin(quiz, eq(quiz.id, quizQuestion.quizId))
    .where(and(eq(quiz.id, id), eq(quizQuestion.id, body.questionId), eq(quiz.userId, session.user.id), isNull(quiz.deletedAt)));
  const options = row?.question.options.length ? row.question.options : row?.quizOptions;
  if (!row || !options || (body.selectedIndex as number) < 0 || (body.selectedIndex as number) >= options.length) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }
  const correct = body.selectedIndex === row.question.answerIndex;
  const [existing] = await db.select().from(quizProgress)
    .where(and(eq(quizProgress.questionId, row.question.id), eq(quizProgress.userId, session.user.id)));
  const grade: Grade = correct ? existing?.lastGrade === "5" ? 2 : 1 : 5;
  const level = getNextLevel(existing?.level ?? 0, grade);
  const repetitions = (existing?.repetitions ?? 0) + 1;
  const now = new Date();
  const nextReviewAt = correct ? getNextReviewDate(level, repetitions) : now;
  const [progress] = await db.insert(quizProgress).values({
    questionId: row.question.id, userId: session.user.id, level, lastGrade: String(grade),
    lastReviewedAt: now, nextReviewAt, repetitions,
  }).onConflictDoUpdate({ target: [quizProgress.questionId, quizProgress.userId], set: {
    level, lastGrade: String(grade), lastReviewedAt: now, nextReviewAt,
    repetitions: sql`${quizProgress.repetitions} + 1`,
  } }).returning();
  return NextResponse.json({ correct, answerIndex: row.question.answerIndex,
    progress: { level: progress.level, lastGrade: progress.lastGrade,
      lastReviewedAt: progress.lastReviewedAt, nextReviewAt: progress.nextReviewAt,
      repetitions: progress.repetitions } });
}
