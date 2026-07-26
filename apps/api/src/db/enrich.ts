import "../env.js"; // load .env so ANTHROPIC_API_KEY is visible to the factory
import { pool } from "./index.js";
import { createEnricher } from "../features/enrichment/enricher.factory.js";
import { enrichPending } from "../features/enrichment/enrichment.service.js";
import { countsByStatus } from "../features/enrichment/enrichment.repository.js";

interface Args {
  articleId?: number;
  force: boolean;
}

/**
 * Parse CLI args:
 *   yarn db:enrich                     enrich all pending/failed articles
 *   yarn db:enrich 5                   enrich only article 5 (if pending/failed)
 *   yarn db:enrich --article 5         same as above (-a also works)
 *   yarn db:enrich 5 --force           reprocess article 5 even if completed
 *   yarn db:enrich --force             reprocess ALL articles (e.g. prompt change)
 */
function parseArgs(argv: string[]): Args {
  let articleId: number | undefined;
  let force = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--force" || arg === "-f") {
      force = true;
    } else if (arg === "--article" || arg === "-a") {
      articleId = parseArticleId(argv[++i]);
    } else if (arg.startsWith("--article=")) {
      articleId = parseArticleId(arg.slice("--article=".length));
    } else if (/^\d+$/.test(arg)) {
      articleId = parseArticleId(arg); // positional id
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }
  return { articleId, force };
}

function parseArticleId(value: string | undefined): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) fail(`Invalid article id: ${value}`);
  return n;
}

function fail(message: string): never {
  console.error(`[enrich] ${message}`);
  console.error("Usage: yarn db:enrich [<articleId> | --article <id>] [--force]");
  process.exit(1);
}

/**
 * Synchronous, local enrichment runner. In production this work would be
 * triggered on ingestion via a queue; here it's a manual `yarn db:enrich` pass.
 * Uses the Anthropic API when ANTHROPIC_API_KEY is set, else the mock enricher.
 */
async function main() {
  const { articleId, force } = parseArgs(process.argv.slice(2));
  const scope = articleId !== undefined ? `article ${articleId}` : "all articles";
  console.log(`[enrich] scope: ${scope}${force ? " (force — includes completed)" : ""}`);

  const enricher = createEnricher();
  const result = await enrichPending(enricher, { articleId, force });

  if (result.processed === 0) {
    console.log(
      articleId !== undefined
        ? `[enrich] nothing to do for article ${articleId} (no matching row; use --force to reprocess a completed one)`
        : "[enrich] nothing to do (no pending/failed articles; use --force to reprocess)",
    );
  } else {
    console.log(
      `[enrich] processed ${result.processed} (completed ${result.completed}, failed ${result.failed})`,
    );
  }
  console.log("[enrich] status counts:", await countsByStatus());
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error("[enrich] fatal:", err);
    process.exitCode = 1;
    return pool.end();
  });
