import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { VOICES } from "@/lib/voices";
import { db } from "@/db";
import { languageClass } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { voiceName } from "@/lib/voice-names";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const classId = req.nextUrl.searchParams.get("classId");
  let targetLanguage = "en";
  if (classId) {
    if (!/^[0-9a-f-]{36}$/i.test(classId)) return NextResponse.json({ error: "Invalid course ID" }, { status: 400 });
    const [course] = await db.select({ targetLanguage: languageClass.targetLanguage })
      .from(languageClass)
      .where(and(eq(languageClass.id, classId), eq(languageClass.userId, session.user.id)));
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
    targetLanguage = course.targetLanguage;
  }
  return NextResponse.json({ voices: VOICES.map((voice) => ({ ...voice, name: voiceName(voice.id, targetLanguage) })) }, {
    headers: { "Cache-Control": "private, max-age=3600" },
  });
}
