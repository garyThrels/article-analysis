import { Router, type Response } from "express";
import type { AggregateBucket, ApiResponse, Article, ApiError, Paginated } from "@carma/shared";
import { ParseError } from "@carma/shared";
import { CursorError } from "../../lib/cursor.js";
import { buildArticleFilters, FilterError, parseArticleFilters } from "./articles.filters.js";
import { getAggregateBuckets, parseAggregateParams } from "./articles.aggregate.js";
import { findArticlesPage } from "./articles.repository.js";
import { toArticle } from "./articles.mapper.js";
import {
  anchorFromCursor,
  buildPageInfo,
  EMPTY_PAGE_INFO,
  parseDirection,
  parseLimit,
} from "./articles.pagination.js";
import type { KeysetAnchor } from "./articles.types.js";

export const articlesRouter = Router();

function badRequest(res: Response, message: string) {
  const body: ApiError = { error: message };
  return res.status(400).json(body);
}

// GET /api/articles/aggregate?interval=month|week&source=<id>
// Per-bucket article counts over time — overall total plus the per-sentiment
// breakdown — optionally restricted to one source.
articlesRouter.get("/aggregate", async (req, res) => {
  let params;
  try {
    params = parseAggregateParams(req.query);
  } catch (err) {
    if (err instanceof FilterError) return badRequest(res, err.message);
    throw err;
  }
  const body: ApiResponse<AggregateBucket[]> = {
    data: await getAggregateBuckets(params),
  };
  res.json(body);
});

// GET /api/articles?q=<query>&limit=5&cursor=<token>&direction=next|prev
// Keyset-paginated, newest-first, with optional boolean full-text search (q).
// This handler stays thin: parse request → build filters → repository → map.
articlesRouter.get("/", async (req, res) => {
  const limit = parseLimit(req.query.limit);
  const direction = parseDirection(req.query.direction);
  const cursorToken =
    typeof req.query.cursor === "string" && req.query.cursor.length > 0
      ? req.query.cursor
      : undefined;

  // Parse + validate filters, then compile them to a predicate.
  // FilterError (bad id / date / range) and ParseError (bad q) → 400.
  let filter;
  try {
    filter = buildArticleFilters(parseArticleFilters(req.query));
  } catch (err) {
    if (err instanceof FilterError || err instanceof ParseError) {
      return badRequest(res, err.message);
    }
    throw err;
  }

  // Decode the cursor token into the keyset anchor for this direction (→ 400).
  let anchor: KeysetAnchor | undefined;
  if (cursorToken) {
    try {
      anchor = anchorFromCursor(cursorToken, direction);
    } catch (err) {
      if (err instanceof CursorError) return badRequest(res, err.message);
      throw err;
    }
  }

  const page = await findArticlesPage({ limit, direction, anchor, filter });

  if (page.rows.length === 0) {
    const empty: Paginated<Article> = { data: [], pageInfo: EMPTY_PAGE_INFO };
    return res.json(empty);
  }

  const first = page.rows[0]!;
  const last = page.rows[page.rows.length - 1]!;
  const body: Paginated<Article> = {
    data: page.rows.map(toArticle),
    pageInfo: buildPageInfo(first, last, page.hasNext, page.hasPrev),
  };
  res.json(body);
});
