/**
 * Keyset-pagination cursor encoding.
 *
 * A cursor token is an opaque (base64url) string that encodes BOTH edges of a
 * page — its first row and its last row — as `(published_at, id)` pairs. Because
 * it carries both edges, a single token is enough to navigate either direction:
 *   - forward  (older) → compare against the LAST edge with `<`
 *   - backward (newer) → compare against the FIRST edge with `>`
 *
 * The token is not encrypted or signed — it only exposes a timestamp + id, both
 * of which are already returned in the payload — but it is validated on decode
 * so malformed input yields a 400 rather than a bad query.
 */

/** One edge of a page: a keyset position `(published_at, id)`. */
export interface Edge {
  /** ISO-8601 `published_at`. */
  t: string;
  /** Article `id` (keyset tiebreaker). */
  i: number;
}

/** A page cursor: the first (`f`) and last (`l`) edges of a page. */
export interface PageCursor {
  f: Edge;
  l: Edge;
}

/** Thrown when a client-supplied cursor can't be decoded/validated. */
export class CursorError extends Error {}

export function encodeCursor(cursor: PageCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function isEdge(value: unknown): value is Edge {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Edge).t === "string" &&
    typeof (value as Edge).i === "number" &&
    Number.isInteger((value as Edge).i) &&
    !Number.isNaN(Date.parse((value as Edge).t))
  );
}

export function decodeCursor(token: string): PageCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    throw new CursorError("cursor is not valid base64url JSON");
  }

  const candidate = parsed as Partial<PageCursor>;
  if (!isEdge(candidate.f) || !isEdge(candidate.l)) {
    throw new CursorError("cursor is missing valid first/last edges");
  }
  return { f: candidate.f, l: candidate.l };
}
