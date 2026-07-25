import { describe, expect, it } from "vitest";
import { parseQuery } from "./parser.js";
import { ParseError } from "./tokenizer.js";
import type { QueryNode } from "./ast.js";

// Small builders to keep expected trees readable.
const term = (value: string): QueryNode => ({ type: "term", value });
const phrase = (value: string): QueryNode => ({ type: "phrase", value });
const prefix = (value: string): QueryNode => ({ type: "prefix", value });
const and = (left: QueryNode, right: QueryNode): QueryNode => ({ type: "and", left, right });
const or = (left: QueryNode, right: QueryNode): QueryNode => ({ type: "or", left, right });
const not = (operand: QueryNode): QueryNode => ({ type: "not", operand });

describe("parseQuery — leaves", () => {
  it("parses a bare term", () => {
    expect(parseQuery("renewable")).toEqual(term("renewable"));
  });

  it("parses a phrase", () => {
    expect(parseQuery('"media intelligence"')).toEqual(phrase("media intelligence"));
  });

  it("parses a prefix wildcard", () => {
    expect(parseQuery("renew*")).toEqual(prefix("renew"));
  });

  it("supports unicode terms (Arabic / Chinese)", () => {
    expect(parseQuery("دبي")).toEqual(term("دبي"));
    expect(parseQuery("中国")).toEqual(term("中国"));
  });

  it("returns null for empty / whitespace input", () => {
    expect(parseQuery("")).toBeNull();
    expect(parseQuery("   ")).toBeNull();
  });
});

describe("parseQuery — operators & precedence", () => {
  it("AND binds tighter than OR", () => {
    expect(parseQuery("a AND b OR c")).toEqual(or(and(term("a"), term("b")), term("c")));
    expect(parseQuery("a OR b AND c")).toEqual(or(term("a"), and(term("b"), term("c"))));
  });

  it("honours explicit grouping", () => {
    expect(parseQuery("a AND (b OR c)")).toEqual(
      and(term("a"), or(term("b"), term("c"))),
    );
  });

  it("handles nested groups", () => {
    expect(parseQuery("(a AND (b OR c)) OR d")).toEqual(
      or(and(term("a"), or(term("b"), term("c"))), term("d")),
    );
  });

  it("treats adjacency as implicit AND", () => {
    expect(parseQuery("oil gas")).toEqual(and(term("oil"), term("gas")));
  });

  it("parses AND NOT", () => {
    expect(parseQuery("renewable AND NOT nuclear")).toEqual(
      and(term("renewable"), not(term("nuclear"))),
    );
  });

  it("parses a leading NOT", () => {
    expect(parseQuery("NOT startup*")).toEqual(not(prefix("startup")));
  });

  it("combines phrases, wildcards and groups", () => {
    expect(parseQuery('"oil prices" AND (geopolitical OR renew*)')).toEqual(
      and(phrase("oil prices"), or(term("geopolitical"), prefix("renew"))),
    );
  });
});

describe("parseQuery — case sensitivity", () => {
  it("treats lowercase and/or/not as terms (implicit-AND between them)", () => {
    expect(parseQuery("oil and gas")).toEqual(and(and(term("oil"), term("and")), term("gas")));
  });

  it("only uppercase AND/OR/NOT are operators", () => {
    // "AND" is an operator; "and" is a term.
    expect(parseQuery("a AND and")).toEqual(and(term("a"), term("and")));
  });

  it("a word followed by * is always a prefix term, even 'AND*'", () => {
    expect(parseQuery("AND*")).toEqual(prefix("AND"));
  });
});

describe("parseQuery — errors", () => {
  const expectError = (input: string, at?: number) => {
    try {
      parseQuery(input);
      throw new Error(`expected ParseError for: ${input}`);
    } catch (err) {
      expect(err).toBeInstanceOf(ParseError);
      if (at !== undefined) expect((err as ParseError).position).toBe(at);
    }
  };

  it("rejects a dangling operator", () => expectError("oil AND"));
  it("rejects a leading OR", () => expectError("OR oil"));
  it("rejects unbalanced open paren", () => expectError("(oil AND gas"));
  it("rejects unbalanced close paren", () => expectError("oil)"));
  it("rejects an unterminated phrase", () => expectError('oil "prices'));
  it("rejects an empty phrase", () => expectError('""'));
  it("rejects a stray wildcard", () => expectError("*oil", 0));
  it("rejects tsquery meta characters", () => expectError("oil & gas"));
});
