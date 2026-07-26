import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { articleEnrichments, articles } from "../../db/schema.js";
import type { EnrichmentResult } from "./enrichment.types.js";

/** A claimed work item: the enrichment row plus the article text to enrich. */
export interface EnrichmentJob {
  enrichmentId: number;
  articleId: number;
  headline: string;
  body: string;
}

/** Statuses eligible for (re)processing. `failed` rows are retried. */
const CLAIMABLE = ["pending", "failed"] as const;

/**
 * Self-heal: ensure every article has an enrichment row (status `pending`).
 * Lets an already-populated DB backfill on the first run, and is a no-op once
 * rows exist. One set-based INSERT … SELECT.
 */
export async function ensureRowsForAllArticles(): Promise<void> {
  await db.execute(sql`
    INSERT INTO ${articleEnrichments} (article_id)
    SELECT a.${sql.raw("id")} FROM ${articles} a
    LEFT JOIN ${articleEnrichments} e ON e.${sql.raw("article_id")} = a.${sql.raw("id")}
    WHERE e.${sql.raw("article_id")} IS NULL
    ON CONFLICT (article_id) DO NOTHING
  `);
}

/** Claim up to `limit` articles needing enrichment (pending or failed). */
export async function claimPending(limit: number): Promise<EnrichmentJob[]> {
  const rows = await db
    .select({
      enrichmentId: articleEnrichments.id,
      articleId: articles.id,
      headline: articles.headline,
      body: articles.body,
    })
    .from(articleEnrichments)
    .innerJoin(articles, eq(articleEnrichments.articleId, articles.id))
    .where(inArray(articleEnrichments.status, [...CLAIMABLE]))
    .limit(limit);
  return rows;
}

export async function markProcessing(enrichmentId: number): Promise<void> {
  await db
    .update(articleEnrichments)
    .set({
      status: "processing",
      attempts: sql`${articleEnrichments.attempts} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(articleEnrichments.id, enrichmentId));
}

export async function markCompleted(
  enrichmentId: number,
  result: EnrichmentResult,
): Promise<void> {
  await db
    .update(articleEnrichments)
    .set({
      status: "completed",
      summary: result.summary,
      sentiment: result.sentiment,
      topics: result.topics,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(articleEnrichments.id, enrichmentId));
}

export async function markFailed(
  enrichmentId: number,
  errorMessage: string,
): Promise<void> {
  await db
    .update(articleEnrichments)
    .set({
      status: "failed",
      errorMessage: errorMessage.slice(0, 2000),
      updatedAt: new Date(),
    })
    .where(eq(articleEnrichments.id, enrichmentId));
}

/** Count enrichment rows grouped by status (for run summaries). */
export async function countsByStatus(): Promise<Record<string, number>> {
  const rows = await db
    .select({
      status: articleEnrichments.status,
      count: sql<number>`count(*)::int`,
    })
    .from(articleEnrichments)
    .groupBy(articleEnrichments.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.count]));
}
