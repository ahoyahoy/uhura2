-- Add language_class table
CREATE TABLE IF NOT EXISTS "language_class" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id"),
  "source_language" text NOT NULL,
  "target_language" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Add class_id to topic
ALTER TABLE "topic" ADD COLUMN IF NOT EXISTS "class_id" uuid REFERENCES "language_class"("id") ON DELETE CASCADE;

-- Rename sentence columns
ALTER TABLE "sentence" RENAME COLUMN "cz" TO "source_text";
ALTER TABLE "sentence" RENAME COLUMN "en" TO "target_text";
