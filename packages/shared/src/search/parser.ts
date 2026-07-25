import type { QueryNode } from "./ast.js";
import { ParseError, tokenize, type Token } from "./tokenizer.js";

// Tokens that can begin a primary expression — used to detect implicit AND
// (juxtaposition), e.g. `oil gas` and `oil and gas` (lowercase `and` is a term).
const PRIMARY_START = new Set<Token["type"]>([
  "TERM",
  "PHRASE",
  "PREFIX",
  "NOT",
  "LPAREN",
]);

/**
 * Parse a boolean search query into an AST.
 *
 * Grammar (precedence OR < AND < NOT < primary; adjacency implies AND):
 *   orExpr  := andExpr ( 'OR' andExpr )*
 *   andExpr := notExpr ( ('AND')? notExpr )*
 *   notExpr := 'NOT' notExpr | primary
 *   primary := '(' orExpr ')' | PHRASE | TERM | PREFIX
 *
 * Returns `null` for empty/whitespace input (= no search filter). Throws
 * `ParseError` (with a position) on malformed input.
 */
export function parseQuery(input: string): QueryNode | null {
  const tokens = tokenize(input);
  if (tokens.length === 0) return null;

  let pos = 0;
  const peek = (): Token | undefined => tokens[pos];
  const eof = (): number => input.length;

  function parseOr(): QueryNode {
    let left = parseAnd();
    while (peek()?.type === "OR") {
      pos += 1;
      const right = parseAnd();
      left = { type: "or", left, right };
    }
    return left;
  }

  function parseAnd(): QueryNode {
    let left = parseNot();
    for (;;) {
      const t = peek();
      if (t?.type === "AND") {
        pos += 1;
        left = { type: "and", left, right: parseNot() };
      } else if (t && PRIMARY_START.has(t.type)) {
        // Implicit AND between adjacent operands.
        left = { type: "and", left, right: parseNot() };
      } else {
        return left;
      }
    }
  }

  function parseNot(): QueryNode {
    if (peek()?.type === "NOT") {
      pos += 1;
      return { type: "not", operand: parseNot() };
    }
    return parsePrimary();
  }

  function parsePrimary(): QueryNode {
    const t = peek();
    if (!t) {
      throw new ParseError("Unexpected end of query", eof());
    }
    switch (t.type) {
      case "LPAREN": {
        pos += 1;
        const inner = parseOr();
        const close = peek();
        if (close?.type !== "RPAREN") {
          throw new ParseError("Expected ')'", close?.position ?? eof());
        }
        pos += 1;
        return inner;
      }
      case "PHRASE":
        pos += 1;
        return { type: "phrase", value: t.value };
      case "TERM":
        pos += 1;
        return { type: "term", value: t.value };
      case "PREFIX":
        pos += 1;
        return { type: "prefix", value: t.value };
      default:
        throw new ParseError(`Unexpected '${t.value}'`, t.position);
    }
  }

  const node = parseOr();
  const trailing = peek();
  if (trailing) {
    throw new ParseError(`Unexpected '${trailing.value}'`, trailing.position);
  }
  return node;
}
