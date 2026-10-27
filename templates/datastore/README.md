# @lightproject/datastore

Shared Drizzle schema, clients and migrations for Postgres (Node, or Cloudflare via Hyperdrive)
and D1. It owns every table and migration; apps never keep their own. Full reference, including
the step-by-step "Adding a table": `.ai-data/architecture.md` → "Database".

<!-- template-only -->

This is the **template** for the future real `packages/database`: its own env keys use the
`DATASTORE_` prefix (Postgres database `lightproject_datastore`), and the `DATABASE_POSTGRES_*` keys
in `.env.example` are reserved for that package (root README → "Templates and Reserved Names").
`DATABASE_DIALECT` is shared by both.

<!-- /template-only -->

```ts
import { db, type types } from '@lightproject/datastore';

const database = await db.createDatabase(env); // dialect from DATABASE_DIALECT; D1 binding as env.DB
```

Commands run from `templates/datastore` unless noted.

## Setup

1. Install and start Postgres (from the repo root):

   ```sh
   vp install
   docker compose up -d postgres
   ```

   This package has its own database, `lightproject_datastore` (`DATASTORE_POSTGRES_DB`), next to
   `lightproject`, which is reserved for the future real `packages/database`; each keeps its own
   migration history. `configs/postgres/create-databases.sh` creates every `*_POSTGRES_DB` compose
   passes it (skipping existing ones). Postgres runs it only on a fresh volume; on an existing
   one, run it once after `docker compose up -d postgres` has picked up the mount:

   ```sh
   docker compose exec postgres sh /docker-entrypoint-initdb.d/create-databases.sh
   ```

2. Configure the root `.env` (copy `.env.example`): `DATABASE_DIALECT` (`postgres` or `d1`), and
   `DATASTORE_POSTGRES_URL` or the shared `POSTGRES_*` server parts plus `DATASTORE_POSTGRES_DB`. Local D1 needs nothing else; it lives in
   `../../.wrangler/state`, shared by every app's `wrangler dev`.

3. Build and apply the migrations to both databases (`db:migrate` runs the built
   `dist/scripts/migrate.mjs`, so build first):

   ```sh
   vp run build
   DATABASE_DIALECT=postgres vp run db:migrate
   DATABASE_DIALECT=d1 vp run db:migrate
   ```

### Reset local databases

Stop any running `wrangler dev` (backend, tasks, scheduler) first; it holds the local D1 files open. From
the repo root:

```sh
# Postgres: app schema + drizzle's migration history
docker exec postgres psql -U lightproject -d lightproject_datastore -c \
  'DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;'

# D1: only the d1 folder of the shared state
rm -rf .wrangler/state/v3/d1
```

Then repeat setup step 3.

## Environment variables

Read from `process.env` (Node: the root `.env` through the app or task that loads it). On
Cloudflare, `createDatabase(env)` takes the Worker's `env` instead: its `DATABASE_DIALECT` and
`DATASTORE_POSTGRES_URL` win over `process.env`.

| Variable                 | Used by                   | Purpose                                                                                               |
| ------------------------ | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `DATABASE_DIALECT`       | `createDatabase`, migrate | **Required.** `postgres` or `d1`; anything else throws                                                |
| `DATASTORE_POSTGRES_URL` | `createDatabase`, migrate | Postgres connection string; when unset it is built from the `POSTGRES_*` parts below                  |
| `POSTGRES_HOST`          | `createDatabase`, migrate | Host for the built URL (default `localhost`)                                                          |
| `POSTGRES_PORT`          | `createDatabase`, migrate | Port for the built URL (default `5432`)                                                               |
| `POSTGRES_USER`          | `createDatabase`, migrate | User for the built URL (default `lightproject`)                                                       |
| `POSTGRES_PASSWORD`      | `createDatabase`, migrate | Password for the built URL (default `lightproject`)                                                   |
| `DATASTORE_POSTGRES_DB`  | `createDatabase`, migrate | Database name for the built URL (default `lightproject_datastore`)                                    |
| `CLOUDFLARE_ENV`         | migrate (`d1`)            | Unset: local D1. `develop`/`staging`/`production`: the remote D1 of that `[env.*]` in `wrangler.toml` |
| `CLOUDFLARE_ACCOUNT_ID`  | migrate (remote D1)       | Account of the remote D1 (environment, else the root `.env`)                                          |
| `CLOUDFLARE_API_TOKEN`   | migrate (remote D1)       | API token with D1 edit access (environment, else the root `.env`)                                     |
| `TEST_SUITE`             | `vite.config.ts`          | `integration` switches `vp test` to `tests/integration` (set by `vp run test:integration`)            |

Worker bindings (not variables) passed in `createDatabase(env)`:

| Binding      | Purpose                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------ |
| `DB`         | D1 database; required when the dialect is `d1`                                                   |
| `HYPERDRIVE` | Postgres through Cloudflare Hyperdrive; its connection string wins over `DATASTORE_POSTGRES_URL` |

## Development

**Only edit `src/postgres/`** (plus the dialect-neutral `src/shared/`, `src/repositories/`,
`src/types.ts`, `src/schemas.ts`). `src/d1/schema.ts`, `crud.ts`, `tables.ts`,
`worker-jobs.ts` and `script-locks.ts` and everything under `migrations/` are generated; `client.ts` and
`repositories.ts` stay hand-written per dialect.

| Task                        | What it does                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `vp run db:generate <name>` | Regenerates the D1 files from Postgres, formats/lints them, writes both migrations `<name>` |
| `vp run db:migrate`         | Applies migrations to the `DATABASE_DIALECT` target (needs `vp run build` first)            |
| `vp run db:check`           | `drizzle-kit check` on both migration folders                                               |
| `vp run db:studio`          | Drizzle Studio on Postgres                                                                  |

### Schema change → generate → migrate

1. Edit `src/postgres/schema.ts` and export the table. Use the shared helpers (`newId`,
   `timestamps`), not SQL defaults:

   ```ts
   const samples = pgTable('samples', {
     id: uuid('id').primaryKey().$defaultFn(newId),
     name: text('name').notNull(),
     ...timestamps,
   });

   export { samples, timestampColumn, timestamps, users, workerJobs };
   ```

2. Generate the D1 side and both migrations:

   ```sh
   vp run db:generate add_samples
   ```

   Expected: `src/d1/schema.ts updated`, plus `migrations/postgres/<ts>_add_samples/` and
   `migrations/d1/<ts>_add_samples/`. It fails with the reason on constructs D1 cannot represent
   (arrays, numeric, serial, SQL defaults, …) or Postgres-only query constructs the renderer
   cannot map. Re-running with no changes reports everything as already in sync.

3. Apply to both databases:

   ```sh
   vp run build
   DATABASE_DIALECT=postgres vp run db:migrate
   DATABASE_DIALECT=d1 vp run db:migrate
   ```

4. For apps to query the table, also add its types, repository, `tables.ts` wiring and a contract
   test (steps 2–6 and 8 of "Adding a table").

To discard a trial table: revert `src/postgres/schema.ts` and `src/d1/schema.ts`, delete both
`<ts>_<name>` migration folders themselves (not just their files:
`rm -rf migrations/*/*_<name>`), then reset the local databases. Git does not track empty
folders, so a leftover one is invisible in `git status` but still counted by the migration tests.

## Testing

```sh
vp test                   # unit: PGlite + generated-file parity/drift, no services needed
vp run test:integration   # shared contract on docker-compose Postgres, then a throwaway local D1
```

- `tests/shared/database-contract.ts` is the one contract both dialects run.
- Parity, migration-drift and query-drift tests fail when a generated file was edited or
  `db:generate` was skipped.

Check a migrated local database directly:

```sh
# Postgres: table exists, migrations recorded
docker exec postgres psql -U lightproject -d lightproject_datastore -c '\d samples' \
  -c 'SELECT id, name FROM drizzle.__drizzle_migrations;'

# Local D1
vp exec wrangler d1 execute DB --local --persist-to ../../.wrangler/state \
  --command "SELECT name FROM sqlite_master WHERE type='table';"
```

Before finishing, run `vp run ready` from the repo root. To reproduce CI:
`dagger call test-integration --workspace=@lightproject/datastore`.

## Deployment

`dist/scripts/migrate.mjs` picks its target from the environment:

| `DATABASE_DIALECT` | `CLOUDFLARE_ENV`                     | Target                                                                                          |
| ------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `postgres`         | ignored                              | `DATASTORE_POSTGRES_URL` or `POSTGRES_*` (drizzle's `__drizzle_migrations` table)               |
| `d1`               | unset                                | Local D1 in `../../.wrangler/state`                                                             |
| `d1`               | `develop` / `staging` / `production` | Remote D1 of that `[env.*]` in `wrangler.toml` (`CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`) |

### CI

On deploy, the `datastore` job runs before `backend` and always publishes the migrator image
`<REGISTRY_ADDRESS>/datastore` (command `node dist/scripts/migrate.mjs`). CI applies migrations
only when the GitHub variable `DATABASE_MIGRATION_ENABLED` is `true` (default off), using the
`DATABASE_DIALECT` variable and the `CLOUDFLARE_*` / `DATASTORE_POSTGRES_URL` secrets; enabled with no
dialect fails the job. The `backend`, `tasks` and `scheduler` deploys fail if `DATABASE_DIALECT`
differs from the dialect in their `wrangler.toml`'s `[env.<env>.vars]`.

### Manually

```sh
# Remote D1 (credentials from the environment or the root .env)
vp run build
CLOUDFLARE_ENV=develop DATABASE_DIALECT=d1 vp run db:migrate

# Postgres, via the published image (Kubernetes Job/initContainer, or any container runtime)
docker run --rm -e DATABASE_DIALECT=postgres -e DATASTORE_POSTGRES_URL="postgres://…" \
  <REGISTRY_ADDRESS>/datastore:<tag>

# Same path CI takes (from the repo root)
dagger call migrate --workspace=@lightproject/datastore --environment=develop --dialect=postgres \
  --postgres-url=env:DATASTORE_POSTGRES_URL
```
