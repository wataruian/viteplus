# Monorepo Architecture

This document provides a comprehensive overview of the `@lightproject/monorepo` architecture.

## High-Level Structure

The repository is structured as a **Vite+-powered Monorepo**.

- **`apps/`**: Deployable units of the system. Empty for now (`apps/.gitkeep`); the real apps
  (`api`, `admin`, `site`, `workers`) are created here from `templates/`.
- **`packages/`**: Shared internal libraries and utilities.
  - **`common`**: The foundational library providing isomorphic environment management and structured logging.
    Entry points (`@lightproject/common/<dir>`) are split by runtime: `browser` (Faro RUM —
    frontend only), `server` (OpenTelemetry SDK setup, `/metrics`, flush/shutdown — backend only),
    `node` (Node-only fs helpers), and isomorphic `utils`, `logger`, `environment`, `configs`,
    `validators`, `typecast`. Browser code must not import `server`/`node`, and server code must
    not import `browser`.
  - **`design-system`**: Shared UI component library using UnoCSS and React.
- **`templates/`**: Workspace templates (`templates/*` in `pnpm-workspace.yaml`, verified and
  deployed like the others) that real apps and packages are created from with `mise run create`.
  - **`backend`**: Hono API — a Fetch-API/WinterCG-compatible framework (`app.fetch`). The
    portable core (`src/app.ts`) has no runtime-specific dependencies; `src/runtimes/` holds the
    thin adapters that run it: `node.ts` (local dev via `@hono/node-server`) and `edge.ts` (the
    `wrangler.toml` entry, deployed to Cloudflare Workers). Node-specific APIs are intentionally
    confined to `runtimes/node.ts` and build/test tooling.
  - **`frontend`**: Modern SPA built with React and Vite.
  - **`tasks`**: Always-running background job workers — see "Background Workers" below. Same
    split as the backend: a Web-API-only core, Node APIs only in `runtimes/node.ts`.
  - **`scheduler`**: Cron and one-off scripts that never overlap themselves — see "Scheduled
    Scripts" below. Same split: Node APIs only in `runtimes/node.ts`.
  - **`datastore`**: Shared Drizzle ORM schema, clients and migrations — see "Database" below.
  - **`library`**: General purpose shared library templates.
- **Templates and reserved names**: `templates/backend`, `templates/frontend`, `templates/tasks`, `templates/scheduler` and `templates/datastore` are templates for future real workspaces: `apps/api` (from `backend`), `apps/admin` and `apps/site` (from `frontend`), `apps/workers` (from `tasks`), `apps/dispatcher` (from `scheduler`) and `packages/database` (from `datastore`). Each owns an env prefix: templates `BACKEND_*`/`FRONTEND_*`/`TASKS_*`/`SCHEDULER_*`/`DATASTORE_*` (ports 2000+/8230+), real ones `API_*`/`ADMIN_*`/`SITE_*`/`WORKERS_*`/`DISPATCHER_*`/`DATABASE_*` (ports 3000+/9230+). The real ones' keys are reserved in `.env.example` and unused until those workspaces exist; do not remove or reuse them. Only variables that would clash when two of them run side by side get the prefix: ports and URLs, `<APP>_CONCURRENCY` (it names that app's job functions), `<APP>_RUN_TOKEN` (a scheduler app's one-off run secret), and the Postgres database (`<PKG>_POSTGRES_DB`/`<PKG>_POSTGRES_URL`: each database package keeps its own database and migration history on the shared compose server, created by `configs/postgres/create-databases.sh`). Everything else stays shared and unprefixed: `POSTGRES_HOST`/`PORT`/`USER`/`PASSWORD`, `DATABASE_DIALECT` and `DATABASE_MIGRATION_ENABLED` (shared despite the prefix), `JOB_STORE`, the `WORKER_*`/`JOB_*` tunables, `ALLOWED_IPS`, … New apps/packages come from `mise run create --type=backend|frontend|tasks|scheduler|datastore|library --name=<name>` (the target folder is fixed by type: `apps/` or `packages/`; the `vp create` directory prompt is ignored) (`scaffold/scaffold.ts`, tested in `tests/unit/scaffold.test.ts`), which renames only the template's own names in the copy and adds its missing keys to `.env.example`. So a template must read its **own** URL/port app-locally (its `src/env.ts`/`config.ts`, e.g. the backend's `BACKEND_URL`), never through a name-specific getter in `packages/common` (common keeps those only for other apps that call it), must not use its own camelCase name for anything else, must reach other workspaces through the repo root (`../../templates/backend/…`, never a sibling path like `../backend/…`, which breaks once the copy lives in `apps/`), and wraps template-only README text in `<!-- template-only -->` … `<!-- /template-only -->`.
- **`bak/`**: Intentionally tracked archive of earlier app/library setups, kept for future reuse.
  Not a workspace member; excluded from lint/format, Sonar, and CodeQL. Not a cleanup/TODO item —
  do not propose removing it from Git.

## Database (`templates/datastore`)

- **Drizzle ORM 1.0 RC** (`drizzle-orm`/`drizzle-kit` pinned to `1.0.0-rc.4`), chosen over Prisma
  (codegen, heavy on Workers, D1 adapter in Preview) and Kysely (no schema/migration tooling).
  Comparison: `.ai-data/artifacts/orm-comparison.md` (local scratch).
- **Two dialects, both first-class**: Postgres (`src/postgres`, postgres.js;
  Node directly, Cloudflare through a Hyperdrive binding + `nodejs_compat`) and D1
  (`src/d1`). Neither is a public subpath: `package.json` exports only `.`, and
  `createDatabase` loads the selected dialect with a dynamic `import()`.
- **Postgres is the source of truth; D1 is generated.** Only `src/postgres/` is edited: the
  schema and the modules `crud.ts`, `tables.ts`, `worker-jobs.ts` and `script-locks.ts` are rendered into `src/d1/`;
  `client.ts`/`repositories.ts` are hand-written per dialect (connect/close only).
- **Query modules** (`src/scripts/render-d1-queries.ts`): Drizzle's Pg and SQLite builders share
  their API but not their types, so one module cannot serve both without `any`; instead the D1
  copy renames the dialect identifiers (`AnyPostgresDatabase`→`D1Database`, `PgTable`→
  `SQLiteTable`, `pg-core`→`sqlite-core`, `createPostgres*`→`createD1*`) and drops
  `.for('update', { skipLocked: true })` (D1 runs one write at a time). Any Postgres-only
  identifier left over (`pg*`/`Pg*`/`Postgres*`, `postgres-js`, `.for(`) fails `db:generate`.
  Source code must therefore use APIs both builders type the same way (e.g. `.execute()`, not
  `.all()`), and partial-index predicates come from `src/shared` (`dedupeKeyPredicate`,
  `finishedJobsPredicate`, used as `sql.raw` by the schema and the queries, since SQLite only uses
  a partial index whose predicate the query repeats). `render-d1-queries.test.ts` fails if a
  committed D1 copy differs from its rendered, `vp fmt`-formatted source.
- **Schema rendering**: `vp run db:generate [name]` (`src/scripts/generate.ts` → `src/scripts/render-d1-schema.ts`, then `src/scripts/migrations.ts`) reads the
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
  '@lightproject/datastore'`; namespaced like the other packages' roots) picks the
  dialect from `env.DATABASE_DIALECT` (else `process.env`) and returns repositories
  (`db.users.findById/findByEmail/insert/update/remove`, `db.workerJobs.findById/insert` plus the job-queue queries, `db.scriptLocks.acquire/renew/release/findByName` for `templates/scheduler`) with the
  same row types on both. D1 needs the binding as `env.DB`; Postgres uses
  `env.HYPERDRIVE.connectionString`, then `env.DATASTORE_POSTGRES_URL`, then the `POSTGRES_*` env. Each
  dialect is loaded with a dynamic `import()`, so the root entry imports neither driver.
- **Repository layering (no casts)**: Drizzle's builders can't be typed over a generic table, so
  each dialect has one table-generic `crud.ts` (`findBy`/`insert`/`update`/`remove`) that widens
  the table to `PgTable`/`SQLiteTable` and parses rows with the `drizzle-orm/zod` schemas
  generated from it (a zod parse per row). Domain repositories are written once in
  `src/repositories/create.ts` on top of it; a new table is one `crud(table)` line in
  `src/postgres/tables.ts` (the D1 copy is generated; see "Adding a table"). Custom queries (joins, job claiming) go in the
  `Database` interface with a per-dialect implementation, e.g. the job queue
  (`db.workerJobs.enqueue/claim/heartbeat/complete/fail/release/purge`,
  `src/{postgres,d1}/worker-jobs.ts`): lease, heartbeat and retry times come from the **database
  clock** (`now()` on Postgres, `unixepoch('subsec')` on D1, via the hand-written per-dialect
  `src/{postgres,d1}/clock.ts`), and callers pass durations (`leaseMs`, `retryAfterMs`), so clock
  skew between workers cannot reclaim a live lease; `now` is optional and injected only by tests
  for determinism. `release` hands a job back to `pending` without charging the attempt (shutdown,
  a thread that never started). Owner-checked writes
  (`heartbeat`/`complete`/`fail`) are fenced by owner **and attempt** (`attempts`, raised by every
  claim) and resolve `false` once the lease is lost, so a late write from an earlier attempt —
  even by the same worker — cannot touch a reclaimed job; Postgres claims/purges with `FOR UPDATE SKIP LOCKED`, D1
  relies on single-statement atomicity. A claim first takes the oldest expired lease, then the
  oldest due pending job, each an index-ordered `LIMIT 1` (`selectExpiredLease` on
  `worker_jobs_running_idx`, `selectDuePending` on `worker_jobs_pending_idx`), so a backlog costs
  no sort per claim (`d1-query-plans.test.ts` asserts no `TEMP B-TREE`); one `OR` across both
  states had to read and sort every due row of the function. `enqueue` targets the partial dedupe index
  (`ON CONFLICT (function_name, dedupe_key) WHERE dedupe_key IS NOT NULL DO UPDATE`), so in one
  statement a repeat returns the existing job unchanged while it is pending, running or
  succeeded, and revives it when it is `dead` (each column `CASE WHEN status = 'dead' THEN
  excluded.… ELSE … END`: new payload, `run_at` and `max_attempts`, attempts reset; same id) — a
  failed job never blocks its key, as in BullMQ's deduplication. Any other conflict (e.g. a
  duplicate id) throws. Not `onConflictDoNothing({ where })`: in
  1.0.0-rc.4 the SQLite builder renders that `where` after `DO NOTHING` (a syntax error).
  The shared contract tests exercise the repositories on both dialects: unit tests on a local D1
  and on PGlite (in-memory Postgres via
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
  drizzle-orm's postgres-js migrator (`DATASTORE_POSTGRES_URL` or the `POSTGRES_*` parts); `d1` → local D1
  (shared state), or with `CLOUDFLARE_ENV=<develop|staging|production>` the remote D1
  (`src/scripts/migrate-d1-remote.ts`: Drizzle's sqlite-proxy migrator over Cloudflare's D1 `/raw`
  HTTP endpoint; the database is the `DB` binding of `[env.<CLOUDFLARE_ENV>]` in
  `templates/datastore/wrangler.toml`, credentials `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`
  from the environment or root `.env`). Not `drizzle-kit migrate` with `d1-http`: in 1.0.0-rc.4
  its migrations-table check reads rows as arrays while that driver returns objects, so every run
  after the first fails with "migrations in the database that do not match any local migration".
  A unit test also rejects migration folders missing `migration.sql`/`snapshot.json` (left
  behind when files are deleted), which break every migrate run the same way.
- **One database for all apps**, one migration history: apps bind the same D1 (`database_id`
  from `templates/datastore/wrangler.toml` locally, `lightproject-datastore-local`) and run `wrangler dev`
  with `--persist-to ../../.wrangler/state`, the folder `DATABASE_DIALECT=d1 vp run db:migrate` migrates. Apps never keep
  their own tables or migrations.
- **Lint note**: `sort-keys` orders column objects alphabetically, so generated tables list
  columns alphabetically (cosmetic).

### Adding a table

Every edit is in `templates/datastore`, on the Postgres or dialect-neutral side; nothing under
`src/d1/` or `migrations/` is edited by hand. Example: an `orders` table that belongs to a user
(this exact code was applied, generated and tested on both dialects before being documented).

1. **Define it** in `src/postgres/schema.ts` and add it to the `export { … }` list. Use the
   shared helpers (`timestamps`, `newId`, values and predicates from `src/shared`), not SQL
   defaults: the D1 renderer refuses constructs with no faithful SQLite equivalent.

   ```ts
   const orders = pgTable('orders', {
     id: uuid('id').primaryKey().$defaultFn(newId),
     totalCents: integer('total_cents').notNull(),
     userId: uuid('user_id')
       .notNull()
       .references(() => users.id),
     ...timestamps,
   });

   export { orders, timestampColumn, timestamps, users, workerJobs };
   ```

2. **Row types** in `src/types.ts`:

   ```ts
   import type { orders, users, workerJobs } from './postgres/schema';

   type Order = typeof orders.$inferSelect;
   type NewOrder = typeof orders.$inferInsert;

   export type { NewOrder, NewUser, NewWorkerJob, Order, User, WorkerJob };
   ```

3. **Repository types** in `src/repositories/types.ts`: the generic table in `Tables`, the
   methods apps get, and the entry in `Database` (add `OrdersRepository` to the type exports):

   ```ts
   interface Tables {
     orders: TableRepository<Order, NewOrder>;
     users: TableRepository<User, NewUser>;
     workerJobs: TableRepository<WorkerJob, NewWorkerJob>;
   }

   interface OrdersRepository {
     findById: (id: string) => Promise<Order | undefined>;
     insert: (order: NewOrder) => Promise<Order>;
     remove: (id: string) => Promise<boolean>;
   }

   interface Database {
     close: () => Promise<void>;
     dialect: DatabaseDialect;
     orders: OrdersRepository;
     users: UsersRepository;
     workerJobs: WorkerJobsRepository;
   }
   ```

4. **Table wiring** in `src/postgres/tables.ts` (type-checked against `Tables`):

   ```ts
   import { orders, users, workerJobs } from './schema';

   const createPostgresTables = (db: AnyPostgresDatabase): Tables => {
     const crud = createPostgresCrud(db);
     return { orders: crud(orders), users: crud(users), workerJobs: crud(workerJobs) };
   };
   ```

5. **Repository methods** in `src/repositories/create.ts` (shared by both dialects; `stamped`
   fills `createdAt`/`updatedAt`):

   ```ts
   const createRepositories = ({
     close,
     dialect,
     tables: { orders, users, workerJobs },
     workerJobQueue,
   }: RepositoriesOptions): Database => ({
     close,
     dialect,
     orders: {
       findById: async (id) => await orders.findBy('id', id),
       insert: async (order) => await orders.insert(stamped(order)),
       remove: async (id) => await orders.remove('id', id),
     },
     users: { … },
     workerJobs: { … },
   });
   ```

6. **Validation schema** (only if apps validate rows) in `src/schemas.ts`; reaches apps as
   `schemas.order`:

   ```ts
   const order = createSelectSchema(orders);

   export { order, user, workerJob };
   ```

7. **Generate** the D1 side and both migrations; it fails with the reason on anything it cannot
   render for D1:

   ```sh
   vp run db:generate add_orders
   ```

   ```text
   src/d1/schema.ts updated from src/postgres/schema.ts
   src/d1/crud.ts already in sync with src/postgres/crud.ts
   src/d1/tables.ts updated from src/postgres/tables.ts
   src/d1/worker-jobs.ts already in sync with src/postgres/worker-jobs.ts
   [✓] Your SQL migration ➜ migrations/postgres/<timestamp>_add_orders/migration.sql 🚀
   [✓] Your SQL migration ➜ migrations/d1/<timestamp>_add_orders/migration.sql 🚀
   ```

   What it writes for you (do not edit): the D1 table, with SQLite storage types and columns
   in alphabetical order (`sort-keys`)…

   ```ts
   // src/d1/schema.ts
   const orders = sqliteTable('orders', {
     createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(now),
     id: text('id').primaryKey().$defaultFn(newId),
     totalCents: integer('total_cents').notNull(),
     updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
       .notNull()
       .$defaultFn(now)
       .$onUpdateFn(now),
     userId: text('user_id')
       .notNull()
       .references(() => users.id),
   });
   ```

   …the D1 wiring (`src/d1/tables.ts`, `createD1Tables` with `orders: crud(orders)`), and one
   migration per dialect:

   ```sql
   -- migrations/postgres/<timestamp>_add_orders/migration.sql
   CREATE TABLE "orders" (
   	"id" uuid PRIMARY KEY,
   	"total_cents" integer NOT NULL,
   	"user_id" uuid NOT NULL,
   	"created_at" timestamp with time zone NOT NULL,
   	"updated_at" timestamp with time zone NOT NULL
   );
   ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");

   -- migrations/d1/<timestamp>_add_orders/migration.sql
   CREATE TABLE `orders` (
   	`created_at` integer NOT NULL,
   	`id` text PRIMARY KEY,
   	`total_cents` integer NOT NULL,
   	`updated_at` integer NOT NULL,
   	`user_id` text NOT NULL,
   	CONSTRAINT `fk_orders_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
   );
   ```

8. **Test** in `tests/shared/database-contract.ts`; the same test runs on Postgres (PGlite in
   unit tests, a throwaway database in integration) and on a local D1:

   ```ts
   targetTest('stores an order for a user', async (target) => {
     const user = await target.database.users.insert(newUser());
     const order = await target.database.orders.insert({ totalCents: 1250, userId: user.id });

     expect(order.userId).toBe(user.id);
     await expect(target.database.orders.findById(order.id)).resolves.toStrictEqual(order);
     await expect(target.database.orders.remove(order.id)).resolves.toBe(true);
   });
   ```

   Then `vp run ready`. Drift tests fail if step 7 was skipped or a generated file was edited.

9. **Apply** the migrations (CI applies them on deploy when `DATABASE_MIGRATION_ENABLED` is
   `true`):

   ```sh
   vp run build
   DATABASE_DIALECT=postgres vp run db:migrate
   DATABASE_DIALECT=d1 vp run db:migrate
   ```

Apps then use it through the same entry point as every table, on either dialect:

```ts
import { db } from '@lightproject/datastore';

const database = await db.createDatabase(env);
const order = await database.orders.insert({ totalCents: 1250, userId: user.id });
```

A schema-only change to an existing table needs steps 1, 7, 8 and 9 (plus 3/5 if its repository
methods change).

## Background Workers (`templates/tasks`)

- **Model**: each job function (`defineFunction` in `src/functions/`, registered in
  `functions/index.ts`) gets `concurrency` workers (`TASKS_CONCURRENCY=name=n,…` overrides,
  validated in the env schema at startup; names no registered function has fail the Node start
  and the Worker's module load via `config.assertKnownFunctions(functions)`). A
  worker loops claim → run → record. While the queue stays empty it backs off, on both runtimes:
  `WORKER_POLL_INTERVAL_MS` (1 s), doubling up to `WORKER_IDLE_POLL_MAX_MS` (30 s), back to
  immediate as soon as it finds work (`nextIdleDelay`); a job enqueued to an idle worker can
  therefore wait up to `WORKER_IDLE_POLL_MAX_MS`. A failing poll (store unreachable) backs off the
  same way instead of retrying every interval, and never polls faster than
  `WORKER_POLL_INTERVAL_MS` (even if the maximum is set lower). Every timer setting (lease, poll,
  idle maximum, purge interval, a function's `timeoutMs`) is capped at 2^31-1 ms, beyond which
  Node fires timers after 1 ms.
- **No models, SQL or migrations in the app.** A job is `types.WorkerJob` (the `worker_jobs` row
  owned by `templates/datastore`). `JobStore` (`src/core/store.ts`) mirrors `db.workerJobs`
  (enqueue/claim/heartbeat/complete/fail/release/purge + `findById`); production passes no `now`
  (database clock; the memory store uses its own), unit tests inject one (`storeClock`). `JOB_STORE=memory|database`: `memory` (dev/unit tests; same semantics,
  pinned by `tests/unit/helpers/job-store-contract.ts`, which also runs on the database store over a
  local D1) or `database` (`db.createDatabase(env)`, dialect from `DATABASE_DIALECT`).
- **Delivery is at-least-once**: a job can run again after a crash or a lost lease, so handlers
  must be idempotent (`context.idempotencyKey` = job id). Retries use `exponentialBackoff` up to
  `maxAttempts`; a handler failure or timeout (`timeoutMs` → `context.signal`) counts as an
  attempt. `UnrecoverableJobError` (thrown by the handler, or for a payload that fails its schema)
  marks the job `dead` at once, without retries. Once an attempt is aborted (timeout or lost lease)
  it counts as aborted even if the handler then returns normally: a handler that returns early on
  `signal` cannot be told apart from one that finished, so the retry (made safe by idempotency)
  is preferred over silently dropping work. Telemetry setup never blocks processing: a failure is
  logged once and that process/isolate runs with context propagation only (no export, but trace
  ids and child spans still work), through `createTelemetryStarter` in `@lightproject/common/server`,
  which `backend`, `tasks` and `scheduler` all use (`initializeTelemetry` in
  `packages/common` marks itself initialized before the steps that can fail, so it cannot be
  retried in place; its steps only build exporters and providers, so a failure is a configuration
  error, and export failures are retried by the SDK itself). Recording the outcome
  (`complete`/`fail`) is retried 3 times (250/500 ms apart, `withRetry` from
  `@lightproject/common/utils`); if the store is still unreachable the lease expires and the
  reclaim counts as an attempt, so an outage at the final attempt can leave a finished job `dead`.
  Heartbeats renew the lease every `leaseMs / 4`, one at a time (a tick is skipped while one is in
  flight), timed on the worker's own clock from when it sent the claim (never compared with a
  database timestamp); a renewal only ever extends it. Each tick
  first checks the clock and aborts the attempt (as for a lost lease, and stops heartbeating) once
  the lease left would no longer cover one more interval plus the abort grace (5 s) and a margin
  (1 s) — so a stuck handler is terminated (Node) or overtaken (edge) before the lease ends, and
  no other worker runs the job alongside. The three numbers live in `src/core/timing.ts`
  (`abortGraceMs`, `abortMarginMs`, `minLeaseMs`); `WORKER_LEASE_MS` must be at least
  `minLeaseMs` (30 s, the default), which `timing.test.ts` checks still leaves two heartbeats
  between a renewal and the abort, so one failed heartbeat is ridden out.
  No cancel API: a handler that finds its job no longer applies calls `context.skip(reason)`
  (stored as `succeeded`, counted/logged as `skipped`).
- **Shutdown (Node)**: SIGTERM/SIGINT stop claiming; in-flight jobs get `WORKER_SHUTDOWN_GRACE_MS`
  (15 s) to finish, then are aborted and released (back to `pending`, attempt not charged) so
  another worker picks them up at once. The worst case is grace + 5 s abort grace + up to 5 s
  for each thread to flush its telemetry + closing the store (idle by then) + up to 3 s for the
  main process to flush its telemetry (`telemetryFlushMs`; an unreachable collector would
  otherwise hold it for the OTel exporters' 30 s), about 28 s by default
  (`timing.test.ts` checks it stays under 29 s), so keep the
  orchestrator's stop timeout above that (Kubernetes' default 30 s fits; `docker stop` needs
  `-t 30` / compose `stop_grace_period: 30s`). Repeated shutdown requests (e.g. several workers'
  thread-start failures) start one graceful stop; only a second signal exits at once. The edge needs none: alarms are bounded.
- **Thread start failures (Node)**: a thread posts `ready` once it serves. Dying before that
  releases the job (`JobNotStartedError`, attempt not charged); 3 consecutive start failures shut
  the process down with exit code 1, so the orchestrator restarts it and alerts, instead of every
  job burning its attempts in a process that looks healthy.
- **Accepted trade-offs** (reviewed and kept on purpose): the package root exports `schemas`
  eagerly (the Postgres table objects are in every bundle anyway, because `createDatabase` supports
  the Postgres dialect on the edge too; laziness would only save two zod schema builds and change
  the API); the D1 query modules are generated by renaming identifiers (the design chosen over a
  dialect-generic module, which Drizzle's types only allow with `any`; anything unmapped fails
  `db:generate`); each edge alarm opens and closes its own
  store (Hyperdrive pools connections, and per-invocation connect is Cloudflare's pattern); an
  outcome write that committed but whose reply was lost is retried, matches no row and is counted
  as `lease-lost` (the stored status is right, only that metric label is off); `crud.remove`
  counts rows with `Array.isArray` (native narrowing of the untyped generic `returning()` result,
  which CLAUDE.md allows; awaiting `returning()` directly is typed `unknown` on Postgres and an
  error type on D1); a claim costs a second, cheap query when no lease has expired (the expired
  check reads at most one row of the small running index; one `UNION` statement cannot carry
  Postgres's `FOR UPDATE SKIP LOCKED` per branch without derived tables, which the generated D1
  copy would also have to express); the deploy's smoke test skips `tasks` explicitly (it has no
  HTTP endpoint; the `case` fallback would only add a warning to every deploy); the edge purge
  runs only on the tick that crosses an interval boundary, so a dropped tick skips one interval
  (the next sweep removes everything past retention, capped per sweep); `db:generate` runs one
  `vp check --fix` per generated file (dev-only, and it keeps each error tied to its file).
  A success reply that races an abort is still reported as aborted (see "Delivery" above), and
  failing polls share the idle backoff, so right after an outage a job can wait up to
  `WORKER_IDLE_POLL_MAX_MS` — the same bound as an idle worker.
  A worker thread that is terminated after ignoring an abort loses its unexported telemetry (a
  stuck thread cannot flush), and its replacement starts a new metrics stream.
  `WorkerLoop.fetch` stores its slot only when none is stored (a Durable Object's name fixes its
  slot), so the minutely watchdog costs no storage writes.
- **Runtimes** (thin adapters in `src/runtimes/`, like the backend):
  - `node.ts` (entry `src/index.ts`; local `vp run dev`, and the published container image
    `node dist/index.mjs`): one worker thread per worker (`worker_threads`), so a CPU-bound or
    crashing job only affects its own thread; on timeout the thread gets a grace period, then is
    terminated and replaced; the attempt is reported aborted only after the handler settled or the
    thread was terminated, so a retry never overlaps it (a thread whose own grace ran out replies
    `handlerRunning: true`, and the main thread then terminates it rather than reuse it; a thread
    that exits during the grace settles the abort at once). Each thread keeps `error`/`exit` listeners for its whole life, so an
    error thrown while it is idle retires it instead of crashing the process. Jobs cross into threads validated by `schemas.workerJob`. Under `tsx`
    a thread registers tsx itself (Node 24 doesn't pass tsx's loader to threads).
  - `edge.ts` (the `wrangler.toml` entry) + `worker-loop.ts`: one `WorkerLoop` Durable Object per
    worker (`<function>#<n>`) runs continuously on alarms — each alarm drains for up to 30 s, then
    re-arms immediately (budget spent), after the poll interval (jobs ran), or after the backoff
    above (idle or failing). It flushes telemetry only when jobs ran or something failed. The
    `* * * * *` cron is only a watchdog: it (re)starts every loop (a no-op for running ones), and
    on the first tick of each `JOB_PURGE_INTERVAL_MS` (`isPurgeDue` on the tick's
    `scheduledTime`; no state) sweeps finished jobs. Loops for removed functions or above the current concurrency
    clear their state and stop. `edge.ts` is the Worker entry, so it exports only the default
    handler and `WorkerLoop` (re-exported from `worker-loop.ts`, which holds the loop helpers):
    workerd refuses to start on any other export ("Incorrect type for map entry"), which no
    type-check catches. Handlers run in-process and cannot be killed: on timeout the loop
    waits up to 5 s for the handler to settle before claiming the next job, then logs and moves on
    (a handler that ignores `context.signal` can overlap the next one). No `nodejs_compat`: D1 and Postgres (plain `DATASTORE_POSTGRES_URL`) both ran
    in local workerd without it; Postgres through a deployed Hyperdrive is not yet verified.
- **Shared database**: the edge binds the same D1 as `templates/datastore` (local and per-env ids);
  a deployed env may use a remote Postgres instead (`DATABASE_DIALECT=postgres` + a `HYPERDRIVE`
  binding, or a `DATASTORE_POSTGRES_URL` secret). `wrangler.toml` is the Worker's source of truth (it holds
  the bindings that dialect needs); when the GitHub `DATABASE_DIALECT` variable (the migration's
  dialect) is set, the workers deploy fails unless `[env.<env>.vars]` names the same dialect, so a
  mismatch is a loud deploy error instead of a Worker reading an unmigrated database. (Forwarding
  the variable instead was rejected: a Worker switched to Postgres without a `HYPERDRIVE` binding
  or `DATASTORE_POSTGRES_URL` cannot connect.) Locally `wrangler dev` loads `.env`, whose values override
  `[vars]`, so local Cloudflare dev follows `.env`'s `DATABASE_DIALECT` (decision 2026-10-20).
- **Retention**: `purgeFinished` deletes succeeded jobs after `JOB_RETENTION_SUCCEEDED_MS` (7 d,
  the dedupe window for completed work) and dead ones after `JOB_RETENTION_DEAD_MS` (30 d), oldest first, in
  batches of `JOB_PURGE_BATCH_SIZE` (500), at most `JOB_PURGE_MAX_BATCHES` (20) per status per
  sweep; a sweep stops at the first short batch. Node sweeps on start and every
  `JOB_PURGE_INTERVAL_MS` (1 h, so ≤ 10k per status per hour by default); the edge cron sweeps on
  the first tick of each such interval, with the same settings. Raise the cap if more finish than that (verified live: the cap
  holds, the next sweep continues, recent jobs stay).
- **Enqueue API**: `@lightproject/tasks` exports `createJobClient(store).enqueue(fn, payload,
  { delayMs | runAt, dedupeKey, maxAttempts })` (`delayMs` and `runAt` are mutually exclusive
  in the type); payloads are validated by the function's schema
  and JSON round-tripped exactly as the database stores them, then re-parsed, so a schema the stored
  JSON no longer satisfies (`z.date()`, `.transform()`) fails at enqueue, not on every attempt.
- **Telemetry**: span `job.run`, counter `jobs_processed`, histogram `job_duration` (by function and
  outcome) from the main thread / Durable Object; the instruments are created on first use (a meter
  taken before `initializeTelemetry()` stays a no-op). The runner injects `job.run` into a W3C
  carrier passed to the executor (and, on Node, in the thread's `run` message); the handler runs
  under a child span `job.handler`, ended when the handler settles. Each Node worker thread starts
  its own SDK (own `service.instance.id`, one writer per stream) and flushes it on `close()`
  (`shutdown` message; terminated after the grace period). The context manager is
  `StackContextManager` (no `AsyncLocalStorage`, so it drops context at `await`), so handlers get
  span-bound helpers: `context.logger` (each call written under `job.handler`) and
  `context.withTrace(fn)` (a call started synchronously in `fn`, e.g. `fetch`, becomes a child).
  Verified live: Loki handler logs carry the trace id; Tempo shows `job.handler` under `job.run`
  across instances (Node and edge).
- **CI/CD**: verified on PRs like `datastore`; deployed after `datastore` (needs its migrations):
  `dagger publish` (Node image) + `dagger wrangler` (Worker, `OTLP_ENDPOINT` as a worker var). No
  smoke test: the Worker has no HTTP endpoint.

### Adding a job function

Every edit is in `templates/tasks`; both runtimes pick the function up from the registry, so neither
`runtimes/` nor `wrangler.toml` changes. Example: `send-welcome-email` (this exact code was
written, linted, tested and run on Node before being documented).

1. **Define it** in `src/functions/send-welcome-email.ts` with `defineFunction`. Only `name`,
   `schema` and `handler` are required; the rest default to `concurrency: 1`, `maxAttempts: 5`,
   `timeoutMs: 60_000` and `exponentialBackoff()` (1 s doubling to 5 min, with jitter).

   ```ts
   import { z } from 'zod';

   import { defineFunction, exponentialBackoff } from '../core/function';

   const sendWelcomeEmail = defineFunction({
     backoff: exponentialBackoff({ baseMs: 5000, maxMs: 600_000 }),
     concurrency: 2,
     handler: async ({ email, userId }, { idempotencyKey, logger, signal, skip, withTrace }) => {
       if (email.endsWith('@example.invalid')) {
         skip('test address');
         return;
       }
       const response = await withTrace(async () =>
         globalThis.fetch('https://email.example.com/send', {
           body: JSON.stringify({ template: 'welcome', to: email }),
           headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
           method: 'POST',
           signal,
         }),
       );
       if (!response.ok) {
         throw new Error(`Email API answered ${response.status}`);
       }
       logger.info('Welcome email sent', { userId });
     },
     maxAttempts: 8,
     name: 'send-welcome-email',
     schema: z.object({ email: z.email(), userId: z.uuid() }),
     timeoutMs: 30_000,
   });

   export { sendWelcomeEmail };
   ```

   What the handler gets, and the rules it follows:
   - **Idempotent**: delivery is at-least-once (a crash or a lost lease reruns the job). Pass
     `idempotencyKey` (the job id, stable across retries) to anything with side effects.
   - **`signal`**: aborted on timeout or a lost lease; pass it to `fetch` and other cancellable
     work. A handler that ignores it is terminated (Node) or overlapped (edge) after a 5 s grace.
   - **Throw to retry** (with `backoff`, up to `maxAttempts`, then `dead`); throw
     **`UnrecoverableJobError`** (from `@lightproject/tasks`) for a failure retrying cannot fix
     (e.g. an HTTP 4xx) to mark the job `dead` at once; **`skip(reason)`** to finish without
     retrying when the job no longer applies.
   - **`logger`** writes under the job's `job.handler` span; **`withTrace(fn)`** makes a call
     started in `fn` (e.g. `fetch`) a child span. Use `fetch`, never `XMLHttpRequest`.
   - The payload is validated by `schema` at enqueue and again before every attempt (a payload
     that no longer matches marks the job `dead`); it must survive JSON (no `z.date()` or
     `.transform()`).

2. **Register it** in `src/functions/index.ts` (names must be unique):

   ```ts
   import { ping } from './ping';
   import { sendWelcomeEmail } from './send-welcome-email';

   const functions: readonly JobFunction[] = [ping, sendWelcomeEmail];
   export { ping } from './ping';
   export { sendWelcomeEmail } from './send-welcome-email';
   ```

3. **Export it to other apps** (only if they enqueue it) in `src/client.ts`:

   ```ts
   export { functions, ping, sendWelcomeEmail } from './functions';
   ```

4. **Test** in `tests/unit/functions/send-welcome-email.test.ts`, calling `execute` with a job from
   the in-memory store (`tests/unit/helpers/jobs.ts`):

   ```ts
   const run = async (payload: { email: string; userId: string }) => {
     const { client } = setup();
     const job = await client.enqueue(sendWelcomeEmail, payload);
     const skip = vi.fn<(reason: string) => void>();
     await sendWelcomeEmail.execute(job.payload, {
       attempt: 1,
       idempotencyKey: job.id,
       job,
       logger,
       signal: new globalThis.AbortController().signal,
       skip,
       withTrace: <R>(fn: () => R) => fn(),
     });
     return { job, skip };
   };

   test('sends once per job, keyed by the job id', async () => {
     const fetch = vi
       .spyOn(globalThis, 'fetch')
       .mockResolvedValue(new globalThis.Response(null, { status: 202 }));

     const { job } = await run(user);

     expect(fetch).toHaveBeenCalledOnce();
     const [url, init] = fetch.mock.calls[0] ?? [];
     expect(url).toBe('https://email.example.com/send');
     expect(new globalThis.Headers(init?.headers).get('Idempotency-Key')).toBe(job.id);
   });

   test('fails the attempt (so it is retried) when the API errors', async () => {
     vi.spyOn(globalThis, 'fetch').mockResolvedValue(
       new globalThis.Response(null, { status: 503 }),
     );

     await expect(run(user)).rejects.toThrow('Email API answered 503');
   });
   ```

   Then `vp run ready`.

5. **Concurrency per environment** (optional): `TASKS_CONCURRENCY` overrides the function's
   `concurrency`, e.g. `TASKS_CONCURRENCY="ping=2,send-welcome-email=4"` in `.env`, the
   container's env, or a deployed Worker's vars. A name that matches no registered function stops
   both runtimes at startup.

6. **Enqueue it** from another app (add `"@lightproject/tasks": "workspace:*"` to its
   `dependencies`); `dedupeKey` returns the existing job while it is pending, running or succeeded
   (until retention purges it), and revives a `dead` one with the new payload:

   ```ts
   import { createJobClient, createJobStore, sendWelcomeEmail } from '@lightproject/tasks';

   const store = await createJobStore('database', env);
   const jobs = createJobClient(store);
   await jobs.enqueue(
     sendWelcomeEmail,
     { email: user.email, userId: user.id },
     { dedupeKey: `welcome:${user.id}`, delayMs: 60_000 },
   );
   ```

   Or from the CLI (Postgres, with the mise env loaded):

   ```sh
   vp run enqueue send-welcome-email '{"email":"ada@example.com","userId":"<uuid>"}'
   ```

7. **Run it**: nothing to wire. Node (`vp run dev`) starts `concurrency` worker threads for it; on
   Cloudflare the next cron tick starts one `WorkerLoop` per slot (`send-welcome-email#1`, `#2`),
   and loops above a lowered concurrency stop on their own.

## Scheduled Scripts (`templates/scheduler`)

- **Model**: a script (`defineScript` in `src/scripts/`, registered in `scripts/index.ts`) has a
  kebab-case `name` (a CLI argument and a URL path), an `input` zod schema (`noInput` for none), an
  optional 5-field cron `schedule` and a `timeoutMs` (default 10 min, at most 24 h; it covers the
  whole run, from opening the database and taking the lock, which are abandoned on a stop or the
  timeout and cleaned up if they finish late: a late database is closed, a late lock released,
  and the run waits up to the abort grace plus the 5 s release timeout for that cleanup before
  closing its database; an abandoned acquire that comes back `false` needs no release). Definitions
  fail at module load on a bad name, timeout or schedule, a duplicate name, or a scheduled script
  whose schema rejects `{}` (scheduled runs pass `{}`). `run(input, context)` gets `context.db`
  (the `templates/datastore` repositories, opened for the run and closed after it), `logger`
  (bound to the run's `script.run` span), `signal` (timeout or stop), `trigger`
  (`schedule`/`manual`), `scheduledTime` and `withTrace(fn)`.
- **Portable cron subset** (`src/core/schedule.ts`): the same expression must mean the same on
  Cloudflare Cron Triggers and Kubernetes CronJobs (both UTC here), so it takes exactly 5 fields
  of `*`, numbers, ranges, lists and `/step`; day of week only as names (`MON-FRI`: Kubernetes
  counts 0–6 from Sunday, Cloudflare 1–7), and not both day of month and day of week restricted;
  no `@daily`, `L`, `W`, `#` or `?`.
- **Runtimes** (decision 2026-10-26): **Node** is one-shot — `node dist/index.mjs <script>
  [--input '<json>'] | <script> --scheduled | --list`, exit `0` succeeded, `1` failed/timed
  out/stopped, `2` usage/unknown script/invalid input, `3` skipped (lock held), `4` lock lost (renewals failed or taken over); the schedule lives
  in the orchestrator (one CronJob per scheduled script, `--scheduled`). SIGTERM aborts the run and
  gives it 5 s; a second signal exits at once. **Cloudflare**: `[triggers] crons` in
  `wrangler.toml` (inherited by every `[env.*]`; `wrangler-crons.test.ts` requires it to equal the
  set of schedules in code) calls `scheduled`, which runs every script whose `schedule` is
  `controller.cron` and throws if one failed (Cloudflare records the invocation as failed; `noRetry()` first, so a retry never reruns the scripts that succeeded, the same as `backoffLimit: 0` on Kubernetes);
  one-off runs are `POST /run/<script>` with `Authorization: Bearer <SCHEDULER_RUN_TOKEN>` (a
  wrangler secret, 32+ characters; unset → 404, shorter → 503 and an error log; compared as SHA-256
  digests), body = JSON input or empty for `{}`. The request awaits the run, which is also handed to
  `waitUntil` (see "Cloudflare limits": a client disconnect aborts it, and the cleanup and
  telemetry flush run inside `waitUntil`'s 30 s), and answers `{ script, outcome, durationMs }`
  with 200/400/409/500/503/504 (503 for `aborted` and `lock-lost`); error details are logged, not returned, except for invalid input;
  a too-short token is logged once per isolate. The Worker entry
  exports only the default handler (module-level code may run, e.g. the cron-cap warnings). The token comes from the handler's `env` argument, not
  `src/env.ts`, so it is never read on Node.
- **No overlap** (decision 2026-10-26, user request): a run takes the script's lock before it
  starts — `db.scriptLocks.acquire({ name, owner, leaseMs })` on the `script_locks` table, one
  `INSERT … ON CONFLICT (name) DO UPDATE … WHERE expires_at <= <db now>`, so only a free or expired
  lock is taken, atomically on both dialects, on the database clock — and releases it after
  (`release` deletes only its own row). A run that finds the lock held does not run: outcome
  `skipped` (cron: a warning; HTTP 409; Node exit 3). This covers every trigger and instance that
  shares the database (Cloudflare invocations, CronJob pods, `docker run`, Node and Worker side by
  side). The lease is short (60 s, `defaultLease`) and renewed every 15 s while the script runs
  (`db.scriptLocks.renew`, owner-checked, on the database clock) by the same
  `startLeaseHeartbeat` (`@lightproject/common/utils`) that renews `tasks`' job leases: a run
  killed from outside (OOM, `SIGKILL`, Cloudflare CPU limit) frees the lock within one lease,
  whatever its `timeoutMs`. Each heartbeat tick first checks the clock (timed from when the
  acquire or renewal was sent) and aborts the run once the lease left could no longer cover one
  more interval plus the 5 s abort grace and a 5 s margin (25 s), so one failed renewal is ridden
  out (the next one, 15 s later, still has time) and a run whose renewals fail twice is aborted at 45 s
  (15 s before its lease could lapse) and has stopped by 50 s at the latest (after the 5 s grace); a renewal that finds another owner (`false`) aborts the run at
  once. Either way the outcome is `lock-lost` (Node exit 4, HTTP 503), whatever the script did
  after (as `tasks` reports `lease-lost`), so lock or database trouble is told apart from a routine
  stop or a script failure; the lock is still released (owner-checked, a no-op once taken over; every release makes up to
  3 attempts (2 retries, 250/500 ms apart, `withRetry`), and given up after its own 5 s timeout (`releaseLock`; not the abort
  grace), so a stalled connection cannot hold the run; a retry that finds nothing to delete counts
  as unknown, not lost, since an earlier attempt may have deleted it before its reply was lost; an
  acquire that throws is followed by a release too, in case it committed; an unreleased lock frees
  itself when its lease ends). A
  release that finds the lock gone also means `lock-lost`, with an error log: the heartbeat shares
  the event loop with the script on both runtimes, so a script that blocks it for ~20 s or more
  (synchronous work, e.g. a huge `JSON.parse` loop) cannot renew and may have overlapped with
  another run (the heartbeat times the lease from the last confirmed renewal, and an overdue
  tick runs before the pending renewal's reply is handled, so ~20 s is the worst case); scripts must
  yield (`await`) at least every ~15 s (running them in worker threads,
  as `tasks` does, would lift this). `runScript` refuses (`failed`) a lease too short for its
  renewal interval and abort grace (`checkLease`). An acquisition that took longer than one renewal interval (a cold or stalled database) is
  followed by an immediate renewal, so the heartbeat times the lease from that renewal instead of
  giving a healthy run up. A release it cannot confirm is logged with every attempt's error and
  whether it timed out. `runner.test.ts` pins these margins; a renewal that settles after the
  heartbeat stopped is ignored. A script that ignores its abort past the 5 s grace keeps the lock
  until its lease ends (it may still be running, so the runner neither releases the lock nor
  closes its database); if it had lost the lock, the runner logs an error instead, since another
  run may now overlap with it. Verified live on Postgres: a 70 s
  run still blocked a second run at 65 s; a `SIGKILL`ed run freed its lock after the lease. A stop
  that arrives before the script starts (during the database open or the lock) means it never
  starts; it is reported `aborted` (Node exit 1, HTTP 503), not `skipped`. Lock names are `<package name>/<script>`, so two apps on one
  database never block each other. Invalid input is rejected before the database is opened.
- **Cloudflare limits**: a scheduled invocation has a 15 min wall-clock limit (Cloudflare's
  limits page; HTTP invocations have none while the client stays connected). On the Worker, cron
  runs are capped at `cronMaxRunMs` (14 min, `src/core/cloudflare.ts`) through `runScript`'s
  `maxRunMs`, so the runner aborts the run and releases its lock before Cloudflare kills the
  invocation (a killed one would hold it until the lease ends); the Worker logs a warning at startup for
  every scheduled script whose `timeoutMs` the cap shortens (Node keeps the full `timeoutMs`). CPU
  limits are separate (Paid: 30 s for crons under an hour, 15 min for longer intervals, 5 min max
  for HTTP via `limits.cpu_ms`); CPU-heavy or long scripts belong on Node. A one-off over HTTP
  runs with `request.signal` as its stop signal (`compatibility_flags = ["enable_request_signal"]`,
  inherited by every `[env.*]`; Cloudflare aborts it when the client disconnects) and is passed to
  `ctx.waitUntil`, so a disconnect aborts the run, which then settles within the 5 s grace and
  releases its lock inside the 30 s `waitUntil` allows (`edge.test.ts` drives this through the real
  handler). Local `wrangler dev` does not forward a client disconnect (its proxy keeps the request
  open), so there the run finishes normally; verified only through the test, not yet on a deployed
  Worker.
- **Telemetry**: span `script.run` (`script.name`, `script.trigger`, `script.outcome`), counter
  `script_runs` and histogram `script_duration` (by `script`, `trigger`, `outcome`). On Workers
  `durationMs` is coarse (the clock only advances on I/O).
- **CI/CD**: verified on PRs like `tasks`; deployed after `datastore` (needs its migrations):
  `dagger publish` (Node image, default command `node dist/index.mjs`, so a CronJob passes the
  whole command) + `dagger wrangler` (Worker with the crons, `OTLP_ENDPOINT` as a worker var); the
  same `DATABASE_DIALECT` deploy check as `tasks`. No smoke test (nothing is served without a
  token).

### Adding a script

Every edit is in `templates/scheduler`; both runtimes pick the script up from the registry, so
`runtimes/` never changes. Example: `check-admin`, hourly and also runnable on demand (this
exact code was written, linted, tested and run on Node against Postgres and on the local Worker
against D1 before being documented; the outputs below are from those runs).

1. **Define it** in `src/scripts/check-admin.ts` with `defineScript`. `input`, `name` and `run`
   are required; `schedule` is optional (leave it out for a one-off-only script) and `timeoutMs`
   defaults to 10 min (at most 24 h). A scheduled script's schema must accept `{}` (that is what a
   cron passes), hence the `.default(…)`:

   ```ts
   import { z } from 'zod';

   import { defineScript } from '../core/script';

   const checkAdmin = defineScript({
     input: z.object({ email: z.email().default('admin@example.com') }),
     name: 'check-admin',
     run: async ({ email }, { db, logger, signal }) => {
       signal.throwIfAborted();
       const admin = await db.users.findByEmail(email);
       if (admin === undefined) {
         logger.warn(`check-admin: no user ${email}`);
         return;
       }
       logger.info(`check-admin: ${email} is ${admin.name}`, { userId: admin.id });
     },
     schedule: '0 * * * *',
     timeoutMs: 60_000,
   });

   export { checkAdmin };
   ```

   `context.db` is opened for the run and closed after it; `context.signal` fires on the timeout
   or SIGTERM (5 s grace, then the run is reported `timed-out`/`aborted`). A run that dies keeps
   the script's lock only until its lease ends (at most 60 s), and the next trigger starts over,
   so make the work safe to repeat. Keep the event loop free: the lock is renewed on the same
   thread, so `await` at least every ~15 s during long synchronous work (otherwise the run ends
   as `lock-lost`).

2. **Register it** in `src/scripts/index.ts` (duplicate names fail at module load):

   ```ts
   import { registerScripts } from '../core/script';
   import { checkAdmin } from './check-admin';
   import { ping } from './ping';

   const scripts = registerScripts([ping, checkAdmin]);
   export { checkAdmin } from './check-admin';
   export { ping } from './ping';

   export { scripts };
   ```

3. **Schedule it on Cloudflare**: add its cron to `[triggers]` in `wrangler.toml` (one entry per
   distinct schedule; scripts that share a cron run together; every `[env.*]` inherits it):

   ```toml
   [triggers]
   crons = ["*/5 * * * *", "0 * * * *"]
   ```

   Until code and `wrangler.toml` agree, `vp test` fails in `wrangler-crons.test.ts` ("(top level)
   fires exactly the schedules the scripts declare"). A one-off-only script needs no entry.

4. **Test it** in `tests/unit/scripts/check-admin.test.ts`. `useLocalDatabase()` starts a
   throwaway, migrated local D1 for the file; `context(database, overrides)` builds a
   `ScriptContext` around it:

   ```ts
   import { logger } from '@lightproject/common/logger';
   import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

   import { checkAdmin, scripts } from '../../../src/scripts';
   import { useLocalDatabase } from '../helpers/database';
   import { context, runDirectly } from '../helpers/scripts';

   const { openDatabase } = useLocalDatabase();

   afterEach(() => {
     vi.restoreAllMocks();
   });

   describe('check-admin', () => {
     test('is registered hourly', () => {
       expect(scripts).toContain(checkAdmin);
       expect(checkAdmin.schedule).toBe('0 * * * *');
     });

     test('finds the admin by email', async () => {
       const database = await openDatabase();
       const admin = await database.users.insert({ email: 'ada@example.com', name: 'Ada' });
       const info = vi.spyOn(logger, 'info');

       await runDirectly(checkAdmin, { email: 'ada@example.com' }, context(database));

       expect(info).toHaveBeenCalledWith('check-admin: ada@example.com is Ada', {
         userId: admin.id,
       });
     });

     test('warns when the admin is missing (the scheduled default)', async () => {
       const warn = vi.spyOn(logger, 'warn');

       await runDirectly(checkAdmin, {}, context(await openDatabase(), { trigger: 'schedule' }));

       expect(warn).toHaveBeenCalledWith('check-admin: no user admin@example.com');
     });
   });
   ```

   ```sh
   vp check --fix . && vp test   # build templates/datastore first (Vitest loads its dist/)
   ```

5. **Run it on Node** (needs the migrated database; `vp run start …` is the same from `dist/`):

   ```sh
   vp run script --list
   vp run script check-admin --input '{"email":"ada@example.com"}'
   vp run script check-admin --scheduled
   vp run script check-admin --input '{"email":"nope"}'; echo $?
   ```

   ```text
   ping         */5 * * * *
   check-admin  0 * * * *
   INFO : check-admin: ada@example.com is Ada
   INFO : Script check-admin succeeded
   WARN : check-admin: no user admin@example.com
   INFO : Script check-admin succeeded
   ERROR: Script check-admin invalid-input   ("✖ Invalid email address → at email"), exit 2
   ```

6. **Run it on the local Worker**:

   ```sh
   vp run wrangler:dev --var DATABASE_DIALECT:d1 --var SCHEDULER_RUN_TOKEN:abcdefghijklmnopqrstuvwxyz0123456789
   # another terminal
   curl "http://localhost:2003/__scheduled?cron=0+*+*+*+*"
   curl -X POST -H "Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789" \
     -d '{"email":"ada@example.com"}' http://localhost:2003/run/check-admin
   ```

   ```text
   WARN : check-admin: no user admin@example.com      (the cron, default input)
   INFO : Script check-admin succeeded
   {"durationMs":4,"outcome":"succeeded","script":"check-admin"}   (200)
   ```

7. **Schedule it on Node in production**: one CronJob per scheduled script, same cron, UTC. The
   image's `node dist/index.mjs` is a default command (no entrypoint), so give the whole command:

   ```yaml
   apiVersion: batch/v1
   kind: CronJob
   metadata:
     name: check-admin
   spec:
     schedule: '0 * * * *'
     timeZone: Etc/UTC
     concurrencyPolicy: Forbid
     jobTemplate:
       spec:
         backoffLimit: 0 # exit 3 = skipped (lock held); not worth a retry
         template:
           spec:
             restartPolicy: Never
             terminationGracePeriodSeconds: 30
             containers:
               - name: check-admin
                 image: <REGISTRY_ADDRESS>/scheduler:<tag>
                 command: ['node', 'dist/index.mjs', 'check-admin', '--scheduled']
                 env:
                   - name: DATABASE_DIALECT
                     value: postgres
                   - name: DATASTORE_POSTGRES_URL
                     valueFrom: { secretKeyRef: { name: datastore, key: url } }
   ```

   Deploying the Worker (CI's `dagger wrangler`) picks up the new cron by itself.

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
