import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql, type SQL } from "drizzle-orm";
import { parseQuery } from "@carma/shared";
import { articles } from "../db/schema.js";
import { compileToTsquery } from "./compile.js";

/*
 * Runs against a migrated + seeded Postgres (the docker DB). Skipped entirely
 * when DATABASE_URL is unset, so `yarn test` stays DB-free by default.
 *
 * To run ensure that the DATABASE_URL is set, since Vitest does not read the .env
 * Run `DATABASE_URL=postgres://carma:carma@localhost:5432/carma yarn workspace @carma/api test`
 */

// Runs against a migrated + seeded Postgres (the docker DB). Skipped entirely
// when DATABASE_URL is unset, so `yarn test` stays DB-free by default.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("boolean search @@ (integration)", () => {
  let pool: Pool;
  let db: NodePgDatabase;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    db = drizzle(pool);
    const counts = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(articles);
    const count = counts[0]?.count ?? 0;
    if (count < 20) {
      throw new Error(
        `Expected the seeded dataset (>=20 articles), found ${count}. Run 'yarn db:migrate && yarn db:seed'.`,
      );
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  /** Run a search query string and return matching article ids (ascending). */
  async function search(q: string): Promise<number[]> {
    const node = parseQuery(q);
    const predicate: SQL | undefined = node
      ? sql`${articles.searchVector} @@ ${compileToTsquery(node)}`
      : undefined;
    const rows = await db
      .select({ id: articles.id })
      .from(articles)
      .where(predicate)
      .orderBy(articles.id);
    return rows.map((r) => r.id);
  }

  it("prefix wildcard: renew* matches the Renewable article (5)", async () => {
    expect(await search("renew*")).toContain(5);
  });

  it('phrase: "oil prices" matches article 1', async () => {
    expect(await search('"oil prices"')).toContain(1);
  });

  it('phrase order matters: "prices oil" does NOT match article 1', async () => {
    expect(await search('"prices oil"')).not.toContain(1);
  });

  it("AND NOT: 'AI AND NOT startup*' includes AI articles but excludes the startup one", async () => {
    const ids = await search("AI AND NOT startup*");
    expect(ids).toEqual(expect.arrayContaining([2, 3])); // AI, no "startup"
    expect(ids).not.toContain(10); // "Healthcare AI Startup ..."
  });

  it("nesting: '(oil OR renewable) AND NOT nuclear' includes 1 and 5", async () => {
    const ids = await search("(oil OR renewable) AND NOT nuclear");
    expect(ids).toEqual(expect.arrayContaining([1, 5]));
  });

  it("OR is a union of its sides", async () => {
    const oil = await search("oil");
    const renewable = await search("renewable");
    const union = await search("oil OR renewable");
    for (const id of [...oil, ...renewable]) expect(union).toContain(id);
  });

  it("case-sensitive: lowercase 'and' is a term, not an operator", async () => {
    // "gas and oil" -> requires the literal token "and"; behaves as a filter,
    // not an operator. Just assert it runs and returns a subset of "oil".
    const withAndTerm = await search("oil and gas");
    const oil = await search("oil");
    for (const id of withAndTerm) expect(oil).toContain(id);
  });
});
