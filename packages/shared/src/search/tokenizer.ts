/** A lexical token with its start position in the source string. */
export interface Token {
  type: "AND" | "OR" | "NOT" | "LPAREN" | "RPAREN" | "PHRASE" | "TERM" | "PREFIX";
  /** For PHRASE/TERM/PREFIX: the text value. For operators/parens: the literal. */
  value: string;
  /** 0-based index into the input where this token starts. */
  position: number;
}

/** Raised on malformed input; `position` points at the offending character. */
export class ParseError extends Error {
  readonly position: number;
  constructor(message: string, position: number) {
    super(message);
    this.name = "ParseError";
    this.position = position;
  }
}

// A "word" character: Unicode letters, digits, and underscore. Restricting
// terms to this set is what lets the compiler safely append `:*` for wildcards
// and keeps `tsquery` meta-characters (& | ! : < >) out of user input.
const WORD_CHAR = /[\p{L}\p{N}_]/u;

const KEYWORDS = new Set(["AND", "OR", "NOT"]);

/**
 * Turn a query string into tokens. Uppercase AND/OR/NOT are operators; any
 * other casing is an ordinary term. A word immediately followed by `*` is a
 * prefix (wildcard) token.
 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i]!;

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "LPAREN", value: "(", position: i });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "RPAREN", value: ")", position: i });
      i += 1;
      continue;
    }

    if (ch === '"') {
      const start = i;
      i += 1;
      let value = "";
      while (i < input.length && input[i] !== '"') {
        value += input[i];
        i += 1;
      }
      if (i >= input.length) {
        throw new ParseError("Unterminated phrase (missing closing quote)", start);
      }
      i += 1; // consume closing quote
      if (value.trim().length === 0) {
        throw new ParseError("Empty phrase", start);
      }
      tokens.push({ type: "PHRASE", value, position: start });
      continue;
    }

    if (WORD_CHAR.test(ch)) {
      const start = i;
      let word = "";
      while (i < input.length && WORD_CHAR.test(input[i]!)) {
        word += input[i];
        i += 1;
      }
      // A trailing '*' makes it a prefix (wildcard) token.
      if (input[i] === "*") {
        i += 1;
        tokens.push({ type: "PREFIX", value: word, position: start });
        continue;
      }
      if (KEYWORDS.has(word)) {
        tokens.push({ type: word as "AND" | "OR" | "NOT", value: word, position: start });
      } else {
        tokens.push({ type: "TERM", value: word, position: start });
      }
      continue;
    }

    if (ch === "*") {
      throw new ParseError("Unexpected '*' (wildcards must follow a term)", i);
    }

    throw new ParseError(`Unexpected character '${ch}'`, i);
  }

  return tokens;
}
