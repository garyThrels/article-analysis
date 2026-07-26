import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { sql } from "drizzle-orm";
import { db, pool } from "./index.js";
import {
  articleEnrichments,
  articles,
  languages,
  sources,
  type NewArticleRow,
} from "./schema.js";

const here = dirname(fileURLToPath(import.meta.url));
const sampleFile = resolve(here, "seeders/data/sample_articles.json");

/** Display names for the language codes present in the sample data. */
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ar: "Arabic",
  zh: "Chinese",
};

/** Shape of a record in seeders/data/sample_articles.json. */
interface SampleArticle {
  headline: string;
  body: string;
  source: string;
  published_at: string | null;
  language: string;
  // `id` is present in the file but ignored — the DB assigns it via serial.
}

async function loadSampleArticles(): Promise<SampleArticle[]> {
  const raw = await readFile(sampleFile, "utf8");
  return JSON.parse(raw) as SampleArticle[];
}

/**
 * Upsert the distinct sources referenced by the sample data and return a
 * `name -> id` lookup.
 */
async function seedSources(names: string[]): Promise<Map<string, number>> {
  if (names.length > 0) {
    await db
      .insert(sources)
      .values(names.map((name) => ({ name })))
      .onConflictDoNothing();
  }
  const rows = await db.select().from(sources);
  return new Map(rows.map((r) => [r.name, r.id]));
}

/**
 * Upsert the distinct languages referenced by the sample data and return a
 * `code -> id` lookup.
 */
async function seedLanguages(codes: string[]): Promise<Map<string, number>> {
  if (codes.length > 0) {
    await db
      .insert(languages)
      .values(
        codes.map((code) => ({ code, name: LANGUAGE_NAMES[code] ?? code })),
      )
      .onConflictDoNothing();
  }
  const rows = await db.select().from(languages);
  return new Map(rows.map((r) => [r.code, r.id]));
}

/**
 * Seed the sample articles (and their normalized sources/languages) the first
 * time the table is empty, so the app has data out of the box. No-op once data
 * exists. Article ids come from the serial column, not the file.
 */
export async function seedIfEmpty(): Promise<void> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(articles);

  const count = rows[0]?.count ?? 0;
  if (count > 0) return;

  const records = await loadSampleArticles();
  if (records.length === 0) return;

  const sourceIds = await seedSources([
    ...new Set(records.map((r) => r.source)),
  ]);
  const languageIds = await seedLanguages([
    ...new Set(records.map((r) => r.language)),
  ]);

  const values: NewArticleRow[] = records.map((r) => {
    const sourceId = sourceIds.get(r.source);
    const languageId = languageIds.get(r.language);
    if (sourceId === undefined || languageId === undefined) {
      throw new Error(
        `Could not resolve FK for article (source=${r.source}, language=${r.language})`,
      );
    }
    return {
      headline: r.headline,
      body: r.body,
      sourceId,
      languageId,
      // published_at is NOT NULL; every sample has one, fall back to now() - since thee are ingested articles, they will have a date of publication or at least a date we retrieved them
      publishedAt: r.published_at ? new Date(r.published_at) : new Date(),
    };
  });

  const inserted = await db
    .insert(articles)
    .values(values)
    .returning({ id: articles.id });

  // Enqueue a pending enrichment row per article (the work items db:enrich processes).
  if (inserted.length > 0) {
    await db
      .insert(articleEnrichments)
      .values(inserted.map((a) => ({ articleId: a.id })));
  }

  console.log(
    `[seed] inserted ${values.length} articles, ${sourceIds.size} sources, ${languageIds.size} languages, ${inserted.length} pending enrichments`,
  );
}

// Allow running standalone: `tsx src/db/seed.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  seedIfEmpty()
    .then(() => pool.end())
    .catch((err) => {
      console.error("[seed] failed:", err);
      process.exitCode = 1;
      return pool.end();
    });
}
