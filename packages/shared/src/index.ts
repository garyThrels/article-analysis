/**
 * Shared types for the Carma monorepo.
 *
 * These are the single source of truth for shapes that cross the wire between
 * the API (`@carma/api`) and the web app (`@carma/web`). Import them with:
 *
 *   import type { Article, ApiResponse } from '@carma/shared'
 */

/** A single article record as returned by the API. */
export interface Article {
  id: number;
  headline: string;
  body: string;
  /** Publisher/source of the article (e.g. "Reuters"). */
  source: string;
  /** ISO-8601 timestamp string, or null if the article has no publish date. */
  publishedAt: string | null;
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

/** Standard envelope for error responses. */
export interface ApiError {
  error: string;
}
