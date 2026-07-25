import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { parseQuery } from "@carma/shared";
import { compileToTsquery } from "./compile.js";

const dialect = new PgDialect();

/** Compile a query string and render it to `{ sql, params }`. */
function render(query: string) {
  const node = parseQuery(query);
  if (!node) throw new Error("query parsed to null");
  return dialect.sqlToQuery(compileToTsquery(node));
}

describe("compileToTsquery — leaves", () => {
  it("term -> plainto_tsquery with bound value", () => {
    const { sql, params } = render("oil");
    expect(sql).toBe("plainto_tsquery($1, $2)");
    expect(params).toEqual(["simple", "oil"]);
  });

  it("phrase -> phraseto_tsquery with bound value", () => {
    const { sql, params } = render('"oil prices"');
    expect(sql).toBe("phraseto_tsquery($1, $2)");
    expect(params).toEqual(["simple", "oil prices"]);
  });

  it("prefix -> to_tsquery with ':*' appended to the bound value", () => {
    const { sql, params } = render("renew*");
    expect(sql).toBe("to_tsquery($1, $2)");
    expect(params).toEqual(["simple", "renew:*"]);
  });
});

describe("compileToTsquery — operators", () => {
  it("AND -> &&", () => {
    const { sql, params } = render("oil AND gas");
    expect(sql).toBe("(plainto_tsquery($1, $2) && plainto_tsquery($3, $4))");
    expect(params).toEqual(["simple", "oil", "simple", "gas"]);
  });

  it("OR -> ||", () => {
    const { sql } = render("oil OR gas");
    expect(sql).toBe("(plainto_tsquery($1, $2) || plainto_tsquery($3, $4))");
  });

  it("AND NOT -> && (!! ...)", () => {
    const { sql, params } = render("renewable AND NOT nuclear");
    expect(sql).toBe(
      "(plainto_tsquery($1, $2) && (!! plainto_tsquery($3, $4)))",
    );
    expect(params).toEqual(["simple", "renewable", "simple", "nuclear"]);
  });

  it("nested groups compile with correct structure and params", () => {
    const { sql, params } = render('"oil prices" AND (geopolitical OR renew*)');
    expect(sql).toBe(
      "(phraseto_tsquery($1, $2) && (plainto_tsquery($3, $4) || to_tsquery($5, $6)))",
    );
    expect(params).toEqual([
      "simple",
      "oil prices",
      "simple",
      "geopolitical",
      "simple",
      "renew:*",
    ]);
  });
});

describe("compileToTsquery — safety", () => {
  it("keeps user values as parameters, not inlined SQL", () => {
    // The parser rejects tsquery metacharacters, but even ordinary values must
    // travel as bound params — never interpolated into the SQL text.
    const { sql, params } = render("oil");
    expect(sql).not.toContain("oil");
    expect(params).toContain("oil");
  });
});
