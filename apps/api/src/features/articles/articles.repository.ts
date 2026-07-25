import { and, eq, sql, type SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import { articles, sources } from "../../db/schema.js";
import { keysetPredicate, newerThan, olderThan, orderFor } from "./articles.pagination.js";
import type { ArticlesPage, FindArticlesPageParams } from "./articles.types.js";

/** Does any row satisfy `cmp` (a keyset comparison), honouring the filter? */
async function exists(cmp: SQL, filter: SQL | undefined): Promise<boolean> {
  const rows = await db
    .select({ one: sql`1` })
    .from(articles)
    .where(and(cmp, filter))
    .limit(1);
  return rows.length > 0;
}

/**
 * Fetch one keyset page of articles (newest-first) plus its navigation flags.
 * `hasNext`/`hasPrev` are computed with index-only existence probes that also
 * apply the filter, so they stay correct under search and in either direction.
 */
export async function findArticlesPage({
  limit,
  direction,
  anchor,
  filter,
}: FindArticlesPageParams): Promise<ArticlesPage> {
  const where = and(anchor ? keysetPredicate(anchor, direction) : undefined, filter);

  const query = db
    .select({
      id: articles.id,
      headline: articles.headline,
      body: articles.body,
      source: sources.name,
      publishedAt: articles.publishedAt,
      createdAt: articles.createdAt,
    })
    .from(articles)
    .innerJoin(sources, eq(articles.sourceId, sources.id))
    .$dynamic();

  if (where) query.where(where);
  const rows = await query.orderBy(orderFor(direction)).limit(limit);
  // Backward pages are scanned ascending (closest-first); flip to newest-first.
  if (direction === "prev") rows.reverse();

  if (rows.length === 0) {
    return { rows: [], hasNext: false, hasPrev: false };
  }

  const first = rows[0]!;
  const last = rows[rows.length - 1]!;
  const [hasPrev, hasNext] = await Promise.all([
    exists(newerThan({ publishedAt: first.publishedAt, id: first.id }), filter),
    exists(olderThan({ publishedAt: last.publishedAt, id: last.id }), filter),
  ]);

  return { rows, hasNext, hasPrev };
}
