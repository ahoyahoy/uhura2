import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { speechForSentence, TtsError } from "@/lib/tts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { sentenceId?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body.sentenceId !== "string" || !UUID.test(body.sentenceId)) {
    return NextResponse.json({ error: "Invalid sentence ID" }, { status: 400 });
  }
  try {
    const audio = await speechForSentence(body.sentenceId, session.user.id);
    return new NextResponse(new Uint8Array(audio), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=31536000, immutable" },
    });
  } catch (error) {
    if (error instanceof TtsError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Audio generation failed", error);
    return NextResponse.json({ error: "Audio could not be generated" }, { status: 502 });
  }
}
