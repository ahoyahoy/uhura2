import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { topic, sentence, sentenceProgress } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [t] = await db
    .select()
    .from(topic)
    .where(and(eq(topic.id, id), eq(topic.userId, session.user.id)));

  if (!t) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete progress for sentences in this topic
  const topicSentences = await db
    .select({ id: sentence.id })
    .from(sentence)
    .where(eq(sentence.topicId, id));

  if (topicSentences.length > 0) {
    await db.delete(sentenceProgress).where(
      inArray(
        sentenceProgress.sentenceId,
        topicSentences.map((s) => s.id)
      )
    );
  }

  // Sentences cascade-delete, but progress doesn't
  await db.delete(topic).where(eq(topic.id, id));

  return NextResponse.json({ ok: true });
}
