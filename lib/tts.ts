import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const CACHE_DIR = join(process.cwd(), ".cache", "tts");

function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getCachePath(text: string): string {
  const hash = createHash("md5").update(text).digest("hex");
  return join(CACHE_DIR, `${hash}.mp3`);
}

export async function generateSpeech(text: string): Promise<Buffer> {
  ensureCacheDir();

  const cachePath = getCachePath(text);

  // Return cached audio if exists
  if (existsSync(cachePath)) {
    return readFileSync(cachePath);
  }

  const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/UQoLnPXvf18gaKpLzfb8", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": process.env.ELEVENLABS_KEY!,
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
    }),
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs TTS failed: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Save to cache
  writeFileSync(cachePath, buffer);

  return buffer;
}
