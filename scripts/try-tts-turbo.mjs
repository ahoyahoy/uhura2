// Node 22: node --experimental-strip-types --env-file=.env.local scripts/try-tts-turbo.mjs SENTENCE_ID [--generate]
// A single bounded trial. No retries or fallback model, including after an uncertain failure.
import { neon } from "@neondatabase/serverless";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { generateTurboSpeech, turboCacheKey, TURBO_MODEL, TURBO_VOICE } from "../lib/elevenlabs-turbo.ts";

const sentenceId = process.argv[2];
if (!/^[0-9a-f-]{36}$/i.test(sentenceId ?? "")) throw new Error("Provide a sentence ID");
const sql = neon(process.env.DATABASE_URL);
const [sentence] = await sql`
  SELECT s.id, s.target_text, c.target_language
  FROM sentence s JOIN topic t ON t.id = s.topic_id
  JOIN language_class c ON c.id = t.class_id
  WHERE s.id = ${sentenceId} AND t.deleted_at IS NULL`;
if (!sentence) throw new Error("Active sentence not found");
const text = sentence.target_text;
const language = sentence.target_language;
if (text.length > 100) throw new Error("Trial hard limit is 100 characters");
const key = turboCacheKey(text, language);
const [cached] = await sql`SELECT encode(audio, 'base64') AS audio FROM tts_cache WHERE text_hash = ${key}`;
const directory = new URL("../.cache/tts-turbo/", import.meta.url);
await mkdir(directory, { recursive: true });
const audioFile = new URL(`${key}.mp3`, directory);
const markerFile = new URL("trial-attempt.json", directory);
console.log(JSON.stringify({ sentenceId, text, language, model: TURBO_MODEL, voice: TURBO_VOICE,
  characters: text.length, basePriceEstimateUsd: text.length * 0.04 / 1000,
  cacheHit: !!cached, maxRequests: 1, retries: 0 }));

async function saveAudio(buffer) {
  // Local copy first: a database write failure must not cause paid regeneration.
  await writeFile(audioFile, buffer);
  await sql`INSERT INTO tts_cache (text_hash, audio)
    VALUES (${key}, decode(${buffer.toString("base64")}, 'base64'))
    ON CONFLICT (text_hash) DO NOTHING`;
  console.log(JSON.stringify({ saved: audioFile.pathname, bytes: buffer.length, persistentCache: true }));
}

if (cached) {
  await writeFile(audioFile, Buffer.from(cached.audio, "base64"));
  console.log(JSON.stringify({ saved: audioFile.pathname, source: "database-cache" }));
} else {
  let localAudio;
  try { localAudio = await readFile(audioFile); } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (localAudio) {
    await saveAudio(localAudio);
  } else if (process.argv.includes("--generate")) {
    const response = await fetch(`https://api.elevenlabs.io/v1/voices/${TURBO_VOICE}`, {
      headers: { "xi-api-key": process.env.ELEVENLABS_KEY },
    });
    if (!response.ok) throw new Error(`Cannot verify voice price: ${response.status}`);
    const voice = await response.json();
    if (voice.sharing?.rate !== 1 || voice.sharing?.fiat_rate != null) {
      throw new Error("Voice price differs from the costed standard rate");
    }
    // Exclusive, persistent marker caps this experiment at one paid attempt across reruns.
    await writeFile(markerFile, JSON.stringify({ sentenceId, key, characters: text.length, at: new Date() }), { flag: "wx" });
    await saveAudio(await generateTurboSpeech(text, language, process.env.ELEVENLABS_KEY));
  }
}
