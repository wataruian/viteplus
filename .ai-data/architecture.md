# Monorepo Architecture

This document provides a comprehensive overview of the `@lightproject/monorepo` architecture.

## High-Level Structure

The repository is structured as a **Vite+-powered Monorepo**.

- **`apps/`**: Contains deployable units of the system.
  - **`backend`**: Hono API — a Fetch-API/WinterCG-compatible framework (`app.fetch`). The
    portable core (`src/app.ts`) has no runtime-specific dependencies; `src/runtimes/` holds the
    thin adapters that run it: `node.ts` (local dev via `@hono/node-server`) and `edge.ts` (the
    `wrangler.toml` entry, deployed to Cloudflare Workers). Node-specific APIs are intentionally
    confined to `runtimes/node.ts` and build/test tooling.
  - **`frontend`**: Modern SPA built with React and Vite.
- **`packages/`**: Shared internal libraries and utilities.
  - **`common`**: The foundational library providing isomorphic environment management and structured logging.
    Entry points (`@lightproject/common/<dir>`) are split by runtime: `browser` (Faro RUM —
    frontend only), `server` (OpenTelemetry SDK setup, `/metrics`, flush/shutdown — backend only),
    `node` (Node-only fs helpers), and isomorphic `utils`, `logger`, `environment`, `configs`,
    `validators`, `typecast`. Browser code must not import `server`/`node`, and server code must
    not import `browser`.
  - **`design-system`**: Shared UI component library using UnoCSS and React.
  - **`database`**: Shared Drizzle ORM schema, clients and migrations — see "Database" below.
  - **`library`**: General purpose shared library templates.
- **`bak/`**: Intentionally tracked archive of earlier app/library setups, kept for future reuse.
  Not a workspace member; excluded from lint/format, Sonar, and CodeQL. Not a cleanup/TODO item —
  do not propose removing it from Git.

## Database (`packages/database`)

- **Drizzle ORM 1.0 RC** (`drizzle-orm`/`drizzle-kit` pinned to `1.0.0-rc.4`), chosen over Prisma
  (codegen, heavy on Workers, D1 adapter in Preview) and Kysely (no schema/migration tooling).
  Comparison: `.ai-data/artifacts/orm-comparison.md` (local scratch).
- **Two dialects, both first-class**: Postgres (`src/postgres`, postgres.js;
  Node directly, Cloudflare through a Hyperdrive binding + `nodejs_compat`) and D1
  (`src/d1`). Neither is a public subpath: `package.json` exports only `.`, and
  `createDatabase` loads the selected dialect with a dynamic `import()`.
- **Postgres is the source of truth; D1 is generated.** Only `src/postgres/schema.ts` is edited.
  `vp run db:generate [name]` (`src/scripts/generate.ts` → `src/scripts/render-d1-schema.ts`, then `src/scripts/migrations.ts`) reads the
  exported Postgres tables at runtime (`getTableConfig`) and writes `src/d1/schema.ts` with the
  same column names and TypeScript types (`uuid`→`text`, `jsonb`→JSON `text` reusing the Postgres
  column's `$type`, `timestamptz`→integer epoch ms, `boolean`→integer boolean), keeps
  `$defaultFn`/`$onUpdateFn`/enum references to `src/shared` by identity, orders tables so
  foreign-key targets come first, then runs `vp check --fix` on it and `drizzle-kit generate` for
  both dialects. It refuses (with the reason) anything without a faithful SQLite equivalent:
  arrays, `numeric`, `serial`, `date`, bigint mode `bigint`, string timestamps, SQL defaults,
  functions not from `src/shared`, non-btree/unnamed/expression indexes, composite or circular
  foreign keys. Row types (`User`, `WorkerJob`, …) are exported once from the root entry.
- **Apps query through one import**: `db.createDatabase(env)` (`import { db } from
  '@lightproject/database'`; namespaced like the other packages' roots) picks the
  dialect from `env.DATABASE_DIALECT` (else `process.env`) and returns repositories
  (`db.users.findById/findByEmail/insert/update/remove`, `db.workerJobs.findById/insert`) with the
  same row types on both. D1 needs the binding as `env.DB`; Postgres uses
  `env.HYPERDRIVE.connectionString`, then `env.POSTGRES_URL`, then the `POSTGRES_*` env. Each
  dialect is loaded with a dynamic `import()`, so the root entry imports neither driver.
- **Repository layering (no casts)**: Drizzle's builders can't be typed over a generic table, so
  each dialect has one table-generic `crud.ts` (`findBy`/`insert`/`update`/`remove`) that widens
  the table to `PgTable`/`SQLiteTable` and parses rows with the `drizzle-orm/zod` schemas
  generated from it (a zod parse per row). Domain repositories are written once in
  `src/repositories/create.ts` on top of it; a new table is one `crud(table)` line per dialect in
  `src/{postgres,d1}/repositories.ts`. Custom queries (joins, job claiming) go in the
  `Database` interface with a per-dialect implementation. The shared contract tests exercise the
  repositories on both dialects: unit tests on a local D1 and on PGlite (in-memory Postgres via
  `drizzle-orm/pglite`; `createPostgresCrud` takes any `PgAsyncDatabase`), `test:integration` on
  the real server. Prisma was reconsidered (2026-10-19) and rejected: it removes
  only the query layer, while schema and migrations stay per provider.
- **Guards that keep them in step** (unit tests): `schema-parity` discovers every exported table
  and compares columns, nullability, defaults, keys, foreign keys, indexes, checks and (at type
  level, for all tables at once) the inferred row types; `migrations-drift` runs
  `drizzle-kit generate` on a scratch copy of the migrations and requires "No schema changes".
  `tests/shared/database-contract.ts` runs the same behavior checks on a real local D1 (unit) and
  a real Postgres (`vp run test:integration`).
- **Ids and timestamps are set by the app** (`$defaultFn`/`$onUpdateFn`), never DB defaults, so
  both dialects produce identical values.
- **Migrations**: `vp run db:generate` writes `migrations/{postgres,d1}/<timestamp>_<name>/`
  (Drizzle 1.0 folder format — not the flat files `wrangler d1 migrations` reads, so D1 is
  migrated by Drizzle's migrator too, tracked in `__drizzle_migrations` on both). Apply:
  `vp run db:migrate`, which picks the migrator from `DATABASE_DIALECT`: `postgres` →
  drizzle-orm's postgres-js migrator (`POSTGRES_URL` or the `POSTGRES_*` parts); `d1` → local D1
  (shared state), or with `CLOUDFLARE_ENV=<develop|staging|production>` the remote D1
  (`src/scripts/migrate-d1-remote.ts`: Drizzle's sqlite-proxy migrator over Cloudflare's D1 `/raw`
  HTTP endpoint; the database is the `DB` binding of `[env.<CLOUDFLARE_ENV>]` in
  `packages/database/wrangler.toml`, credentials `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`
  from the environment or root `.env`). Not `drizzle-kit migrate` with `d1-http`: in 1.0.0-rc.4
  its migrations-table check reads rows as arrays while that driver returns objects, so every run
  after the first fails with "migrations in the database that do not match any local migration".
  A unit test also rejects migration folders missing `migration.sql`/`snapshot.json` (left
  behind when files are deleted), which break every migrate run the same way.
- **One database for all apps**, one migration history: apps bind the same D1 (`database_id`
  from `packages/database/wrangler.toml` locally, `lightproject-local`) and run `wrangler dev`
  with `--persist-to ../../.wrangler/state`, the folder `DATABASE_DIALECT=d1 vp run db:migrate` migrates. Apps never keep
  their own tables or migrations.
- **Lint note**: `sort-keys` orders column objects alphabetically, so generated tables list
  columns alphabetically (cosmetic).

## Observability Stack

A full Grafana LGTM stack is configured via `docker-compose.yml` for local telemetry and observability:

- **Grafana** (Port 3300): Dashboards and visualization.
- **Loki** (Port 3100): Log aggregation.
- **Tempo** (Port 3200): Distributed tracing.
- **Mimir** (Ports 9009/9095): Metrics storage.
- **OpenTelemetry Collector** (Ports 4317/4318): Ingestion point for all traces, metrics, and logs.

_Backend services must emit their telemetry data to the OpenTelemetry Collector._

### Metrics model

- **One stream per SDK instance**: backend Worker isolates/Node processes and frontend browser tabs each
  set a lazily generated `service.instance.id` (OTel single-writer principle). OTLP metric exporters
  use **delta** temporality; the collector's `deltatocumulative` processor (`max_stale: 5m`) turns
  each instance's deltas into a cumulative series for Mimir. Without a per-instance identity,
  concurrent writers' overlapping deltas are silently dropped (verified on otelcol-contrib 0.131.0).
- **Query across instances**: `sum without (instance, service_instance_id) (rate(<counter>_total[5m]))`.
- **Samples are intentional** (starter demos of the Counter API and duration gauges): backend
  `request_hits` + `http_server_duration_seconds`, frontend `button_clicks` +
  `http_client_duration_seconds`.
- **Cost / scaling**: series churn tracks recently active instances (≈ concurrent visitors), not total
  page views. At high browser traffic, switch frontend metrics to collector-derived metrics
  (`spanmetrics`/`count` connectors over browser spans/events), with the collector as single writer.

### Redaction

- App-side: `@lightproject/common/logger` — `redact` (JSON-shaped serialization + key masking,
  fail-closed) and `redactUrl` (userinfo, sensitive query/fragment params, JSON-valued params).
- Collector: `transform/redact-urls` (traces + logs pipelines, `error_mode: propagate`) covers every
  producer, including browser/Faro spans the app code never touches.
