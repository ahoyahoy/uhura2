import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { topic } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const topics = await db
    .select()
    .from(topic)
    .where(eq(topic.userId, session.user.id))
    .orderBy(desc(topic.createdAt));

  return NextResponse.json({ topics });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, description } = await req.json();

  const [created] = await db
    .insert(topic)
    .values({
      userId: session.user.id,
      title,
      description,
    })
    .returning();

  return NextResponse.json({ topic: created });
}
