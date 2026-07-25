import { and, sql, type SQL } from "drizzle-orm";
import { parseQuery } from "@carma/shared";
import { articles } from "../../db/schema.js";
import { compileToTsquery } from "../../search/compile.js";
import type { ArticleFilterInput } from "./articles.types.js";

/** Full-text search predicate from a raw query string; may throw `ParseError`. */
function searchFilter(q: string | undefined): SQL | undefined {
  if (!q || q.trim().length === 0) return undefined;
  const node = parseQuery(q);
  return node ? sql`${articles.searchVector} @@ ${compileToTsquery(node)}` : undefined;
}

/**
 * Combine all active filters into a single predicate (or `undefined` when none
 * apply). Throws `ParseError` if the search query is malformed — the caller
 * maps that to a 400.
 */
export function buildArticleFilters(input: ArticleFilterInput): SQL | undefined {
  return and(searchFilter(input.q));
}
