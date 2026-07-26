import { enrichmentConfig } from "./enrichment.config.js";
import {
  claimPending,
  ensureRowsForAllArticles,
  markCompleted,
  markFailed,
  markProcessing,
} from "./enrichment.repository.js";
import type { Enricher } from "./enrichment.types.js";

export interface EnrichRunResult {
  processed: number;
  completed: number;
  failed: number;
}

interface EnrichOptions {
  concurrency?: number;
  /** Max articles to process this run. */
  limit?: number;
  /** Restrict to a single article. */
  articleId?: number;
  /** Reprocess regardless of status (includes already-`completed` rows). */
  force?: boolean;
}

/**
 * Enrich all pending/failed articles with the given enricher. Each article
 * transitions pending/failed → processing → completed | failed; a failure is
 * captured on that row's `error_message` and never aborts the batch. Completed
 * rows are left untouched, so the whole thing is idempotent and retry-safe.
 */
export async function enrichPending(
  enricher: Enricher,
  opts: EnrichOptions = {},
): Promise<EnrichRunResult> {
  const concurrency = opts.concurrency ?? enrichmentConfig.concurrency;
  const limit = opts.limit ?? 10_000;

  await ensureRowsForAllArticles();
  const jobs = await claimPending({
    limit,
    articleId: opts.articleId,
    force: opts.force,
  });

  let completed = 0;
  let failed = 0;

  await runWithConcurrency(jobs, concurrency, async (job) => {
    await markProcessing(job.enrichmentId);
    try {
      const result = await enricher.enrich({
        headline: job.headline,
        body: job.body,
      });
      await markCompleted(job.enrichmentId, result);
      completed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markFailed(job.enrichmentId, message);
      failed += 1;
      console.error(`[enrich] article ${job.articleId} failed: ${message}`);
    }
  });

  return { processed: jobs.length, completed, failed };
}

/** Run `fn` over `items` with at most `limit` in flight at once. */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(limit, 1), items.length) },
    async () => {
      while (cursor < items.length) {
        const item = items[cursor++]!;
        await fn(item);
      }
    },
  );
  await Promise.all(workers);
}
