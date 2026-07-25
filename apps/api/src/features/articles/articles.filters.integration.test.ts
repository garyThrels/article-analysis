import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { asc, sql } from "drizzle-orm";
import { articles } from "../../db/schema.js";
import { buildArticleFilters } from "./articles.filters.js";
import type { ArticleFilterInput } from "./articles.types.js";

/*
 * Runs against a migrated + seeded Postgres. Skipped when DATABASE_URL is unset.
 * DATABASE_URL=postgres://carma:carma@localhost:5432/carma yarn workspace @carma/api test
 *
 * Seed facts used below: every sample article has a unique source, so source id
 * N ↔ article N. Languages seed in first-appearance order: en=1, ar=2, zh=3
 * (article 8 is Arabic, article 9 is Chinese).
 */
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("article filters (integration)", () => {
  let pool: Pool;
  let db: NodePgDatabase;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    db = drizzle(pool);
    const counts = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(articles);
    if ((counts[0]?.count ?? 0) < 20) {
      throw new Error("Expected the seeded dataset (>=20 articles).");
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  /** Apply a filter input and return matching article ids (ascending). */
  async function filter(input: ArticleFilterInput): Promise<number[]> {
    const rows = await db
      .select({ id: articles.id })
      .from(articles)
      .where(buildArticleFilters(input))
      .orderBy(asc(articles.id));
    return rows.map((r) => r.id);
  }

  it("filters by source id", async () => {
    expect(await filter({ sourceId: 1 })).toEqual([1]);
  });

  it("filters by language id", async () => {
    expect(await filter({ languageId: 2 })).toEqual([8]); // Arabic
    expect(await filter({ languageId: 3 })).toEqual([9]); // Chinese
  });

  it("filters by a lower date bound (from)", async () => {
    const ids = await filter({ from: new Date("2026-07-10T00:00:00.000Z") });
    expect(ids).toEqual(expect.arrayContaining([1, 2, 3]));
    expect(ids).not.toContain(20); // published 2026-06-12
  });

  it("filters by a from..to window", async () => {
    const ids = await filter({
      from: new Date("2026-07-08T00:00:00.000Z"),
      to: new Date("2026-07-10T23:59:59.999Z"),
    });
    expect(ids).toEqual([3, 4, 5]); // 07-10, 07-09, 07-08
  });

  it("combines search with a source filter (AND)", async () => {
    expect(await filter({ sourceId: 5, q: "renew*" })).toEqual([5]); // The Guardian + renewable
    expect(await filter({ sourceId: 1, q: "renew*" })).toEqual([]); // Reuters isn't renewable
  });
});
