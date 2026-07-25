import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { db, pool } from './index.js';
import { articles, type NewArticleRow } from './schema.js';

const here = dirname(fileURLToPath(import.meta.url));
const sampleFile = resolve(here, 'seeders/data/sample_articles.json');

/** Shape of a record in seeders/data/sample_articles.json. */
interface SampleArticle {
  headline: string;
  body: string;
  source: string;
  published_at: string | null;
  language: string;
  // `id` is present in the file but ignored — the DB assigns it via serial.
}

async function loadSampleArticles(): Promise<NewArticleRow[]> {
  const raw = await readFile(sampleFile, 'utf8');
  const records = JSON.parse(raw) as SampleArticle[];

  return records.map((r) => ({
    headline: r.headline,
    body: r.body,
    source: r.source,
    language: r.language,
    // published_at may be null in the data; the column is nullable.
    publishedAt: r.published_at ? new Date(r.published_at) : null,
  }));
}

/**
 * Insert the sample articles from seeders/data/sample_articles.json the first
 * time the table is empty, so the app has data out of the box. No-op once data
 * exists. Ids come from the serial column, not the file, to keep the sequence
 * consistent with future inserts.
 */
export async function seedIfEmpty(): Promise<void> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(articles);

  const count = rows[0]?.count ?? 0;
  if (count > 0) return;

  const values = await loadSampleArticles();
  if (values.length === 0) return;

  await db.insert(articles).values(values);
  console.log(`[seed] inserted ${values.length} sample articles`);
}

// Allow running standalone: `tsx src/db/seed.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  seedIfEmpty()
    .then(() => pool.end())
    .catch((err) => {
      console.error('[seed] failed:', err);
      process.exitCode = 1;
      return pool.end();
    });
}
