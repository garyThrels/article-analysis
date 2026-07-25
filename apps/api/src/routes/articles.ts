import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import type { Article, ApiResponse } from "@carma/shared";
import { db } from "../db/index.js";
import { articles, sources } from "../db/schema.js";

export const articlesRouter = Router();

// GET /api/articles -> newest first (published_at DESC, id DESC — matches the
// keyset index). `source` is resolved to its name via the sources lookup table.
articlesRouter.get("/", async (_req, res) => {
  const rows = await db
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
    // NULLS LAST is required so the ordering matches the
    // articles_published_at_id_idx index (created DESC NULLS LAST); otherwise
    // the planner adds a Sort and the keyset index isn't used. Keep this
    // convention for all keyset-ordered article queries.
    .orderBy(
      sql`${articles.publishedAt} DESC NULLS LAST, ${articles.id} DESC NULLS LAST`,
    );

  const data: Article[] = rows.map((row) => ({
    id: row.id,
    headline: row.headline,
    body: row.body,
    source: row.source,
    publishedAt: row.publishedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }));

  const body: ApiResponse<Article[]> = { data };
  res.json(body);
});
