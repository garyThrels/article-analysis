import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index.js';

const here = dirname(fileURLToPath(import.meta.url));
// ./drizzle holds the generated SQL migrations (relative to apps/api root).
const migrationsFolder = resolve(here, '../../drizzle');

/**
 * Apply any pending migrations. Called on server startup so a freshly created
 * database (e.g. the first `docker compose up`) is brought up to date
 * automatically. Safe to run repeatedly — already-applied migrations are
 * skipped via drizzle's __drizzle_migrations bookkeeping table.
 */
export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder });
}

// Allow running standalone: `tsx src/db/migrate.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      console.log('[migrate] migrations applied');
      return pool.end();
    })
    .catch((err) => {
      console.error('[migrate] failed:', err);
      process.exitCode = 1;
      return pool.end();
    });
}
