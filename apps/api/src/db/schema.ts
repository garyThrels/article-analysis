import { sql } from "drizzle-orm";
import {
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  smallint,
  smallserial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Postgres `tsvector` isn't a built-in Drizzle column type, so we declare a
 * thin custom type for the generated full-text column below.
 */
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

/**
 * Lookup table for article languages (normalized out of `articles`).
 * Surrogate `id` keeps the FK on `articles` small; `code` is the stable natural
 * key used for filtering (e.g. "en", "ar", "zh").
 */
export const languages = pgTable("languages", {
  id: smallserial("id").primaryKey(),
  code: varchar("code", { length: 8 }).notNull().unique(),
  name: text("name").notNull(),
});

/**
 * Lookup table for article sources/publishers (e.g. "Reuters").
 */
export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

/**
 * Articles. `source` and `language` are normalized into the lookup tables above
 * and referenced by FK. Indexing is tuned for the app's access paths — see the
 * index block at the bottom of this table and the plan/README for reasoning.
 */
export const articles = pgTable(
  "articles",
  {
    id: serial("id").primaryKey(),
    headline: text("headline").notNull(),
    body: text("body").notNull(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id),
    languageId: smallint("language_id")
      .notNull()
      .references(() => languages.id),
    // NOT NULL: a keyset cursor needs a stable, non-null sort key.
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Precomputed full-text vector over headline + body. 'simple' config (no
    // stemming) so multilingual content (en/ar/zh) matches predictably and
    // prefix wildcards (`term:*`) work against this same vector.
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`to_tsvector('simple', headline || ' ' || body)`,
    ),
  },
  (t) => [
    // Keyset pagination + date-range scans + aggregate range predicate.
    // (published_at, id) is a total order; DESC matches the feed's ORDER BY so
    // pages are index range scans with no sort node.
    index("articles_published_at_id_idx").on(t.publishedAt.desc(), t.id.desc()),
    // Filter by source, newest-first, paginated — equality column leads, then
    // the same (published_at DESC, id DESC) ordering. Also covers the FK.
    index("articles_source_published_at_id_idx").on(
      t.sourceId,
      t.publishedAt.desc(),
      t.id.desc(),
    ),
    // Same, for language.
    index("articles_language_published_at_id_idx").on(
      t.languageId,
      t.publishedAt.desc(),
      t.id.desc(),
    ),
    // Boolean full-text search: GIN inverted index over the tsvector.
    index("articles_search_vector_idx").using("gin", t.searchVector),
  ],
);

/** Article sentiment produced by LLM enrichment. */
export const sentimentEnum = pgEnum("sentiment", [
  "positive",
  "negative",
  "neutral",
  "mixed",
]);

/** Lifecycle of an article's enrichment work item. */
export const enrichmentStatusEnum = pgEnum("enrichment_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

/**
 * LLM enrichment for an article (1:1). Kept in its own table so it carries a
 * status lifecycle + error message — effectively the work item a production
 * queue would process. Result columns are null until `status = 'completed'`.
 */
export const articleEnrichments = pgTable(
  "article_enrichments",
  {
    id: serial("id").primaryKey(),
    articleId: integer("article_id")
      .notNull()
      .unique()
      .references(() => articles.id, { onDelete: "cascade" }),
    status: enrichmentStatusEnum("status").notNull().default("pending"),
    summary: text("summary"),
    sentiment: sentimentEnum("sentiment"),
    topics: text("topics").array(),
    errorMessage: text("error_message"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // The enrichment runner scans by status (pending/failed) to find work.
    index("article_enrichments_status_idx").on(t.status),
  ],
);

// Inferred row types. The generated `searchVector` column is excluded from the
// insert type automatically. The API maps these to the wire-facing `Article`
// type from @carma/shared before responding.
export type ArticleRow = typeof articles.$inferSelect;
export type NewArticleRow = typeof articles.$inferInsert;

export type SourceRow = typeof sources.$inferSelect;
export type LanguageRow = typeof languages.$inferSelect;

export type ArticleEnrichmentRow = typeof articleEnrichments.$inferSelect;
export type NewArticleEnrichmentRow = typeof articleEnrichments.$inferInsert;
