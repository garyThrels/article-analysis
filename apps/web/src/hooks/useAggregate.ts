import { AggregateBucket, ApiResponse, TimeInterval } from "@carma/shared";
import { useEffect, useState } from "react";

export interface AggregateParams {
  interval: TimeInterval;
  sourceId: number | null;
}

interface State {
  buckets: AggregateBucket[];
  loading: boolean;
  error: string | null;
}

/** Fetch per-bucket article counts (total + per-sentiment) for interval + source. */
export function useAggregate(params: AggregateParams): State {
  const [state, setState] = useState<State>({
    buckets: [],
    loading: true,
    error: null,
  });

  const key = JSON.stringify(params);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));

    const qs = new URLSearchParams({ interval: params.interval });
    if (params.sourceId !== null) qs.set("source", String(params.sourceId));

    fetch(`/api/articles/aggregate?${qs.toString()}`, { signal: controller.signal })
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error(`Request failed: ${res.status}`)),
      )
      .then((body: ApiResponse<AggregateBucket[]>) =>
        setState({ buckets: body.data, loading: false, error: null }),
      )
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          buckets: [],
          loading: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      });

    return () => controller.abort();
    // `key` captures every param field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
