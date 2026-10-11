import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { article, articleParagraph, languageClass } from "@/db/schema";
import { speechForText, TtsError } from "@/lib/tts";
import { DEFAULT_VOICE_ID } from "@/lib/voices";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ paragraphId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { paragraphId } = await params;
  if (!UUID.test(paragraphId)) return NextResponse.json({ error: "Invalid paragraph" }, { status: 400 });
  const [row] = await db.select({ text: articleParagraph.targetText, language: languageClass.targetLanguage })
    .from(articleParagraph).innerJoin(article, eq(article.id, articleParagraph.articleId))
    .innerJoin(languageClass, eq(languageClass.id, article.classId))
    .where(and(eq(articleParagraph.id, paragraphId), eq(article.userId, session.user.id), eq(languageClass.userId, session.user.id)));
  if (!row) return NextResponse.json({ error: "Paragraph not found" }, { status: 404 });
  try {
    const audio = await speechForText(row.text, row.language, DEFAULT_VOICE_ID);
    return new NextResponse(new Uint8Array(audio), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof TtsError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Article audio generation failed", error);
    return NextResponse.json({ error: "Audio could not be played" }, { status: 502 });
  }
}
