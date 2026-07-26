import { and, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { parseQuery } from "@carma/shared";
import { articles } from "../../db/schema.js";
import { compileToTsquery } from "../../search/compile.js";
import type { ArticleFilterInput } from "./articles.types.js";

/** Raised on malformed filter inputs; the router maps it to a 400. */
export class FilterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FilterError";
  }
}

/** Parse a query param as a positive integer id, or throw FilterError. */
export function parseId(raw: unknown, field: string): number | undefined {
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new FilterError(`Invalid ${field}: expected a positive integer`);
  }
  return n;
}

/** Parse a query param as a date, or throw FilterError. */
function parseDate(raw: unknown, field: string): Date | undefined {
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new FilterError(`Invalid ${field}: expected an ISO date`);
  }
  return d;
}

/**
 * Parse & validate the raw request query into a filter input. Either date bound
 * may be omitted, but if both are present `to` must not precede `from`.
 * Throws FilterError on malformed input.
 */
export function parseArticleFilters(
  query: Record<string, unknown>,
): ArticleFilterInput {
  const from = parseDate(query.from, "from");
  const to = parseDate(query.to, "to");
  if (from && to && to.getTime() < from.getTime()) {
    throw new FilterError(
      "Invalid date range: 'to' must be on or after 'from'",
    );
  }
  return {
    q: typeof query.q === "string" ? query.q : undefined,
    sourceId: parseId(query.source, "source"),
    languageId: parseId(query.language, "language"),
    from,
    to,
  };
}

/** Full-text search predicate from a raw query string; may throw `ParseError`. */
function searchFilter(q: string | undefined): SQL | undefined {
  if (!q || q.trim().length === 0) return undefined;
  const node = parseQuery(q);
  return node
    ? sql`${articles.searchVector} @@ ${compileToTsquery(node)}`
    : undefined;
}

/**
 * Combine all active filters into a single predicate (or `undefined` when none
 * apply). All predicates are on `articles` columns, so they also apply cleanly
 * to the keyset existence probes. Throws `ParseError` for a malformed `q`.
 */
export function buildArticleFilters(
  input: ArticleFilterInput,
): SQL | undefined {
  return and(
    searchFilter(input.q),
    input.sourceId !== undefined ? eq(articles.sourceId, input.sourceId) : undefined,
    input.languageId !== undefined ? eq(articles.languageId, input.languageId) : undefined,
    input.from ? gte(articles.publishedAt, input.from) : undefined,
    input.to ? lte(articles.publishedAt, input.to) : undefined,
  );
}
