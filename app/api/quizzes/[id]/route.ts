import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { quiz, quizQuestion, quizProgress } from "@/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { UUID } from "@/lib/quiz-server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid quiz" }, { status: 400 });
  const [entry] = await db.select().from(quiz)
    .where(and(eq(quiz.id, id), eq(quiz.userId, session.user.id), isNull(quiz.deletedAt)));
  if (!entry) return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  const questions = await db.select().from(quizQuestion).where(eq(quizQuestion.quizId, id)).orderBy(quizQuestion.position);
  const progress = questions.length ? await db.select().from(quizProgress)
    .where(and(eq(quizProgress.userId, session.user.id), inArray(quizProgress.questionId, questions.map((item) => item.id)))) : [];
  return NextResponse.json({ quiz: entry, questions, progress }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid quiz" }, { status: 400 });
  const [removed] = await db.update(quiz).set({ deletedAt: new Date() })
    .where(and(eq(quiz.id, id), eq(quiz.userId, session.user.id), isNull(quiz.deletedAt)))
    .returning({ id: quiz.id });
  if (!removed) return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
