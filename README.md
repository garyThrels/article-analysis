# Carma — Media Signal Service

A small full-stack service that ingests news articles, enriches them with an LLM,
and lets users search and explore the data — boolean query parsing, LLM-driven
enrichment, SQL performance, and safe handling of untrusted content.

Built as a TypeScript monorepo:

- **`apps/api`** — Express 5 API with [Drizzle ORM](https://orm.drizzle.team/) over Postgres
- **`apps/web`** — Vite + React frontend
- **`packages/shared`** — TypeScript types shared by both (`@carma/shared`)

Package manager: **Yarn 4** (workspaces). Everything runs with a single Docker command.

```
carma/
├── apps/
│   ├── api/          # Express + Drizzle (ingest, search, aggregate, enrichment)
│   └── web/          # Vite + React (search page + aggregate chart)
└── packages/
    └── shared/       # shared types (Article, ApiResponse, …)
```

---

## Table of contents

- [Quick start](#quick-start-docker--recommended)
- [Local development](#local-development-without-docker)
- [Database & migrations](#database--migrations-drizzle)
- [Useful scripts](#useful-scripts)
- **Assignment write-up**
  - [Plan](docs/plan.md)
  - [Architecture & Decisions](docs/architecture.md)
  - [LLM Cost Analysis](docs/llm-costanalysis.md)
  - [Security & Responsibility](docs/security.md)
  - [Future enhancements](docs/enhancements.md)
  - [Reflection](#reflection)
  - [LLM Transcript](#llm-transcript)

---

## Quick start (Docker — recommended)

Requires Docker.

```bash
cp .env.example .env          # sane defaults already work
docker compose up --build
```

This starts three services:

| Service | URL                   | Notes                                  |
| ------- | --------------------- | -------------------------------------- |
| `web`   | http://localhost:5173 | Vite dev server (HMR)                  |
| `api`   | http://localhost:3000 | Express; auto-runs migrations + seed   |
| `db`    | localhost:5432        | Postgres 16 (data persisted in volume) |

Open **http://localhost:5173** — the page talks to the API (proxied at `/api`),
lets you run boolean searches, and renders the aggregate chart. On first boot the
API runs pending migrations, seeds the 20 sample articles, and enriches them (see
[LLM Enrichment](#llm-enrichment)).

> **LLM key (optional).** Enrichment runs against the Anthropic API when
> `ANTHROPIC_API_KEY` is set in `.env`. If it is **unset**, the service falls back
> to the **mock enricher**, which returns realistic canned summaries / sentiment /
> tags so the whole app is demonstrable with zero API cost. See
> [LLM Cost Analysis](#llm-cost-analysis).

Source is bind-mounted, so edits to the API or web app hot-reload automatically.
Stop with `Ctrl-C`; `docker compose down` removes the containers (add `-v` to also
wipe the database volume).

## Local development (without Docker)

Requires Node 20+, Yarn 4 (via Corepack), and a reachable Postgres.

```bash
corepack enable
yarn install

# Point DATABASE_URL at your Postgres, then create the schema and seed:
yarn db:migrate
yarn db:seed

# Run API and web together:
yarn dev
# ...or individually:
yarn dev:api   # http://localhost:3000
yarn dev:web   # http://localhost:5173
```

## Database & migrations (Drizzle)

The schema lives in **`apps/api/src/db/schema.ts`** as plain TypeScript. Drizzle
generates readable SQL migration files from it into `apps/api/drizzle/`.

```bash
# 1. Edit apps/api/src/db/schema.ts
# 2. Generate a SQL migration from the schema diff:
yarn db:generate
# 3. Apply pending migrations to the database:
yarn db:migrate
```

- **`yarn db:generate`** only diffs the schema files — no running database needed.
  Inspect `apps/api/drizzle/` to see the exact SQL it produced.
- **`yarn db:migrate`** connects using `DATABASE_URL` and applies anything pending.
  The API **also runs pending migrations automatically on startup**
  (`apps/api/src/db/migrate.ts`), so a fresh `docker compose up` just works.
- **`yarn db:studio`** opens Drizzle Studio, a browser GUI for the database.

## Useful scripts

| Command            | What it does                                               |
| ------------------ | ---------------------------------------------------------- |
| `yarn dev`         | Run API + web together                                     |
| `yarn typecheck`   | Type-check every workspace                                 |
| `yarn build`       | Build every workspace                                      |
| `yarn db:generate` | Generate a Drizzle migration from the schema               |
| `yarn db:migrate`  | Apply pending migrations                                   |
| `yarn db:seed`     | Load `sample_articles.json` (enqueues pending enrichments) |
| `yarn db:enrich`   | Enrich pending/failed articles (see options below)         |
| `yarn db:studio`   | Open Drizzle Studio                                        |

`db:enrich` options (run from the repo root or `apps/api`):

```bash
yarn db:enrich                 # enrich all pending/failed articles
yarn db:enrich 5               # only article 5 (if pending/failed)  — --article 5 / -a 5 also work
yarn db:enrich 5 --force       # reprocess article 5 even if completed (e.g. after a prompt change)
yarn db:enrich --force         # reprocess ALL articles regardless of status
```

---

# Assignment write-up

The detailed write-up lives in [`docs/`](docs/):

| Section                                          | Contents                                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| [Plan](docs/plan.md)                             | Problem breakdown, why the approach was taken, and what I'd cut under time pressure.             |
| [Architecture & Decisions](docs/architecture.md) | Tech stack, schema and indexing choices, keyset pagination, boolean search, and LLM enrichment.  |
| [LLM Cost Analysis](docs/llm-costanalysis.md)    | Model selection, per-article/day cost, latency, self-hosting, and the production recommendation. |
| [Security & Responsibility](docs/security.md)    | SQL injection, XSS, prompt injection, and cost / rate guardrails.                                |
| [Future enhancements](docs/enhancements.md)      | Deliberately deferred work, with a clear path to add each.                                       |

The [Reflection](#reflection) and [LLM Transcript](#llm-transcript) sections follow below.

---

## Reflection

Overall I have come to make use of AI and the agentic development flow throughout my day, and throughout the entirity of this small project. Using Perplexity, I was able to grasp a high level plan on how I wanted to tackle the problem. Asking it questions and learning more about different terminology and steps it proposes, especially in relation to Postgresql and its various tools which I am not all that familiar with.

Through this project alone though, I learned alot more about PostGreSQL and how useful it can potentially be when handling large amounts of text data efficiently within requiring tools like ElasticSearch and Meilisearch.

After that initial planning, through Claude CLI I was able to easily setup a simple project with a single docker command to execute it, structured and ready to be use both agentically and through manual intervention.
It helped greatly in 2 areas:

- When it came to indexing the right columns, where although I knew what I wanted to be easily searchable and indexed, AI helps to validate my reasoning by providing comprehensive reasoning as to why it might be needed, along with potential improvmeents down the line.
- Creating a custom built Boolean Search parser, AST and compiler. Something that would have taken far longer without AI to develop and get right. When it comes to this sort of logic heavy implementation, I also like to write unit tests, allowing the agent to take a test driven approach, so that we ensure the validity of the logic.

As for any misleading, there were no large instances where I think this happened. I try to be cautious, first breaking down large features and then planning each while giving context of the full picture to the agent. I question certain choices and research others to be sure of what will happen. The misleads worth noting:

- The first was likely when handling the wildcard search. My assumption was that a suffix/prefix with \* would have worked, and the agent was moving along with it, while it made a small reference as to how it would work in actuality. That made me question it, even looking into other solutions and re-reading the brief to see what was expected. As per the brief, a prefix with \* was enough (I hope) so we continued, but took note of possible solutions.
- Tests were being skipped, since Vitest does not read our local .env file, and we were testing against the database. Without the database path, tests were being skipped, even though we had written them, creating a false sense of security. After adding the env variable as part of the command to execute the tests, I was able to debug some minor issues and confirm that the logic was working as expected.

With more time:

- I would have liked to see how the project fares with a large dataset, comparing the indexed searches with non-indexed ones.
- Improved the UI, splitting and improving the data aggregation and listing, possibly even showing information about enrichment status for articles. Adding a single article page with translation capability for the articles, making use of Google's translate apis or similar.
- Introduced a queue to handle processing the data ingress and enrichment step.
- Improved the search and filtering to include search within the enriched fields of the article, along with a ranking system and fuzzy word matching.
- Cross language search - searching a word using English would still match in an article written in Chinese, possibly even vice versa. This would mean storing English translations of other articles, and later if we allow search by other langauges, we too would translate the search term to english first before searching it. This is just a quick thought though, and would require more in depth research.
- Use vendor agnostic AI libraries like Vercel/ai to allow us to easily switch between model providers and models used, currenlty we would need to interface other providers like OpenAI ourselves. It would also make it easier to have fallback models, or switch models depending on their latest pricing.
- Test out self hosted models, making use of a vendor agnostic approach to allow switching based on load, errors and so on.

Overall it was honestly a fun brief, hopefully the quality expectations were met and I will definitely see how the solution does in handling large datasets.

---

## LLM Transcript

The code generation was generated along with Claude CLI, while using VS Code as an IDE to review and commit the changes along the way. A full transcript of the conversation can be found inside [`docs/llm-transcript.md`](docs/llm-transcript.md).
Before starting the assignment through the week, and while developing the project, Perplexity was used to help in researching the solution and learning about any new terminology and concepts to fully understand and be ready to challenge any decisions being made. A full transcript of this chat is in [`docs/research-transcript.md`](docs/research-transcript.md).

The reason I take this approach with AI, is that Perplexity provides not only a solution, but also the sources for the explanations that I am able to read more about, makeing it easier to question and think through. It is also able to keep up to date with the latest chnages, something that models from Claude and Gemini sometimes lack, requireing reminders to ensure the solution given is for the correct db or library version
