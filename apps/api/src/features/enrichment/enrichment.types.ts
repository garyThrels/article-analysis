import type { Sentiment } from "@carma/shared";

/** The input an enricher needs to enrich one article. */
export interface EnrichmentInput {
  headline: string;
  body: string;
}

/** The result of enriching one article. */
export interface EnrichmentResult {
  summary: string;
  sentiment: Sentiment;
  topics: string[];
}

/**
 * Strategy for turning an article into enrichment. This interface is the seam
 * that keeps the rest of the app provider-agnostic — swapping Anthropic for
 * another provider (or a fuller abstraction) is a matter of a new implementation.
 */
export interface Enricher {
  enrich(input: EnrichmentInput): Promise<EnrichmentResult>;
}
