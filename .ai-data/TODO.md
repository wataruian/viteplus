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
  traces exposed). Also remove the now-unused `WORKERS_SUBDOMAIN` GitHub variable (keep `VITE_API_URL`: PR
  verification builds in `verify-workspace.yml` still read it).
- **`ALLOW_ALL_IPS = "true"` in every backend environment** (hardcoded in `apps/backend/wrangler.toml`)
  makes the API public; revisit (per-environment `ALLOWED_IPS`, or auth) before it serves real data.

Not a TODO: `bak/` is intentionally tracked (see `architecture.md`).
