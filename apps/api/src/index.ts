import express from 'express';
import { env } from './env.js';
import { pool } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seedIfEmpty } from './db/seed.js';
import { articlesRouter } from './routes/articles.js';

async function main() {
  // Bring the schema up to date, then seed sample data on a fresh DB.
  await runMigrations();
  await seedIfEmpty();

  const app = express();
  app.use(express.json());

  // Liveness probe.
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/articles', articlesRouter);

  const server = app.listen(env.port, () => {
    console.log(`[api] listening on http://localhost:${env.port}`);
  });

  // Graceful shutdown so `docker compose down` / Ctrl-C closes cleanly.
  const shutdown = () => {
    server.close(() => {
      void pool.end().then(() => process.exit(0));
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[api] fatal startup error:', err);
  process.exit(1);
});
