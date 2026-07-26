CREATE TYPE "public"."enrichment_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."sentiment" AS ENUM('positive', 'negative', 'neutral', 'mixed');--> statement-breakpoint
CREATE TABLE "article_enrichments" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"status" "enrichment_status" DEFAULT 'pending' NOT NULL,
	"summary" text,
	"sentiment" "sentiment",
	"topics" text[],
	"error_message" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_enrichments_article_id_unique" UNIQUE("article_id")
);
--> statement-breakpoint
ALTER TABLE "article_enrichments" ADD CONSTRAINT "article_enrichments_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_enrichments_status_idx" ON "article_enrichments" USING btree ("status");