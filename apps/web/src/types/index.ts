import { Article, PageInfo } from "@carma/shared";

export type ArticlesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; articles: Article[]; pageInfo: PageInfo };

/** The full set of list controls sent to the API (search + filters). */
export interface ArticleQuery {
  /** Boolean search query string. */
  q: string;
  sourceId: number | null;
  languageId: number | null;
  /** `yyyy-mm-dd` from the date inputs, or null. */
  from: string | null;
  to: string | null;
}

/** An empty query — the unfiltered feed. */
export const EMPTY_QUERY: ArticleQuery = {
  q: "",
  sourceId: null,
  languageId: null,
  from: null,
  to: null,
};
