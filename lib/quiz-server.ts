import { db } from "@/db";
import { quizDailyBudget } from "@/db/schema";
import { LANGUAGES } from "@/lib/languages";
import { QUIZ_BATCH_SIZE, QUIZ_MODES, tenseOptions, type QuizPlan } from "@/lib/quiz-config";
import { isAllowedVoice } from "@/lib/voices";
import { sql } from "drizzle-orm";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const languages = new Set<string>(LANGUAGES.map(({ code }) => code));

export function parseQuizPlan(input: Record<string, unknown>): (QuizPlan & { classId: string; voiceId: string }) | null {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const mode = input.mode;
  const level = input.level;
  const questionLanguage = input.questionLanguage;
  const answerLanguage = input.answerLanguage;
  const voiceId = input.voiceId;
  const classId = input.classId;
  const submittedOptions = Array.isArray(input.options) ? input.options.map((value) => typeof value === "string" ? value.trim() : "") : [];
  const options = mode === "tense_family" && typeof answerLanguage === "string" ? tenseOptions(answerLanguage)
    : mode === "tense_form" ? [] : submittedOptions;
  if (title.length < 3 || title.length > 80 || description.length < 10 || description.length > 600 ||
    !QUIZ_MODES.includes(mode as QuizPlan["mode"]) || !LEVELS.includes(String(level)) ||
    typeof questionLanguage !== "string" || !languages.has(questionLanguage) ||
    typeof answerLanguage !== "string" || !languages.has(answerLanguage) ||
    (mode === "tense_form" && answerLanguage !== "en") ||
    typeof classId !== "string" || !UUID.test(classId) ||
    typeof voiceId !== "string" || !isAllowedVoice(voiceId) || !options ||
    (mode !== "tense_form" && options.length < 2) || options.length > 6 ||
    options.some((value) => value.length < 1 || value.length > 80) ||
    new Set(options.map((value) => value.toLocaleLowerCase())).size !== options.length) return null;
  return { title, description, mode: mode as QuizPlan["mode"], level: String(level), questionLanguage, answerLanguage, options, voiceId, classId };
}

// A server-enforced ceiling of ten quiz batches per user per UTC day.
export async function reserveQuizBatch(userId: string): Promise<boolean> {
  const key = `${userId}:${new Date().toISOString().slice(0, 10)}`;
  const [reserved] = await db.insert(quizDailyBudget).values({ key, questions: QUIZ_BATCH_SIZE })
    .onConflictDoUpdate({ target: quizDailyBudget.key,
      set: { questions: sql`${quizDailyBudget.questions} + ${QUIZ_BATCH_SIZE}` },
      setWhere: sql`${quizDailyBudget.questions} + ${QUIZ_BATCH_SIZE} <= 100`,
    }).returning({ key: quizDailyBudget.key });
  return Boolean(reserved);
}
