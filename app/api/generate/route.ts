import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { openai } from "@/lib/openai";
import { db } from "@/db";
import { sentence, topic, languageClass } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLanguageLabel } from "@/lib/languages";
import { getLevelDescription } from "@/lib/level-descriptions";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { topicId } = await req.json();

  const [t] = await db.select().from(topic).where(eq(topic.id, topicId));
  if (!t || t.userId !== session.user.id) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  // Get class languages
  let sourceLang = "Czech";
  let targetLang = "English";
  if (t.classId) {
    const [cls] = await db
      .select()
      .from(languageClass)
      .where(eq(languageClass.id, t.classId));
    if (cls) {
      sourceLang = getLanguageLabel(cls.sourceLanguage);
      targetLang = getLanguageLabel(cls.targetLanguage);
    }
  }

  // Load existing sentences for context
  const existing = await db
    .select({ source: sentence.sourceText, target: sentence.targetText })
    .from(sentence)
    .where(eq(sentence.topicId, topicId));

  const existingContext =
    existing.length > 0
      ? `\n\nExisting sentences (DO NOT repeat these, generate NEW ones with different patterns/variations):\n${existing.map((s) => `- ${s.source} → ${s.target}`).join("\n")}`
      : "";

  const levelDesc = getLevelDescription(t.level);

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
    temperature: 0.8,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a language learning assistant. Generate sentence pairs for practicing ${targetLang} at CEFR level ${t.level}.

IMPORTANT: All sentences MUST strictly match ${t.level} level:
${levelDesc}

Rules:
- Generate 10 sentence pairs (${sourceLang} → ${targetLang})
- Focus on ONE grammatical pattern or structure per batch
- Create variations of the same pattern (change subject, verb, context — keep the structure)
- Sentences should be natural, conversational ${targetLang}
- ${sourceLang} translations should be natural ${sourceLang} (not word-for-word)
- If existing sentences are provided, generate DIFFERENT patterns/variations — do not repeat

Return JSON: { "sentences": [{ "source": "...", "target": "..." }] }`,
      },
      {
        role: "user",
        content: `Topic: ${t.title}\nDescription: ${t.description}\nLevel: ${t.level}${existingContext}\n\nGenerate new sentence pairs.`,
      },
    ],
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    return NextResponse.json({ error: "No response from AI" }, { status: 500 });
  }

  const parsed = JSON.parse(content) as {
    sentences: { source: string; target: string }[];
  };

  const inserted = await db
    .insert(sentence)
    .values(
      parsed.sentences.map((s) => ({
        topicId,
        sourceText: s.source,
        targetText: s.target,
      }))
    )
    .returning();

  return NextResponse.json({ sentences: inserted });
}
