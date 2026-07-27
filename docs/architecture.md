# Architecture & Decisions

### Tech stack

| Choice                                     | Why                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TypeScript everywhere**                  | One language across API, UI, and shared types. The `Article` shape is defined **once** in `packages/shared` and flows DB → Express → React, so a schema change surfaces as a compile error in the UI rather than a runtime bug.                                                                                                                                                                                                               |
| **PostgreSQL**                             | Follows Carma's tech stack which I hope to learn more of, and also makes it easier to follow the requirements. The brief's requirements — date-range/source/language filtering, month/week aggregation, and full-text boolean search — are all first-class in Postgres. Its native FTS (`tsvector`/`to_tsquery`) means boolean search needs no external search engine.                                                                        |
| **Drizzle ORM**                            | Type-safe SQL that stays close to the SQL you'd actually write, with readable generated migrations checked into the repo. I used Prisma a bit in the past, but found it slightly harder to follow sometimes, especially in a single large file. Here I opted to try Drizzle more out of curiosity and sticking closer to SQL syntax.                                                                                                          |
| **Express 5**                              | Minimal, well-understood HTTP layer; enough for a handful of endpoints without framework overhead.                                                                                                                                                                                                                                                                                                                                            |
| **Vite + React**                           | Fast dev loop; the UI is intentionally minimal (functional, not pixel-perfect, per the brief). No styling library like tailwind will be used, instead we will stick with simple CSS.                                                                                                                                                                                                                                                          |
| **Yarn 4 workspaces + Docker Compose**     | `docker compose up` brings up db + api + web with migrations and seeding automated — the "runnable with a simple setup" requirement.                                                                                                                                                                                                                                                                                                          |
| **Monorepo (single repo, shared package)** | Keeping the API, web app, and a `packages/shared` workspace in one repo lets both ends import the **same types** (`Article`, API contracts) and the **same logic** — most notably the boolean-search parser/validator, so the query a user types is validated identically in the browser and on the server. One source of truth means no drift between FE and BE, and a change is refactored and type-checked across every workspace at once. |

### Schema design

`source` and `language` although simple in this context, are **normalized** into their own lookup tables
(`sources`, `languages`) and referenced from `articles` by foreign key. This keeps
the filter columns small (a 2-byte/4-byte FK instead of a repeated string), lets
each source/language carry display metadata in one place, and gives referential
integrity for free.

The core table is `articles` (`apps/api/src/db/schema.ts`):

| Column          | Type                                  | Purpose                                                                                                                |
| --------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `id`            | `serial` PK                           | Stable identifier + keyset tiebreaker                                                                                  |
| `headline`      | `text NOT NULL`                       | Empty-string aware — sample article 17 has an empty headline                                                           |
| `body`          | `text NOT NULL`                       | Raw article body (stored untrusted; sanitized at render — see Security)                                                |
| `source_id`     | `integer NOT NULL` → `sources(id)`    | Source filter dimension (normalized)                                                                                   |
| `language_id`   | `smallint NOT NULL` → `languages(id)` | Language filter dimension (handles Arabic / Chinese samples)                                                           |
| `published_at`  | `timestamptz NOT NULL`                | Filter + aggregation dimension, and the keyset sort key — **`NOT NULL`** so the cursor has a stable, non-null ordering |
| `created_at`    | `timestamptz NOT NULL`                | Ingest time                                                                                                            |
| `search_vector` | `tsvector` (generated, stored)        | Precomputed `to_tsvector('simple', headline ‖ body)` for full-text search — see below                                  |

Lookup tables: `sources(id, name UNIQUE)` and `languages(id, code UNIQUE, name)`.

**Enrichment table** (`article_enrichments`): LLM output lives in its **own table**,
1:1 with `articles` (a `UNIQUE` FK on `article_id`, `ON DELETE CASCADE`) rather than
as columns on `articles`. This keeps it as a self-contained **work item** — the row
a production queue would pick up — so it carries a lifecycle, not just results:

| Column          | Type                                               | Purpose                                                                                                                      |
| --------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `status`        | enum (`pending`/`processing`/`completed`/`failed`) | Lifecycle of the work item; the enrichment runner can scan by this to find work                                              |
| `summary`       | `text`                                             | LLM summary (null until `completed`)                                                                                         |
| `sentiment`     | enum (`positive`/`negative`/`neutral`/`mixed`)     | Sentiment; a Postgres enum so the aggregate view can group/filter cheaply and invalid values are rejected at the DB boundary |
| `topics`        | `text[]`                                           | 1–3 tags (null until `completed`)                                                                                            |
| `error_message` | `text`                                             | Failure reason captured on `failed`, so we have a trace and a retry can potentially have more context                        |
| `attempts`      | `integer` (default `0`)                            | Retry counter — lets the runner back off or give up after N tries                                                            |

Result columns (`summary`/`sentiment`/`topics`) stay null until `status = 'completed'`.
Splitting enrichment out this way means an article exists and is searchable the moment
it's ingested, independent of whether its (slower, failable) LLM enrichment has run —
and re-running enrichment never touches the article row. A `status` index lets the
runner cheaply find `pending`/`failed` items to process.

### Indexing choices

The access paths to serve are: **filter by date range / source / language**,
**keyset-paginated listing**, a **month/week count aggregate**, and **boolean
full-text search**. Indexes are chosen to serve exactly those — and no more, since
every index is extra work on each write, which matters at ~50k articles/day.

| Index                                             | Serves                                                            | Reasoning                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `btree (published_at DESC, id DESC)`              | Unfiltered feed, keyset cursor, date-range scans, aggregate range | `published_at` alone isn't unique (many rows can share a timestamp at 50k/day), so ties would skip/duplicate rows across pages — appending the unique `id` makes `(published_at, id)` a **total order**, giving a stable cursor. Stored in `(DESC, DESC)` to match the feed's `ORDER BY`, so a page is an ordered **index range scan with no sort node**, and the keyset predicate `(published_at, id) < (…)` becomes a range seek → **O(page size)** regardless of depth. |
| `btree (source_id, published_at DESC, id DESC)`   | "Articles from source X, newest first, paginated"                 | Equality column (`source_id`) **leads**, so Postgres seeks straight to that source's slice and finds it _already ordered_ by `(published_at DESC, id DESC)` — filter + sort + cursor in one scan. A single-column `btree(source_id)` would find the rows but then need a **separate sort** per page. The leading FK column also (a) indexes the FK for fast joins + integrity checks and (b) serves `WHERE source_id = ?` / `GROUP BY source_id`.                          |
| `btree (language_id, published_at DESC, id DESC)` | Same, filtered by language                                        | Identical reasoning to the source index.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `GIN (search_vector)`                             | Boolean full-text + prefix-wildcard search                        | GIN is an **inverted index** (lexeme → list of rows), so `search_vector @@ tsquery` probes only the query's lexemes → cost scales with _matches_, not table size. Chosen over GiST (smaller but ~3× slower lookups) because search is read-heavy. `'simple'` config = no stemming/stopwords, so multilingual (en/ar/zh) content and prefix wildcards (`term:*`) behave predictably.                                                                                        |

**Compound vs. single-column — a deliberate call.** `source_id` and `language_id`
are _compound_ with `(published_at DESC, id DESC)` rather than standalone, because
they're almost always used **as a filter on the paginated feed** — the compound
shape serves filter + order + cursor in a single index scan. Standalone
single-column indexes would still need a sort for every page.

<!-- > **`NULLS LAST` gotcha (important).** Drizzle emits these indexes as
> `DESC NULLS LAST`, but `ORDER BY … DESC` defaults to `NULLS FIRST`. That mismatch
> alone makes the planner **ignore the index and sort** — even though
> `published_at`/`id` are `NOT NULL` so results are identical. Every keyset-ordered
> query therefore uses `ORDER BY published_at DESC NULLS LAST, id DESC NULLS LAST`
> to match the index (see `apps/api/src/routes/articles.ts`). Verified with
> `EXPLAIN`: with `NULLS LAST` the plan is an `Index Only Scan` with no `Sort`. -->

**Deliberately _not_ indexed (yet):**

- **Combined `(source_id, language_id, …)`** — only worth it if filtering by _both_
  together is a proven hot path; otherwise Postgres can `BitmapAnd` the two
  compound indexes. Left out to save write cost until a real query demands it.
- **`pg_trgm` trigram index** — needed only for substring/suffix wildcards; the
  brief's wildcards are prefix, already covered by the FTS `:*` operator. See
  [Wildcard scope](#wildcard-scope--prefix-only-for-now).
- **Enrichment columns (`sentiment`, `topics`)** — the `article_enrichments` table
  currently indexes only `status` (the runner's work-scan). `btree(sentiment)` to
  back a sentiment aggregate/filter, and `GIN(topics)` to filter by tag, are **not
  yet added** — deferred until those filters are actually exposed, to avoid paying
  write cost for an unused index. See [Future enhancements](#future-enhancements).
- **No redundant single-column FK indexes** — the compound indexes' leading
  `source_id` / `language_id` already satisfy the FK-index need.

**Aggregate:** `date_trunc('month'|'week', published_at)` + `count(*)` over a date
range rides the `(published_at DESC, id DESC)` index; since the count only needs the
columns _in_ that index, Postgres can do an **index-only scan** (no heap fetch).

If a dashboard ever needs to count the entire table (no date range) as it grows
huge, the next step is to **precompute the counts** into a saved summary table that
refreshes periodically, so each request reads the pre-tallied numbers instead of
recounting every row — designed for, not yet built.

### Pagination — avoiding deep `OFFSET`

Deep `OFFSET` pagination degrades linearly: `OFFSET 10000` makes Postgres scan and
discard 10,000 rows every request. The list endpoint uses **keyset (cursor)
pagination** instead — the client passes the last row's `(published_at, id)` and
the query does:

```sql
WHERE (published_at, id) < ($cursor_ts, $cursor_id)
ORDER BY published_at DESC NULLS LAST, id DESC NULLS LAST
LIMIT $n
```

This is backed by the `(published_at DESC, id DESC)` index, so every page is an
index range scan — O(page size), independent of how deep you are. (The
`NULLS LAST` matches the index; see the gotcha above.) `SELECT *` is avoided; only
the columns the client needs are projected.

One pitfall of this method is that is not able to provide a page index selector as you would with the offset method. So jumping from page 2 to page 10 is not possible. One solution would be a hybrid approach, using keyset pagination for next/prev and offset navigation for jumping pages.

### Aggregate endpoint

`GET /api/articles/aggregate` returns article counts per time bucket, grouped by
`date_trunc(interval, published_at)` (`interval` is `month` or `week`, whitelisted —
the only value interpolated into SQL), optionally filtered by `source`. A single
grouped query (no N+1) returns both the overall **`total`** (via `LEFT JOIN`, so it
counts every article regardless of enrichment state) and the per-sentiment breakdown
(via `count(*) FILTER (WHERE …)`), using the `(published_at, id)` index.

The chart renders a **Total** line plus one line per sentiment.

### Boolean search approach

**Decision: hand-rolled parser → Postgres `to_tsquery`.** Rather than expose
`to_tsquery` directly (its syntax isn't the brief's syntax, and passing user input
into it raw is both a correctness and an injection hazard), the API parses the
query itself and compiles it to a **parameterized** `tsquery`.

Pipeline:

1. **Tokenize** — recognize case-sensitive `AND` / `OR` / `AND NOT` operators,
   parentheses, `"quoted phrases"`, `wildcard*` terms, and bare terms. Lowercase
   `and`/`or`/`not` are treated as **search terms**, not operators (per the brief).
2. **Parse** — a small recursive-descent / precedence parser produces an AST,
   handling nesting like `(a AND (b OR c))`.
3. **Compile to `tsquery`** — map the AST to Postgres text-search functions and
   operators. Leaves become `tsquery` values via built-in functions: a plain term →
   `plainto_tsquery`, a quoted phrase → `phraseto_tsquery` (handles word adjacency
   for us), and a wildcard → `to_tsquery` with the `:*` prefix-match operator.
   Branches combine those with the `tsquery`-combining operators `&&` (AND), `||`
   (OR) and `!!` (NOT). Every user value is passed as a **bound parameter** — user
   text never becomes SQL syntax — and all functions use the `'simple'` config to
   match `search_vector`. The result is matched with `@@` against the GIN-indexed
   `tsvector`.

**Why this approach (tradeoffs):**

- ✅ **Uses the index** — compiling to a native `tsquery` means the GIN index does
  the work; matching stays fast as the corpus grows.
- ✅ **Safe by construction** — user tokens are never string-interpolated into SQL
  (see Security); malformed queries return a 400 with a clear message instead of a
  500 or an injection.
- ✅ **Exactly the brief's semantics** — case-sensitive keywords, phrases,
  wildcards, and nesting are handled in our parser, not left to `to_tsquery`'s
  different rules or `websearch_to_tsquery`'s looser ones.
- ⚠️ **Cost** — we own a parser. Mitigated by keeping the grammar tiny and unit-
  testing it against the brief's example queries.
- ⚠️ **`websearch_to_tsquery` was rejected** — it's convenient but doesn't support
  our nesting/wildcard requirements or the case-sensitive-keyword rule outright.
  If the product later wanted a **more forgiving, consumer-style search box** —
  loose syntax tolerated rather than validated, no 400s on malformed input — this
  is the natural switch, at the cost of the strict boolean semantics the brief asks
  for. (For a true **fuzzy / typo-tolerant** matching e.g. `supprt` → `support` — that
  would be likely be a job for `pg_trgm` trigram similarity index, not just a `tsquery` change.)

Validated against the brief's examples, e.g.:

```
"oil prices" AND (geopolitical OR "supply chain")
renewable AND NOT (nuclear OR coal)
AI AND ("healthcare" OR "diagnostic") AND NOT startup*
```

#### Wildcard scope — prefix only (for now)

**Decision: support `term*` (prefix) wildcards only; not `*term` or `*term*`.**
Postgres Full Test Search (FTS) wildcards compile to the `:*` operator, which matches lexemes by
**prefix** — `startup*` → `startup`, `startups`, `startup:*`. This is served by
the existing `GIN(search_vector)` index with no extra structures, because GIN
stores lexemes/words sorted and a prefix is just a range in that sorted set.

Leading/substring wildcards (`*new`, `*new*` → matching the "new" _inside_
"renewable") are **deliberately out of scope**. FTS can't do them — a suffix has
no anchor in a front-sorted lexeme dictionary. Supporting them requires a
different tool: the **`pg_trgm`** extension with a `GIN (col gin_trgm_ops)`
trigram index (which decomposes text into 3-char chunks so `ILIKE '%new%'`
becomes index-backed).

We're not adding `pg_trgm` yet because:

- the brief's wildcard syntax is prefix (`term*`), already covered;
- a trigram index is a **second index to maintain on every write** — real cost at
  ~50k articles/day — and matches raw characters, not words (no stemming, phrase,
  or boolean semantics), so it's complementary to FTS, not a substitute.

**If substring/suffix or fuzzy search is later required**, the change is scoped and
additive: enable `pg_trgm` in a migration, add a `GIN (headline gin_trgm_ops)`
(and/or `body`) index, and route substring/fuzzy queries through `ILIKE` /
`similarity()` while keeping boolean/phrase/prefix on FTS.

### LLM enrichment

Enrichment lives behind an **`Enricher` interface** (`apps/api/src/features/enrichment/`)
with two implementations — `AnthropicEnricher` and `MockEnricher` — selected at
runtime by the presence of `ANTHROPIC_API_KEY`. This keeps the app fully
demonstrable with no API spend while making the real integration a drop-in (the
interface is also the seam that would let us swap providers). `AnthropicEnricher`
makes two calls per article: **Sonnet** for the 1–2 sentence summary and **Haiku**
for sentiment + topics via **structured output**. See the
[cost analysis](#llm-cost-analysis) for model selection, guardrails, and cost.

**Own table + lifecycle.** Enrichment is a separate `article_enrichments` table
(1:1 with `articles`) carrying a **status** (`pending`/`processing`/`completed`/
`failed`), the result columns, an **`error_message`**, and an `attempts` counter —
effectively the work item a production queue would process. A `pending` row is
enqueued per article at ingest/seed time; the runner transitions
`pending`/`failed` → `processing` → `completed`|`failed`, capturing any error on
the row without aborting the batch (idempotent — `completed` rows are skipped,
`failed` rows retried). The API returns it nested on each article as
`enrichment { status, summary, sentiment, topics }` (the `error_message` stays
internal).

**Cost guardrails** (`enrichment.config.ts`): input caps, output-token maximums,
and a concurrency limit keep spend bounded — see
[Cost / rate guardrails](#cost--rate-guardrails) for the full list.

**How it runs.** Synchronously via **`yarn db:enrich`** (no key → mock, zero cost;
`ANTHROPIC_API_KEY` set → real). It can enrich the whole backlog, a **single
article** (`yarn db:enrich 5`), or **reprocess** already-`completed` rows with
`--force` (e.g. after changing a prompt) — see the [script options](#useful-scripts).
In production this would fire on ingestion via a queue — the `article_enrichments`
row is already the work-item shape, so a per-article worker calling `enrichPending`
drops in. _(Queue on ingestion, a fuller provider abstraction, the Anthropic Batch
API for bulk backfill, and a UI / aggregate-by-sentiment view remain enhancements.)_

### API surface

| Endpoint                      | Purpose                                                                                                                                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/articles`           | Keyset-paginated list. Optional filters: `?q=` boolean search (parser → `tsquery`), `?source=<id>`, `?language=<id>`, `?from=`/`?to=` (ISO) date range. `?limit=`, `?cursor=`, `?direction=next\|prev` drive pagination.           |
| `GET /api/lookups`            | Reference data for the filter controls: `{ sources, languages }`.                                                                                                                                                                  |
| `GET /api/articles/aggregate` | Article counts over time — `?interval=month\|week` (default month), optional `?source=<id>`. Returns `AggregateBucket[]` (`{ bucket, total, bySentiment }`): overall total + per-sentiment breakdown; powers the multi-line chart. |

Search and filters are optional query params on the list endpoint rather than
separate routes, so they compose with each other and with the keyset pagination.
List responses use the shared `Paginated<T>` type (`{ data, pageInfo }`);
errors use `ApiError`, both from `@carma/shared`. A malformed `q`, a bad
`source`/`language` id, an invalid date, or a `to` before `from` all return
**400** with a descriptive message.

### Known issues

#### 1. Search + filter state are out of sync

**Bug:** the search box commits its text to the query only on submit (Enter /
Search), while the filter controls commit on change. Because both write into the
same query object, editing the search input _without submitting_ and then changing
a filter re-applies the **stale** search term alongside the new filter.

_Repro:_ type a phrase → Search → clear the input (don't press Enter) → change the
source filter. Expected: results filtered by source with **no** search. Actual: the
previously-submitted phrase is still applied, because `query.q` never updated when
the input was cleared.

**Root cause:** two independent commit paths (search-on-submit vs. filter-on-change)
over shared state in `App`, so the search input's current text and the applied `q`
can diverge. `SearchBar` holds the live text locally; `App.query.q` holds the last
submitted value.

**Planned fix:** lift the whole query into a **context provider** as the single
source of truth, and have the search input keep the provider's `q` current as the
user types (debounced) — or, at minimum, commit the input's current text whenever
_any_ filter changes. Then changing a filter uses whatever is in the box right now,
Enter or not, and search + filters always stay consistent. This restructure is not
yet done.

---
