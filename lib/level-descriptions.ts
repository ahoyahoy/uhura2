const LEVEL_DESCRIPTIONS: Record<string, string> = {
  A1: "Short, useful utterances about familiar concrete situations with common vocabulary.",
  A2: "Straightforward everyday situations, common phrases and clear context.",
  B1: "Natural everyday language for explaining plans, experiences and reasons when relevant to the goal.",
  B2: "Flexible everyday language with some nuance; avoid needless complexity.",
  C1: "Precise meaning, natural collocations and register appropriate to the situation, including ordinary spoken language.",
  C2: "Fine shades of meaning and register when useful; do not force literary style or rare grammar.",
};

export function getLevelDescription(level: string): string {
  return LEVEL_DESCRIPTIONS[level] ?? LEVEL_DESCRIPTIONS["B1"];
}
