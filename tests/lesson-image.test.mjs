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

const { validateLessonImage, validateImageLessonBrief } = await import("../lib/lesson-image.ts");

test("accepts a small PNG and rejects disguised or oversized images", () => {
  const image = `data:image/png;base64,${Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]).toString("base64")}`;
  assert.equal(validateLessonImage(image), image);
  assert.throws(() => validateLessonImage(image.replace("image/png", "image/jpeg")));
  assert.throws(() => validateLessonImage("data:image/png;base64,not base64"));
  assert.throws(() => validateLessonImage(`data:image/png;base64,${"A".repeat(2_000_100)}`));
});

test("accepts a concise image-based pronunciation brief", () => {
  assert.deepEqual(validateImageLessonBrief({
    description: "Practise English th sounds in useful sentences",
    goalKind: "pronunciation", focus: "/θ/ vs /ð/",
    referenceNotes: "/θ/: think, three, thank. /ð/: this, they, father.",
  }), {
    description: "Practise English th sounds in useful sentences",
    goalKind: "pronunciation", focus: "/θ/ vs /ð/",
    referenceNotes: "/θ/: think, three, thank. /ð/: this, they, father.",
  });
  assert.throws(() => validateImageLessonBrief({ description: "x", goalKind: "other", focus: "", referenceNotes: "x" }));
});
