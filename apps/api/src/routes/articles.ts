import { Router } from "express";
import { eq, sql, type SQL } from "drizzle-orm";
import type { Article, ApiError, Paginated } from "@carma/shared";
import { db } from "../db/index.js";
import { articles, sources } from "../db/schema.js";
import { CursorError, decodeCursor, encodeCursor } from "../lib/cursor.js";

export const articlesRouter = Router();

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;

// Ordering that matches the articles_published_at_id_idx index. NULLS LAST is
// required so the planner uses the index instead of sorting (see README).
const ORDER_DESC = sql`${articles.publishedAt} DESC NULLS LAST, ${articles.id} DESC NULLS LAST`;
// Reverse of the index — used when paging backward; results are reversed back
// to DESC for presentation.
const ORDER_ASC = sql`${articles.publishedAt} ASC NULLS FIRST, ${articles.id} ASC NULLS FIRST`;

function parseLimit(raw: unknown): number {
  const n = Number(raw);
  if (Number.isInteger(n) && n > 0) return Math.min(n, MAX_LIMIT);
  return DEFAULT_LIMIT;
}

/** Is there a row strictly older than this keyset position? (forward exists) */
async function hasOlder(publishedAt: Date, id: number): Promise<boolean> {
  const rows = await db
    .select({ one: sql`1` })
    .from(articles)
    .where(sql`(${articles.publishedAt}, ${articles.id}) < (${publishedAt}, ${id})`)
    .limit(1);
  return rows.length > 0;
}

/** Is there a row strictly newer than this keyset position? (backward exists) */
async function hasNewer(publishedAt: Date, id: number): Promise<boolean> {
  const rows = await db
    .select({ one: sql`1` })
    .from(articles)
    .where(sql`(${articles.publishedAt}, ${articles.id}) > (${publishedAt}, ${id})`)
    .limit(1);
  return rows.length > 0;
}

// GET /api/articles?limit=5&cursor=<token>&direction=next|prev
// Keyset-paginated, newest-first. Without a cursor, returns the first page.
articlesRouter.get("/", async (req, res) => {
  const limit = parseLimit(req.query.limit);
  const direction = req.query.direction === "prev" ? "prev" : "next";
  const cursorToken =
    typeof req.query.cursor === "string" && req.query.cursor.length > 0
      ? req.query.cursor
      : undefined;

  let where: SQL | undefined;
  let orderBy: SQL = ORDER_DESC;
  let reversed = false;

  if (cursorToken) {
    let cursor;
    try {
      cursor = decodeCursor(cursorToken);
    } catch (err) {
      if (err instanceof CursorError) {
        const body: ApiError = { error: err.message };
        return res.status(400).json(body);
      }
      throw err;
    }

    if (direction === "prev") {
      // Rows newer than the page's first edge, scanned ascending (closest-first)
      // then reversed back to newest-first.
      where = sql`(${articles.publishedAt}, ${articles.id}) > (${new Date(cursor.f.t)}, ${cursor.f.i})`;
      orderBy = ORDER_ASC;
      reversed = true;
    } else {
      // Rows older than the page's last edge.
      where = sql`(${articles.publishedAt}, ${articles.id}) < (${new Date(cursor.l.t)}, ${cursor.l.i})`;
    }
  }

  const query = db
    .select({
      id: articles.id,
      headline: articles.headline,
      body: articles.body,
      source: sources.name,
      publishedAt: articles.publishedAt,
      createdAt: articles.createdAt,
    })
    .from(articles)
    .innerJoin(sources, eq(articles.sourceId, sources.id))
    .$dynamic();

  if (where) query.where(where);
  const rows = await query.orderBy(orderBy).limit(limit);
  if (reversed) rows.reverse();

  if (rows.length === 0) {
    const body: Paginated<Article> = {
      data: [],
      pageInfo: { cursor: null, hasNext: false, hasPrev: false },
    };
    return res.json(body);
  }

  const first = rows[0]!;
  const last = rows[rows.length - 1]!;

  // Probe both edges so hasNext/hasPrev are correct regardless of which
  // direction we navigated (index-only LIMIT 1 lookups).
  const [hasPrev, hasNext] = await Promise.all([
    hasNewer(first.publishedAt, first.id),
    hasOlder(last.publishedAt, last.id),
  ]);

  const cursor = encodeCursor({
    f: { t: first.publishedAt.toISOString(), i: first.id },
    l: { t: last.publishedAt.toISOString(), i: last.id },
  });

  const data: Article[] = rows.map((row) => ({
    id: row.id,
    headline: row.headline,
    body: row.body,
    source: row.source,
    publishedAt: row.publishedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }));

  const body: Paginated<Article> = {
    data,
    pageInfo: { cursor, hasNext, hasPrev },
  };
  res.json(body);
});
