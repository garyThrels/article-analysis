import type { Enricher, EnrichmentInput, EnrichmentResult } from "./enrichment.types.js";

/**
 * Deterministic, offline, zero-cost enricher used when no ANTHROPIC_API_KEY is
 * set. Produces plausible-looking output so the whole feature is demonstrable
 * without any API spend.
 */
export class MockEnricher implements Enricher {
  async enrich({ headline, body }: EnrichmentInput): Promise<EnrichmentResult> {
    const firstSentence = body.split(/(?<=[.!?])\s/)[0]?.trim() ?? "";
    const summary = (firstSentence || headline || "No content.").slice(0, 200);

    // Cheap keyword-ish topics from the headline (first few significant words).
    const topics = headline
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 3)
      .map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase())
      .filter(Boolean);

    return {
      summary,
      sentiment: "neutral",
      topics: topics.length > 0 ? topics : ["general"],
    };
  }
}
