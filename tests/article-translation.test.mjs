import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

process.env.OPENAI_API_KEY = "test-only";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { validateArticleTranslation } = await import("../lib/article-translation.ts");
const article = { url: "https://example.com/story", title: "A story", paragraphs: ["The first paragraph.", "The second paragraph."] };

test("keeps translated paragraphs aligned with the original article", () => {
  assert.deepEqual(validateArticleTranslation({
    titleTranslation: "Příběh", paragraphs: ["První odstavec.", "Druhý odstavec."],
  }, article), { titleTranslation: "Příběh", paragraphs: ["První odstavec.", "Druhý odstavec."] });
  assert.throws(() => validateArticleTranslation({ titleTranslation: "Příběh", paragraphs: ["První odstavec."] }, article));
  assert.throws(() => validateArticleTranslation({ titleTranslation: "Příběh", paragraphs: ["První odstavec.", "The second paragraph."] }, article));
});
