import { ApiResponse, Lookups } from "@carma/shared";
import { useEffect, useState } from "react";

const EMPTY: Lookups = { sources: [], languages: [] };

/** Fetch the filter reference data (sources + languages) once on mount. */
export function useLookups(): Lookups {
  const [lookups, setLookups] = useState<Lookups>(EMPTY);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/lookups", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: ApiResponse<Lookups>) => setLookups(body.data))
      .catch(() => {
        // Non-fatal: filters just render with no options if this fails.
      });
    return () => controller.abort();
  }, []);

  return lookups;
}
