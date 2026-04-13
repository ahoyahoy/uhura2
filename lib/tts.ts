import { createHash } from "crypto";
import { db } from "@/db";
import { ttsCache } from "@/db/schema";
import { eq } from "drizzle-orm";

function hashText(text: string): string {
  return createHash("md5").update(text).digest("hex");
}

export async function generateSpeech(text: string): Promise<Buffer> {
  const hash = hashText(text);

  // Check DB cache
  const [cached] = await db
    .select({ audio: ttsCache.audio })
    .from(ttsCache)
    .where(eq(ttsCache.textHash, hash));

  if (cached) {
    return cached.audio;
  }

  // Fetch from ElevenLabs
  const response = await fetch(
    "https://api.elevenlabs.io/v1/text-to-speech/UQoLnPXvf18gaKpLzfb8",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": process.env.ELEVENLABS_KEY!,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs TTS failed: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Save to DB cache
  await db.insert(ttsCache).values({
    textHash: hash,
    audio: buffer,
  });

  return buffer;
}
