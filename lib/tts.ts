import { db } from "@/db";
import { sentence, topic, languageClass, ttsCache, ttsGeneration, ttsDailyBudget } from "@/db/schema";
import { generateTurboSpeech, turboCacheKey } from "@/lib/elevenlabs-turbo";
import { DEFAULT_VOICE_ID, isAllowedVoice, pickVoice } from "@/lib/voices";
import { and, eq, isNull, lt, sql } from "drizzle-orm";

export class TtsError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function cachedAudio(cacheKey: string): Promise<Buffer | null> {
  const [cached] = await db.select({ audio: ttsCache.audio }).from(ttsCache).where(eq(ttsCache.textHash, cacheKey));
  return cached?.audio ?? null;
}

async function awaitOtherGenerator(cacheKey: string): Promise<Buffer> {
  for (let attempt = 0; attempt < 90; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const cached = await cachedAudio(cacheKey);
    if (cached) return cached;
    const [job] = await db.select({ status: ttsGeneration.status }).from(ttsGeneration)
      .where(eq(ttsGeneration.cacheKey, cacheKey));
    if (job?.status === "failed") break;
    if (job?.status === "deferred") throw new TtsError("Daily audio budget reached", 429);
  }
  throw new TtsError("Audio generation needs attention. Please try later.", 503);
}

export async function speechForSentence(sentenceId: string, userId: string): Promise<Buffer> {
  const [row] = await db.select({
    text: sentence.targetText, voiceId: sentence.voiceId, topicId: topic.id,
    voiceIds: topic.voiceIds, language: languageClass.targetLanguage,
  }).from(sentence).innerJoin(topic, eq(topic.id, sentence.topicId))
    .innerJoin(languageClass, eq(languageClass.id, topic.classId))
    .where(and(eq(sentence.id, sentenceId), eq(topic.userId, userId),
      eq(languageClass.userId, userId), isNull(topic.deletedAt)));
  if (!row) throw new TtsError("Sentence not found", 404);
  if (row.text.length > 350) throw new TtsError("Sentence too long for audio", 400);

  let voiceId = row.voiceId;
  if (!voiceId) {
    const candidate = pickVoice(row.voiceIds.length ? row.voiceIds : [DEFAULT_VOICE_ID]);
    const [updated] = await db.update(sentence).set({ voiceId: candidate })
      .where(and(eq(sentence.id, sentenceId), isNull(sentence.voiceId)))
      .returning({ voiceId: sentence.voiceId });
    if (updated) voiceId = updated.voiceId;
    else {
      const [current] = await db.select({ voiceId: sentence.voiceId }).from(sentence).where(eq(sentence.id, sentenceId));
      voiceId = current?.voiceId ?? candidate;
    }
  }
  if (!voiceId || !isAllowedVoice(voiceId)) throw new TtsError("Voice unavailable", 422);

  return speechForText(row.text, row.language, voiceId);
}

/** Auth and ownership must be checked by the caller before using this shared cache. */
export async function speechForText(text: string, language: string, voiceId: string): Promise<Buffer> {
  if (!text.trim() || text.length > 350 || !isAllowedVoice(voiceId)) {
    throw new TtsError("Invalid audio request", 400);
  }
  const key = turboCacheKey(text, language, voiceId);
  const cached = await cachedAudio(key);
  if (cached) return cached;

  const [job] = await db.insert(ttsGeneration).values({ cacheKey: key })
    .onConflictDoNothing().returning({ cacheKey: ttsGeneration.cacheKey });
  if (!job) {
    const [existingJob] = await db.select({ status: ttsGeneration.status, updatedAt: ttsGeneration.updatedAt })
      .from(ttsGeneration).where(eq(ttsGeneration.cacheKey, key));
    const now = new Date();
    const startOfToday = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
    if (existingJob?.status === "deferred" && existingJob.updatedAt >= startOfToday) {
      throw new TtsError("Daily audio budget reached", 429);
    }
    const retryAfter = existingJob?.status === "deferred" ? startOfToday
      : existingJob?.status === "failed" ? new Date(now.getTime() - 60 * 60_000)
      : existingJob?.status === "generating" ? new Date(now.getTime() - 2 * 60_000)
      : null;
    if (!retryAfter) return awaitOtherGenerator(key);
    const [reclaimed] = await db.update(ttsGeneration).set({ status: "generating", updatedAt: now })
      .where(and(eq(ttsGeneration.cacheKey, key), eq(ttsGeneration.status, existingJob!.status), lt(ttsGeneration.updatedAt, retryAfter)))
      .returning({ cacheKey: ttsGeneration.cacheKey });
    if (!reclaimed) return awaitOtherGenerator(key);
  }

  try {
    // Global cap: 10,000 uncached characters per UTC day, including voice samples.
    const day = new Date().toISOString().slice(0, 10);
    const [budget] = await db.insert(ttsDailyBudget).values({ day, characters: text.length })
      .onConflictDoUpdate({ target: ttsDailyBudget.day,
        set: { characters: sql`${ttsDailyBudget.characters} + ${text.length}` },
        setWhere: sql`${ttsDailyBudget.characters} + ${text.length} <= 10000`,
      }).returning({ day: ttsDailyBudget.day });
    if (!budget) throw new TtsError("Daily audio budget reached", 429);
    const audio = await generateTurboSpeech(text, language, process.env.ELEVENLABS_KEY!, voiceId);
    await db.insert(ttsCache).values({ textHash: key, audio }).onConflictDoNothing();
    await db.update(ttsGeneration).set({ status: "completed", updatedAt: new Date() })
      .where(eq(ttsGeneration.cacheKey, key));
    return audio;
  } catch (error) {
    await db.update(ttsGeneration).set({ status: error instanceof TtsError && error.status === 429 ? "deferred" : "failed", updatedAt: new Date() })
      .where(eq(ttsGeneration.cacheKey, key));
    throw error;
  }
}
