import type { LanguageCode } from "./languages";
import { VOICES } from "./voice-catalog";

type SixNames = readonly [string, string, string, string, string, string];

// One stable, readable alias per voice and target language. Keep names in Latin
// script even when the language normally uses another writing system.
export const VOICE_NAMES: Record<LanguageCode, SixNames> = {
  cs: ["Martin", "Tereza", "Jakub", "Klára", "Anna", "Ondřej"],
  en: ["Robert", "Sarah", "George", "Jessica", "Alice", "Will"],
  de: ["Lukas", "Hannah", "Paul", "Lena", "Mia", "Jonas"],
  es: ["Diego", "Lucía", "Mateo", "Sofía", "Elena", "Javier"],
  fr: ["Hugo", "Camille", "Gabriel", "Léa", "Chloé", "Louis"],
  it: ["Marco", "Giulia", "Lorenzo", "Sofia", "Chiara", "Matteo"],
  pt: ["Miguel", "Mariana", "João", "Beatriz", "Ana", "Tiago"],
  nl: ["Daan", "Emma", "Bram", "Sophie", "Lotte", "Lars"],
  pl: ["Jan", "Zofia", "Piotr", "Julia", "Alicja", "Michał"],
  sk: ["Martin", "Zuzana", "Peter", "Lucia", "Nina", "Tomáš"],
  uk: ["Andriy", "Olena", "Dmytro", "Kateryna", "Sofiia", "Maksym"],
  ru: ["Ivan", "Anna", "Dmitry", "Maria", "Elena", "Alexey"],
  ja: ["Haruto", "Yui", "Ren", "Sakura", "Aoi", "Kaito"],
  ko: ["Minjun", "Seoyeon", "Jiho", "Jisoo", "Minji", "Junho"],
  zh: ["Li Wei", "Wang Mei", "Chen Jun", "Lin Na", "Zhang Jing", "Liu Hao"],
  sv: ["Erik", "Elsa", "Johan", "Maja", "Linnea", "Oskar"],
  no: ["Henrik", "Nora", "Jonas", "Ingrid", "Emma", "Emil"],
  da: ["Mikkel", "Freja", "Anders", "Emma", "Sofie", "Oliver"],
  fi: ["Mika", "Aino", "Elias", "Emma", "Sofia", "Onni"],
  tr: ["Emre", "Elif", "Kerem", "Zeynep", "Ayşe", "Mert"],
  ar: ["Omar", "Layla", "Karim", "Salma", "Noor", "Youssef"],
  hi: ["Arjun", "Priya", "Rohan", "Ananya", "Asha", "Kabir"],
};

export function voiceName(voiceId: string | null | undefined, targetLanguage: string): string {
  const index = VOICES.findIndex((voice) => voice.id === voiceId);
  if (index < 0) return "Voice";
  return VOICE_NAMES[targetLanguage as LanguageCode]?.[index] ?? VOICE_NAMES.en[index];
}
