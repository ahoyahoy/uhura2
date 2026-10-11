CREATE TABLE "article" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"title_translation" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_paragraph" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"target_text" text NOT NULL,
	"source_text" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_class_id_language_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."language_class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_paragraph" ADD CONSTRAINT "article_paragraph_article_id_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "article_paragraph_position_unique" ON "article_paragraph" USING btree ("article_id","position");