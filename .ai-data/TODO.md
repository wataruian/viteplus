# Open TODOs

- **TypeScript 7** — ⏸ **On hold until TypeScript 7.1 stable is released** (skip 7.0.x).
  Currently 6.0.2 (vite-plus is now on 1.1.0). Decide whether
  `@typescript/native-preview` (`tsgo`, used for `pack.dts.generator`) is still needed once TS 7
  ships the native compiler as `tsc`.
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
- **`ALLOW_ALL_IPS = "true"` in every backend environment** (hardcoded in `apps/backend/wrangler.toml`)
  makes the API public; revisit (per-environment `ALLOWED_IPS`, or auth) before it serves real data.
- **`packages/database` follow-ups** (added 2026-10-18):
  - To migrate from CI, set `DATABASE_MIGRATION_ENABLED=true` plus the `DATABASE_DIALECT`
    variable (`d1`/`postgres`; repository level, or per GitHub Environment to override) and the
    `POSTGRES_URL` secret for `postgres`; until then deploys only publish the migrator image.
  - Run the migrator image end to end once (`dagger call load --workspace=@lightproject/database`
    then `docker run --network none …` to confirm Node is baked in, and against the compose Postgres).
  - Dagger `ready` fails at `test:e2e` (pre-existing): its container never installs Playwright
    browsers (`withPlaywrightChromium`).
  - Upgrade `drizzle-orm`/`drizzle-kit` from `1.0.0-rc.4` to 1.0 GA when it ships, then check
    whether `drizzle-kit migrate` with `d1-http` can re-run (see architecture); if so,
    `src/scripts/migrate-d1-remote.ts` + `src/scripts/remote-d1.ts` can go.
  - The stashed `apps/workers` (`stash@{0}`) still has its own `worker_jobs` migrations and
    hand-written SQL stores: on unstash, delete `apps/workers/migrations` + `scripts/migrate.ts`,
    rewrite the Postgres/D1 stores on `@lightproject/database`, and resolve the expected conflicts
    in `docker-compose.yml`/`.env.example` (Postgres credentials are now `lightproject`).

Not a TODO: `bak/` is intentionally tracked (see `architecture.md`).
