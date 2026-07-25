import type { QueryNode } from "@carma/shared";
import { sql, type SQL } from "drizzle-orm";

// Text-search configuration. 'simple' (no stemming/stopwords) so multilingual
// content matches predictably and prefix wildcards behave — matches the config
// used to build articles.search_vector.
const CONFIG = "simple";

/**
 * Compile a parsed query AST into a Postgres `tsquery` SQL expression.
 *
 * Leaves are built with `plainto_tsquery` / `phraseto_tsquery` / `to_tsquery`
 * and every user value is passed as a **bound parameter** — user text never
 * becomes SQL syntax. Nodes combine with the tsquery operators `&&` (and),
 * `||` (or) and `!!` (not). The result is meant to be used as:
 *
 *   sql`${articles.searchVector} @@ ${compileToTsquery(node)}`
 */
export function compileToTsquery(node: QueryNode): SQL {
  switch (node.type) {
    case "term":
      return sql`plainto_tsquery(${CONFIG}, ${node.value})`;
    case "phrase":
      return sql`phraseto_tsquery(${CONFIG}, ${node.value})`;
    case "prefix":
      // node.value is `[\p{L}\p{N}_]+` (enforced by the parser), so appending
      // ':*' to form a prefix query is safe. The whole string is still bound.
      return sql`to_tsquery(${CONFIG}, ${node.value + ":*"})`;
    case "and":
      return sql`(${compileToTsquery(node.left)} && ${compileToTsquery(node.right)})`;
    case "or":
      return sql`(${compileToTsquery(node.left)} || ${compileToTsquery(node.right)})`;
    case "not":
      return sql`(!! ${compileToTsquery(node.operand)})`;
  }
}
