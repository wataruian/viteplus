# @lightproject/tasks

Always-running background job workers: each job function gets N workers that claim, run and
record `worker_jobs` rows from `templates/datastore` (no models, SQL or migrations here). Runs as a
Node process (one worker thread per worker; published as a container image) or on Cloudflare as
one `WorkerLoop` Durable Object alarm loop per worker (the cron is only a watchdog). Delivery is
at-least-once, so **handlers must be idempotent** (`context.idempotencyKey`). Full reference,
including the step-by-step "Adding a job function": `.ai-data/architecture.md` → "Background
Workers".

<!-- template-only -->

This is the **template** for the future real `apps/workers`: its own env keys use the `TASKS_`
prefix (ports 2002/8232), and the `WORKERS_*` keys in `.env.example` are reserved for that app
(root README → "Templates and Reserved Names").

<!-- /template-only -->

```ts
import { createJobClient, createJobStore, ping } from '@lightproject/tasks';

const client = createJobClient(await createJobStore('database', env));
await client.enqueue(ping, { message: 'hello' }, { delayMs: 5000 });
```

Commands run from `templates/tasks` unless noted.

## Setup

1. Install, start Postgres and apply the migrations: setup in `templates/datastore/README.md`
   (the workers read the same database, so migrate it first).

2. Configure the root `.env` (copy `.env.example`): `JOB_STORE=database`, `DATABASE_DIALECT`
   and the Postgres settings. mise loads it into the shell for the Node run; `vite.config.ts`
   links it to `templates/tasks/.env` for `wrangler dev`, where its values override `[vars]` (so local
   Cloudflare dev follows `.env`'s `DATABASE_DIALECT`).

## Environment variables

Validated once at module load (`src/env.ts`); an invalid value fails the start with the list of
bad keys. On Cloudflare they come from `wrangler.toml`'s `[vars]` / `[env.<env>.vars]`.

| Variable                     | Purpose                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `JOB_STORE`                  | **Required.** `database` (shared queue) or `memory` (single process; refused on Cloudflare and by `enqueue`)                   |
| `TASKS_CONCURRENCY`          | Per-function worker counts, `name=n,…` (e.g. `ping=2`); unset uses each function's `concurrency`. Unknown names fail the start |
| `WORKER_LEASE_MS`            | Job lease; heartbeats renew it every quarter (default and minimum `30000`)                                                     |
| `WORKER_POLL_INTERVAL_MS`    | Poll interval, and the first idle backoff step (default `1000`)                                                                |
| `WORKER_IDLE_POLL_MAX_MS`    | Idle/failing poll backoff cap; the longest a new job waits on an idle worker (default `30000`)                                 |
| `WORKER_SHUTDOWN_GRACE_MS`   | Node: time in-flight jobs get on SIGTERM before they are released (default `15000`)                                            |
| `JOB_RETENTION_SUCCEEDED_MS` | Purge succeeded jobs after this (default `604800000`, 7 d)                                                                     |
| `JOB_RETENTION_DEAD_MS`      | Purge dead jobs after this (default `2592000000`, 30 d)                                                                        |
| `JOB_PURGE_INTERVAL_MS`      | Purge sweep interval (default `3600000`, 1 h)                                                                                  |
| `JOB_PURGE_BATCH_SIZE`       | Rows deleted per batch (default `500`)                                                                                         |
| `JOB_PURGE_MAX_BATCHES`      | Batches per status per sweep (default `20`)                                                                                    |
| `SKIP_OPENTELEMETRY`         | `true` skips the OTel SDK (context propagation only); `true`/`false` only (default `false`)                                    |
| `TASKS_PORT`                 | `vite.config.ts`: `wrangler dev` port (default `2002`)                                                                         |
| `TASKS_INSPECTOR_PORT`       | `vite.config.ts`: `wrangler dev` inspector port (default `8232`)                                                               |
| `TEST_SUITE`                 | `integration` switches `vp test` to `tests/integration` (set by `vp run test:integration`)                                     |

Shared variables, defined in `packages/common/README.md` and `templates/datastore/README.md`:

- `ENV` (default `local`; non-local forces JSON logs), `LOG_LEVEL`, `LOG_FORMAT`.
- `OTLP_ENDPOINT` (default `http://localhost:4318`; CI passes it as a Worker var),
  `TELEMETRY_DEBUG`.
- `DATABASE_DIALECT`, `DATASTORE_POSTGRES_URL` or the `POSTGRES_*` parts (with `JOB_STORE=database`).

Worker bindings (`wrangler.toml`, every env):

| Binding       | Purpose                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `DB`          | The shared D1 (same ids as `templates/datastore`); used when `DATABASE_DIALECT=d1`                 |
| `WORKER_LOOP` | Durable Object namespace of `WorkerLoop`, one object per worker (`<function>#<n>`)                 |
| `HYPERDRIVE`  | Optional, not bound today: Postgres through Hyperdrive for an env with `DATABASE_DIALECT=postgres` |

## Development

Add job functions in `src/functions/` and register them in `src/functions/index.ts` (both runtimes
pick them up; see "Adding a job function"). Node APIs only in `src/runtimes/node.ts`; the Worker
entry `src/runtimes/edge.ts` may export only the default handler and `WorkerLoop`.

| Task                                   | What it does                                                                             |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `vp run dev`                           | Node workers under `tsx watch` (not plain `vp dev`)                                      |
| `vp run build`                         | Builds `dist/` (`dist/index.mjs`, the client entry)                                      |
| `vp run start`                         | Runs the built `node dist/index.mjs` (what the container image runs)                     |
| `vp run enqueue <fn> '<json>' [count]` | Enqueues `count` (default 1) jobs into the `JOB_STORE=database` store (refuses `memory`) |
| `vp run wrangler:dev`                  | Local Worker on `TASKS_PORT`, D1 in `../../.wrangler/state`, `--test-scheduled`          |
| `vp run wrangler:deploy`               | `wrangler deploy` (CI uses `dagger wrangler`; see Deployment)                            |
| `vp run wrangler:delete`               | `wrangler delete`                                                                        |

### Run on Node

```sh
vp run dev
# another terminal
vp run enqueue ping '{"message":"hello"}' 3
```

Expected: the dev process logs `ping: hello` three times. `enqueue` writes through `.env`'s
`DATABASE_DIALECT` (the Postgres path by default).

### Run on Cloudflare (local)

```sh
vp run wrangler:dev
# another terminal: fire the watchdog cron, which starts every WorkerLoop
curl "http://localhost:2002/__scheduled?cron=*+*+*+*+*"
```

The loops then run on alarms until stopped; the cron also sweeps finished jobs on the first tick of
each `JOB_PURGE_INTERVAL_MS`.

## Testing

```sh
vp test                   # unit (JOB_STORE=memory); store contract also runs on a throwaway local D1
vp run test:integration   # Node worker threads (timeouts, aborts, start failures), files run serially
```

- `tests/unit/helpers/job-store-contract.ts` pins the same semantics on the memory and database
  stores.
- Coverage is 100% (runtimes and entry files excluded).

Before finishing, run `vp run ready` from the repo root. To reproduce CI:
`dagger call test-integration --workspace=@lightproject/tasks`.

### Local testing

Manual end-to-end checks against a real database. Postgres runs on the Node runtime; local D1 only
on the Cloudflare runtime (`wrangler dev`): Node has no D1 binding, so `vp run dev` and
`vp run enqueue` refuse `DATABASE_DIALECT=d1`.

**Environment**: the commands need the root `.env` in the shell (mise does this when activated).
Without mise activation, run them through `mise x -- env KEY=value … <command>`: put overrides
**after** `mise x --`, because `mise x` re-applies `.env` over variables set before it.

**Prerequisites** (once):

```sh
docker compose up -d postgres   # repo root
cd ../../templates/datastore && vp run build \
  && DATABASE_DIALECT=postgres vp run db:migrate && DATABASE_DIALECT=d1 vp run db:migrate
cd ../../templates/tasks
```

**Query helpers**:

```sh
# Postgres
pgq() { docker exec postgres psql -U lightproject -d lightproject_datastore -c "$1"; }
pgjobs() { pgq "SELECT payload->>'message' AS msg, status, attempts, left(last_error, 60) AS error, run_at FROM worker_jobs ORDER BY created_at DESC LIMIT 10;"; }

# Local D1
d1() { vp exec wrangler d1 execute DB --local --persist-to ../../.wrangler/state --command "$1"; }
d1jobs() { d1 "SELECT json_extract(payload,'\$.message') AS msg, status, attempts, substr(last_error,1,60) AS error, datetime(run_at/1000,'unixepoch') AS run_at FROM worker_jobs ORDER BY created_at DESC LIMIT 10;"; }
```

The enqueue CLI has no delay or raw-payload options, so cases that need them insert rows
directly. A row needs every column (no SQL defaults besides `attempts`).

#### Postgres (Node runtime)

| Case                  | Commands                                                                                                                                      | Expected                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| P1. Run jobs          | `DATABASE_DIALECT=postgres vp run dev`, then (2nd terminal) `DATABASE_DIALECT=postgres vp run enqueue ping '{"message":"hello"}' 3`, `pgjobs` | `Started 2 worker(s)…`, `Enqueued 3 ping job(s)`, `ping: hello` ×3, `succeeded` |
| P2. Concurrency       | `DATABASE_DIALECT=postgres TASKS_CONCURRENCY=ping=4 vp run dev`                                                                               | `Started 4 worker(s)…`; an unknown function name stops the start                |
| P3. Delayed job       | P1's `vp run dev`, then the delayed insert below                                                                                              | `pending` until `run_at`, then `ping: later`                                    |
| P4. Invalid payload   | P1's `vp run dev`, then the invalid insert below                                                                                              | `Job attempt failed` (`retryable: false`), row `dead`, `Invalid payload: …`     |
| P5. Retention purge   | `DATABASE_DIALECT=postgres JOB_RETENTION_SUCCEEDED_MS=1000 JOB_RETENTION_DEAD_MS=1000 JOB_PURGE_INTERVAL_MS=15000 vp run dev`                 | Sweeps on start and every 15 s: `Purged N succeeded and M dead job(s)`          |
| P6. Graceful shutdown | Ctrl+C in the `vp run dev` terminal                                                                                                           | `Received SIGTERM; stopping (in-flight jobs get the shutdown grace)`            |
| P7. Built output      | `vp run build && DATABASE_DIALECT=postgres vp run start`                                                                                      | Same as P1, from `dist/index.mjs`                                               |

```sh
# P3: delayed job (runs in 20 s)
pgq "INSERT INTO worker_jobs (id, function_name, payload, status, attempts, max_attempts, run_at, created_at, updated_at)
     VALUES (gen_random_uuid()::text, 'ping', '{\"message\":\"later\"}', 'pending', 0, 5, now() + interval '20 seconds', now(), now());"

# P4: invalid payload (enqueue would reject it)
pgq "INSERT INTO worker_jobs (id, function_name, payload, status, attempts, max_attempts, run_at, created_at, updated_at)
     VALUES (gen_random_uuid()::text, 'ping', '{}', 'pending', 0, 5, now(), now(), now());"

# Reset
pgq "DELETE FROM worker_jobs;"
```

Container image (what CI publishes; from the repo root):

```sh
dagger call load --workspace=@lightproject/tasks --docker-socket=/var/run/docker.sock
docker run --rm --name tasks -e JOB_STORE=database -e DATABASE_DIALECT=postgres \
  -e DATASTORE_POSTGRES_URL=postgres://lightproject:lightproject@host.docker.internal:5432/lightproject_datastore tasks:latest
docker stop -t 30 tasks   # graceful stop within the 30 s budget
```

#### D1 (Cloudflare runtime)

Extra flags after `vp run wrangler:dev` reach `wrangler dev`, and `--var KEY:value` overrides
`.env`, so `.env` can stay on `postgres`. Fire the watchdog cron once after every start; it starts
one `WorkerLoop` per worker. Stop with Ctrl+C (wrangler respawns a killed `workerd`).

| Case                | Commands                                                                                                                                                                | Expected                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| D1. Run jobs        | `vp run wrangler:dev --var DATABASE_DIALECT:d1`, then (2nd terminal) `curl "http://localhost:2002/__scheduled?cron=*+*+*+*+*"`, the bulk insert below, `d1jobs`         | `Cron * * * * *: 2 worker loop(s) running`, `ping: hello` ×5, `succeeded`   |
| D2. Concurrency     | `vp run wrangler:dev --var DATABASE_DIALECT:d1 --var TASKS_CONCURRENCY:ping=3`, then the curl                                                                           | `3 worker loop(s) running`; loops above a lowered count stop                |
| D3. Delayed job     | D1's server + curl, then the delayed insert below                                                                                                                       | `pending` until `run_at`, then `ping: later`                                |
| D4. Invalid payload | D1's server + curl, then the invalid insert below                                                                                                                       | `Job attempt failed`, row `dead`, `Invalid payload: …`                      |
| D5. Retention purge | `vp run wrangler:dev --var DATABASE_DIALECT:d1 --var JOB_RETENTION_SUCCEEDED_MS:1000 --var JOB_RETENTION_DEAD_MS:1000 --var JOB_PURGE_INTERVAL_MS:60000`, then the curl | Every tick sweeps (interval = tick): `Purged N succeeded and M dead job(s)` |

```sh
# D1: enqueue 5 jobs
d1 "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 5)
    INSERT INTO worker_jobs (id, function_name, payload, status, attempts, max_attempts, run_at, created_at, updated_at)
    SELECT lower(hex(randomblob(16))), 'ping', '{\"message\":\"hello\"}', 'pending', 0, 5,
           unixepoch()*1000, unixepoch()*1000, unixepoch()*1000 FROM n;"

# D3: delayed job (runs in 20 s)
d1 "INSERT INTO worker_jobs (id, function_name, payload, status, attempts, max_attempts, run_at, created_at, updated_at)
    VALUES (lower(hex(randomblob(16))), 'ping', '{\"message\":\"later\"}', 'pending', 0, 5,
            unixepoch()*1000 + 20000, unixepoch()*1000, unixepoch()*1000);"

# D4: invalid payload
d1 "INSERT INTO worker_jobs (id, function_name, payload, status, attempts, max_attempts, run_at, created_at, updated_at)
    VALUES (lower(hex(randomblob(16))), 'ping', '{}', 'pending', 0, 5, unixepoch()*1000, unixepoch()*1000, unixepoch()*1000);"

# Reset
d1 "DELETE FROM worker_jobs;"
```

#### Telemetry (either runtime)

`docker compose up -d` (repo root), run any case, then in Grafana (http://localhost:3300) search
Tempo for `{resource.service.name="@lightproject/tasks" && name="job.handler"}` and Loki for
`{service_name="@lightproject/tasks"}`; handler logs carry the job span's trace id.

## Deployment

The `tasks` deploy runs after `datastore` (it needs its migrations) and does two things:

| Step              | Result                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `dagger publish`  | Node image `<REGISTRY_ADDRESS>/tasks:<tag>` (command `node dist/index.mjs`)                         |
| `dagger wrangler` | Worker `lightproject-tasks-<dev\|staging\|production>` from `[env.<env>]`, `OTLP_ENDPOINT` as a var |

- When the GitHub variable `DATABASE_DIALECT` is set, the deploy fails unless
  `[env.<env>.vars]` names the same dialect, so the Worker never reads a database CI did not
  migrate. Changing the dialect means changing that block and its binding (`DB` or
  `HYPERDRIVE`/`DATASTORE_POSTGRES_URL`).
- No smoke test: the Worker has no HTTP endpoint.
- Node: on SIGTERM a stop takes up to `WORKER_SHUTDOWN_GRACE_MS` + 13 s (about 28 s by default),
  so keep the orchestrator's stop timeout at 30 s or more (`docker stop -t 30`, compose
  `stop_grace_period: 30s`; Kubernetes' default fits).

### Manually

```sh
# Worker, per env (credentials from the environment or the root .env)
CLOUDFLARE_ENV=develop vp run wrangler:deploy

# Node, via the published image (any container runtime)
docker run --rm --stop-timeout 30 -e JOB_STORE=database -e DATABASE_DIALECT=postgres \
  -e DATASTORE_POSTGRES_URL="postgres://…" <REGISTRY_ADDRESS>/tasks:<tag>

# Same path CI takes (from the repo root)
dagger call wrangler --workspace=@lightproject/tasks --environment=develop \
  --cloudflare-api-token=env:CLOUDFLARE_API_TOKEN --cloudflare-account-id=env:CLOUDFLARE_ACCOUNT_ID
```
