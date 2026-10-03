import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { VOICES } from "@/lib/voices";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const response = await fetch("https://api.elevenlabs.io/v1/voices?page_size=100", {
    headers: { "xi-api-key": process.env.ELEVENLABS_KEY! },
    next: { revalidate: 3600 },
  });
  if (!response.ok) return NextResponse.json({ error: "Voices are temporarily unavailable" }, { status: 502 });
  const body = await response.json() as { voices?: { voice_id: string }[] };
  const accessible = new Set((body.voices ?? []).map((voice) => voice.voice_id));
  return NextResponse.json({ voices: VOICES.filter((voice) => accessible.has(voice.id)) }, {
    headers: { "Cache-Control": "private, max-age=3600" },
  });
}
