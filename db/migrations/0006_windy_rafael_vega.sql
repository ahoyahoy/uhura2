ALTER TABLE "article" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "article" ADD COLUMN "status" text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "article_class_source_url_unique" ON "article" USING btree ("class_id","source_url");