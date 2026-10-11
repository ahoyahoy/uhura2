import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { article, articleParagraph, languageClass } from "@/db/schema";

type Context = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: Context) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid article" }, { status: 400 });
  const [row] = await db.select({
    id: article.id, classId: article.classId, title: article.title, titleTranslation: article.titleTranslation,
    sourceUrl: article.sourceUrl,
    targetLanguage: languageClass.targetLanguage, sourceLanguage: languageClass.sourceLanguage,
  }).from(article).innerJoin(languageClass, eq(languageClass.id, article.classId))
    .where(and(eq(article.id, id), eq(article.userId, session.user.id), eq(languageClass.userId, session.user.id), eq(article.status, "ready")));
  if (!row) return NextResponse.json({ error: "Article not found" }, { status: 404 });
  const paragraphs = await db.select({
    id: articleParagraph.id, position: articleParagraph.position,
    targetText: articleParagraph.targetText, sourceText: articleParagraph.sourceText,
  }).from(articleParagraph).where(eq(articleParagraph.articleId, id)).orderBy(articleParagraph.position);
  return NextResponse.json({ article: { ...row, paragraphs } });
}

export async function DELETE(_req: Request, { params }: Context) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid article" }, { status: 400 });
  const [deleted] = await db.delete(article).where(and(eq(article.id, id), eq(article.userId, session.user.id))).returning({ id: article.id });
  if (!deleted) return NextResponse.json({ error: "Article not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
