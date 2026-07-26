import { describe, expect, it } from "vitest";
import { parseAggregateParams } from "./articles.aggregate.js";
import { FilterError } from "./articles.filters.js";

describe("parseAggregateParams", () => {
  it("defaults interval to month", () => {
    expect(parseAggregateParams({})).toEqual({ interval: "month", sourceId: undefined });
  });

  it("accepts week + source", () => {
    expect(parseAggregateParams({ interval: "week", source: "3" })).toEqual({
      interval: "week",
      sourceId: 3,
    });
  });

  it("rejects an invalid interval", () => {
    expect(() => parseAggregateParams({ interval: "day" })).toThrow(FilterError);
  });

  it("rejects inherited Object.prototype keys as intervals", () => {
    for (const key of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(() => parseAggregateParams({ interval: key })).toThrow(FilterError);
    }
  });

  it("rejects a non-integer source", () => {
    expect(() => parseAggregateParams({ source: "abc" })).toThrow(FilterError);
  });
});
