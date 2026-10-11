import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { article, articleParagraph, languageClass } from "@/db/schema";
import { validateArticleText } from "@/lib/article-paragraphs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const classId = req.nextUrl.searchParams.get("classId");
  if (!classId || !UUID.test(classId)) return NextResponse.json({ error: "Invalid course" }, { status: 400 });

  const [course] = await db.select({ id: languageClass.id }).from(languageClass)
    .where(and(eq(languageClass.id, classId), eq(languageClass.userId, session.user.id)));
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const articles = await db.select({ id: article.id, title: article.title, titleTranslation: article.titleTranslation, createdAt: article.createdAt })
    .from(article).where(and(eq(article.classId, classId), eq(article.userId, session.user.id)))
    .orderBy(desc(article.createdAt));
  return NextResponse.json({ articles });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid article" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid article" }, { status: 400 });
  }
  const classId = typeof body.classId === "string" ? body.classId : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const titleTranslation = typeof body.titleTranslation === "string" ? body.titleTranslation.trim() : "";
  const targetText = typeof body.targetText === "string" ? body.targetText : "";
  const sourceText = typeof body.sourceText === "string" ? body.sourceText : "";
  if (!UUID.test(classId) || !title || !titleTranslation || title.length > 160 || titleTranslation.length > 160 ||
    targetText.length > 25_000 || sourceText.length > 25_000) {
    return NextResponse.json({ error: "Check the article title and text" }, { status: 400 });
  }
  const { paragraphs, error } = validateArticleText(targetText, sourceText);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const [course] = await db.select({ id: languageClass.id }).from(languageClass)
    .where(and(eq(languageClass.id, classId), eq(languageClass.userId, session.user.id)));
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const [created] = await db.insert(article).values({ classId, userId: session.user.id, title, titleTranslation }).returning({ id: article.id });
  try {
    await db.insert(articleParagraph).values(paragraphs.map((paragraph, position) => ({ articleId: created.id, position, ...paragraph })));
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (saveError) {
    await db.delete(article).where(eq(article.id, created.id));
    console.error("Article paragraphs could not be saved", saveError);
    return NextResponse.json({ error: "Article could not be saved" }, { status: 500 });
  }
}
