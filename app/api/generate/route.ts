import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { openai } from "@/lib/openai";
import { db } from "@/db";
import { sentence, topic } from "@/db/schema";
import { eq } from "drizzle-orm";

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

  // Load existing sentences for context
  const existing = await db
    .select({ cz: sentence.cz, en: sentence.en })
    .from(sentence)
    .where(eq(sentence.topicId, topicId));

  const existingContext =
    existing.length > 0
      ? `\n\nExisting sentences (DO NOT repeat these, generate NEW ones with different patterns/variations):\n${existing.map((s) => `- ${s.cz} → ${s.en}`).join("\n")}`
      : "";

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
    temperature: 0.8,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a language learning assistant. Generate sentence pairs for practicing English at CEFR level ${t.level}.

IMPORTANT: All sentences MUST strictly match ${t.level} level:
${t.level === "A1" ? "- Use only present simple, basic vocabulary (100-500 words), very short sentences (3-6 words)" : ""}${t.level === "A2" ? "- Use present simple/continuous, past simple, basic connectors, simple everyday vocabulary" : ""}${t.level === "B1" ? "- Use past tenses, present perfect, conditionals (first), relative clauses, moderate vocabulary" : ""}${t.level === "B2" ? "- Use all tenses, passive voice, reported speech, conditionals (second/third), idiomatic expressions" : ""}${t.level === "C1" ? "- Use complex structures, subjunctive, inversions, advanced idioms, nuanced vocabulary" : ""}${t.level === "C2" ? "- Use sophisticated language, rare idioms, literary expressions, subtle nuances, near-native complexity" : ""}

Rules:
- Generate 10 sentence pairs (Czech → English)
- Focus on ONE grammatical pattern or structure per batch
- Create variations of the same pattern (change subject, verb, context — keep the structure)
- Sentences should be natural, conversational English
- Czech translations should be natural Czech (not word-for-word)
- If existing sentences are provided, generate DIFFERENT patterns/variations — do not repeat

Return JSON: { "sentences": [{ "cz": "...", "en": "..." }] }`,
      },
      {
        role: "user",
        content: `Topic: ${t.title}\nDescription: ${t.description}\nLevel: ${t.level}${existingContext}\n\nGenerate new sentence pairs.`,
      },
    ],
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    return NextResponse.json(
      { error: "No response from AI" },
      { status: 500 }
    );
  }

  const parsed = JSON.parse(content) as {
    sentences: { cz: string; en: string }[];
  };

  const inserted = await db
    .insert(sentence)
    .values(
      parsed.sentences.map((s) => ({
        topicId,
        cz: s.cz,
        en: s.en,
      }))
    )
    .returning();

  return NextResponse.json({ sentences: inserted });
}
