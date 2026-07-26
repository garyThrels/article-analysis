import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, sql } from "drizzle-orm";

/*
 * Runs against a migrated + seeded (+ enriched) Postgres. Skipped when
 * DATABASE_URL is unset. Modules importing the env-gated db client are loaded
 * lazily in beforeAll.
 */
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("getAggregateBuckets (integration)", () => {
  let pool: Pool;
  let db: NodePgDatabase;
  let getAggregateBuckets: typeof import("./articles.aggregate.js").getAggregateBuckets;
  let schema: typeof import("../../db/schema.js");

  beforeAll(async () => {
    ({ getAggregateBuckets } = await import("./articles.aggregate.js"));
    schema = await import("../../db/schema.js");
    pool = new Pool({ connectionString: url });
    db = drizzle(pool);
    const c = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.articles);
    if ((c[0]?.n ?? 0) < 20) {
      throw new Error("Expected the seeded dataset (>=20 articles).");
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  const sumTotal = (b: { total: number }[]) => b.reduce((a, x) => a + x.total, 0);

  it("bucket totals sum to the full article count (all articles)", async () => {
    const total =
      (await db.select({ n: sql<number>`count(*)::int` }).from(schema.articles))[0]!
        .n;
    const rows = await getAggregateBuckets({ interval: "month" });
    expect(sumTotal(rows)).toBe(total);
    // ascending by bucket
    const labels = rows.map((r) => r.bucket);
    expect([...labels].sort()).toEqual(labels);
  });

  it("total >= sum of the per-sentiment breakdown in every bucket", async () => {
    const rows = await getAggregateBuckets({ interval: "month" });
    for (const r of rows) {
      const classified = Object.values(r.bySentiment).reduce((a, n) => a + n, 0);
      expect(r.total).toBeGreaterThanOrEqual(classified);
    }
  });

  it("per-sentiment totals match the enrichment counts", async () => {
    const rows = await getAggregateBuckets({ interval: "month" });
    const negatives = rows.reduce((a, r) => a + r.bySentiment.negative, 0);
    const expected = (
      await db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.articleEnrichments)
        .where(eq(schema.articleEnrichments.sentiment, "negative"))
    )[0]!.n;
    expect(negatives).toBe(expected);
  });

  it("week yields at least as many buckets as month, same total", async () => {
    const month = await getAggregateBuckets({ interval: "month" });
    const week = await getAggregateBuckets({ interval: "week" });
    expect(week.length).toBeGreaterThanOrEqual(month.length);
    expect(sumTotal(week)).toBe(sumTotal(month));
  });

  it("filters by source", async () => {
    // Each sample article has a unique source → source 1 totals exactly 1.
    expect(sumTotal(await getAggregateBuckets({ interval: "month", sourceId: 1 }))).toBe(1);
  });
});
