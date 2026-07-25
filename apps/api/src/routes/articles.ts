import { Router } from 'express';
import { desc } from 'drizzle-orm';
import type { Article, ApiResponse } from '@carma/shared';
import { db } from '../db/index.js';
import { articles, type ArticleRow } from '../db/schema.js';

export const articlesRouter = Router();

/** Map a DB row to the wire-facing shared `Article` type. */
function toArticle(row: ArticleRow): Article {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

// GET /api/articles -> newest first
articlesRouter.get('/', async (_req, res) => {
  const rows = await db.select().from(articles).orderBy(desc(articles.createdAt));
  const body: ApiResponse<Article[]> = { data: rows.map(toArticle) };
  res.json(body);
});
