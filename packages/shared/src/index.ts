/**
 * Shared types for the Carma monorepo.
 *
 * These are the single source of truth for shapes that cross the wire between
 * the API (`@carma/api`) and the web app (`@carma/web`). Import them with:
 *
 *   import type { Article, ApiResponse } from '@carma/shared'
 */

export type * from "./types";

// --- Boolean search query language (parser lives here so the API can compile
// it and the web can validate typed input against the same grammar) ---
export type { QueryNode } from "./search/ast";
export { parseQuery } from "./search/parser";
export { ParseError } from "./search/tokenizer";
export type { Token } from "./search/tokenizer";
