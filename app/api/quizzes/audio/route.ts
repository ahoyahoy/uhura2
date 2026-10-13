import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { quiz, quizQuestion } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { UUID } from "@/lib/quiz-server";
import { speechForText, TtsError } from "@/lib/tts";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { questionId?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body.questionId !== "string" || !UUID.test(body.questionId)) {
    return NextResponse.json({ error: "Invalid question" }, { status: 400 });
  }
  const [row] = await db.select({ prompt: quizQuestion.prompt, language: quiz.questionLanguage, voiceId: quiz.voiceId })
    .from(quizQuestion).innerJoin(quiz, eq(quiz.id, quizQuestion.quizId))
    .where(and(eq(quizQuestion.id, body.questionId), eq(quiz.userId, session.user.id), isNull(quiz.deletedAt)));
  if (!row) return NextResponse.json({ error: "Question not found" }, { status: 404 });
  try {
    const audio = await speechForText(row.prompt, row.language, row.voiceId);
    return new NextResponse(new Uint8Array(audio), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=31536000, immutable" },
    });
  } catch (error) {
    if (error instanceof TtsError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Quiz audio generation failed", error);
    return NextResponse.json({ error: "Audio unavailable" }, { status: 502 });
  }
}
