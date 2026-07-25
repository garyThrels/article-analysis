/** A single article record as returned by the API. */
export interface Article {
  id: number;
  headline: string;
  body: string;
  /** Publisher/source of the article (e.g. "Reuters"). */
  source: string;
  /** ISO-8601 timestamp string (the column is now NOT NULL). */
  publishedAt: string;
  /** ISO-8601 timestamp string (serialised from the DB `timestamp`). */
  createdAt: string;
}

/** Fields accepted when creating an article (server assigns the rest). */
export interface NewArticle {
  headline: string;
  body: string;
}

/** Standard envelope for successful list/detail responses. */
export interface ApiResponse<T> {
  data: T;
}

/**
 * Keyset-pagination metadata for a page of results.
 *
 * `cursor` is a single opaque token that encodes BOTH edges of the current page
 * (its first and last rows), so the client can navigate either direction from
 * it: request the next page with `?cursor=<cursor>&direction=next`, or the
 * previous page with `?cursor=<cursor>&direction=prev`. It is `null` for an
 * empty page.
 */
export interface PageInfo {
  cursor: string | null;
  /** Whether an older page exists after this one (forward). */
  hasNext: boolean;
  /** Whether a newer page exists before this one (backward). */
  hasPrev: boolean;
}

/** A page of results plus its keyset-pagination metadata. */
export interface Paginated<T> {
  data: T[];
  pageInfo: PageInfo;
}

/** Standard envelope for error responses. */
export interface ApiError {
  error: string;
}

/** A news source/publisher (filter dimension). */
export interface Source {
  id: number;
  name: string;
}

/** A content language (filter dimension). */
export interface Language {
  id: number;
  code: string;
  name: string;
}

/** Reference data for populating the filter controls. */
export interface Lookups {
  sources: Source[];
  languages: Language[];
}
