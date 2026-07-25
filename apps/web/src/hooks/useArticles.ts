import { Paginated, Article } from "@carma/shared";
import { useEffect, useRef, useState } from "react";
import { ArticlesState } from "../types";
import { useCursorPagination } from "./useCursorPagination";

/**
 * Keyset-paginated articles. Navigation (cursor + direction, goNext/goPrev) is
 * delegated to the reusable useCursorPagination hook; this hook just fetches the
 * page described by its `request` and exposes the result.
 */
export function useArticles(limit = 5) {
  const [state, setState] = useState<ArticlesState>({ status: "loading" });
  const [isFetching, setIsFetching] = useState(true);
  // Skip the scroll-to-top on the very first load (already at the top).
  const isInitialLoad = useRef(true);

  const pageInfo = state.status === "ready" ? state.pageInfo : null;
  const { request, goNext, goPrev } = useCursorPagination(pageInfo);

  useEffect(() => {
    const controller = new AbortController();
    setIsFetching(true);

    async function load() {
      const params = new URLSearchParams({ limit: String(limit) });
      if (request.cursor) {
        params.set("cursor", request.cursor);
        params.set("direction", request.direction);
      }

      try {
        const res = await fetch(`/api/articles?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const body = (await res.json()) as Paginated<Article>;
        setState({
          status: "ready",
          articles: body.data,
          pageInfo: body.pageInfo,
        });
        // On a page change (not the first load), scroll back to the top so the
        // new page starts at article one.
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
  }, [request, limit]);

  return { state, isFetching, goNext, goPrev };
}
