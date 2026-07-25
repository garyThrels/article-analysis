import type { Article } from "@carma/shared";
import type { ArticleListRow } from "./articles.types.js";

/** Map a database row to the wire-facing shared `Article` DTO. */
export function toArticle(row: ArticleListRow): Article {
  return {
    id: row.id,
    headline: row.headline,
    body: row.body,
    source: row.source,
    publishedAt: row.publishedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}
