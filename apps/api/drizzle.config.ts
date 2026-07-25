import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load the repo-root .env when running locally. In Docker Compose the env vars
// are injected directly, so a missing file here is fine.
loadEnv({ path: resolve(process.cwd(), '../../.env') });

// `generate` only diffs the schema files and needs no live DB, so we fall back
// to a local default. `migrate`/`push`/`studio` do connect, so set DATABASE_URL
// (via the root .env) before running those.
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://carma:carma@localhost:5432/carma';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: databaseUrl,
  },
  // Print the SQL statements drizzle-kit runs — helpful while learning.
  verbose: true,
  strict: true,
});
