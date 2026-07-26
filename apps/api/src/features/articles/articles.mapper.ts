import type { Article, ArticleEnrichment } from "@carma/shared";
import type { ArticleListRow } from "./articles.types.js";

/** Build the nested enrichment DTO, or null when no enrichment row exists. */
function toEnrichment(row: ArticleListRow): ArticleEnrichment | null {
  if (row.enrichmentStatus === null) return null;
  return {
    status: row.enrichmentStatus,
    summary: row.summary,
    sentiment: row.sentiment,
    topics: row.topics ?? [],
  };
}

/** Map a database row to the wire-facing shared `Article` DTO. */
export function toArticle(row: ArticleListRow): Article {
  return {
    id: row.id,
    headline: row.headline,
    body: row.body,
    source: row.source,
    publishedAt: row.publishedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    enrichment: toEnrichment(row),
  };
}
