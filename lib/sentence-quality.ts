export type SentencePair = { source: string; target: string };

export type SentenceQualityPlan = {
  goalKind: string;
  practiceStyle: "fixed" | "varied" | "situational";
  level: string;
  sourceLanguage: string;
  targetLanguage: string;
};

function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\p{P}\p{S}]/gu, " ").replace(/\s+/g, " ").trim();
}

function isNearCopy(a: string, b: string): boolean {
  const leftWords = normalize(a).split(" ");
  const rightWords = normalize(b).split(" ");
  let samePrefix = 0;
  while (samePrefix < Math.min(leftWords.length, rightWords.length) && leftWords[samePrefix] === rightWords[samePrefix]) samePrefix++;
  const additionalClause = (value: string) => /[?!.;].+\S/.test(value.trim().replace(/[?!.;]\s*$/, ""));
  if ((samePrefix >= 4 || (samePrefix >= 3 && Math.max(leftWords.length, rightWords.length) <= 7)) &&
    !additionalClause(a) && !additionalClause(b)) return true;
  const left = new Set(leftWords);
  const right = new Set(rightWords);
  const union = new Set([...left, ...right]);
  return union.size > 0 && [...left].filter((word) => right.has(word)).length / union.size >= 0.8;
}

function isShortVariedGrammar(plan: SentenceQualityPlan): boolean {
  return plan.goalKind === "grammar" && plan.practiceStyle === "varied" &&
    (plan.level === "A1" || plan.level === "A2");
}

function hasMultipleClauses(pair: SentencePair, targetLanguage: string): boolean {
  const multiplePhrases = (text: string) => /[;；:：]\s*\S|[.!?。！？]\s*\S/.test(text.trim().replace(/[.!?。！？]\s*$/, ""));
  if (targetLanguage === "en") {
    return multiplePhrases(pair.target) ||
      /,\s*(?:but|and|so|because|while|although)\b|\b(?:but|although|however)\b/i.test(pair.target);
  }
  return multiplePhrases(pair.source) || multiplePhrases(pair.target) ||
    /[,，、]\s*\S/.test(pair.target);
}

function tooLongForA2(pair: SentencePair, plan: SentenceQualityPlan): boolean {
  return plan.targetLanguage === "en" && pair.target.trim().split(/\s+/).length > 14;
}

function opening(text: string): string {
  return normalize(text).split(" ").slice(0, 2).join(" ");
}

function hasAmbiguousCzechSubject(pair: SentencePair, plan: SentenceQualityPlan): boolean {
  if (plan.sourceLanguage !== "cs" || plan.targetLanguage !== "en") return false;
  const targetSubject = pair.target.match(/^(?:(he|she)\b|(?:(?:does|did|is|was|can|will|has)|(?:what|where|when|why|how)\s+(?:does|did|is|was|can|will|has))\s+(he|she)\b)/i);
  const subject = (targetSubject?.[1] ?? targetSubject?.[2])?.toLowerCase();
  if (!subject) return false;
  return !new RegExp(`\\b${subject === "he" ? "on" : "ona"}\\b`, "i").test(pair.source);
}

export function parseSentencePairs(value: unknown): SentencePair[] {
  if (!Array.isArray(value) || value.length > 10 || value.length === 0) {
    throw new Error("AI returned an invalid number of sentences");
  }
  const accepted: SentencePair[] = [];
  const seenSource = new Set<string>();
  const seenTarget = new Set<string>();
  for (const item of value) {
    if (!item || typeof item.source !== "string" || typeof item.target !== "string") continue;
    const source = item.source.trim();
    const target = item.target.trim();
    if (!source || !target || source.length > 350 || target.length > 350) continue;
    const normalizedSource = normalize(source);
    const normalizedTarget = normalize(target);
    if (seenSource.has(normalizedSource) || seenTarget.has(normalizedTarget)) continue;
    seenSource.add(normalizedSource);
    seenTarget.add(normalizedTarget);
    accepted.push({ source, target });
  }
  if (!accepted.length) throw new Error("AI did not provide any usable sentences");
  return accepted;
}

export function batchQualityIssues(pairs: SentencePair[], plan: SentenceQualityPlan): string[] {
  const issues: string[] = [];
  const ambiguousSubjectCount = pairs.filter((pair) => hasAmbiguousCzechSubject(pair, plan)).length;
  if (ambiguousSubjectCount > 0) issues.push(`${ambiguousSubjectCount} English he/she subjects have no matching explicit Czech pronoun; make the source unambiguous.`);
  if (!isShortVariedGrammar(plan)) return issues;
  const compoundCount = pairs.filter((pair) => hasMultipleClauses(pair, plan.targetLanguage)).length;
  const longCount = pairs.filter((pair) => tooLongForA2(pair, plan)).length;
  const openings = new Map<string, number>();
  for (const pair of pairs) {
    const key = opening(pair.target);
    if (key) openings.set(key, (openings.get(key) ?? 0) + 1);
  }
  if (compoundCount > 2) issues.push(`${compoundCount} sentences use multiple clauses or a repeated contrast frame; use at most two and write mostly single, independent utterances.`);
  if (longCount > 0) issues.push(`${longCount} target sentences exceed 14 words; shorten them without losing the grammar goal.`);
  if ([...openings.values()].some((count) => count > 2)) issues.push("Several sentences begin with the same two words; vary their communicative use and sentence shape.");
  return issues;
}

export function filterSentencePairs(
  value: unknown,
  existing: SentencePair[],
  plan: SentenceQualityPlan,
  requiredHeadword: string | null = null,
): SentencePair[] {
  const candidates = parseSentencePairs(value);
  const accepted: SentencePair[] = [];
  const prior = existing.map((pair) => ({ source: normalize(pair.source), target: normalize(pair.target) }));
  let compoundCount = 0;
  const openings = new Map<string, number>();
  for (const pair of candidates) {
    if (requiredHeadword && !new RegExp(`\\b${requiredHeadword}(?:s|es|ed|d|ing)?\\b`, "i").test(pair.target)) continue;
    if (hasAmbiguousCzechSubject(pair, plan)) continue;
    const exact = prior.some((item) => item.source === normalize(pair.source) || item.target === normalize(pair.target));
    const near = plan.practiceStyle !== "fixed" && [...existing, ...accepted].some((item) => isNearCopy(pair.target, item.target));
    if (exact || near) continue;
    if (isShortVariedGrammar(plan)) {
      if (tooLongForA2(pair, plan)) continue;
      const key = opening(pair.target);
      if ((openings.get(key) ?? 0) >= 2) continue;
      if (hasMultipleClauses(pair, plan.targetLanguage)) {
        if (compoundCount >= 2) continue;
        compoundCount++;
      }
      openings.set(key, (openings.get(key) ?? 0) + 1);
    }
    accepted.push(pair);
    prior.push({ source: normalize(pair.source), target: normalize(pair.target) });
  }
  if (!accepted.length) throw new Error("AI did not provide any new usable sentences");
  if (plan.level === "A2" && isShortVariedGrammar(plan) && existing.length === 0 && accepted.length < 5) {
    throw new Error("AI did not provide enough short, varied sentences for this level");
  }
  return accepted;
}
