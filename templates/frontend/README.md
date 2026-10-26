# @lightproject/frontend

React SPA built with Vite and UnoCSS (styles and components from `@lightproject/design-system`).
It calls the backend over tRPC (`@lightproject/backend`'s client types, `fetch` only) and sends
browser telemetry (Faro RUM, OTLP metrics) through `@lightproject/common/browser`. It deploys as
static assets to a Cloudflare Worker and as an nginx image. Layering and runtime rules:
`.ai-data/architecture.md` → "High-Level Structure"; telemetry: → "Observability Stack".

Commands run from `templates/frontend` unless noted.

## Setup

1. Install and configure (from the repo root):

   ```sh
   vp install
   cp .env.example .env   # if you have no .env yet
   ```

   mise loads the root `.env` into the shell (`_.file = ".env"`), which is how the `VITE_*` values
   reach the browser bundle. There is no `.env` in `templates/frontend`.

2. Start the backend (port 2000) for the tRPC sample, and optionally the telemetry stack (from the
   repo root):

   ```sh
   vp run --filter @lightproject/backend dev
   docker compose up -d   # Grafana LGTM + OTel collector; without it telemetry exports just fail
   ```

3. Start the frontend:

   ```sh
   vp dev   # http://localhost:2001 (/preview shows the design-system preview page)
   ```

## Environment variables

Every browser-side value is read through `getEnv('X')`, which falls back to `VITE_X`. Vite only
exposes `VITE_*` to the browser and inlines them at build time, so in the bundle **every variable
is build-time**: set the `VITE_` form (each mirrors its plain one in `.env.example`) before
`vp build`; changing it later needs a rebuild. Empty strings count as unset.

App-specific (`src/env.ts`, `vite.config.ts`, `playwright.config.ts`):

| Variable                  | Read by                        | Purpose                                                                                                                     |
| ------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `FRONTEND_PORT`           | `vite.config.ts`, `src/env.ts` | Port of `vp dev`, `vp preview` and `wrangler:dev` (default `2001`)                                                          |
| `FRONTEND_INSPECTOR_PORT` | `vite.config.ts`               | Inspector port of `wrangler:dev` (default `8231`)                                                                           |
| `FRONTEND_URL`            | `vite.config.ts` (build)       | Public URL; enables the absolute share tags (see "Share tags"). `VITE_FRONTEND_URL` is used when it is empty. Default unset |
| `FRONTEND_E2E_PORT`       | `playwright.config.ts`         | Port of the dev server Playwright starts (default `2111`)                                                                   |

Shared, from `commonEnv` (full list in `packages/common/README.md`). The ones the frontend uses:

| Variable        | Purpose                                                                                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENV`           | `local`/`develop`/`staging`/`production` (default `local`): RUM `deployment.environment`; `local` keeps pretty logs and, at build, skips minification and emits source maps |
| `BACKEND_URL`   | Backend base URL for tRPC and trace-header propagation (default `http://localhost:2000`)                                                                                    |
| `OTLP_ENDPOINT` | OTLP/HTTP collector for browser metrics, `/v1/metrics` appended (default `http://localhost:4318`)                                                                           |
| `FARO_ENDPOINT` | Faro receiver for RUM logs/traces, `/collect` appended (default `http://localhost:12347`)                                                                                   |
| `LOG_LEVEL`     | `silent`/`error`/`warn`/`info`/`debug` (default `info`; `trace` is accepted and logs as `info`)                                                                             |
| `LOG_FORMAT`    | `json` or `pretty` (default `pretty`); only honored when `ENV=local`, otherwise always `json`                                                                               |

`commonEnv` validates all its keys once at module load and throws on invalid ones (e.g. a
`BACKEND_URL` that is not a URL). The RUM service name and version come from `package.json`, not
`SERVICE_NAME`/`SERVICE_VERSION`. Unit tests force `SKIP_OPENTELEMETRY=true` and `LOG_LEVEL=silent`.

## Development

| Task                     | What it does                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `vp dev` / `vp run dev`  | Vite dev server on `FRONTEND_PORT` with HMR                                         |
| `vp run build`           | Production bundle in `dist/` (`vp build`, task-cached)                              |
| `vp run start`           | `vp preview` of `dist/` on `FRONTEND_PORT`                                          |
| `vp run wrangler:dev`    | Serves `dist/` through the Worker locally (build first)                             |
| `vp run wrangler:deploy` | `wrangler deploy` of `dist/` (`CLOUDFLARE_ENV` picks the `[env.*]`; see Deployment) |
| `vp run wrangler:delete` | `wrangler delete` of the Worker                                                     |
| `vp run check`           | `vp check` (format, lint, type check); also `format`, `lint`, `type-check` tasks    |
| `vp run test:unit`       | `vp test` with coverage (task-cached)                                               |
| `vp run test:e2e`        | Playwright browser tests (task-cached, restores `e2e-test-results/` on a cache hit) |

From the repo root, `mise run start dev` (or `wrangler`) starts every app in parallel.

- `src/main.tsx` initializes RUM, then lazy-loads `src/app.tsx` or, on `/preview`,
  `src/preview-page.tsx`.
- `src/config.ts` resolves the backend URL; `src/providers/trpc-provider.tsx` sends
  `X-Request-Id`/`X-Client-Id` with every call.
- In dev, `@lightproject/backend`, `@lightproject/common` and `@lightproject/design-system` resolve
  to their sources (`resolve.alias`), so no package build is needed. UnoCSS uses
  `packages/design-system/uno.config.ts`; components and tokens belong in the design system, not
  here.
- Never use `XMLHttpRequest` or XHR-based clients (lint-banned); tracing is built on `fetch`.

### Share tags

`og:url`, `og:image` and `twitter:image` must be absolute, so `social-meta.ts` only emits them (and
switches `twitter:card` to `summary_large_image`) when `FRONTEND_URL` / `VITE_FRONTEND_URL` is set
at build; a non-http(s) or relative value fails the build. `public/og-image.png` (1200×630) and
`public/apple-touch-icon.png` are generated from `favicon.svg`; replace them with brand assets any
time.

## Testing

```sh
vp test            # unit (jsdom), against the backend in Node and in a local wrangler Worker
vp run test:e2e    # Playwright, Chromium, its own dev server on FRONTEND_E2E_PORT (2111)
```

- Unit tests live in `tests/unit/`; coverage must stay at 100% for `src/` and `social-meta.ts`.
  `tests/unit/helpers/global-setup.ts` starts the backend Worker (`templates/backend/wrangler.toml`)
  once; `setup.ts` hides `import.meta.env`, so `.env` values never leak into tests.
- E2E tests in `tests/e2e/` cover the home page (counter, tRPC sample, navigation to and from
  `/preview`) and the light/dark toggle on `/preview`. Each run writes `e2e-test-results/`: a video
  per test (`results/**/video.webm`), `results.json`, and an HTML report (`report/index.html`).
- One-time Chromium download: `vp exec playwright install chromium`.

Before finishing, run `vp run ready` from the repo root. To reproduce CI (from the repo root):
`dagger call test-unit --workspace=@lightproject/frontend` and
`dagger call test-end-to-end --workspace=@lightproject/frontend`; `verify-workspace.yml` uploads
the e2e output as the `e2e-frontend` artifact.

## Deployment

Each target has its own Worker (`wrangler.toml` `[env.*]`, selected by `CLOUDFLARE_ENV`), serving
`dist/` with single-page-application fallback:

| `CLOUDFLARE_ENV` | Worker                             | URL                                                           |
| ---------------- | ---------------------------------- | ------------------------------------------------------------- |
| `develop`        | `lightproject-frontend-dev`        | `https://lightproject-frontend-dev.wataru.workers.dev`        |
| `staging`        | `lightproject-frontend-staging`    | `https://lightproject-frontend-staging.wataru.workers.dev`    |
| `production`     | `lightproject-frontend-production` | `https://lightproject-frontend-production.wataru.workers.dev` |

### CI

`deploy-workspace.yml` builds with these `--build-env` values (Dagger accepts build env only for
frontend-type workspaces):

| Build variable       | Value                                                                        |
| -------------------- | ---------------------------------------------------------------------------- |
| `VITE_ENV`           | The target environment                                                       |
| `VITE_BACKEND_URL`   | `https://lightproject-backend-<dev\|staging\|production>.wataru.workers.dev` |
| `VITE_FRONTEND_URL`  | That environment's frontend Worker URL                                       |
| `VITE_OTLP_ENDPOINT` | GitHub variable `OTLP_ENDPOINT`, only when set                               |
| `VITE_FARO_ENDPOINT` | GitHub variable `FARO_ENDPOINT`, only when set                               |

It then publishes the nginx image `<REGISTRY_ADDRESS>/frontend` (`nginx.conf`, `dist/` in
`/usr/share/nginx/html/vite`, port 80) via Dagger `publish`, deploys the Worker via Dagger
`wrangler` (`vp run wrangler:deploy` with `CLOUDFLARE_ENV` and the `CLOUDFLARE_*` secrets), and
smoke-tests the Worker URL for HTTP 200. Promotion to `staging`/`production` and the workflow
chain: root `AGENTS.md` → "CI Pipeline (Dagger)".

### Manually

```sh
# Worker (credentials from the environment or the root .env)
VITE_ENV=develop VITE_BACKEND_URL=https://lightproject-backend-dev.wataru.workers.dev \
  VITE_FRONTEND_URL=https://lightproject-frontend-dev.wataru.workers.dev vp run build
CLOUDFLARE_ENV=develop vp run wrangler:deploy

# Same path CI takes (from the repo root)
dagger call wrangler --workspace=@lightproject/frontend --environment=develop \
  --cloudflare-api-token=env:CLOUDFLARE_API_TOKEN --cloudflare-account-id=env:CLOUDFLARE_ACCOUNT_ID \
  --build-env=VITE_ENV=develop --build-env=VITE_BACKEND_URL=https://lightproject-backend-dev.wataru.workers.dev

# nginx image into the local Docker (frontend:latest), then serve it on :8080 (from the repo root)
dagger call load --workspace=@lightproject/frontend --docker-socket=/var/run/docker.sock
docker run --rm -p 8080:80 frontend:latest
```
