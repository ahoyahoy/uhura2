import { createHash } from "node:crypto";
import { DEFAULT_VOICE_ID, isAllowedVoice } from "./voices.ts";

export const TURBO_MODEL = "eleven_v4_turbo";
export const TURBO_VOICE = DEFAULT_VOICE_ID;
export const TURBO_FORMAT = "mp3_44100_128";

export function turboCacheKey(text: string, language: string, voiceId: string = TURBO_VOICE): string {
  return createHash("sha256")
    .update(JSON.stringify({
      provider: "elevenlabs", model: TURBO_MODEL, voice: voiceId,
      format: TURBO_FORMAT, language, text,
    }))
    .digest("hex");
}

/** Server only. Call after authorization, persistent-cache lookup and cost checks. */
export function generateTurboSpeech(
  text: string,
  language: string,
  apiKey: string,
  voiceId: string = TURBO_VOICE,
): Promise<Buffer> {
  if (!text.trim() || !/^[a-z]{2}$/.test(language) || !apiKey || !isAllowedVoice(voiceId)) {
    return Promise.reject(new Error("Invalid TTS input or missing API key"));
  }

  return new Promise((resolve, reject) => {
    const url = new URL("wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input");
    url.searchParams.set("model_id", TURBO_MODEL);
    url.searchParams.set("output_format", TURBO_FORMAT);
    url.searchParams.set("language_code", language);
    const socket = new WebSocket(url);
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const timer = setTimeout(() => finish(new Error("ElevenLabs TTS timed out")), 45_000);

    function finish(error?: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      if (error) reject(error);
      else if (!size) reject(new Error("ElevenLabs returned no audio"));
      else resolve(Buffer.concat(chunks));
    }

    socket.onopen = () => {
      socket.send(JSON.stringify({ voices: [voiceId], xi_api_key: apiKey }));
      socket.send(JSON.stringify({
        inputs: [{ text, voice_id: voiceId }], close_socket: true,
      }));
    };
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data));
        if (message.error || message.code) {
          finish(new Error(`ElevenLabs: ${message.error ?? message.code}: ${message.message ?? "generation failed"}`));
          return;
        }
        if (typeof message.audio === "string" && message.audio) {
          const chunk = Buffer.from(message.audio, "base64");
          size += chunk.length;
          if (size > 4_000_000) {
            finish(new Error("ElevenLabs audio exceeded size limit"));
            return;
          }
          chunks.push(chunk);
        }
        if (message.is_final === true) finish();
      } catch {
        finish(new Error("Invalid ElevenLabs response"));
      }
    };
    socket.onerror = () => finish(new Error("ElevenLabs connection failed"));
    socket.onclose = () => {
      if (!settled) finish(new Error("ElevenLabs closed before completing the audio"));
    };
  });
}
