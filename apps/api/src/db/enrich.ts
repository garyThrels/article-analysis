import "../env.js"; // load .env so ANTHROPIC_API_KEY is visible to the factory
import { pool } from "./index.js";
import { createEnricher } from "../features/enrichment/enricher.factory.js";
import { enrichPending } from "../features/enrichment/enrichment.service.js";
import { countsByStatus } from "../features/enrichment/enrichment.repository.js";

/**
 * Synchronous, local enrichment runner. In production this work would be
 * triggered on ingestion via a queue; here it's a manual `yarn db:enrich` pass.
 * Uses the Anthropic API when ANTHROPIC_API_KEY is set, else the mock enricher.
 */
async function main() {
  const enricher = createEnricher();
  const result = await enrichPending(enricher);
  console.log(
    `[enrich] processed ${result.processed} (completed ${result.completed}, failed ${result.failed})`,
  );
  console.log("[enrich] status counts:", await countsByStatus());
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error("[enrich] fatal:", err);
    process.exitCode = 1;
    return pool.end();
  });
