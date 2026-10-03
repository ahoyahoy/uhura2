import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { VOICES } from "@/lib/voices";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ voices: VOICES }, {
    headers: { "Cache-Control": "private, max-age=3600" },
  });
}
