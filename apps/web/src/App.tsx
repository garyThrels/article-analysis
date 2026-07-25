import { ArticleListItem } from "./components/ArticleLitItem";
import { EmptyState } from "./components/EmptyState";
import { useArticles } from "./hooks/useArticles";

export function App() {
  const { state } = useArticles();

  return (
    <main className="container">
      <h1>Carma</h1>
      <h4>by Gary Hili</h4>
      <p className="subtitle">
        Articles served from Postgres via Express + Drizzle.
      </p>

      {state.status === "error" ? (
        <p className="error">Failed to load articles: {state.message}</p>
      ) : state.status !== "ready" || state.articles.length === 0 ? (
        <EmptyState loading={state.status !== "ready"} hasQuery={false} />
      ) : (
        <ul className="articles">
          {state.articles.map((article) => (
            <ArticleListItem key={article.id} article={article} />
          ))}
        </ul>
      )}
    </main>
  );
}
