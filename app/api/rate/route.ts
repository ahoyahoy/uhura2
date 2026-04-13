import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { sentenceProgress } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  type Grade,
  getNextLevel,
  getNextReviewDate,
} from "@/lib/spaced-repetition";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const sentenceId = body.sentenceId as string;
  const grade = Number(body.grade) as Grade;

  if (![1, 2, 3, 4, 5].includes(grade)) {
    return NextResponse.json({ error: "Invalid grade" }, { status: 400 });
  }

  // Find or create progress
  const [existing] = await db
    .select()
    .from(sentenceProgress)
    .where(
      and(
        eq(sentenceProgress.sentenceId, sentenceId),
        eq(sentenceProgress.userId, session.user.id)
      )
    );

  const currentLevel = existing?.level ?? 0;
  const reps = existing?.repetitions ?? 0;
  const newLevel = getNextLevel(currentLevel, grade);
  const nextReviewAt = getNextReviewDate(newLevel, reps + 1);

  if (existing) {
    await db
      .update(sentenceProgress)
      .set({
        level: newLevel,
        lastGrade: String(grade),
        lastReviewedAt: new Date(),
        nextReviewAt,
        repetitions: existing.repetitions + 1,
      })
      .where(eq(sentenceProgress.id, existing.id));
  } else {
    await db.insert(sentenceProgress).values({
      sentenceId,
      userId: session.user.id,
      level: newLevel,
      lastGrade: String(grade),
      lastReviewedAt: new Date(),
      nextReviewAt,
      repetitions: 1,
    });
  }

  return NextResponse.json({ level: newLevel, nextReviewAt });
}
