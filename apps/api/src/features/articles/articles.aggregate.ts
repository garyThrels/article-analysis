import { eq, sql } from "drizzle-orm";
import type { AggregateBucket, Sentiment, TimeInterval } from "@carma/shared";
import { db } from "../../db/index.js";
import { articleEnrichments, articles } from "../../db/schema.js";
import { FilterError, parseId } from "./articles.filters.js";

// Whitelist of allowed date_trunc granularities. Only these literals are ever
// interpolated into SQL — never raw request input — so the interval can't be an
// injection vector.
const INTERVALS: Record<string, TimeInterval> = { month: "month", week: "week" };

export interface AggregateParams {
  interval: TimeInterval;
  sourceId?: number;
}

/** Parse & validate aggregate query params. Throws FilterError on bad input. */
export function parseAggregateParams(
  query: Record<string, unknown>,
): AggregateParams {
  const rawInterval = typeof query.interval === "string" ? query.interval : "month";
  const interval = INTERVALS[rawInterval];
  if (!interval) {
    throw new FilterError("Invalid interval: expected 'month' or 'week'");
  }
  return { interval, sourceId: parseId(query.source, "source") };
}

/**
 * Per-time-bucket article counts: an overall `total` (LEFT JOIN → counts every
 * article, classified or not) plus a per-sentiment breakdown via conditional
 * aggregation. One grouped query, ascending by bucket. Optionally restricted to
 * one source. `interval` is a whitelisted literal (see INTERVALS).
 */
export async function getAggregateBuckets({
  interval,
  sourceId,
}: AggregateParams): Promise<AggregateBucket[]> {
  const bucket = sql<string>`date_trunc(${sql.raw(`'${interval}'`)}, ${articles.publishedAt})`;
  // count(*) FILTER (WHERE sentiment = $s) — sentiment values are a fixed enum,
  // bound as params and compared as text (avoids enum-vs-text operator issues).
  const per = (s: Sentiment) =>
    sql<number>`(count(*) filter (where ${articleEnrichments.sentiment}::text = ${s}))::int`;

  const query = db
    .select({
      bucket,
      total: sql<number>`count(*)::int`,
      positive: per("positive"),
      negative: per("negative"),
      neutral: per("neutral"),
      mixed: per("mixed"),
    })
    .from(articles)
    .leftJoin(articleEnrichments, eq(articleEnrichments.articleId, articles.id))
    .$dynamic();

  if (sourceId !== undefined) query.where(eq(articles.sourceId, sourceId));

  const rows = await query.groupBy(bucket).orderBy(bucket);

  return rows.map((r) => ({
    bucket: new Date(r.bucket).toISOString(),
    total: r.total,
    bySentiment: {
      positive: r.positive,
      negative: r.negative,
      neutral: r.neutral,
      mixed: r.mixed,
    },
  }));
}
