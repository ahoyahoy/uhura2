ALTER TABLE "sentence" ADD COLUMN IF NOT EXISTS "position" integer DEFAULT 0;
--> statement-breakpoint
WITH ranked AS (
  SELECT id, (row_number() OVER (PARTITION BY topic_id ORDER BY created_at, id) - 1)::integer AS new_position
  FROM "sentence"
)
UPDATE "sentence" AS s SET "position" = ranked.new_position FROM ranked WHERE s.id = ranked.id;
--> statement-breakpoint
ALTER TABLE "sentence" ALTER COLUMN "position" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sentence_topic_position_unique" ON "sentence" ("topic_id", "position");
