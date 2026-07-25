import { PageInfo } from "@carma/shared";
import { useCallback, useRef, useState } from "react";

/** What page to request: the current page's cursor + which way to move from it. */
export interface CursorRequest {
  cursor: string | null;
  direction: "next" | "prev";
}

/**
 * Reusable keyset-pagination navigation. Owns the `request` (cursor + direction)
 * that a data hook feeds into its fetch, and derives `goNext`/`goPrev` from the
 * latest `PageInfo`. Not tied to any particular resource — pass it the `PageInfo`
 * of whatever cursor-paginated endpoint you're consuming.
 *
 *   const { request, goNext, goPrev } = useCursorPagination(pageInfo);
 *   // fetch using `request`, then render buttons wired to goNext/goPrev.
 */
export function useCursorPagination(pageInfo: PageInfo | null) {
  const [request, setRequest] = useState<CursorRequest>({
    cursor: null,
    direction: "next",
  });

  // Keep the latest pageInfo in a ref so goNext/goPrev stay referentially stable
  // while always reading current values.
  const pageInfoRef = useRef<PageInfo | null>(pageInfo);
  pageInfoRef.current = pageInfo;

  const goNext = useCallback(() => {
    const pi = pageInfoRef.current;
    if (pi?.hasNext && pi.cursor) {
      setRequest({ cursor: pi.cursor, direction: "next" });
    }
  }, []);

  const goPrev = useCallback(() => {
    const pi = pageInfoRef.current;
    if (pi?.hasPrev && pi.cursor) {
      setRequest({ cursor: pi.cursor, direction: "prev" });
    }
  }, []);

  return {
    request,
    goNext,
    goPrev,
    canNext: pageInfo?.hasNext ?? false,
    canPrev: pageInfo?.hasPrev ?? false,
  };
}
