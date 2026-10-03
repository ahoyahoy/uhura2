ALTER TABLE "topic" ADD COLUMN IF NOT EXISTS "goal_kind" text DEFAULT 'situation' NOT NULL;
--> statement-breakpoint
ALTER TABLE "topic" ADD COLUMN IF NOT EXISTS "focus" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "topic" ADD COLUMN IF NOT EXISTS "practice_style" text DEFAULT 'varied' NOT NULL;
--> statement-breakpoint
ALTER TABLE "topic" ADD COLUMN IF NOT EXISTS "register" text DEFAULT 'neutral_spoken' NOT NULL;
--> statement-breakpoint
ALTER TABLE "topic" ADD COLUMN IF NOT EXISTS "voice_ids" text[] DEFAULT ARRAY['UQoLnPXvf18gaKpLzfb8']::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "sentence" ADD COLUMN IF NOT EXISTS "voice_id" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tts_generation" (
  "cache_key" text PRIMARY KEY NOT NULL,
  "status" text DEFAULT 'generating' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "topic_generation" (
  "topic_id" uuid PRIMARY KEY NOT NULL REFERENCES "topic"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'generating' NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tts_daily_budget" (
  "day" text PRIMARY KEY NOT NULL,
  "characters" integer DEFAULT 0 NOT NULL
);
