import { describe, expect, it } from "vitest";
import { enrichmentConfig, truncateBody } from "./enrichment.config.js";
import { MockEnricher } from "./mock.enricher.js";

describe("truncateBody (cost guardrail)", () => {
  it("caps long bodies at maxBodyChars", () => {
    const long = "x".repeat(enrichmentConfig.maxBodyChars + 500);
    expect(truncateBody(long)).toHaveLength(enrichmentConfig.maxBodyChars);
  });

  it("leaves short bodies unchanged", () => {
    expect(truncateBody("a short body")).toBe("a short body");
  });
});

describe("MockEnricher", () => {
  it("returns a summary, neutral sentiment, and 1–3 topics", async () => {
    const result = await new MockEnricher().enrich({
      headline: "Global Oil Prices Surge Amid Tensions",
      body: "Crude oil rose sharply on Monday. Analysts warned of further volatility.",
    });
    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.sentiment).toBe("neutral");
    expect(result.topics.length).toBeGreaterThanOrEqual(1);
    expect(result.topics.length).toBeLessThanOrEqual(3);
  });
});
