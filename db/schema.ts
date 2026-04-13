import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  customType,
} from "drizzle-orm/pg-core";

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
  level: text("level").default("B1").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sentence = pgTable("sentence", {
  id: uuid("id").defaultRandom().primaryKey(),
  topicId: uuid("topic_id")
    .notNull()
    .references(() => topic.id, { onDelete: "cascade" }),
  sourceText: text("source_text").notNull(),
  targetText: text("target_text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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

export const ttsCache = pgTable("tts_cache", {
  id: uuid("id").defaultRandom().primaryKey(),
  textHash: text("text_hash").notNull().unique(),
  audio: bytea("audio").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
