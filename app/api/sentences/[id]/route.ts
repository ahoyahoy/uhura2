import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { sentence, sentenceProgress, topic } from "@/db/schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function ownedSentence(id: string, userId: string) {
  const [row] = await db.select({ id: sentence.id }).from(sentence)
    .innerJoin(topic, eq(topic.id, sentence.topicId))
    .where(and(eq(sentence.id, id), eq(topic.userId, userId), isNull(topic.deletedAt)));
  return row;
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid sentence ID" }, { status: 400 });
  let body: { sourceText?: unknown; targetText?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const sourceText = typeof body.sourceText === "string" ? body.sourceText.trim() : "";
  const targetText = typeof body.targetText === "string" ? body.targetText.trim() : "";
  if (!sourceText || !targetText || sourceText.length > 350 || targetText.length > 350) {
    return NextResponse.json({ error: "Both sentences must contain 1–350 characters" }, { status: 400 });
  }
  if (!await ownedSentence(id, session.user.id)) return NextResponse.json({ error: "Sentence not found" }, { status: 404 });
  const [updated] = await db.update(sentence).set({ sourceText, targetText })
    .where(eq(sentence.id, id)).returning();
  await db.delete(sentenceProgress).where(eq(sentenceProgress.sentenceId, id));
  return NextResponse.json({ sentence: updated });
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid sentence ID" }, { status: 400 });
  if (!await ownedSentence(id, session.user.id)) return NextResponse.json({ error: "Sentence not found" }, { status: 404 });
  await db.delete(sentence).where(eq(sentence.id, id));
  return NextResponse.json({ ok: true });
}
