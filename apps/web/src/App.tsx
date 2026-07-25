import { useState } from "react";
import { ArticleListItem } from "./components/ArticleListItem";
import { EmptyState } from "./components/EmptyState";
import { SearchBar } from "./components/SearchBar";
import { Filters, type FilterValue } from "./components/Filters";
import { useArticles } from "./hooks/useArticles";
import { useLookups } from "./hooks/useLookups";
import { ArticleQuery, EMPTY_QUERY } from "./types";

export function App() {
  const [query, setQuery] = useState<ArticleQuery>(EMPTY_QUERY);
  const lookups = useLookups();
  const { state, isFetching, goNext, goPrev } = useArticles(query);

  const setSearch = (q: string) => setQuery((prev) => ({ ...prev, q }));
  const setFilters = (f: FilterValue) => setQuery((prev) => ({ ...prev, ...f }));

  const hasQuery =
    query.q.trim().length > 0 ||
    query.sourceId !== null ||
    query.languageId !== null ||
    query.from !== null ||
    query.to !== null;

  const canPrev =
    state.status === "ready" && state.pageInfo.hasPrev && !isFetching;
  const canNext =
    state.status === "ready" && state.pageInfo.hasNext && !isFetching;

  return (
    <main className="container">
      <h1>Carma</h1>
      <h4>by Gary Hili</h4>
      <p className="subtitle">
        Articles served from Postgres via Express + Drizzle.
      </p>

      <SearchBar onSearch={setSearch} />
      <Filters
        sources={lookups.sources}
        languages={lookups.languages}
        onChange={setFilters}
      />

      {state.status === "error" ? (
        <p className="error">Failed to load articles: {state.message}</p>
      ) : state.status !== "ready" || state.articles.length === 0 ? (
        <EmptyState loading={state.status !== "ready"} hasQuery={hasQuery} />
      ) : (
        <>
          <ul className="articles" aria-busy={isFetching}>
            {state.articles.map((article) => (
              <ArticleListItem key={article.id} article={article} />
            ))}
          </ul>
          <nav className="pager" aria-label="Pagination">
            <button type="button" onClick={goPrev} disabled={!canPrev}>
              ← Newer
            </button>
            <span className="pager-status">
              {isFetching ? "Loading…" : `${state.articles.length} shown`}
            </span>
            <button type="button" onClick={goNext} disabled={!canNext}>
              Older →
            </button>
          </nav>
        </>
      )}
    </main>
  );
}
