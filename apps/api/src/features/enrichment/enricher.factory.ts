import { AnthropicEnricher } from "./anthropic.enricher.js";
import { MockEnricher } from "./mock.enricher.js";
import type { Enricher } from "./enrichment.types.js";

/**
 * Choose an enricher based on the environment: the real Anthropic enricher when
 * ANTHROPIC_API_KEY is present, otherwise the zero-cost mock. Logs which one so
 * enrichment runs are unambiguous.
 */
export function createEnricher(): Enricher {
  if (process.env.ANTHROPIC_API_KEY) {
    console.log("[enrich] using AnthropicEnricher (ANTHROPIC_API_KEY set)");
    return new AnthropicEnricher();
  }
  console.log("[enrich] using MockEnricher (no ANTHROPIC_API_KEY)");
  return new MockEnricher();
}
