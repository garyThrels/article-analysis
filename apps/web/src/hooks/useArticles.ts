import { Paginated, Article, ApiError } from "@carma/shared";
import { useEffect, useRef, useState } from "react";
import { ArticlesState } from "../types";
import { useCursorPagination } from "./useCursorPagination";

/**
 * Keyset-paginated articles with optional boolean search (`q`). Navigation is
 * delegated to useCursorPagination; passing `q` as its reset key snaps back to
 * page one whenever the search changes.
 */
export function useArticles(q = "", limit = 5) {
  const [state, setState] = useState<ArticlesState>({ status: "loading" });
  const [isFetching, setIsFetching] = useState(true);
  // Skip the scroll-to-top on the very first load (already at the top).
  const isInitialLoad = useRef(true);

  const pageInfo = state.status === "ready" ? state.pageInfo : null;
  const { request, goNext, goPrev } = useCursorPagination(pageInfo, q);

  useEffect(() => {
    const controller = new AbortController();
    setIsFetching(true);

    async function load() {
      const params = new URLSearchParams({ limit: String(limit) });
      if (request.cursor) {
        params.set("cursor", request.cursor);
        params.set("direction", request.direction);
      }
      const trimmed = q.trim();
      if (trimmed) params.set("q", trimmed);

      try {
        const res = await fetch(`/api/articles?${params.toString()}`, {
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
        // On a page/search change (not the first load), scroll back to the top.
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
  }, [request, limit, q]);

  return { state, isFetching, goNext, goPrev };
}
