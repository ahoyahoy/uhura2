const cache = new Map<string, Promise<string>>();

export async function getAudioUrl(sentenceId: string): Promise<string> {
  const cached = cache.get(sentenceId);
  if (cached) return cached;

  const pending = (async () => {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentenceId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Audio unavailable");
    }
    return URL.createObjectURL(await res.blob());
  })();
  cache.set(sentenceId, pending);
  pending.catch(() => cache.delete(sentenceId));
  return pending;
}
