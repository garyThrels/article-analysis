import { useEffect, useState } from "react";
import type { Article, ApiResponse } from "@carma/shared";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; articles: Article[] };

export function App() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch("/api/articles", { signal: controller.signal });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const body = (await res.json()) as ApiResponse<Article[]>;
        setState({ status: "ready", articles: body.data });
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  return (
    <main className="container">
      <h1>Carma</h1>
      <h4>by Gary Hili</h4>
      <p className="subtitle">
        Articles served from Postgres via Express + Drizzle.
      </p>

      {state.status === "loading" && <p>Loading…</p>}

      {state.status === "error" && (
        <p className="error">Failed to load articles: {state.message}</p>
      )}

      {state.status === "ready" &&
        (state.articles.length === 0 ? (
          <p>No articles yet.</p>
        ) : (
          <ul className="articles">
            {state.articles.map((article) => (
              <li key={article.id} className="article">
                <h2>{article.title}</h2>
                <p>{article.body}</p>
                <time dateTime={article.createdAt}>
                  {new Date(article.createdAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        ))}
    </main>
  );
}
