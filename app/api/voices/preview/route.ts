import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isAllowedVoice } from "@/lib/voices";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const voiceId = req.nextUrl.searchParams.get("voiceId") ?? "";
  if (!isAllowedVoice(voiceId)) return NextResponse.json({ error: "Unknown voice" }, { status: 400 });

  const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
    headers: { "xi-api-key": process.env.ELEVENLABS_KEY! }, next: { revalidate: 3600 },
  });
  if (!response.ok) return NextResponse.json({ error: "Preview unavailable" }, { status: 502 });
  const voice = await response.json() as { preview_url?: string };
  if (!voice.preview_url || new URL(voice.preview_url).protocol !== "https:") {
    return NextResponse.json({ error: "Preview unavailable" }, { status: 502 });
  }
  const audio = await fetch(voice.preview_url);
  if (!audio.ok || Number(audio.headers.get("content-length") ?? 0) > 2_000_000) {
    return NextResponse.json({ error: "Preview unavailable" }, { status: 502 });
  }
  const bytes = await audio.arrayBuffer();
  if (bytes.byteLength > 2_000_000) return NextResponse.json({ error: "Preview too large" }, { status: 502 });
  return new NextResponse(bytes, {
    headers: { "Content-Type": audio.headers.get("content-type") ?? "audio/mpeg", "Cache-Control": "private, max-age=86400" },
  });
}
