# @lightproject/workers

Always-running background job workers: each job function gets N workers that claim, run and
record `worker_jobs` rows from `packages/database` (no models, SQL or migrations here). Runs as a
Node process (one worker thread per worker; published as a container image) or on Cloudflare as
one `WorkerLoop` Durable Object alarm loop per worker (the cron is only a watchdog). Delivery is
at-least-once, so **handlers must be idempotent** (`context.idempotencyKey`). Full reference,
including the step-by-step "Adding a job function": `.ai-data/architecture.md` → "Background
Workers".

```ts
import { createJobClient, createJobStore, ping } from '@lightproject/workers';

const client = createJobClient(await createJobStore('database', env));
await client.enqueue(ping, { message: 'hello' }, { delayMs: 5000 });
```

Commands run from `apps/workers` unless noted.

## Setup

1. Install, start Postgres and apply the migrations: setup in `packages/database/README.md`
   (the workers read the same database, so migrate it first).

2. Configure the root `.env` (copy `.env.example`): `JOB_STORE=database`, `DATABASE_DIALECT`
   and the Postgres settings. mise loads it into the shell for the Node run; `vite.config.ts`
   links it to `apps/workers/.env` for `wrangler dev`, where its values override `[vars]` (so local
   Cloudflare dev follows `.env`'s `DATABASE_DIALECT`).

## Environment variables

Validated once at module load (`src/env.ts`); an invalid value fails the start with the list of
bad keys. On Cloudflare they come from `wrangler.toml`'s `[vars]` / `[env.<env>.vars]`.

| Variable                     | Purpose                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `JOB_STORE`                  | **Required.** `database` (shared queue) or `memory` (single process; refused on Cloudflare and by `enqueue`)                   |
| `WORKER_CONCURRENCY`         | Per-function worker counts, `name=n,…` (e.g. `ping=2`); unset uses each function's `concurrency`. Unknown names fail the start |
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
| `WORKERS_PORT`               | `vite.config.ts`: `wrangler dev` port (default `2002`)                                                                         |
| `WORKERS_INSPECTOR_PORT`     | `vite.config.ts`: `wrangler dev` inspector port (default `8232`)                                                               |
| `TEST_SUITE`                 | `integration` switches `vp test` to `tests/integration` (set by `vp run test:integration`)                                     |

Shared variables, defined in `packages/common/README.md` and `packages/database/README.md`:

- `ENV` (default `local`; non-local forces JSON logs), `LOG_LEVEL`, `LOG_FORMAT`.
- `OTLP_ENDPOINT` (default `http://localhost:4318`; CI passes it as a Worker var),
  `TELEMETRY_DEBUG`.
- `DATABASE_DIALECT`, `POSTGRES_URL` or the `POSTGRES_*` parts (with `JOB_STORE=database`).

Worker bindings (`wrangler.toml`, every env):

| Binding       | Purpose                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `DB`          | The shared D1 (same ids as `packages/database`); used when `DATABASE_DIALECT=d1`                   |
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
| `vp run wrangler:dev`                  | Local Worker on `WORKERS_PORT`, D1 in `../../.wrangler/state`, `--test-scheduled`        |
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
`dagger call test-integration --workspace=@lightproject/workers`.

## Deployment

The `workers` deploy runs after `database` (it needs its migrations) and does two things:

| Step              | Result                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| `dagger publish`  | Node image `<REGISTRY_ADDRESS>/workers:<tag>` (command `node dist/index.mjs`)                         |
| `dagger wrangler` | Worker `lightproject-workers-<dev\|staging\|production>` from `[env.<env>]`, `OTLP_ENDPOINT` as a var |

- When the GitHub variable `DATABASE_DIALECT` is set, the deploy fails unless
  `[env.<env>.vars]` names the same dialect, so the Worker never reads a database CI did not
  migrate. Changing the dialect means changing that block and its binding (`DB` or
  `HYPERDRIVE`/`POSTGRES_URL`).
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
  -e POSTGRES_URL="postgres://…" <REGISTRY_ADDRESS>/workers:<tag>

# Same path CI takes (from the repo root)
dagger call wrangler --workspace=@lightproject/workers --environment=develop \
  --cloudflare-api-token=env:CLOUDFLARE_API_TOKEN --cloudflare-account-id=env:CLOUDFLARE_ACCOUNT_ID
```
