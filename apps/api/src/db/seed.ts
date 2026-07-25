import { sql } from 'drizzle-orm';
import { db } from './index.js';
import { articles } from './schema.js';

/**
 * Insert a couple of sample articles the first time the table is empty, so the
 * frontend has something to render out of the box. No-op once data exists.
 */
export async function seedIfEmpty(): Promise<void> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(articles);

  const count = rows[0]?.count ?? 0;
  if (count > 0) return;

  await db.insert(articles).values([
    {
      title: 'Welcome to Carma',
      body: 'This article is served by Express + Drizzle from Postgres.',
    },
    {
      title: 'Shared types in action',
      body: 'The Article type lives in @carma/shared and is used by both the API and the web app.',
    },
  ]);

  console.log('[seed] inserted sample articles');
}
