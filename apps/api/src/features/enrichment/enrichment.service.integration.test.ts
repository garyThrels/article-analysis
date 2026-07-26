import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import type { Enricher } from "./enrichment.types.js";

/*
 * Runs against a migrated + seeded Postgres. Skipped when DATABASE_URL is unset.
 *   DATABASE_URL=postgres://carma:carma@localhost:5432/carma yarn workspace @carma/api test
 *
 * Modules that transitively import the env-gated db client are loaded lazily in
 * beforeAll (dynamic import) so the file collects cleanly when skipped.
 */
const url = process.env.DATABASE_URL;

/** An enricher that always throws — drives a row to `failed`. */
const throwingEnricher: Enricher = {
  async enrich() {
    throw new Error("boom: simulated enrichment failure");
  },
};

const ARTICLE_ID = 1;

describe.skipIf(!url)("enrichPending lifecycle (integration)", () => {
  let pool: Pool;
  let db: NodePgDatabase;
  let schema: typeof import("../../db/schema.js");
  let enrichPending: typeof import("./enrichment.service.js").enrichPending;
  let MockEnricher: typeof import("./mock.enricher.js").MockEnricher;

  beforeAll(async () => {
    schema = await import("../../db/schema.js");
    ({ enrichPending } = await import("./enrichment.service.js"));
    ({ MockEnricher } = await import("./mock.enricher.js"));
    pool = new Pool({ connectionString: url });
    db = drizzle(pool);
    // Ensure enrichment rows exist for every article (self-heal) and complete
    // them, so ARTICLE_ID definitely has a row to reset in each test.
    await enrichPending(new MockEnricher());
  });

  afterAll(async () => {
    await pool.end();
  });

  async function resetToPending(articleId: number) {
    await db
      .update(schema.articleEnrichments)
      .set({ status: "pending", summary: null, sentiment: null, topics: null, errorMessage: null })
      .where(eq(schema.articleEnrichments.articleId, articleId));
  }

  async function getRow(articleId: number) {
    const rows = await db
      .select()
      .from(schema.articleEnrichments)
      .where(eq(schema.articleEnrichments.articleId, articleId))
      .limit(1);
    return rows[0];
  }

  it("pending → completed with fields populated", async () => {
    await resetToPending(ARTICLE_ID);
    await enrichPending(new MockEnricher());
    const row = await getRow(ARTICLE_ID);
    expect(row?.status).toBe("completed");
    expect(row?.summary).toBeTruthy();
    expect(row?.sentiment).toBeTruthy();
    expect((row?.topics ?? []).length).toBeGreaterThan(0);
    expect(row?.errorMessage).toBeNull();
  });

  it("failure → failed with error_message captured and attempts bumped", async () => {
    await resetToPending(ARTICLE_ID);
    const before = await getRow(ARTICLE_ID);
    await enrichPending(throwingEnricher);
    const row = await getRow(ARTICLE_ID);
    expect(row?.status).toBe("failed");
    expect(row?.errorMessage).toContain("boom");
    expect(row?.attempts ?? 0).toBeGreaterThan(before?.attempts ?? 0);
  });

  it("failed rows retry to completed; completed rows are idempotent", async () => {
    // ARTICLE_ID is `failed` from the previous test — a mock run should recover it.
    await enrichPending(new MockEnricher());
    expect((await getRow(ARTICLE_ID))?.status).toBe("completed");
    // Running again leaves completed rows untouched.
    await enrichPending(new MockEnricher());
    const row = await getRow(ARTICLE_ID);
    expect(row?.status).toBe("completed");
    expect(row?.errorMessage).toBeNull();
  });

  it("articleId scopes processing to a single article", async () => {
    await resetToPending(1);
    await resetToPending(2);
    await enrichPending(new MockEnricher(), { articleId: 1 });
    expect((await getRow(1))?.status).toBe("completed");
    expect((await getRow(2))?.status).toBe("pending"); // untouched
    await enrichPending(new MockEnricher()); // tidy up article 2
  });

  it("force reprocesses an already-completed article", async () => {
    // Ensure article 1 is completed, then reprocess it with force.
    await enrichPending(new MockEnricher(), { articleId: 1 });
    const before = await getRow(1);
    expect(before?.status).toBe("completed");

    const result = await enrichPending(new MockEnricher(), {
      articleId: 1,
      force: true,
    });
    expect(result.processed).toBe(1); // a completed row WAS reprocessed
    const after = await getRow(1);
    expect(after?.status).toBe("completed");
    expect(after?.attempts ?? 0).toBeGreaterThan(before?.attempts ?? 0);

    // Without force, a completed article is not reprocessed.
    const noop = await enrichPending(new MockEnricher(), { articleId: 1 });
    expect(noop.processed).toBe(0);
  });
});
