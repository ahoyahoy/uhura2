import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { languageClass } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const classes = await db
    .select()
    .from(languageClass)
    .where(eq(languageClass.userId, session.user.id))
    .orderBy(desc(languageClass.createdAt));

  return NextResponse.json({ classes });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sourceLanguage, targetLanguage } = await req.json();

  const [created] = await db
    .insert(languageClass)
    .values({
      userId: session.user.id,
      sourceLanguage,
      targetLanguage,
    })
    .returning();

  return NextResponse.json({ class: created });
}
