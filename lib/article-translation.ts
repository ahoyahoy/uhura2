import { openai } from "@/lib/openai";
import { getLanguageLabel } from "@/lib/languages";
import { MAX_PARAGRAPH_LENGTH } from "@/lib/article-paragraphs";
import type { ImportedArticle } from "@/lib/article-import";
import { ARTICLE_TRANSLATION_MODEL } from "@/lib/ai-models";

export function validateArticleTranslation(result: unknown, article: ImportedArticle): {
  titleTranslation: string; paragraphs: string[];
} {
  if (!result || typeof result !== "object") throw new Error("Article translation was invalid");
  const translated = result as { titleTranslation?: unknown; paragraphs?: unknown };
  if (typeof translated.titleTranslation !== "string" || !translated.titleTranslation.trim() ||
    translated.titleTranslation.length > 160 || !Array.isArray(translated.paragraphs) ||
    translated.paragraphs.length !== article.paragraphs.length ||
    translated.paragraphs.some((paragraph, index) => typeof paragraph !== "string" || !paragraph.trim() ||
      paragraph.length > MAX_PARAGRAPH_LENGTH || paragraph.trim() === article.paragraphs[index].trim())) {
    throw new Error("Article translation was incomplete");
  }
  return { titleTranslation: translated.titleTranslation.trim(), paragraphs: translated.paragraphs as string[] };
}

export async function translateImportedArticle(article: ImportedArticle, sourceLanguage: string, targetLanguage: string) {
  const messages = [
    { role: "system" as const, content: `You are a careful professional translator. Translate this ${getLanguageLabel(targetLanguage)} article into ${getLanguageLabel(sourceLanguage)}. Preserve the title and every paragraph in exactly the same order. Keep all facts, numbers, names, attribution, quotations, tone and meaning. Do not summarize, simplify, add information, include notes, or copy the original language as a substitute for translation. Write natural, grammatical ${getLanguageLabel(sourceLanguage)}. Return only the required JSON object.` },
    { role: "user" as const, content: JSON.stringify({ title: article.title, paragraphs: article.paragraphs }) },
  ];
  if (Buffer.byteLength(JSON.stringify(messages), "utf8") > 20_000) throw new Error("Article is too long to translate");
  const response = await openai.chat.completions.create({
    model: ARTICLE_TRANSLATION_MODEL,
    reasoning_effort: "low",
    max_completion_tokens: 6500,
    response_format: { type: "json_schema", json_schema: { name: "article_translation", strict: true, schema: {
      type: "object",
      properties: { titleTranslation: { type: "string" }, paragraphs: { type: "array", items: { type: "string" } } },
      required: ["titleTranslation", "paragraphs"], additionalProperties: false,
    } } },
    messages,
  });
  const choice = response.choices[0];
  if (!choice || choice.finish_reason !== "stop" || !choice.message.content || choice.message.refusal) {
    throw new Error("Article translation did not finish");
  }
  let result: unknown;
  try { result = JSON.parse(choice.message.content); } catch { throw new Error("Article translation was invalid"); }
  return validateArticleTranslation(result, article);
}
