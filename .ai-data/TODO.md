# Open TODOs

- **TypeScript 7** — ⏸ **On hold until TypeScript 7.1 stable is released** (skip 7.0.x).
  Currently 6.0.2 (vite-plus is now on 1.1.0). Decide whether
  `@typescript/native-preview` (`tsgo`, used for `pack.dts.generator` and the `type-check` task)
  is still needed once TS 7 ships the native compiler as `tsc`.
- **Renovate isn't producing PRs** — no `renovate/*` branches exist on the remote while
  dependencies were months behind (hono was 4.6.12 vs 4.13.x). Confirm the Renovate GitHub App
  is installed on the repo and check the Dependency Dashboard issue.
- **GitHub setting (not in code)** — Settings → Actions → "Require approval for all outside
  collaborators", as defense in depth for the fork guard in `on-pull-request.yml`.
- **Open `vp pm audit` advisories** (2026-10-30): storybook <10.6.2 (critical, via
  `@storybook/addon-docs`), zod <4.6.6 (via `@t3-oss/env-core`), hono <4.13.11 and
  `@hono/node-server` <2.1.3, markdown-it <15.0.3, undici 8 <8.12.2 (via jsdom), fast-uri <3.1.9
  (dev-only, via commitlint/commitizen). Upgrade, then remove the entries `vp pm audit` no longer
  reports.
- **`sharp` / `undici` 7.x overrides** in `pnpm-workspace.yaml`: wrangler's miniflare still pins
  `sharp@0.35.4` and `undici@7.29.0` exactly (2026-10-30). The `undici` override now targets
  7.29.1, but the open advisories need ≥7.30.1: bump it. The `source-map-js` override can go
  (magicast 0.5.5 takes `^1.2.1`). Drop the rest once miniflare depends on patched versions
  (`vp pm audit` clean without them).
- **esbuild GHSA-g7r4-m6w7-qqqr (low)** — only via `tsx` (`esbuild ~0.27`), which the repo no longer
  uses (scripts run with `vpx`) but `@voidzero-dev/vite-plus-core` still depends on; the advisory is
  the Windows dev-server file read, which `tsx` doesn't use. Resolves when vite-plus-core drops `tsx`
  or `tsx` moves to esbuild ≥0.28.1.
- **Re-enable `fsModuleCache` in `templates/frontend`** (`test.fsModuleCache: false` there) once
  Vite+ fixes the 1.4.0 regression: with the module cache on, a cached module's `meta.code` is a
  `Uint8Array`, and vite-plus-core's `Error.prepareStackTrace` (`extractInlineSourceMap`) calls
  `code.charCodeAt` on it. Wrangler's `require('domain')` in the `globalSetup` builds a stack trace,
  so `vp test` aborts with "Startup Error: code.charCodeAt is not a function" (and "No test files
  found"). Only main-process modules (`globalSetup`) hit it; test-file failures print fine.
  Still reproduces on 2026-10-30.
- **`ALLOW_ALL_IPS = "true"` in every backend environment** (hardcoded in `templates/backend/wrangler.toml`)
  makes the API public; revisit (per-environment `ALLOWED_IPS`, or auth) before it serves real data.
  `DISABLE_TEST_ROUTES` is unset there too (user decision, 2026-10-27), so every deployed backend
  serves the sample `test` routes, including the DB-writing `test/users` and `test/ping`
  (`test.createUser`/`test.enqueuePing`) to anyone; set it to `"true"` per `[env.*.vars]` when that
  should stop.
- **`templates/datastore` follow-ups** (added 2026-10-18):
  - **Migrate the remote D1s** (`lightproject-datastore-<env>`, created 2026-10-30, empty): set the
    GitHub variables `DATABASE_MIGRATION_ENABLED=true` and `DATABASE_DIALECT=d1` (repository level,
    or per GitHub Environment to override) so the next `datastore` deploy migrates each
    environment. Until then deploys only publish the migrator image. Switching to `postgres` also
    needs the `DATASTORE_POSTGRES_URL` secret.
  - Run the migrator image end to end once (`dagger call load --workspace=@lightproject/datastore`
    then `docker run --network none …` to confirm Node is baked in, and against the compose Postgres).
  - Dagger `ready` fails at `test:e2e` (pre-existing): its container never installs Playwright
    browsers (`withPlaywrightChromium`).
  - Upgrade `drizzle-orm`/`drizzle-kit` from `1.0.0-rc.4` to 1.0 GA when it ships, then check
    whether `drizzle-kit migrate` with `d1-http` can re-run (see architecture); if so,
    `src/scripts/migrate-d1-remote.ts` + `src/scripts/remote-d1.ts` can go.
  - Unit tests time out in `dagger call ready` (2026-10-25): `migrations-drift.test.ts`
    (postgresql, 44.9 s) and a PGlite contract test hit the 30 s timeout when the whole repo runs in
    one container (68% of the time spent importing); `dagger call test-unit
    --workspace=@lightproject/datastore` passes alone (drift 15.5 s), and PR CI runs per workspace.
    Give the drift test an explicit timeout or make it cheaper (it runs drizzle-kit against a copy
    per dialect). `dagger call ready` is flaky under its own load: a second run timed out a
    different test instead.
- **`templates/tasks` follow-ups** (rebuilt on `templates/datastore`, 2026-10-20):
  - First real deploy: confirm the `WorkerLoop` Durable Objects run on develop, and (when an env
    uses Postgres) whether the driver needs `nodejs_compat` through a real Hyperdrive binding.
  - Exercise loop retirement (lower `TASKS_CONCURRENCY`, confirm surplus loops stop).
  - On the first deploy, confirm handler telemetry outside local dev: `job.handler` spans under
    `job.run` and `context.logger` entries with trace ids, from the container (per-thread SDK)
    and the Worker (verified only against the local Grafana stack).
  - `mise run docker` does not include `tasks` yet (no port; needs a database to be useful).
- **`templates/scheduler` follow-ups** (2026-10-26):
  - First real deploy: confirm the crons fire on develop (`[triggers]` inherited by `[env.*]`, checked
    only with wrangler's config reader), set `SCHEDULER_RUN_TOKEN` per env and try `POST /run/ping`.
  - Confirm `script.run` telemetry from a deployed Worker and from the container.
  - On a deployed Worker, confirm a one-off whose client disconnects is aborted and releases its lock
    (`request.signal` with `enable_request_signal`; local `wrangler dev` does not forward the
    disconnect, so it is covered only by `edge.test.ts`).
  - Kubernetes CronJob manifests are documented (README → Deployment), not generated or tested.
  - `mise run docker` does not include `scheduler` (one-shot; needs a database).

Not a TODO: `bak/` is intentionally tracked (see `architecture.md`).
