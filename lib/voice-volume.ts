// Sarah's recordings are noticeably louder than the other curated voices.
export function voiceVolume(voiceId: string | null | undefined): number {
  return voiceId === "EXAVITQu4vr4xnSDxMaL" ? 0.62 : 1;
}
