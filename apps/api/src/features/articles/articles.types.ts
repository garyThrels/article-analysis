import type { SQL } from "drizzle-orm";

/** Direction to page in, relative to a keyset anchor. */
export type Direction = "next" | "prev";

/** A keyset position — the `(published_at, id)` pair a page is anchored on. */
export interface KeysetAnchor {
  publishedAt: Date;
  id: number;
}

/** A joined article row as read from the database (source resolved to a name). */
export interface ArticleListRow {
  id: number;
  headline: string;
  body: string;
  source: string;
  publishedAt: Date;
  createdAt: Date;
}

/** Inputs that narrow the article list. */
export interface ArticleFilterInput {
  /** Boolean full-text search query. */
  q?: string;
  /** Restrict to a source by id. */
  sourceId?: number;
  /** Restrict to a language by id. */
  languageId?: number;
  /** Inclusive lower bound on published_at. */
  from?: Date;
  /** Inclusive upper bound on published_at. */
  to?: Date;
}

export interface FindArticlesPageParams {
  limit: number;
  direction: Direction;
  /** Keyset position to page from; omit for the first page. */
  anchor?: KeysetAnchor;
  /** Optional extra predicate (e.g. full-text search) — see articles.filters. */
  filter?: SQL;
}

export interface ArticlesPage {
  rows: ArticleListRow[];
  hasNext: boolean;
  hasPrev: boolean;
}
