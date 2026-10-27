# @lightproject/backend

Hono API (Fetch-API/WinterCG). The portable core (`src/app.ts`) runs on Node through
`@hono/node-server` (`src/runtimes/node.ts`, the only place Node APIs live) and on Cloudflare
Workers through `wrangler` (`src/runtimes/edge.ts`, the `wrangler.toml` entry). It serves HTTP
routes under `/api` (OpenAPI via `@hono/zod-openapi`), tRPC under `/trpc`, a health check on `/`
and Prometheus metrics on `/metrics`. Layout: `.ai-data/architecture.md` → "High-Level
Structure"; telemetry: "Observability Stack".

```ts
import { type AppRouter, getApp } from '@lightproject/backend'; // tRPC router type for clients
```

Commands run from `templates/backend` unless noted.

## Setup

1. Install (from the repo root), and copy `.env.example` to the root `.env`:

   ```sh
   vp install
   ```

   mise loads the root `.env` into your shell. `vite.config.ts` symlinks it to
   `templates/backend/.env` (copies it if symlinks fail) for `wrangler dev`.

2. For telemetry, start the LGTM stack + OpenTelemetry Collector (from the repo root), or set
   `SKIP_OPENTELEMETRY=true` to run without a collector:

   ```sh
   docker compose up -d
   ```

3. For the sample database routes (see "Test routes"), start Postgres (`docker compose up -d`
   above) and migrate it once, from `templates/datastore`:

   ```sh
   vp run build && vp run db:migrate
   ```

   The backend keeps no tables or migrations of its own: it queries `@lightproject/datastore`
   and enqueues jobs through `@lightproject/tasks`, whose worker (`vp run dev` in
   `templates/tasks`) runs them.

## Environment variables

Validated once, at module load, by `src/env.ts` (`createEnv`; invalid keys fail fast). Node reads
`process.env`; on Cloudflare the Worker vars come from `wrangler.toml`'s `[env.<env>.vars]` plus
any `--worker-var` at deploy time. Every `X` falls back to its `VITE_X` mirror. Flags take
exactly `true` or `false`; empty means unset.

| Variable                  | Used by                    | Purpose                                                                                                                                                                                                                                                       |
| ------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BACKEND_PORT`            | Node, `wrangler`           | Listen port (default `2000`); also the `wrangler:dev` port                                                                                                                                                                                                    |
| `BACKEND_URL`             | `src/config.ts`, CORS, CSP | This backend's own public URL, allowed as an origin (default `http://localhost:<BACKEND_PORT>`). Read app-locally, so a copy of this template renames it with its own prefix; `packages/common` keeps `BACKEND_URL` only for frontends that call this backend |
| `BACKEND_INSPECTOR_PORT`  | `vite.config.ts`           | `wrangler:dev` inspector port (default `8230`)                                                                                                                                                                                                                |
| `ADDITIONAL_CORS_ORIGINS` | CORS, CSP                  | Comma-separated extra allowed origins, on top of `BACKEND_URL` and `FRONTEND_URL`                                                                                                                                                                             |
| `ALLOWED_IPS`             | IP filter                  | Comma-separated client IPs allowed besides `127.0.0.1`/`::1`                                                                                                                                                                                                  |
| `ALLOW_ALL_IPS`           | IP filter                  | `true` allows every IP (default `false`; set in every `[env.*]` of `wrangler.toml`)                                                                                                                                                                           |
| `BLOCK_ALL_IPS`           | IP filter                  | `true` denies every request with 403, including the `/` health check (default `false`); wins over all the above                                                                                                                                               |
| `TRUSTED_PROXIES`         | IP filter (Node)           | Comma-separated proxy IPs whose `X-Forwarded-For` is trusted. Workers use `cf-connecting-ip` instead                                                                                                                                                          |
| `ENABLE_ERROR_STACK`      | Error responses            | Return 5xx messages and stacks to clients (default: on when `ENV=local`); always off in `production`                                                                                                                                                          |
| `DISABLE_TEST_ROUTES`     | Routers                    | `true` stops serving the sample `/api/test/*` routes and `test.*` tRPC procedures (404) and drops them from the docs (default `false`). Set it in real apps                                                                                                   |
| `SKIP_OPENTELEMETRY`      | `src/app.ts`               | `true` skips the OTel SDK; request ids in logs keep working (default `false`; `true` in unit tests)                                                                                                                                                           |

Shared variables read through `@lightproject/common` (full list in `packages/common/README.md`):

| Variable            | Purpose                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENV`               | `local` (default), `test`, `develop`, `staging` or `production`. `local` serves `/docs`, pretty logs and error stacks; `local`/`test` allow every IP |
| `CI`                | `true` allows every IP, like `local`/`test`                                                                                                          |
| `FRONTEND_URL`      | The frontend allowed as a CORS/CSP origin (default `http://localhost:2001`); loopback origins are dropped outside `local`/`test`                     |
| `OTLP_ENDPOINT`     | OTLP/HTTP collector (default `http://localhost:4318`)                                                                                                |
| `TELEMETRY_DEBUG`   | `true` turns on the OTel SDK's debug logger                                                                                                          |
| `OTEL_SERVICE_NAME` | Tracer/meter name (default `application`). The resource's `service.name` is always the package name, `@lightproject/backend`                         |
| `LOG_LEVEL`         | `silent`, `error`, `warn`, `info` or `debug` (default `info`; `silent` in unit tests)                                                                |
| `LOG_FORMAT`        | `pretty` (default) or `json`; only honoured when `ENV=local`, everything else logs JSON                                                              |
| `CHALK_LEVEL`       | Log color depth `0`–`3` (default `3`)                                                                                                                |

Database variables, read by `@lightproject/datastore` (`templates/datastore/README.md`):

| Variable                 | Purpose                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `DATABASE_DIALECT`       | `postgres` or `d1` (required once a route opens the database). `d1` in every `wrangler.toml` block             |
| `DATASTORE_POSTGRES_URL` | Node's Postgres URL (default: built from `POSTGRES_HOST`/`PORT`/`USER`/`PASSWORD` and `DATASTORE_POSTGRES_DB`) |

`wrangler.toml` binds the shared D1 database as `DB` in every block, the same databases
`templates/tasks` and `templates/scheduler` use; `wrangler:dev` keeps local state in the repo root's
`.wrangler/state` alongside theirs. Node opens one database for the process (closed on shutdown).
A Worker opens one per request that asks for it and closes it afterwards (`src/database.ts`).

## Development

Use `vp run dev`, not `vp dev`: the built-in `vp dev` starts a Vite dev server, never the API.

| Task                     | What it does                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `vp run dev`             | `tsx watch` on `src/index.ts` (Node, `@hono/node-server`) at `http://localhost:2000`                 |
| `vp run wrangler:dev`    | The Worker runtime locally (`wrangler dev`) on `BACKEND_PORT`, inspector on `BACKEND_INSPECTOR_PORT` |
| `vp run build`           | `vp pack`: ESM + CJS into `dist/` (`dist/index.mjs` is the Node entry, `dist/client.*` the library)  |
| `vp run start`           | `node dist/index.mjs`; build first with `vp run -t build` (also builds `@lightproject/common`)       |
| `vp run check`           | `vp check` (format, lint, type check)                                                                |
| `vp run type-check`      | `tsgo`                                                                                               |
| `vp run wrangler:deploy` | `wrangler deploy`; set `CLOUDFLARE_ENV` to pick the `[env.*]` Worker (see Deployment)                |
| `vp run wrangler:delete` | `wrangler delete` of the selected Worker                                                             |

From the repo root, `mise run start dev|prod|wrangler` runs `dev`/`start`/`wrangler:dev` in every
app at once.

With `ENV=local` the server logs the docs URLs on start:

- `/docs`: index of the OpenAPI docs
- `/docs/http`, `/docs/openapi-http.json`: Swagger UI and schema for the `/api` routes
- `/docs/trpc`, `/docs/openapi-trpc.json`: the same for the tRPC procedures

### Adding a route

Put the logic in `src/services/` as a function with a zod `request`/`response` schema
(`attachSchema` in `src/schema.ts`), then register it in `src/routers/http/` (`defineHttpRoute`)
and/or `src/routers/trpc/` (`defineTrpcRoute`) and merge the router in that folder's `index.ts`.
Locally, an HTTP route without OpenAPI docs throws at start (`assertHttpRoutesDocumented`). Use
`src/services/test.ts` and its routers as the example. A service gets a second argument,
`{ getDatabase }`, which opens the database on first use (`src/database.ts`).

### Test routes

`src/services/test.ts` is a sample, served at `/api/test/*` and `test.*` in tRPC unless
`DISABLE_TEST_ROUTES=true`:

| HTTP                     | tRPC                      | What it does                                                                     |
| ------------------------ | ------------------------- | -------------------------------------------------------------------------------- |
| `GET /api/test/hello`    | `test.hello` (query)      | Echoes a greeting                                                                |
| `POST /api/test/profile` | `test.profile` (mutation) | Builds a profile from the input                                                  |
| `POST /api/test/ping`    | `test.enqueuePing`        | Enqueues a `ping` job (`@lightproject/tasks`); the tasks worker logs its message |
| `POST /api/test/users`   | `test.createUser`         | Inserts a user with a random name into `users` (`@lightproject/datastore`)       |

The `AppRouter` type keeps the `test` procedures either way, so clients still compile; turning
them off only makes the server answer 404.

## Testing

```sh
vp test   # unit tests in tests/unit (no services needed); same as vp run test:unit
```

- Coverage thresholds are 100% (`src/runtimes/**`, `src/client.ts` and `index.ts` files are
  excluded).
- Env is read once, so tests stub first and then re-import (`vi.resetModules()` + `await
  import(...)`); see `tests/unit/helpers/utils.ts`.
- Routes that use the database run against a fake one (`tests/unit/helpers/database.ts`) on
  Node; the `wrangler` runtime's throwaway D1 has no migrations, so it skips them.
- Unit tests set `SKIP_OPENTELEMETRY=true`; `tests/unit/telemetry.test.ts` opts back in against a
  fake collector, so no real endpoint is ever hit.

Before finishing, run `vp run ready` from the repo root. To reproduce CI:
`dagger call test-unit --workspace=@lightproject/backend`.

## Deployment

Two artifacts per version, both built by Dagger:

| Target                                                              | How                                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Container image `<REGISTRY_ADDRESS>/backend:<tag>` (+ `latest`)     | `dagger call publish`: production install + `dist/`, command `node dist/index.mjs`   |
| Cloudflare Worker `lightproject-backend-<dev\|staging\|production>` | `dagger call wrangler`: `vp run wrangler:deploy` with `CLOUDFLARE_ENV=<environment>` |

`CLOUDFLARE_ENV` selects the `[env.develop|staging|production]` block of `wrangler.toml`. Vars
are not inherited by `[env.*]` blocks, so each lists its own `ENV`, `ALLOW_ALL_IPS` and
`ADDITIONAL_CORS_ORIGINS`.

### CI

`.github/workflows/deploy-workspace.yml` runs, for `backend`: build and publish the image (tag =
the version ref, else the short SHA), deploy the Worker, then smoke-test
`https://lightproject-backend-<dev|staging|production>.wataru.workers.dev` for HTTP 200. When the
GitHub variable `OTLP_ENDPOINT` is set it is passed to the Worker as
`--worker-var=OTLP_ENDPOINT=<url>`. Push to `main` deploys `develop`; `staging`/`production` are a
manual `trigger.yml` dispatch with a `version`.

### Manually

```sh
# Worker (from the repo root; credentials from the environment)
dagger call wrangler --workspace=@lightproject/backend --environment=develop \
  --cloudflare-api-token=env:CLOUDFLARE_API_TOKEN --cloudflare-account-id=env:CLOUDFLARE_ACCOUNT_ID \
  --worker-var=OTLP_ENDPOINT=https://…

# Or directly with wrangler (from templates/backend)
CLOUDFLARE_ENV=develop vp run wrangler:deploy

# Container image, on any container runtime
docker run --rm -p 2000:2000 -e ENV=develop -e ALLOW_ALL_IPS=true -e OTLP_ENDPOINT=https://… \
  <REGISTRY_ADDRESS>/backend:<tag>
```
