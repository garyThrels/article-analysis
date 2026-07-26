import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests share one Postgres and some mutate rows (enrichment
    // lifecycle). Run test files sequentially so a mutating file can't race a
    // file asserting on the same rows.
    fileParallelism: false,
  },
});
