import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../env.js';
import * as schema from './schema.js';

// A single shared connection pool for the process.
export const pool = new Pool({ connectionString: env.databaseUrl });

// The Drizzle client, typed with our schema so queries are fully type-safe.
export const db = drizzle(pool, { schema });

export { schema };
