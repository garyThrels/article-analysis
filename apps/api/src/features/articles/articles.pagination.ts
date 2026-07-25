import { sql, type SQL } from "drizzle-orm";
import type { PageInfo } from "@carma/shared";
import { articles } from "../../db/schema.js";
import { decodeCursor, encodeCursor } from "../../lib/cursor.js";
import type { Direction, KeysetAnchor } from "./articles.types.js";

/**
 * Keyset (cursor) pagination for the article feed, ordered `(published_at DESC,
 * id DESC)`. Everything specific to *how we page* lives here: request parsing,
 * index-matching ordering, keyset predicates, and cursor-token ↔ position
 * translation. The repository runs queries with these; the router speaks HTTP.
 */

export const DEFAULT_LIMIT = 5;
export const MAX_LIMIT = 50;

export const EMPTY_PAGE_INFO: PageInfo = {
  cursor: null,
  hasNext: false,
  hasPrev: false,
};

export function parseLimit(raw: unknown): number {
  const n = Number(raw);
  if (Number.isInteger(n) && n > 0) return Math.min(n, MAX_LIMIT);
  return DEFAULT_LIMIT;
}

export function parseDirection(raw: unknown): Direction {
  return raw === "prev" ? "prev" : "next";
}

// Ordering matches the articles_published_at_id_idx index. NULLS LAST/FIRST is
// required so the planner uses the index instead of sorting (see README).
const ORDER_DESC = sql`${articles.publishedAt} DESC NULLS LAST, ${articles.id} DESC NULLS LAST`;
const ORDER_ASC = sql`${articles.publishedAt} ASC NULLS FIRST, ${articles.id} ASC NULLS FIRST`;

/** Feed order for a direction; backward pages scan ascending, then get reversed. */
export function orderFor(direction: Direction): SQL {
  return direction === "prev" ? ORDER_ASC : ORDER_DESC;
}

/** Rows strictly older than the anchor. */
export function olderThan(a: KeysetAnchor): SQL {
  return sql`(${articles.publishedAt}, ${articles.id}) < (${a.publishedAt}, ${a.id})`;
}

/** Rows strictly newer than the anchor. */
export function newerThan(a: KeysetAnchor): SQL {
  return sql`(${articles.publishedAt}, ${articles.id}) > (${a.publishedAt}, ${a.id})`;
}

/** Keyset predicate to page from an anchor: older for `next`, newer for `prev`. */
export function keysetPredicate(a: KeysetAnchor, direction: Direction): SQL {
  return direction === "prev" ? newerThan(a) : olderThan(a);
}

/** Decode a cursor token to the anchor for this direction (throws CursorError). */
export function anchorFromCursor(
  token: string,
  direction: Direction,
): KeysetAnchor {
  const cursor = decodeCursor(token);
  const edge = direction === "prev" ? cursor.f : cursor.l;
  return { publishedAt: new Date(edge.t), id: edge.i };
}

/** Build PageInfo (both-edges cursor token + flags) from a page's edges. */
export function buildPageInfo(
  first: KeysetAnchor,
  last: KeysetAnchor,
  hasNext: boolean,
  hasPrev: boolean,
): PageInfo {
  const cursor = encodeCursor({
    f: { t: first.publishedAt.toISOString(), i: first.id },
    l: { t: last.publishedAt.toISOString(), i: last.id },
  });
  return { cursor, hasNext, hasPrev };
}
