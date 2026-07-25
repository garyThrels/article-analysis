import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { buildArticleFilters, FilterError, parseArticleFilters } from "./articles.filters.js";

describe("parseArticleFilters — validation", () => {
  it("parses ids, dates and q", () => {
    const input = parseArticleFilters({
      source: "3",
      language: "1",
      from: "2026-07-01",
      to: "2026-07-31",
      q: "oil",
    });
    expect(input.sourceId).toBe(3);
    expect(input.languageId).toBe(1);
    expect(input.from).toBeInstanceOf(Date);
    expect(input.to).toBeInstanceOf(Date);
    expect(input.q).toBe("oil");
  });

  it("allows either date bound to be omitted", () => {
    expect(parseArticleFilters({ from: "2026-07-01" }).to).toBeUndefined();
    expect(parseArticleFilters({ to: "2026-07-01" }).from).toBeUndefined();
    expect(parseArticleFilters({}).from).toBeUndefined();
  });

  it("rejects 'to' before 'from'", () => {
    expect(() => parseArticleFilters({ from: "2026-07-31", to: "2026-07-01" })).toThrow(FilterError);
  });

  it("accepts equal from/to", () => {
    expect(() => parseArticleFilters({ from: "2026-07-01", to: "2026-07-01" })).not.toThrow();
  });

  it("rejects non-integer / non-positive ids", () => {
    expect(() => parseArticleFilters({ source: "abc" })).toThrow(FilterError);
    expect(() => parseArticleFilters({ language: "1.5" })).toThrow(FilterError);
    expect(() => parseArticleFilters({ source: "0" })).toThrow(FilterError);
  });

  it("rejects invalid dates", () => {
    expect(() => parseArticleFilters({ from: "not-a-date" })).toThrow(FilterError);
  });
});

describe("buildArticleFilters — SQL", () => {
  const dialect = new PgDialect();

  it("returns undefined when nothing is set", () => {
    expect(buildArticleFilters({})).toBeUndefined();
  });

  it("AND-combines source/language/date predicates as bound params", () => {
    const node = buildArticleFilters({
      sourceId: 3,
      languageId: 1,
      from: new Date("2026-07-01T00:00:00.000Z"),
      to: new Date("2026-07-31T23:59:59.999Z"),
    });
    expect(node).toBeDefined();
    const { sql, params } = dialect.sqlToQuery(node!);
    expect(sql).toContain('"source_id"');
    expect(sql).toContain('"language_id"');
    expect(sql).toContain('"published_at"');
    expect(params).toContain(3);
    expect(params).toContain(1);
  });
});
