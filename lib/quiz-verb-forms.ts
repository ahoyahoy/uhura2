const AUXILIARIES = new Set(["am", "is", "are", "was", "were", "have", "has", "had"]);

export function compactVerbForms(options: string[]): string[] {
  if (options.length !== 4) return options;
  const words = options.map((option) => option.trim().replace(/[.!?]+$/, "").split(/\s+/));
  const shortest = Math.min(...words.map((item) => item.length));
  let subjectLength = 0;
  while (subjectLength < shortest - 1 && words.every((item) => item[subjectLength] === words[0][subjectLength])) {
    subjectLength++;
  }
  if (!subjectLength) return options;
  return words.map((item) => {
    const form = item.slice(subjectLength);
    const auxiliary = form[0]?.toLowerCase();
    const count = AUXILIARIES.has(auxiliary) ? auxiliary === "had" || auxiliary === "have" || auxiliary === "has"
      ? form[1]?.toLowerCase() === "been" ? 3 : 2
      : 2 : 1;
    return item.slice(0, subjectLength + count).join(" ");
  });
}
