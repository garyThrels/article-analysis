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
  title: string;
  body: string;
  /** ISO-8601 timestamp string (serialised from the DB `timestamp`). */
  createdAt: string;
}

/** Fields accepted when creating an article (server assigns the rest). */
export interface NewArticle {
  title: string;
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
