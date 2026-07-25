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
  - [Plan](#plan)
  - [Architecture & Decisions](#architecture--decisions)
  - [LLM Cost Analysis](#llm-cost-analysis)
  - [Security & Responsibility](#security--responsibility)
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

| Service | URL                     | Notes                                   |
| ------- | ----------------------- | --------------------------------------- |
| `web`   | http://localhost:5173   | Vite dev server (HMR)                   |
| `api`   | http://localhost:3000   | Express; auto-runs migrations + seed    |
| `db`    | localhost:5432          | Postgres 16 (data persisted in volume)  |

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

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `yarn dev`          | Run API + web together                        |
| `yarn typecheck`    | Type-check every workspace                    |
| `yarn build`        | Build every workspace                         |
| `yarn db:generate`  | Generate a Drizzle migration from the schema  |
| `yarn db:migrate`   | Apply pending migrations                      |
| `yarn db:seed`      | Load `sample_articles.json` and enrich        |
| `yarn db:studio`    | Open Drizzle Studio                           |

---

