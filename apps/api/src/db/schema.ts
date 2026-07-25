import { pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Minimal `articles` table — the starting point for the schema.
 *
 * This is intentionally small. To evolve it: edit this file, then run
 * `yarn db:generate` (creates a new SQL migration under ./drizzle) followed by
 * `yarn db:migrate` (applies it). The API also auto-applies pending migrations
 * on startup — see src/db/migrate.ts.
 */
export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  headline: text("headline").notNull(),
  body: text("body").notNull(),
  source: text("source").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  language: varchar("language", { length: 8 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Inferred row types, handy for internal use. The API maps these to the
// wire-facing `Article` type from @carma/shared before responding.
export type ArticleRow = typeof articles.$inferSelect;
export type NewArticleRow = typeof articles.$inferInsert;
