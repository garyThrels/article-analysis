import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

// Load the repo-root .env for local runs. In Docker Compose these vars are
// injected by the `environment:` block, so the file simply won't exist there.
loadEnv({ path: resolve(process.cwd(), '../../.env') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var "${name}". Copy .env.example to .env at the ` +
        `repo root, or set it in your environment.`,
    );
  }
  return value;
}

export const env = {
  databaseUrl: required('DATABASE_URL'),
  port: Number(process.env.API_PORT ?? 3000),
} as const;
