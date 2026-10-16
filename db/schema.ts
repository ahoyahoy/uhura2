import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  customType,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

// ─── Better Auth tables ───────────────────────────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// ─── App tables ───────────────────────────────────────────────────

export const languageClass = pgTable("language_class", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  sourceLanguage: text("source_language").notNull(),
  targetLanguage: text("target_language").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const topic = pgTable("topic", {
  id: uuid("id").defaultRandom().primaryKey(),
  classId: uuid("class_id")
    .references(() => languageClass.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
    referenceNotes: text("reference_notes").default("").notNull(),
  level: text("level").default("B1").notNull(),
  goalKind: text("goal_kind").default("situation").notNull(),
  focus: text("focus").default("").notNull(),
  practiceStyle: text("practice_style").default("varied").notNull(),
  register: text("register").default("neutral_spoken").notNull(),
  voiceIds: text("voice_ids").array().default(sql`ARRAY['UQoLnPXvf18gaKpLzfb8']::text[]`).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const sentence = pgTable("sentence", {
  id: uuid("id").defaultRandom().primaryKey(),
  topicId: uuid("topic_id")
    .notNull()
    .references(() => topic.id, { onDelete: "cascade" }),
  sourceText: text("source_text").notNull(),
  targetText: text("target_text").notNull(),
  voiceId: text("voice_id"),
  position: integer("position").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("sentence_topic_position_unique").on(table.topicId, table.position)]);

export const sentenceProgress = pgTable("sentence_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  sentenceId: uuid("sentence_id")
    .notNull()
    .references(() => sentence.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  level: integer("level").default(0).notNull(),
  lastGrade: text("last_grade"),
  lastReviewedAt: timestamp("last_reviewed_at"),
  nextReviewAt: timestamp("next_review_at").defaultNow().notNull(),
  repetitions: integer("repetitions").default(0).notNull(),
});

export const quiz = pgTable("quiz", {
  id: uuid("id").defaultRandom().primaryKey(),
  classId: uuid("class_id").notNull().references(() => languageClass.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  mode: text("mode").notNull(),
  level: text("level").notNull(),
  questionLanguage: text("question_language").notNull(),
  answerLanguage: text("answer_language").notNull(),
  options: text("options").array().notNull(),
  sourceQuizId: uuid("source_quiz_id"),
  voiceId: text("voice_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const quizQuestion = pgTable("quiz_question", {
  id: uuid("id").defaultRandom().primaryKey(),
  quizId: uuid("quiz_id").notNull().references(() => quiz.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  answerIndex: integer("answer_index").notNull(),
  options: text("options").array().default([]).notNull(),
  familyIndex: integer("family_index"),
  example: text("example").notNull(),
  explanation: text("explanation").notNull(),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("quiz_question_position_unique").on(table.quizId, table.position)]);

export const quizProgress = pgTable("quiz_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  questionId: uuid("question_id").notNull().references(() => quizQuestion.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id),
  level: integer("level").default(0).notNull(),
  lastGrade: text("last_grade"),
  lastReviewedAt: timestamp("last_reviewed_at"),
  nextReviewAt: timestamp("next_review_at").defaultNow().notNull(),
  repetitions: integer("repetitions").default(0).notNull(),
}, (table) => [uniqueIndex("quiz_progress_question_user_unique").on(table.questionId, table.userId)]);

export const quizGeneration = pgTable("quiz_generation", {
  quizId: uuid("quiz_id").primaryKey().references(() => quiz.id, { onDelete: "cascade" }),
  status: text("status").default("generating").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const quizDailyBudget = pgTable("quiz_daily_budget", {
  key: text("key").primaryKey(),
  questions: integer("questions").default(0).notNull(),
});

export const article = pgTable("article", {
  id: uuid("id").defaultRandom().primaryKey(),
  classId: uuid("class_id").notNull().references(() => languageClass.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id),
  title: text("title").notNull(),
  titleTranslation: text("title_translation").notNull(),
  sourceUrl: text("source_url"),
  status: text("status").default("ready").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("article_class_source_url_unique").on(table.classId, table.sourceUrl)]);

export const articleParagraph = pgTable("article_paragraph", {
  id: uuid("id").defaultRandom().primaryKey(),
  articleId: uuid("article_id").notNull().references(() => article.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  targetText: text("target_text").notNull(),
  sourceText: text("source_text").notNull(),
}, (table) => [uniqueIndex("article_paragraph_position_unique").on(table.articleId, table.position)]);

export const ttsCache = pgTable("tts_cache", {
  id: uuid("id").defaultRandom().primaryKey(),
  textHash: text("text_hash").notNull().unique(),
  audio: bytea("audio").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ttsGeneration = pgTable("tts_generation", {
  cacheKey: text("cache_key").primaryKey(),
  status: text("status").default("generating").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const topicGeneration = pgTable("topic_generation", {
  topicId: uuid("topic_id").primaryKey().references(() => topic.id, { onDelete: "cascade" }),
  status: text("status").default("generating").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ttsDailyBudget = pgTable("tts_daily_budget", {
  day: text("day").primaryKey(),
  characters: integer("characters").default(0).notNull(),
});
