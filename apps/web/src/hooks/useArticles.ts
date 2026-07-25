import { ApiResponse, Article } from "@carma/shared";
import { useEffect, useState } from "react";
import { ArticlesState } from "../types";

export function useArticles() {
  const [state, setState] = useState<ArticlesState>({ status: "loading" });

  async function load() {
    const controller = new AbortController();

    try {
      const res = await fetch("/api/articles", { signal: controller.signal });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const body = (await res.json()) as ApiResponse<Article[]>;
      setState({ status: "ready", articles: body.data });
    } catch (err) {
      if (controller.signal.aborted) return controller;
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }

    return controller;
  }

  useEffect(() => {
    let controller: AbortController;
    load().then((c) => (controller = c));

    return () => controller?.abort();
  });

  return { state };
}
