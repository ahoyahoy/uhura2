const LEVEL_DESCRIPTIONS: Record<string, string> = {
  A1: "- Use only present simple, basic vocabulary (100-500 words), very short sentences (3-6 words)",
  A2: "- Use present simple/continuous, past simple, basic connectors, simple everyday vocabulary",
  B1: "- Use past tenses, present perfect, conditionals (first), relative clauses, moderate vocabulary",
  B2: "- Use all tenses, passive voice, reported speech, conditionals (second/third), idiomatic expressions",
  C1: "- Use complex structures, subjunctive, inversions, advanced idioms, nuanced vocabulary",
  C2: "- Use sophisticated language, rare idioms, literary expressions, subtle nuances, near-native complexity",
};

export function getLevelDescription(level: string): string {
  return LEVEL_DESCRIPTIONS[level] ?? LEVEL_DESCRIPTIONS["B1"];
}
