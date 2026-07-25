import { useState } from "react";
import { ArticleListItem } from "./components/ArticleListItem";
import { EmptyState } from "./components/EmptyState";
import { SearchBar } from "./components/SearchBar";
import { useArticles } from "./hooks/useArticles";

export function App() {
  const [q, setQ] = useState("");
  const { state, isFetching, goNext, goPrev } = useArticles(q);

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

      <SearchBar onSearch={setQ} />

      {state.status === "error" ? (
        <p className="error">Failed to load articles: {state.message}</p>
      ) : state.status !== "ready" || state.articles.length === 0 ? (
        <EmptyState
          loading={state.status !== "ready"}
          hasQuery={q.trim().length > 0}
        />
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
