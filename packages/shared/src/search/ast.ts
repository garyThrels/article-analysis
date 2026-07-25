/**
 * AST for the boolean search query language.
 *
 * Produced by `parseQuery` (tokenizer + recursive-descent parser) and consumed
 * by the API's compiler, which turns it into a parameterized Postgres `tsquery`.
 */
export type QueryNode =
  | { type: "term"; value: string }
  | { type: "phrase"; value: string }
  | { type: "prefix"; value: string }
  | { type: "and"; left: QueryNode; right: QueryNode }
  | { type: "or"; left: QueryNode; right: QueryNode }
  | { type: "not"; operand: QueryNode };
