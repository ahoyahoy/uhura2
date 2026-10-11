import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { extractArticle, parsePublicArticleUrl } = await import("../lib/article-import.ts");

test("accepts a public URL and removes tracking parameters", () => {
  const url = parsePublicArticleUrl("https://example.com/story?utm_source=mail&id=7#comments");
  assert.equal(url.href, "https://example.com/story?id=7");
});

test("rejects local and non-web article links before fetching", () => {
  for (const url of [
    "http://localhost:3017/secret", "http://127.0.0.1/secret", "http://[::1]/secret",
    "http://169.254.169.254/latest/meta-data", "file:///etc/passwd", "https://user:pass@example.com/story",
  ]) {
    assert.throws(() => parsePublicArticleUrl(url));
  }
});

test("extracts title and ordered paragraphs without navigation text", () => {
  const html = `<html lang="en"><head><title>Reading at work</title></head><body>
    <nav>News Culture Subscribe Sign in</nav><article><h1>Reading at work</h1>
    <p>Many colleagues read short articles during their lunch break. They often share a link and discuss the story afterwards.</p>
    <p>Yesterday, one team picked an article about communication. Everyone had a different view of the main finding.</p>
    <p>The discussion lasted only ten minutes, but it helped the team understand why the subject mattered to them.</p>
    </article><footer>Subscribe for more</footer></body></html>`;
  const result = extractArticle(html, "https://example.com/story", "en");
  assert.equal(result.title, "Reading at work");
  assert.equal(result.paragraphs.length, 3);
  assert.ok(result.paragraphs[0].startsWith("Many colleagues"));
  assert.ok(result.paragraphs[2].startsWith("The discussion"));
  assert.ok(result.paragraphs.every((paragraph) => !paragraph.includes("Subscribe")));
  assert.throws(() => extractArticle(html, "https://example.com/story", "de"), /different language/);
});
