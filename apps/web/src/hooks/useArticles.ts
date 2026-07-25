import { Paginated, Article, ApiError } from "@carma/shared";
import { useEffect, useRef, useState } from "react";
import { ArticleQuery, ArticlesState } from "../types";
import { useCursorPagination } from "./useCursorPagination";

/** Build the API query params from a request cursor + the article query. */
function buildParams(
  request: { cursor: string | null; direction: "next" | "prev" },
  query: ArticleQuery,
  limit: number,
): string {
  const params = new URLSearchParams({ limit: String(limit) });
  if (request.cursor) {
    params.set("cursor", request.cursor);
    params.set("direction", request.direction);
  }
  const q = query.q.trim();
  if (q) params.set("q", q);
  if (query.sourceId !== null) params.set("source", String(query.sourceId));
  if (query.languageId !== null) params.set("language", String(query.languageId));
  // Date inputs are `yyyy-mm-dd`; widen to full-day UTC bounds so the range is
  // inclusive of both endpoints.
  if (query.from) params.set("from", `${query.from}T00:00:00.000Z`);
  if (query.to) params.set("to", `${query.to}T23:59:59.999Z`);
  return params.toString();
}

/**
 * Keyset-paginated articles for a given search + filter query. Any change to the
 * query snaps pagination back to page one (via useCursorPagination's reset key).
 */
export function useArticles(query: ArticleQuery, limit = 5) {
  const [state, setState] = useState<ArticlesState>({ status: "loading" });
  const [isFetching, setIsFetching] = useState(true);
  // Skip the scroll-to-top on the very first load (already at the top).
  const isInitialLoad = useRef(true);

  const pageInfo = state.status === "ready" ? state.pageInfo : null;
  // A primitive key that changes whenever any part of the query changes.
  const resetKey = JSON.stringify(query);
  const { request, goNext, goPrev } = useCursorPagination(pageInfo, resetKey);

  useEffect(() => {
    const controller = new AbortController();
    setIsFetching(true);

    async function load() {
      try {
        const res = await fetch(`/api/articles?${buildParams(request, query, limit)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          let message = `Request failed: ${res.status}`;
          try {
            const body = (await res.json()) as ApiError;
            if (body?.error) message = body.error;
          } catch {
            /* keep the status-based message */
          }
          throw new Error(message);
        }
        const body = (await res.json()) as Paginated<Article>;
        setState({
          status: "ready",
          articles: body.data,
          pageInfo: body.pageInfo,
        });
        if (isInitialLoad.current) {
          isInitialLoad.current = false;
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        if (!controller.signal.aborted) setIsFetching(false);
      }
    }

    void load();
    return () => controller.abort();
    // `resetKey` captures every field of `query`; `request` covers pagination.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, limit, resetKey]);

  return { state, isFetching, goNext, goPrev };
}
