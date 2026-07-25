# Carma

A full-stack TypeScript monorepo:

- **`apps/api`** — Express 5 API with [Drizzle ORM](https://orm.drizzle.team/) over Postgres
- **`apps/web`** — Vite + React frontend
- **`packages/shared`** — TypeScript types shared by both (`@carma/shared`)

Package manager: **Yarn 4** (workspaces). Everything runs with a single Docker command.

```
carma/
├── apps/
│   ├── api/          # Express + Drizzle
│   └── web/          # Vite + React
└── packages/
    └── shared/       # shared types (Article, ApiResponse, …)
```

## Quick start (Docker — recommended)

Requires Docker.

```bash
cp .env.example .env          # sane defaults already work
docker compose up --build
```

This starts three services:

| Service | URL                     | Notes                                  |
| ------- | ----------------------- | -------------------------------------- |
| `web`   | http://localhost:5173   | Vite dev server (HMR)                  |
| `api`   | http://localhost:3000   | Express; auto-runs migrations + seed   |
| `db`    | localhost:5432          | Postgres 16 (data persisted in volume) |

Open **http://localhost:5173** — the page fetches `/api/articles` (proxied to the
API) and renders the seeded articles. The `Article` type flowing through
DB → Express → React is defined once in `packages/shared`.

Source is bind-mounted, so edits to the API or web app hot-reload automatically.

Stop with `Ctrl-C`; `docker compose down` removes the containers (add `-v` to
also wipe the database volume).

## Local development (without Docker)

Requires Node 20+, Yarn 4 (via Corepack), and a reachable Postgres.

```bash
corepack enable
yarn install

# Point DATABASE_URL at your Postgres, then create the schema:
yarn db:migrate

# Run API and web together:
yarn dev
# ...or individually:
yarn dev:api   # http://localhost:3000
yarn dev:web   # http://localhost:5173
```

## Database & migrations (Drizzle)

The schema lives in **`apps/api/src/db/schema.ts`** as plain TypeScript. Drizzle
generates readable SQL migration files from it into `apps/api/drizzle/`.

The typical loop when you change the schema:

```bash
# 1. Edit apps/api/src/db/schema.ts

# 2. Generate a SQL migration from the schema diff:
yarn db:generate

# 3. Apply pending migrations to the database:
yarn db:migrate
```

Notes:

- **`yarn db:generate`** only diffs your schema files — it needs no running
  database. Look inside `apps/api/drizzle/` to see the exact SQL it produced.
- **`yarn db:migrate`** connects using `DATABASE_URL` and applies anything
  pending. The API **also runs pending migrations automatically on startup**
  (see `apps/api/src/db/migrate.ts`), so a fresh `docker compose up` just works.
- **`yarn db:studio`** opens Drizzle Studio, a browser GUI for the database.

The first migration is intentionally a **minimal `articles` table**
(`id`, `title`, `body`, `created_at`) — a starting point to extend.

## Useful scripts (run from the repo root)

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `yarn dev`          | Run API + web together                        |
| `yarn typecheck`    | Type-check every workspace                    |
| `yarn build`        | Build every workspace                         |
| `yarn db:generate`  | Generate a Drizzle migration from the schema  |
| `yarn db:migrate`   | Apply pending migrations                      |
| `yarn db:studio`    | Open Drizzle Studio                           |
