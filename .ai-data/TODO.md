# Open TODOs

- **Remove the vite-plus 1.0.0 release-age exclusions** — `pnpm-workspace.yaml` has
  `minimumReleaseAgeExclude` entries for `vite-plus@1.0.0`, `@voidzero-dev/vite-plus-core@1.0.0`, and
  its 8 platform binaries, added because 1.0.0 was installed ~7h after release (2026-09-28). Once
  they are >24h old (after 2026-09-29 05:37 UTC), delete the whole block and run `vp install` to
  confirm nothing else needs an exception.
- **TypeScript 7** — ⏸ **On hold until TypeScript 7.1 stable is released** (skip 7.0.x).
  Currently 6.0.2 (vite-plus is now on 1.0.0). Decide whether
  `@typescript/native-preview` (`tsgo`, used for `pack.dts.generator`) is still needed once TS 7
  ships the native compiler as `tsc`.
- **Renovate isn't producing PRs** — no `renovate/*` branches exist on the remote while
  dependencies were months behind (hono was 4.6.12 vs 4.13.x). Confirm the Renovate GitHub App
  is installed on the repo and check the Dependency Dashboard issue.
- **GitHub setting (not in code)** — Settings → Actions → "Require approval for all outside
  collaborators", as defense in depth for the fork guard in `on-pull-request.yml`.
- **Set `VITE_ADMIN_URL` per GitHub Environment** (`dev`/`staging`/`production`) — the
  frontend's absolute `og:url`/`og:image` tags are only emitted when it is set (deploy wiring is in
  `deploy-workspace.yml`). Until then, deployed builds simply omit those tags.
- **Two design-system tests are timeout-prone under load** — `preview-registry-drift.test.tsx`
  (~3s locally) and the `ph` icon-loader test in `tokens.test.ts` hit the 30s timeout in a
  `dagger ready` that overlapped with a local `vp run ready` (2026-09-28); the same run passes when
  the machine is idle. Consider speeding them up (the drift test re-imports `Preview` after
  `vi.resetModules()` per case) before the shared self-hosted runner gets busy.

Not a TODO: `bak/` is intentionally tracked (see `architecture.md`).
