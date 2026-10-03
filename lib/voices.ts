import { randomInt } from "node:crypto";
import { VOICES } from "./voice-catalog";
export { VOICES } from "./voice-catalog";

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
