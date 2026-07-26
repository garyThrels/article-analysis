/**
 * Tunable knobs for enrichment. Kept in one place so the cost guardrails and
 * model choices are easy to see and adjust.
 */
export const enrichmentConfig = {
  /** Summary generation model. */
  summaryModel: "claude-sonnet-5",
  /** Sentiment + topics model. */
  classifyModel: "claude-haiku-4-5",

  /** Cost guardrail: hard cap on body characters sent to the LLM (~1.5k tokens). */
  maxBodyChars: 6_000,
  /** Cost guardrail: if counted input exceeds this, truncate further. */
  maxInputTokens: 2_000,

  /** Output caps — these tasks are short by design. */
  summaryMaxTokens: 120,
  classifyMaxTokens: 150,

  /** How many articles to enrich concurrently (avoid rate-limit bursts). */
  concurrency: 3,
} as const;

/** Truncate an article body to the configured character cap. */
export function truncateBody(body: string): string {
  return body.length > enrichmentConfig.maxBodyChars
    ? body.slice(0, enrichmentConfig.maxBodyChars)
    : body;
}
