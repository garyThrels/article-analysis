import { Article } from "@carma/shared";

export type ArticlesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; articles: Article[] };
