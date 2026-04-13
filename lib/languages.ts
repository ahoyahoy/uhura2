export const LANGUAGES = [
  { code: "cs", label: "Czech", flag: "🇨🇿" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "it", label: "Italian", flag: "🇮🇹" },
  { code: "pt", label: "Portuguese", flag: "🇵🇹" },
  { code: "nl", label: "Dutch", flag: "🇳🇱" },
  { code: "pl", label: "Polish", flag: "🇵🇱" },
  { code: "sk", label: "Slovak", flag: "🇸🇰" },
  { code: "uk", label: "Ukrainian", flag: "🇺🇦" },
  { code: "ru", label: "Russian", flag: "🇷🇺" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
  { code: "ko", label: "Korean", flag: "🇰🇷" },
  { code: "zh", label: "Chinese", flag: "🇨🇳" },
  { code: "sv", label: "Swedish", flag: "🇸🇪" },
  { code: "no", label: "Norwegian", flag: "🇳🇴" },
  { code: "da", label: "Danish", flag: "🇩🇰" },
  { code: "fi", label: "Finnish", flag: "🇫🇮" },
  { code: "tr", label: "Turkish", flag: "🇹🇷" },
  { code: "ar", label: "Arabic", flag: "🇸🇦" },
  { code: "hi", label: "Hindi", flag: "🇮🇳" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export function getLanguageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

export function getLanguageFlag(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.flag ?? "";
}
