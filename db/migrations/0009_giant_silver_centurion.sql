ALTER TABLE "quiz" ADD COLUMN "source_quiz_id" uuid;--> statement-breakpoint
ALTER TABLE "quiz_question" ADD COLUMN "options" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_question" ADD COLUMN "family_index" integer;