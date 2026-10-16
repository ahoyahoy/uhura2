const AUXILIARIES = new Set(["am", "is", "are", "was", "were", "have", "has", "had"]);
const ADVERBS = new Set(["already", "always", "ever", "just", "never", "often", "recently", "still", "usually"]);

export function compactVerbForms(options: string[], example = ""): string[] {
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
    const selected: string[] = [];
    let cursor = 0;
    while (ADVERBS.has(form[cursor]?.toLowerCase())) cursor++;
    const auxiliary = form[cursor]?.toLowerCase();
    if (AUXILIARIES.has(auxiliary)) {
      selected.push(form[cursor++]);
      while (ADVERBS.has(form[cursor]?.toLowerCase())) cursor++;
      if (form[cursor]?.toLowerCase() === "been") {
        selected.push(form[cursor++]);
        while (ADVERBS.has(form[cursor]?.toLowerCase())) cursor++;
      }
    }
    if (form[cursor]) selected.push(form[cursor]);
    else if (example) {
      const phrase = item.join(" ").toLowerCase();
      const match = example.replace(/[.!?,;:]+/g, "").split(/\s+/);
      for (let index = 0; index <= match.length - item.length; index++) {
        if (match.slice(index, index + item.length).join(" ").toLowerCase() === phrase) {
          if (match[index + item.length]) selected.push(match[index + item.length]);
          break;
        }
      }
    }
    return [...item.slice(0, subjectLength), ...selected].join(" ");
  });
}
