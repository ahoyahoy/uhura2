import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { languageClass } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { isAllowedVoice } from "@/lib/voices";
import { VOICE_SAMPLES } from "@/lib/voice-samples";
import { speechForText, TtsError } from "@/lib/tts";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const voiceId = req.nextUrl.searchParams.get("voiceId") ?? "";
  const classId = req.nextUrl.searchParams.get("classId") ?? "";
  if (!isAllowedVoice(voiceId) || !/^[0-9a-f-]{36}$/i.test(classId)) {
    return NextResponse.json({ error: "Invalid preview request" }, { status: 400 });
  }
  const [course] = await db.select({ language: languageClass.targetLanguage })
    .from(languageClass)
    .where(and(eq(languageClass.id, classId), eq(languageClass.userId, session.user.id)));
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  const sample = VOICE_SAMPLES[course.language];
  if (!sample) return NextResponse.json({ error: "No sample for this language" }, { status: 422 });

  try {
    const audio = await speechForText(sample, course.language, voiceId);
    return new NextResponse(new Uint8Array(audio), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=31536000, immutable" },
    });
  } catch (error) {
    if (error instanceof TtsError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Voice preview generation failed", error);
    return NextResponse.json({ error: "Preview unavailable" }, { status: 502 });
  }
}
