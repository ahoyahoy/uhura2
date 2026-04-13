import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { topic, sentence } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { openai } from "@/lib/openai";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const topics = await db
    .select()
    .from(topic)
    .where(eq(topic.userId, session.user.id))
    .orderBy(desc(topic.createdAt));

  return NextResponse.json({ topics });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { description, level } = await req.json();

  // Generate title from description
  const completion = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
    temperature: 0.5,
    max_completion_tokens: 30,
    messages: [
      {
        role: "system",
        content: "Generate a short topic title (2-4 words, English) from the user's description. Return only the title, nothing else.",
      },
      { role: "user", content: description },
    ],
  });
  const title = completion.choices[0].message.content?.trim() ?? "Untitled";

  const [created] = await db
    .insert(topic)
    .values({
      userId: session.user.id,
      title,
      description,
      level: level ?? "B1",
    })
    .returning();

  // Generate initial sentences
  const gen = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
    temperature: 0.8,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a language learning assistant. Generate sentence pairs for practicing English at CEFR level ${created.level}.

IMPORTANT: All sentences MUST strictly match ${created.level} level:
${created.level === "A1" ? "- Use only present simple, basic vocabulary (100-500 words), very short sentences (3-6 words)" : ""}${created.level === "A2" ? "- Use present simple/continuous, past simple, basic connectors, simple everyday vocabulary" : ""}${created.level === "B1" ? "- Use past tenses, present perfect, conditionals (first), relative clauses, moderate vocabulary" : ""}${created.level === "B2" ? "- Use all tenses, passive voice, reported speech, conditionals (second/third), idiomatic expressions" : ""}${created.level === "C1" ? "- Use complex structures, subjunctive, inversions, advanced idioms, nuanced vocabulary" : ""}${created.level === "C2" ? "- Use sophisticated language, rare idioms, literary expressions, subtle nuances, near-native complexity" : ""}

Rules:
- Generate 10 sentence pairs (Czech → English)
- Focus on ONE grammatical pattern or structure per batch
- Create variations of the same pattern (change subject, verb, context — keep the structure)
- Sentences should be natural, conversational English
- Czech translations should be natural Czech (not word-for-word)

Return JSON: { "sentences": [{ "cz": "...", "en": "..." }] }`,
      },
      {
        role: "user",
        content: `Topic: ${title}\nDescription: ${description}\nLevel: ${created.level}\n\nGenerate sentence pairs.`,
      },
    ],
  });

  const content = gen.choices[0].message.content;
  if (content) {
    const parsed = JSON.parse(content) as {
      sentences: { cz: string; en: string }[];
    };
    await db.insert(sentence).values(
      parsed.sentences.map((s) => ({
        topicId: created.id,
        cz: s.cz,
        en: s.en,
      }))
    );
  }

  return NextResponse.json({ topic: created });
}
