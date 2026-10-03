import { randomInt } from "node:crypto";

// A small, varied selection of voices accessible in this ElevenLabs workspace.
export const VOICES = [
  { id: "UQoLnPXvf18gaKpLzfb8", name: "Robert", description: "Calm · American", gender: "male" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", description: "Warm · American", gender: "female" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", description: "Storyteller · British", gender: "male" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", description: "Bright · American", gender: "female" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", description: "Clear · British", gender: "female" },
  { id: "bIHbv24MWmeRgasZH58o", name: "Will", description: "Relaxed · American", gender: "male" },
] as const;

export const DEFAULT_VOICE_ID = VOICES[0].id;
const allowed = new Set<string>(VOICES.map((voice) => voice.id));

export function isAllowedVoice(id: string): boolean {
  return allowed.has(id);
}

export function validateVoiceIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > VOICES.length ||
    !value.every((id) => typeof id === "string" && allowed.has(id)) ||
    new Set(value).size !== value.length) return null;
  return value;
}

export function pickVoice(voiceIds: readonly string[], previous?: string | null): string {
  const options = voiceIds.filter((id) => id !== previous);
  const pool = options.length ? options : voiceIds;
  if (!pool.length) return DEFAULT_VOICE_ID;
  return pool[randomInt(pool.length)];
}
