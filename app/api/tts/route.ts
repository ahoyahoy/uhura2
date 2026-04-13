import { NextRequest, NextResponse } from "next/server";
import { generateSpeech } from "@/lib/tts";

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const audioBuffer = await generateSpeech(text);

  return new NextResponse(new Uint8Array(audioBuffer), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
