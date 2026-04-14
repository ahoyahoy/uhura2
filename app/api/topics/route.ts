import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { topic, sentence, languageClass } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { openai } from "@/lib/openai";
import { getLanguageLabel } from "@/lib/languages";
import { getLevelDescription } from "@/lib/level-descriptions";

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

  const { description, level, classId } = await req.json();

  // Get class languages
  let sourceLang = "Czech";
  let targetLang = "English";
  if (classId) {
    const [cls] = await db
      .select()
      .from(languageClass)
      .where(eq(languageClass.id, classId));
    if (cls) {
      sourceLang = getLanguageLabel(cls.sourceLanguage);
      targetLang = getLanguageLabel(cls.targetLanguage);
    }
  }

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
      classId: classId ?? null,
      title,
      description,
      level: level ?? "B1",
    })
    .returning();

  const levelDesc = getLevelDescription(created.level);

  // Generate initial sentences
  const gen = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
    temperature: 0.8,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a language learning assistant. Generate sentence pairs for practicing ${targetLang} at CEFR level ${created.level}.

IMPORTANT: All sentences MUST strictly match ${created.level} level:
${levelDesc}

Rules:
- Generate 10 sentence pairs (${sourceLang} → ${targetLang})
- Focus on ONE grammatical pattern or structure per batch
- Create variations of the same pattern (change subject, verb, context — keep the structure)
- Sentences should be natural, conversational ${targetLang}
- ${sourceLang} translations should be natural ${sourceLang} (not word-for-word)

Return JSON: { "sentences": [{ "source": "...", "target": "..." }] }`,
      },
      {
        role: "user",
        content: `Topic: ${title}\nDescription: ${description}\nLevel: ${created.level}\n\nGenerate sentence pairs.`,
      },
    ],
  });

  const content = gen.choices[0].message.content;
  let insertedSentences: { id: string; topicId: string; sourceText: string; targetText: string; createdAt: Date }[] = [];
  if (content) {
    const parsed = JSON.parse(content) as {
      sentences: { source: string; target: string }[];
    };
    insertedSentences = await db
      .insert(sentence)
      .values(
        parsed.sentences.map((s) => ({
          topicId: created.id,
          sourceText: s.source,
          targetText: s.target,
        }))
      )
      .returning();
  }

  return NextResponse.json({ topic: created, sentences: insertedSentences });
}
