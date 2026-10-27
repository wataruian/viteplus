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
- **Two design-system tests are timeout-prone under load** — `preview-registry-drift.test.tsx`
  (~3s locally) and the `ph` icon-loader test in `tokens.test.ts` hit the 30s timeout in a
  `dagger ready` that overlapped with a local `vp run ready` (2026-09-28); the same run passes when
  the machine is idle. Consider speeding them up (the drift test re-imports `Preview` after
  `vi.resetModules()` per case) before the shared self-hosted runner gets busy.
- **`generateShortUuid` 1M-ids test is timeout-prone too** — `packages/common/tests/unit/text.test.ts`
  ("does not repeat across 1M ids") hit the 30s timeout in a local `vp run ready` (2026-10-18)
  but passes alone in ~9s and on the next `ready`. It is CPU-bound (1M ids into a `Set`); consider
  fewer ids (collision odds at 122 bits are negligible either way) or an explicit per-test timeout.
- **Drop the `sharp` / `undici` 7.x / `source-map-js` overrides** in `pnpm-workspace.yaml` once
  wrangler's miniflare (exact `sharp`/`undici` pins) and magicast (exact `source-map-js` pin) depend
  on patched versions (`vp pm audit` clean without them).
- **braces GHSA-vfj7-8cjw-p6xm (high, dev-only)** — via `commitizen › find-node-modules ›
  findup-sync › micromatch`. The advisory's fix (≥3.0.4) isn't published yet (latest 3.0.3); add an
  override once it is.
- **esbuild GHSA-g7r4-m6w7-qqqr (low)** — only via `tsx` (`esbuild ~0.27`); the advisory is the
  Windows dev-server file read, which `tsx` doesn't use. Resolves when `tsx` moves to esbuild ≥0.28.1.
- **Delete the old unsuffixed Workers** (`lightproject-backend`, `-frontend`, `-design-system`,
  `-storybook`) in the Cloudflare dashboard (or `wrangler delete --name <name>`) once the
  `-dev`/`-staging`/`-production` Workers are deployed and verified — nothing deploys to them anymore
  (user will do this manually). Until then the old backend still runs without `ENV` (docs/stack
  traces exposed).
- **`ALLOW_ALL_IPS = "true"` in every backend environment** (hardcoded in `templates/backend/wrangler.toml`)
  makes the API public; revisit (per-environment `ALLOWED_IPS`, or auth) before it serves real data.
  `DISABLE_TEST_ROUTES` is unset there too (user decision, 2026-10-27), so every deployed backend
  serves the sample `test` routes, including the DB-writing `test/users` and `test/ping`
  (`test.createUser`/`test.enqueuePing`) to anyone; set it to `"true"` per `[env.*.vars]` when that
  should stop.
- **`templates/datastore` follow-ups** (added 2026-10-18):
  - To migrate from CI, set `DATABASE_MIGRATION_ENABLED=true` plus the `DATABASE_DIALECT`
    variable (`d1`/`postgres`; repository level, or per GitHub Environment to override) and the
    `DATASTORE_POSTGRES_URL` secret for `postgres`; until then deploys only publish the migrator image.
  - Run the migrator image end to end once (`dagger call load --workspace=@lightproject/datastore`
    then `docker run --network none …` to confirm Node is baked in, and against the compose Postgres).
  - Dagger `ready` fails at `test:e2e` (pre-existing): its container never installs Playwright
    browsers (`withPlaywrightChromium`).
  - Upgrade `drizzle-orm`/`drizzle-kit` from `1.0.0-rc.4` to 1.0 GA when it ships, then check
    whether `drizzle-kit migrate` with `d1-http` can re-run (see architecture); if so,
    `src/scripts/migrate-d1-remote.ts` + `src/scripts/remote-d1.ts` can go.
- **`templates/tasks` follow-ups** (rebuilt on `templates/datastore`, 2026-10-20):
  - First real deploy: confirm the `WorkerLoop` Durable Objects run on develop, and (when an env
    uses Postgres) whether the driver needs `nodejs_compat` through a real Hyperdrive binding.
  - Exercise loop retirement (lower `TASKS_CONCURRENCY`, confirm surplus loops stop).
  - On the first deploy, confirm handler telemetry outside local dev: `job.handler` spans under
    `job.run` and `context.logger` entries with trace ids, from the container (per-thread SDK)
    and the Worker (verified only against the local Grafana stack).
  - `mise run docker` does not include `tasks` yet (no port; needs a database to be useful).
  - Drop the old workers stashes once this is committed.
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

- **Empty UnoCSS shortcuts** — `btn-primary`, `btn-ghost` and `glass-nav` are documented in
  `AGENTS.md` ("Shortcuts") and `.ai-data/coding-guidelines.md`, but
  `packages/design-system/src/utils/shortcuts.ts` is empty, so they generate no CSS. Decide: add
  them, or remove them from the docs (components use `cva` variants, e.g. `<Button intent='ghost'>`).
- **PR checks disabled for three packages** — the `common`, `design-system` and `library` jobs in
  `.github/workflows/verify.yml` are commented out, so pull requests never verify them directly.
  Decide whether to re-enable them.
- **design-system ignores its CI build env** — the deploy passes `VITE_ENV` and `VITE_BACKEND_URL`
  to `packages/design-system`, but nothing in the package reads them. Decide whether to drop them
  from the deploy.
- **After merging the `templates/` + `datastore`/`tasks` rename** (2026-10-26), in this order:
  1. **GitHub secret**: add `DATASTORE_POSTGRES_URL` (repository or per environment); the old
     `POSTGRES_URL` is no longer read. Only used when `DATABASE_MIGRATION_ENABLED=true` with the
     `postgres` dialect; without it those migrations fail with "needs the DATASTORE_POSTGRES_URL secret".
  2. **Image names change**: `<REGISTRY_ADDRESS>/database` → `/datastore` and `/workers` → `/tasks`.
     Anything that pulls them by name (a Kubernetes Job/initContainer, `docker run`) must follow.
  3. **Old Workers**: delete `lightproject-workers-<env>` (`wrangler delete --name …`) right after the
     first deploy of `tasks`, and the old `<REGISTRY_ADDRESS>/workers` / `/database` images, so the
     future real apps can take the names. Until then their cron and Durable Object loops poll the same
     remote D1 as the new `lightproject-tasks-<env>` (claims are atomic, so no job runs twice, but they
     compete). Promote only post-rename refs with `trigger.yml`; an older ref has no
     `@lightproject/datastore` or `templates/`, so its deploy fails.
  4. **Remote D1s**: create `lightproject-datastore-dev`, `-staging`, `-production`
     (`vp exec wrangler d1 create <name>` in `templates/datastore`), put their ids in `[env.*]` of
     `templates/datastore/wrangler.toml` and `templates/tasks/wrangler.toml`, then migrate them
     (`CLOUDFLARE_ENV=<env> DATABASE_DIALECT=d1 vp run db:migrate`, or CI). Until then the template
     still uses the `lightproject-database-<env>` D1s, which belong to the future real
     `packages/database`.
  5. **Local cleanup** (each developer): in `.env`, drop or rename the stale `POSTGRES_URL`,
     `POSTGRES_DB`, `WORKER_CONCURRENCY` (→ `TASKS_CONCURRENCY`) and `WORKERS_PORT` /
     `WORKERS_INSPECTOR_PORT` (→ `TASKS_*`; `WORKERS_*` are now reserved for the real app on
     3003/9233) to match `.env.example`. Clear the template's old tables from the `lightproject`
     database, which is reserved for the real `packages/database`:
     `docker exec postgres psql -U lightproject -d lightproject -c 'DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;'`
     On a Postgres volume from before `configs/postgres/create-databases.sh`, run it once:
     `docker compose exec postgres sh /docker-entrypoint-initdb.d/create-databases.sh`.
- **Datastore unit tests time out in `dagger call ready`** (2026-10-25): `migrations-drift.test.ts`
  (postgresql, 44.9 s) and a PGlite contract test hit the 30 s timeout when the whole repo runs in
  one container (68% of the time spent importing); `dagger call test-unit
  --workspace=@lightproject/datastore` passes alone (drift 15.5 s), and PR CI runs per workspace.
  Same pattern as the design-system/common timeouts above: give the drift test an explicit timeout
  or make it cheaper (it runs drizzle-kit against a copy per dialect). A second `ready` right after
  passed the datastore but timed out common's 1M-ids test instead: `dagger call ready` is flaky under
  its own load, a different test each run.
