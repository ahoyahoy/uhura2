import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, desc, eq, lt } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { article, articleParagraph, languageClass } from "@/db/schema";
import { validateArticleText } from "@/lib/article-paragraphs";
import { importArticleFromUrl, parsePublicArticleUrl } from "@/lib/article-import";
import { translateImportedArticle } from "@/lib/article-translation";

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
    .from(article).where(and(eq(article.classId, classId), eq(article.userId, session.user.id), eq(article.status, "ready")))
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
  if (!UUID.test(classId)) return NextResponse.json({ error: "Invalid course" }, { status: 400 });
  const [course] = await db.select({
    id: languageClass.id, sourceLanguage: languageClass.sourceLanguage, targetLanguage: languageClass.targetLanguage,
  }).from(languageClass).where(and(eq(languageClass.id, classId), eq(languageClass.userId, session.user.id)));
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  if (typeof body.url === "string") {
    let url: string;
    try { url = parsePublicArticleUrl(body.url.trim()).href; }
    catch { return NextResponse.json({ error: "Enter a public article link" }, { status: 400 }); }

    const staleBefore = new Date(Date.now() - 10 * 60_000);
    const [prior] = await db.select({ id: article.id, status: article.status, createdAt: article.createdAt }).from(article)
      .where(and(eq(article.classId, classId), eq(article.userId, session.user.id), eq(article.sourceUrl, url)));
    if (prior?.status === "ready") return NextResponse.json({ id: prior.id, existing: true });
    if (prior?.status === "importing") {
      if (prior.createdAt >= staleBefore) return NextResponse.json({ error: "This article is already being added" }, { status: 409 });
      await db.delete(article).where(and(eq(article.id, prior.id), eq(article.status, "importing"), lt(article.createdAt, staleBefore)));
    }

    let imported;
    try { imported = await importArticleFromUrl(url, course.targetLanguage); }
    catch (error) {
      console.error("Article extraction failed", error instanceof Error ? error.message.slice(0, 200) : "unknown error");
      return NextResponse.json({ error: "Could not read this article from the link" }, { status: 422 });
    }

    let [created] = await db.insert(article).values({
      classId, userId: session.user.id, title: imported.title, titleTranslation: "",
      sourceUrl: imported.url, status: "importing",
    }).onConflictDoNothing().returning({ id: article.id });
    if (!created) {
      const [duplicate] = await db.select({ id: article.id, status: article.status, createdAt: article.createdAt }).from(article)
        .where(and(eq(article.classId, classId), eq(article.sourceUrl, imported.url)));
      if (duplicate?.status === "ready") return NextResponse.json({ id: duplicate.id, existing: true });
      if (!duplicate || duplicate.createdAt >= staleBefore) {
        return NextResponse.json({ error: "This article is already being added" }, { status: 409 });
      }
      await db.delete(article).where(and(eq(article.id, duplicate.id), eq(article.status, "importing"), lt(article.createdAt, staleBefore)));
      [created] = await db.insert(article).values({
        classId, userId: session.user.id, title: imported.title, titleTranslation: "",
        sourceUrl: imported.url, status: "importing",
      }).onConflictDoNothing().returning({ id: article.id });
      if (!created) return NextResponse.json({ error: "This article is already being added" }, { status: 409 });
    }
    try {
      const translated = await translateImportedArticle(imported, course.sourceLanguage, course.targetLanguage);
      await db.insert(articleParagraph).values(imported.paragraphs.map((targetText, position) => ({
        articleId: created.id, position, targetText, sourceText: translated.paragraphs[position],
      })));
      await db.update(article).set({ titleTranslation: translated.titleTranslation, status: "ready" })
        .where(eq(article.id, created.id));
      return NextResponse.json({ id: created.id }, { status: 201 });
    } catch (error) {
      await db.delete(article).where(eq(article.id, created.id));
      console.error("Article import failed", error instanceof Error ? error.message.slice(0, 200) : "unknown error");
      return NextResponse.json({ error: "Could not add this article right now" }, { status: 502 });
    }
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const titleTranslation = typeof body.titleTranslation === "string" ? body.titleTranslation.trim() : "";
  const targetText = typeof body.targetText === "string" ? body.targetText : "";
  const sourceText = typeof body.sourceText === "string" ? body.sourceText : "";
  if (!title || !titleTranslation || title.length > 160 || titleTranslation.length > 160 ||
    targetText.length > 25_000 || sourceText.length > 25_000) {
    return NextResponse.json({ error: "Check the article title and text" }, { status: 400 });
  }
  const { paragraphs, error } = validateArticleText(targetText, sourceText);
  if (error) return NextResponse.json({ error }, { status: 400 });

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
