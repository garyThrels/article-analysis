CREATE TABLE "articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"headline" text NOT NULL,
	"body" text NOT NULL,
	"source" text NOT NULL,
	"published_at" timestamp with time zone,
	"language" varchar(8) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
