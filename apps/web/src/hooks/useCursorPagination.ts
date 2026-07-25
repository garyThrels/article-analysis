import { PageInfo } from "@carma/shared";
import { useCallback, useRef, useState } from "react";

/** What page to request: the current page's cursor + which way to move from it. */
export interface CursorRequest {
  cursor: string | null;
  direction: "next" | "prev";
}

const FIRST_PAGE: CursorRequest = { cursor: null, direction: "next" };

/**
 * Reusable keyset-pagination navigation. Owns the `request` (cursor + direction)
 * that a data hook feeds into its fetch, and derives `goNext`/`goPrev` from the
 * latest `PageInfo`. Not tied to any particular resource.
 *
 * Pass `resetKey` (e.g. the current search query) to snap back to the first page
 * whenever it changes — the reset happens during render so the data hook makes a
 * single fetch, not one for the stale cursor and another for the reset.
 */
export function useCursorPagination(
  pageInfo: PageInfo | null,
  resetKey?: unknown,
) {
  const [request, setRequest] = useState<CursorRequest>(FIRST_PAGE);

  // Reset to page one when resetKey changes (render-time, guarded — the React
  // "adjusting state on prop change" pattern).
  const prevResetKey = useRef(resetKey);
  if (prevResetKey.current !== resetKey) {
    prevResetKey.current = resetKey;
    setRequest(FIRST_PAGE);
  }

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
