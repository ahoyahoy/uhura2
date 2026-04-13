const cache = new Map<string, string>();

export async function getAudioUrl(text: string): Promise<string> {
  const cached = cache.get(text);
  if (cached) return cached;

  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) throw new Error("TTS fetch failed");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  cache.set(text, url);
  return url;
}
