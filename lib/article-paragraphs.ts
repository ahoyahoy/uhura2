export const MAX_ARTICLE_PARAGRAPHS = 20;
export const MAX_PARAGRAPH_LENGTH = 1200;

export function splitArticleParagraphs(text: string): string[] {
  return text.trim().split(/\r?\n\s*\r?\n/).map((paragraph) => paragraph.replace(/\s*\r?\n\s*/g, " ").trim()).filter(Boolean);
}

export function validateArticleText(targetText: string, sourceText: string): {
  paragraphs: { targetText: string; sourceText: string }[];
  error: string | null;
} {
  const target = splitArticleParagraphs(targetText);
  const source = splitArticleParagraphs(sourceText);
  if (!target.length || !source.length) return { paragraphs: [], error: "Add the article in both languages." };
  if (target.length !== source.length) return { paragraphs: [], error: "Both versions need the same number of paragraphs." };
  if (target.length > MAX_ARTICLE_PARAGRAPHS) return { paragraphs: [], error: `Use at most ${MAX_ARTICLE_PARAGRAPHS} paragraphs.` };
  if ([...target, ...source].some((paragraph) => paragraph.length > MAX_PARAGRAPH_LENGTH)) {
    return { paragraphs: [], error: `Keep each paragraph under ${MAX_PARAGRAPH_LENGTH} characters.` };
  }
  return { paragraphs: target.map((text, index) => ({ targetText: text, sourceText: source[index] })), error: null };
}
