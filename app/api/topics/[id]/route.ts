import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { topic, sentence, sentenceProgress, ttsCache } from "@/db/schema";
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

  // Get all sentences for this topic
  const topicSentences = await db
    .select({ id: sentence.id, targetText: sentence.targetText })
    .from(sentence)
    .where(eq(sentence.topicId, id));

  if (topicSentences.length > 0) {
    const sentenceIds = topicSentences.map((s) => s.id);

    // Delete progress
    await db
      .delete(sentenceProgress)
      .where(inArray(sentenceProgress.sentenceId, sentenceIds));

    // Delete cached audio
    const hashes = topicSentences.map((s) =>
      createHash("md5").update(s.targetText).digest("hex")
    );
    await db.delete(ttsCache).where(inArray(ttsCache.textHash, hashes));
  }

  // Delete topic (sentences cascade-delete)
  await db.delete(topic).where(eq(topic.id, id));

  return NextResponse.json({ ok: true });
}
