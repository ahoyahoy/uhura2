import { openai } from "@/lib/openai";
import { getLanguageLabel } from "@/lib/languages";
import { getLevelDescription } from "@/lib/level-descriptions";

export const GOAL_KINDS = ["vocabulary", "grammar", "contrast", "situation"] as const;
export const PRACTICE_STYLES = ["fixed", "varied", "situational"] as const;
export const REGISTERS = ["neutral_spoken", "informal", "work_polite", "formal_written"] as const;
export type GoalKind = typeof GOAL_KINDS[number];
export type PracticeStyle = typeof PRACTICE_STYLES[number];
export type Register = typeof REGISTERS[number];

export type LessonPlan = {
  description: string;
  goalKind: GoalKind;
  focus: string;
  practiceStyle: PracticeStyle;
  register: Register;
  level: string;
  sourceLanguage: string;
  targetLanguage: string;
};
export type SentencePair = { source: string; target: string };

const responseSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    sentences: {
      type: "array",
      items: {
        type: "object",
        properties: { source: { type: "string" }, target: { type: "string" } },
        required: ["source", "target"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "sentences"],
  additionalProperties: false,
} as const;

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
  const left = new Set(normalize(a).split(" "));
  const right = new Set(normalize(b).split(" "));
  const union = new Set([...left, ...right]);
  return union.size > 0 && [...left].filter((word) => right.has(word)).length / union.size >= 0.8;
}

function requiredEnglishHeadword(plan: LessonPlan): string | null {
  if (plan.goalKind !== "vocabulary" || plan.targetLanguage !== "en") return null;
  return plan.focus.match(/^([a-z]{3,})\s+[—–-]\s+/i)?.[1].toLowerCase() ?? null;
}

export function filterSentencePairs(value: unknown, existing: SentencePair[], style: PracticeStyle, requiredHeadword: string | null = null): SentencePair[] {
  if (!Array.isArray(value) || value.length > 10 || value.length === 0) {
    throw new Error("AI returned an invalid number of sentences");
  }
  const accepted: SentencePair[] = [];
  const prior = existing.map((pair) => ({ source: normalize(pair.source), target: normalize(pair.target) }));
  for (const item of value) {
    if (!item || typeof item.source !== "string" || typeof item.target !== "string") continue;
    const source = item.source.trim();
    const target = item.target.trim();
    if (!source || !target || source.length > 350 || target.length > 350) continue;
    if (requiredHeadword && !new RegExp(`\\b${requiredHeadword}(?:s|es|ed|d|ing)?\\b`, "i").test(target)) continue;
    const exact = prior.some((pair) => pair.source === normalize(source) || pair.target === normalize(target));
    const near = style !== "fixed" && [...existing, ...accepted].some((pair) => isNearCopy(target, pair.target));
    if (exact || near) continue;
    accepted.push({ source, target });
    prior.push({ source: normalize(source), target: normalize(target) });
  }
  if (!accepted.length) throw new Error("AI did not provide any new usable sentences");
  return accepted;
}

export async function generateSentenceBatch(plan: LessonPlan, existing: SentencePair[]): Promise<{ title: string; sentences: SentencePair[] }> {
  const context = JSON.stringify(existing);
  if (context.length > 20_000) throw new Error("This lesson has reached the context limit; start a related lesson");
  const sourceLanguage = getLanguageLabel(plan.sourceLanguage);
  const targetLanguage = getLanguageLabel(plan.targetLanguage);
  const completion = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
    max_completion_tokens: 3500,
    response_format: { type: "json_schema", json_schema: { name: "sentence_batch", strict: true, schema: responseSchema } },
    messages: [
      { role: "system", content: `You are a skilled ${targetLanguage} teacher creating focused translation practice. Treat the plan as the stable learning objective. Create up to 10 useful sentence pairs from ${sourceLanguage} to ${targetLanguage}. CEFR support: ${getLevelDescription(plan.level)}.

The goal kind determines what stays constant: vocabulary = the specified meaning and natural collocations of the target expression; grammar = the specified form and its communicative use; contrast = both specified alternatives with unambiguous context; situation = what a learner would actually say to accomplish the task, not sentences about people talking. For a vocabulary goal, EVERY target sentence must actually contain and practice the specified word or phrase in the specified sense, including appropriate inflections. A related synonym or antonym is not a substitute. The register is binding. Advanced level never requires ornate prose. Use one main learning challenge per sentence; keep other vocabulary familiar.

Practice style: fixed = controlled, meaningful changes within the same pattern; varied = the same learning goal in distinct situations, persons and appropriate utterance types; situational = short contextualized utterances or replies. Do not change the goal, meaning, level, or register to achieve novelty. Both source and target must read like natural native utterances, with no mixed-language words, vague filler, or mechanical paraphrases. For varied style, do not add another version of an existing question or statement by merely changing the object, person or time; develop underused communicative uses of the same goal. Avoid near-copies that merely swap a name or object, except useful controlled practice in fixed style.

Every existing pair is context for continuity and something to avoid repeating. Preserve who does what to whom, negation, tense, modality, and politeness in natural translations. Add short context to the source if needed to make the target construction a fair answer. A reference answer is not the only possible translation. If the goal is exhausted, return fewer valid pairs rather than broadening the goal. Check all pairs before responding. Return a short title and the specified JSON object.` },
      { role: "user", content: JSON.stringify({ plan, existingSentences: existing, requested: 10 }) },
    ],
  });
  const choice = completion.choices[0];
  if (!choice || choice.finish_reason !== "stop" || !choice.message.content || choice.message.refusal) {
    throw new Error("AI generation did not finish with valid content");
  }
  let parsed: unknown;
  try { parsed = JSON.parse(choice.message.content); } catch { throw new Error("AI returned invalid JSON"); }
  if (!parsed || typeof parsed !== "object") throw new Error("AI returned invalid content");
  const response = parsed as { title?: unknown; sentences?: unknown };
  const title = typeof response.title === "string" && response.title.trim().length <= 80 ? response.title.trim() : "Lesson";
  const candidates = filterSentencePairs(response.sentences, existing, plan.practiceStyle, requiredEnglishHeadword(plan));
  const review = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
    max_completion_tokens: 3000,
    response_format: { type: "json_schema", json_schema: { name: "reviewed_sentence_batch", strict: true, schema: responseSchema } },
    messages: [
      { role: "system", content: `You are an independent bilingual language teacher reviewing a translation exercise before students see it. For each candidate check: (1) the specified learning goal and exact vocabulary sense, (2) naturalness and correct grammar in BOTH languages, (3) faithful meaning, person, tense, negation, modality and politeness, (4) realistic context and collocation, and (5) useful variety against all existing pairs. Reject or replace awkward examples, including borrowing things that cannot sensibly be returned. In varied style, a new item or person in an existing short question pattern is not a new teaching use; replace it with a genuinely different utterance or return fewer pairs. Do not broaden the learning goal. If the plan targets a word or phrase, every target sentence must use it in the specified sense. Return at most the candidate count, preferring a smaller correct set to filler. Return only the specified JSON object.` },
      { role: "user", content: JSON.stringify({ plan, existingSentences: existing, proposedTitle: title, candidates }) },
    ],
  });
  const reviewedChoice = review.choices[0];
  if (!reviewedChoice || reviewedChoice.finish_reason !== "stop" || !reviewedChoice.message.content || reviewedChoice.message.refusal) {
    throw new Error("AI review did not finish with valid content");
  }
  let reviewed: unknown;
  try { reviewed = JSON.parse(reviewedChoice.message.content); } catch { throw new Error("AI review returned invalid JSON"); }
  if (!reviewed || typeof reviewed !== "object") throw new Error("AI review returned invalid content");
  const reviewedResponse = reviewed as { title?: unknown; sentences?: unknown };
  const reviewedTitle = typeof reviewedResponse.title === "string" && reviewedResponse.title.trim().length <= 80
    ? reviewedResponse.title.trim() : title;
  return { title: reviewedTitle, sentences: filterSentencePairs(reviewedResponse.sentences, existing, plan.practiceStyle, requiredEnglishHeadword(plan)) };
}
