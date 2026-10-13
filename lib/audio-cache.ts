const cache = new Map<string, Promise<string>>();

async function getCachedAudioUrl(key: string, endpoint: string, body: object): Promise<string> {
  const cached = cache.get(key);
  if (cached) return cached;
  const pending = (async () => {
    const res = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Audio unavailable");
    return URL.createObjectURL(await res.blob());
  })();
  cache.set(key, pending);
  pending.catch(() => cache.delete(key));
  return pending;
}

export async function getAudioUrl(sentenceId: string): Promise<string> {
  return getCachedAudioUrl(`sentence:${sentenceId}`, "/api/tts", { sentenceId });
}

export async function getQuizAudioUrl(questionId: string): Promise<string> {
  return getCachedAudioUrl(`quiz:${questionId}`, "/api/quizzes/audio", { questionId });
}
