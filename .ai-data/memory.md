# Persistent Memory & Decision Log

This file acts as a chronological ledger for major architectural shifts, context updates, and monorepo conventions.
Entries describe the repo **as of their date** — older ones may name files or commands that have
since been renamed or removed (e.g. `ci.yml`, `mise run ci`); the topic docs in `.ai-data/` and
AGENTS.md reflect the current state.

## 2026-08-12: Migration to Mise Tasks

- **Decision**: Migrated loose root-level bash scripts (`check.sh`, `clean.sh`, `create.sh`, `init.sh`, `start.sh`) into `.mise/tasks/`.
- **Reasoning**: `mise` provides a standardized, discoverable, and self-documenting interface for high-level repository automation.
- **Impact**: All high-level interactions should now use `mise run <task>`.

## 2026-08-12: Backend Framework Update

- **Decision**: Removed `vite-plugin-node` from the backend setup.
- **Reasoning**: Shifted to a standard Node.js Express API structure to simplify the backend runtime and decouple it from Vite-specific server plugins.

## 2026-08-12: Establishing `.ai-data`

- **Decision**: Designated `.ai-data` as the persistent, version-controlled knowledge base for all AI interactions and architectural context.
- **Structure**: Core knowledge is stored directly in `.ai-data/`, while temporary agent scratchpads, outputs, and generated artifacts are routed to `.ai-data/artifacts/` (which is `.gitignore`d).

## 2026-08-13: Fixing Environment Variable Loading in Sub-Packages

- **Context**: `process.env['ENV']` was returning `undefined` when running `vp build` in sub-packages (e.g., `packages/common`, `apps/frontend`).
- **Decision**: Added `envDir` configuration to `vite.config.ts` (pointing to the root directory) and invoked `loadEnv` at the top of the file. This ensures `isLocalViteEnv()` operates correctly during module evaluation for all builds.

## 2026-08-13: Architecture Documentation

- **Decision**: Completed a comprehensive `architecture_analysis.md` describing the Vite+ integration, observability stack, and shared foundation. Stored in `.ai-data/artifacts/` for persistent agent memory.

## 2026-08-31: Correction — Backend is Hono, not Express

- **Context**: The 2026-08-12 "Backend Framework Update" entry above says the backend was
  shifted to "a standard Node.js Express API structure." That is no longer (and may never have
  stayed) accurate — `apps/backend/src/app.ts` is a Hono app whose only surface is
  `server.fetch` (Fetch API `Request => Response`), served locally via `@hono/node-server`
  (`src/runtimes/node.ts`) and deployed to the edge via `wrangler`
  (`src/runtimes/edge.ts`, `wrangler.toml`). No Express dependency exists in
  `apps/backend/package.json`.
- **Decision**: Left the original entry above untouched (this is a chronological ledger), but
  recording the correction here so future agents don't propagate the stale "Express" claim.
  See `.ai-data/web-standards.md` for the full Node-vs-Web-API boundary this implies.
- **Impact**: `README.md`, `AGENTS.md`, `.ai-data/architecture.md`, and
  `.ai-data/artifacts/architecture_analysis.md` were corrected to say Hono.

## 2026-08-31: Backend Runtime Adapters Moved Under `src/runtimes/`

- **Decision**: Moved `apps/backend/src/index.ts` → `apps/backend/src/runtimes/node.ts` and
  `apps/backend/src/edge.ts` → `apps/backend/src/runtimes/edge.ts`. `src/app.ts` (the portable
  Fetch-API Hono app) and `src/client.ts` (the type-only RPC surface) stay at the top level.
- **Reasoning**: Groups the two runtime-specific adapters together so the "one Fetch-API core +
  N thin runtime adapters" architecture is visible in the file tree, not just in docs.
- **Impact**: Updated `wrangler.toml` (`main`), `apps/backend/vite.config.ts`
  (`devCommand`/`startCommand` overrides — the monorepo-wide default in the root
  `vite.config.ts` still assumes `src/index.ts` for other apps), `tsconfig.madge.json`, and the
  two integration test helpers that point `wrangler unstable_dev` directly at the edge entry
  (`apps/backend/tests/helpers/utils.ts`, `apps/frontend/tests/helpers/global-setup.ts`).

## 2026-08-31: `packages/common/src/utils/directory.ts` Moved to `src/node/`

- **Context**: `directory.ts` was a purely Node `fs`/`path`/`node:url` filesystem toolkit
  (readFile, createDir, deletePath, copyPath, backupPath, project-root detection, etc.) living
  inside `src/utils/`, the isomorphic barrel both `apps/frontend` (browser) and `apps/backend`
  (Node) import. That's why `package.json`'s `"browser"` field had to stub `node:fs`/
  `node:path`/`node:url` to `false`. It also had zero consumers anywhere in the monorepo and 0%
  test coverage.
- **Decision**: Moved to `packages/common/src/node/directory.ts` (new `./node` subpath,
  deliberately not re-exported from the root barrel or `./utils` — same pattern as the existing
  `./server` subpath). Removed the now-unnecessary `node:fs`/`node:path`/`node:url` entries from
  `package.json`'s `"browser"` field; left `node:async_hooks`/`node:crypto`/`node:util` in place
  since no source file imports them directly (likely needed by a transitive dependency).
- **Reasoning**: Keeps the isomorphic surface (`.`, `./utils`, `./environment`, `./logger`,
  etc.) genuinely free of Node-builtin imports, so it no longer relies on a `"browser"`-field
  workaround for something that should never have been reachable from the browser bundle.
- **Impact**: Verified with a real `apps/frontend` build (browser target) and `vp run -r test`
  (all 141 tests) — no regressions. See `.ai-data/web-standards.md` for the full isomorphic-vs-
  Node subpath convention this establishes for `packages/common`.

## 2026-08-31: Repo-Wide Web-Standard Scan — `packages/design-system` and a Real Guard Bug

- **Context**: A full-repository scan (beyond `packages/common`) found the exact same
  anti-pattern in `packages/design-system`: `src/utils/compile.ts` (Node `fs`/`path`/`util`,
  glob-scans component source at import time to build the UnoCSS safelist) was statically
  reachable via `utils/index.ts` **and** `configs/index.ts` → `unocss.ts`, both re-exported from
  the root `src/index.ts` barrel — even though nothing outside the package ever imports through
  those paths (only `/context` is consumed externally, by `apps/frontend`). This is why
  `package.json` carried a full 6-entry `"browser"` stub list.
- **Decision**: Removed `export * from './compile';` from `utils/index.ts` (matches how
  `update-stories.ts` was already, correctly, never barrel-exported) and removed
  `export * as configs from './configs';` from the root barrel (`configs`/`unocss.ts` is
  build-time-only — `uno.config.ts` already consumes it via a relative import, not the package's
  public exports). `@lightproject/design-system/configs` and `/utils` remain directly reachable
  via the wildcard subpath export for anyone who explicitly wants them — same pattern as
  `@lightproject/common`'s `./server`/`./node`.
- **Verification**: Removed the package's entire `"browser"` field and rebuilt `apps/frontend`
  (browser target) — no new externalized-module warnings or errors, confirming none of the 6
  stub entries were protecting against anything real once the barrels were fixed. Also rebuilt
  `packages/design-system`'s own Storybook (which does exercise `uno.config.ts` →
  `configs/unocss.ts` → `compile.ts`) to confirm the actual (non-barrel) consumer still works.
- **Separate bug found and fixed**: `context/mode-provider.tsx` and `context/theme-provider.tsx`
  both had `typeof globalThis === 'undefined' ? null : globalThis.document.documentElement` —
  `typeof globalThis` can never be `'undefined'` (that's the entire point of `globalThis`, ES2020),
  so this guard was dead code that didn't actually protect against `document` being unavailable.
  The project's own strict lint rules (`strict-boolean-expressions`, `no-unnecessary-condition`)
  confirmed the honest fix: this package's `tsconfig` models a DOM-always-present runtime, and
  both providers are pure client-side React components with no SSR path, so `document` is
  genuinely always present here — simplified to `globalThis.document.documentElement` with no
  guard at all, rather than adding a "more correct" runtime check the type system and actual
  usage both say is unreachable.

## 2026-08-31: `apps/frontend/index.html` — Broken Touch Icon and Two Guessed Colors

- **Context**: On a later re-scan of `index.html` (added in the very first "web-standard"
  turn), two more issues surfaced:
  1. `<link rel="apple-touch-icon" href="/favicon.svg" />` — iOS/iPadOS Safari has never
     supported SVG for home-screen touch icons (only PNG), unlike `rel="icon"` which does
     support SVG in modern browsers. This tag did nothing.
  2. `theme-color` (in both `index.html` and `manifest.webmanifest`) was set to a guessed
     `#0f172a`, and the manifest's `background_color` was guessed as `#ffffff` — neither was
     checked against the app's actual rendered colors.
- **Decision**: Removed the `apple-touch-icon` tag rather than ship a non-functional one — no
  SVG-to-PNG tooling is available in this environment (no ImageMagick/rsvg-convert/inkscape,
  `sharp` not installed), and the source SVG has filter/gradient effects a naive rasterization
  wouldn't reproduce faithfully; adding a new dependency for one static asset was judged
  disproportionate. A proper 180×180 PNG should be added later by whoever owns the brand
  assets. Fixed both colors to the actual computed value by extracting
  `--ds-surface-900: 18 18 18` (i.e. `#121212`) from the real built stylesheet
  (`apps/frontend/dist/assets/style-*.css`) — the design system defaults to dark mode
  (`ModeProvider`'s `initialMode = 'dark'`), so `#121212` is what the app's background/chrome
  actually renders as, not a guess. `manifest.webmanifest`'s `background_color` was updated to
  match too (it's the PWA splash-screen background; matching the real initial background avoids
  a white-flash before the app's CSS loads).
- **Left alone (a judgment call, not an oversight)**: `og:image` and `og:url` are technically
  required by the Open Graph protocol and are still missing — no known production domain or
  share-image asset exists for this starter template. Unlike the touch-icon, the OG/Twitter
  tags that _are_ present (`og:type`, `og:title`, `og:description`, `twitter:*`) are valid and
  functional on their own — crawlers commonly fall back to the crawled URL when `og:url` is
  absent, so this is a genuine content/asset-ownership gap, not a code defect the same way the
  touch-icon was. Revisit once this app has a real domain and share image.
- **Lesson**: color/asset values added to `index.html`/`manifest.webmanifest` must be pulled
  from the design system's actual generated output (e.g. grep the built CSS for the relevant
  `--ds-*` custom property), never guessed — this repo's own convention already says treat
  `packages/design-system` as the color source of truth.

## 2026-08-31: Self-Correction — `apps/frontend` Doesn't Actually Use the Design System's Theme

- **Context**: The `#121212` fix above (pulled from `packages/design-system`'s
  `--ds-surface-900`, assuming `ModeProvider`'s `initialMode = 'dark'` governs the page) was
  built on a wrong premise. `apps/frontend/src/main.tsx` only wraps `<App />` in
  `SessionProvider` — `ModeProvider`/`ThemeProvider` are **not mounted anywhere** in
  `apps/frontend`. The page's actual colors come entirely from `apps/frontend/src/style.css`'s
  own, separate `:root { --bg: #fff; ... }` / `@media (prefers-color-scheme: dark) { --bg:
  #16171d; }` — OS-preference-driven CSS, unrelated to the design system's class-toggle theming.
  (`style.css` and `app.tsx` are, in fact, still the stock Vite React starter demo page —
  `.hero`, `#next-steps`, `#docs`, `#social`, `.ticks`, the counter button — not yet replaced
  with real app content.)
- **Decision**: Corrected `theme-color` in `index.html` to two `media`-conditioned meta tags
  matching `style.css`'s actual `prefers-color-scheme` breakpoints exactly
  (`content="#ffffff" media="(prefers-color-scheme: light)"` /
  `content="#16171d" media="(prefers-color-scheme: dark)"`) — this is the standard pattern for
  a page whose CSS branches on that same media query. `manifest.webmanifest`'s `theme_color`/
  `background_color` (no media-query support in the base spec) were set to `#ffffff`, matching
  `style.css`'s unconditional default rule (the dark override only applies conditionally).
- **Lesson**: before trusting "the design system is the color source of truth," verify the
  component tree actually consumes it — check what's mounted in `main.tsx`, not just what
  exists in the shared package. `packages/design-system`'s `ModeProvider`/`ThemeProvider`
  remain valid, fixed, reusable components; they're just not wired into this particular app yet.

## 2026-08-31: Accessibility/DOM-API Pass — `apps/frontend/src/app.tsx` and `counter.ts`

- **Context**: A pass focused on HTML/accessibility standards (rather than JS runtime APIs)
  found two real issues in `apps/frontend`, the last remaining unswept angle:
  1. `app.tsx`'s `<img src={heroImg} .../>` had no `alt` attribute at all — a genuine HTML5/
     WCAG 1.1.1 violation. The other two images in the same `.hero` composition
     (`typescriptLogo`, `viteLogo`) already carry real alt text; `heroImg` is the decorative
     background graphic they're overlaid on.
  2. `counter.ts`'s `setCounter` used `element.innerHTML = \`Count is ${counter}\``to write
     plain text — the wrong DOM API for non-markup content (unnecessarily invokes the HTML
     parser; no XSS risk here since`counter` is an internal integer, but still incorrect API
     choice).
- **Decision**: Added `alt=''` to `heroImg` (decorative, consistent with how the icon images
  elsewhere in the same file already use empty alt for decoration next to text). Changed
  `element.innerHTML` to `element.textContent` in `counter.ts`.
- **Verification**: `vp check` (203 files clean), `vp run -r test` (141 tests), and a real
  `apps/frontend` production build — all clean, no regressions.
- **Not touched**: `packages/design-system`'s `Icon`/`Logo` components render decorative
  `<span>`/CSS-icon content with no built-in `aria-hidden` — left alone since both spread
  `...props` onto the root element, so consumers can already add `aria-hidden`/`role`
  contextually; this is an extensible API choice, not a spec violation, unlike the two fixes
  above.

## 2026-09-09: Dagger Pipeline for Local + CI Parity

- **Decision**: Added a TypeScript Dagger module at `dagger/` (`dagger init --sdk=typescript`)
  that wraps `pnpm install` + the `vp` task runner in a hermetic container. GitHub Actions
  (`.github/workflows/ci.yml`) now runs `dagger/dagger-for-github@v8` calling `dagger call ready`
  instead of `voidzero-dev/setup-vp@v1.20.0` + `vp run ready` directly on the runner — the exact same
  containerized pipeline now runs on a laptop (`dagger -m dagger call ready`, or `mise run ci`)
  and in CI, closing the "works on my machine" gap.
- **Why a container at all**: `dagger` was already added to `mise.toml`'s `[tools]` (see
  `mise.lock`/`mise.toml` diff from an earlier session) before this module existed — this entry
  fills in the module itself.
- **Caching design** (`dagger/src/index.ts`): dependency install is cached on manifests alone
  (`package.json` + `pnpm-lock.yaml` + `pnpm-workspace.yaml`, via `Directory.filter`) so Dagger's
  own content-addressed cache skips `pnpm install` entirely when only source files change — the
  common case. The pnpm store and vp's own task cache (`.vite-hooks/`, see `clean:build` script)
  are mounted as `LOCKED` `CacheVolume`s so warm caches survive across separate `dagger call`
  invocations on the same engine (i.e. iterative local dev). In CI, cross-run persistence of
  those cache volumes requires a `DAGGER_CLOUD_TOKEN` repo secret (optional, wired into
  `ci.yml`'s `cloud-token` input) — without it every CI run is a cold cache, no worse than the
  previous setup.
- **Container needs `git`**: `node:24.15.0-slim` has no `git`; `pnpm install`'s `prepare` script
  runs `vp config`, which shells out to git and needs it present (it degrades gracefully to
  "`.git` can't be found" without a real repo, which is expected — `.git` itself is excluded from
  the container's mounted source).
- **Gotcha found while validating**: a standalone `test()` call failed with
  `Cannot find package '@lightproject/common/configs'` — workspace packages' `exports` map
  resolves subpath imports to `dist/*` at runtime (see `packages/common/package.json`), so tests
  can't import them until the package is built. `vp run ready`'s script order already builds
  before testing; the Dagger module's `test()` function now does the same (`build` then `test`)
  so it's safe to call standalone, matching what `ready()` does implicitly. `check()` (format/
  lint/type-check) doesn't have this issue — it's static analysis, not runtime imports.
- **Not committed**: `dagger/sdk/` (Dagger's vendored TS SDK client) is gitignored by Dagger's
  own default `dagger/.gitignore` — verified it regenerates automatically on `dagger call` even
  when absent, so this isn't something to "fix."

## 2026-09-13: CI Hardening — Explicit Secrets, Renovate

- **Decision**: Removed `secrets: inherit` from `pr.yml`/`main.yml`/`trigger.yml`. It was a
  blanket grant that `ci.yml` never actually consumed (grepped — no `secrets.*` reference
  existed anywhere in the workflow files); on the fork/PR-triggerable path it was pure unused
  blast radius against the privileged, Docker-socket-mounted self-hosted runner. `CLOUDFLARE_API_TOKEN`
  is now declared explicitly on `ci.yml`'s `workflow_call.secrets` and passed by name only from
  `main.yml`/`trigger.yml` — `pr.yml` gets none, matching that its Deploy step never runs.
- **Not done**: the actual `dagger call wrangler` deploy wiring was drafted and then deliberately
  reverted — not needed yet, revisit when a real backend Cloudflare Workers deploy is wanted.
  `ci.yml`'s Deploy step is still the placeholder echo.
- **Added `renovate.json`**: chosen over Dependabot because `pnpm-workspace.yaml`'s `catalog:`
  entries need a bot that understands the catalog protocol — Dependabot's npm ecosystem support
  doesn't resolve `catalog:`-referenced versions reliably. Scoped deliberately narrow:
  `ignorePaths: ["dagger/**"]` keeps Renovate out of the Dagger module entirely (it's
  Dagger-managed, not pnpm/vp-managed — see the two "hard walls" above), and the `vite-plus`/
  `@voidzero-dev/vite-plus-core` pair is grouped with a note to hand-bump the pinned
  `VITE_PLUS_IMAGE` tag in `dagger/src/index.ts` and mise.toml's `viteplus` entry alongside it
  rather than let Renovate touch the toolchain image/version pins unsupervised. Needs the Renovate
  GitHub App installed on the repo before it does anything — not something committing this file
  alone accomplishes.

### 2026-09-09 follow-up: module discovery, and two hard walls in Dagger's isolation

- **`dagger.json` moved to repo root**: originally `dagger.json` lived inside `dagger/` (module
  root = `dagger/`), which meant every invocation needed `dagger -m dagger call ...`. Re-ran
  `dagger init --sdk=typescript --name=viteplus --source=dagger .` from the repo root instead —
  this puts `dagger.json` at the repo root with `"source": "dagger"` pointing at the actual
  module code, and `dagger call`/`dagger functions`/`mise run ci` now all work with **no `-m`
  flag** from anywhere in the repo (Dagger's own module auto-discovery finds root `dagger.json`).
  `.github/workflows/ci.yml`'s `dagger/dagger-for-github` step no longer needs a `module:` input
  either, for the same reason.
- **Wall #1 — can't `extends` a tsconfig outside `dagger/`**: tried making `dagger/tsconfig.json`
  extend the root `tsconfig.base.json` (to stop duplicating `strict`/`target`/etc.) via
  `"extends": "../tsconfig.base.json"` plus `dagger.json`'s `"include": ["tsconfig.base.json"]`.
  This reproducibly fails with `Error: File '../tsconfig.base.json' not found` from inside the
  module's own bootstrap. Root cause: the Dagger TS module's entrypoint is loaded by `tsx`,
  which resolves `tsconfig.json#extends` against the container's disk **before** any Dagger API
  call runs — and `include` only makes extra repo files fetchable _through_ the Dagger API
  (`dag.currentModule().source()`) at runtime, not present on disk at that early boot point. So
  `dagger/tsconfig.json` **must stay self-contained** (reverted to the plain `dagger init`
  version: `target`/`moduleResolution`/`experimentalDecorators`/`strict`/`skipLibCheck` +
  the `paths` mapping to `./sdk`). This is a hard constraint of how the TS SDK boots, not a
  config mistake — don't retry this without a different mechanism.
- **Wall #2 — `dagger/package.json`'s `typescript` dependency + `yarn.lock` keep coming back**:
  removed both (module doesn't need a local `typescript` install to execute — `tsx` handles
  transpilation itself, and `dagger call` runs fine without them, confirmed). But `dagger develop`
  (needed whenever the module's exported functions change, or the pinned `engineVersion` bumps)
  regenerates both unconditionally — same root cause as wall #1: the module's build container
  can't see the monorepo's hoisted root `node_modules/typescript`, so Dagger's own TS SDK codegen
  provisions an isolated one via `yarn`. Currently removed per an explicit ask, but expect them
  to reappear after the next `dagger develop` — that's Dagger managing its own module tooling,
  not a bug, and not worth fighting (don't add a script to re-delete them after every `develop`).

## 2026-09-13: Verified `disableDefaultFunctionCaching: true` Doesn't Cost Real Reuse

- **Question**: `dagger.json` sets `"disableDefaultFunctionCaching": true`, which disables
  Dagger's own function-level result memoization (an identical `dagger call` with identical
  args would normally short-circuit entirely). Was this quietly forcing every `dagger call` to
  redo expensive work that the mounted `CacheVolume`s (pnpm store, vite-plus package
  manager/js-runtime, per-workspace task-cache) were supposed to make cheap?
- **Verified empirically** (`dagger call check --workspace=@lightproject/design-system`, three
  back-to-back runs, no `dagger cache clean` between them):
  1. Cold-ish run: `.check()` took 39.9s.
  2. Immediate rerun, zero source changes: `.check()` took 7.2s (~5.5x faster) — proves the
     content-addressed layer cache and `CacheVolume`s are doing real work independent of
     function-level caching.
  3. Rerun after a genuine one-line content change to a tracked test file: `.check()` took
     30.3s — back near the cold timing, proving the cache correctly invalidates on real changes
     rather than silently serving stale results from run 2.
- **Conclusion**: `disableDefaultFunctionCaching: true` is not costing meaningful reuse in
  practice — the layer cache + explicit `CacheVolume`s already capture the expensive part
  (install, lint/format/type-check tool warm-up), which is exactly what function-level caching
  would have shortcut anyway. No change needed; leave as-is.

## 2026-09-24: Security Hardening Pass (IP allowlist, CI forks, deps, CSP)

- **Client-IP spoofing fixed**: `apps/backend/src/middlewares/trust-proxy.ts` used to take the
  first `X-Forwarded-For` / `X-Real-IP` value, so any client could send
  `X-Forwarded-For: 127.0.0.1` and pass the IP allowlist in develop/staging/production. The
  client IP now comes from the TCP peer on Node (`X-Forwarded-For` only honored when the peer is in
  the new `TRUSTED_PROXIES` env var, taking the rightmost untrusted hop) and from
  `CF-Connecting-IP` on Workers (overwritten by Cloudflare's edge). `X-Real-IP` is never trusted.
  Note: local wrangler/miniflare keeps a client-sent `CF-Connecting-IP` and only fills it in when
  absent — which is why the wrangler-runtime tests can simulate client IPs with that header.
- **`AppEnv.Bindings`** (`apps/backend/src/schema.ts`) now models `c.env` (Node `HttpBindings`
  subset), replacing the `isNodeEnv(env: unknown)` guard. `c.env` is still `undefined` when
  `app.request()` is called without bindings, so it is read through a
  `NodeBindings | undefined` parameter.
- **Fork PRs are gated off the self-hosted runner** (`on-pull-request.yml` job-level `if:`), since
  the runner has the host Docker socket and its GitHub PAT in-env.
- **Actions pinned to commit SHAs** (`# vX.Y.Z` comments), with Renovate's
  `helpers:pinGitHubActionDigests`.
- **Deps**: hono 4.6.12 → 4.13.8 (41 advisories). `packages/common` now declares `hono` itself —
  it uses `@hono/node-server`, whose `hono` peer otherwise got auto-installed at "latest", creating
  a second unpinned copy (and a `minimumReleaseAgeExclude` entry). Added a `hono` Renovate group.
  Hono 4.13 narrowed `c.json()`/`HTTPException` to `ContentfulStatusCode` and deprecated
  `c.req.routePath` (→ `routePath(c)` from `hono/route`). Storybook 8.6 → 10.6
  (`addon-essentials` → `addon-docs`, `@storybook/theming` → `storybook/theming`, types from
  `@storybook/react-vite`, toolbar `showName` → `title`). Wrangler → 4.136.2 (patched `sharp`).
  Transitive `fast-uri`/`js-yaml`/`nanoid` refreshed in the lockfile. `vp pm audit`: 52 → 1 (low).
- **CSP split**: `'unsafe-inline'` + `cdn.jsdelivr.net` now only apply under `docsEndpoint`
  (Swagger UI); all other responses get the strict policy.

## 2026-09-24: Storybook Light/Dark Toggle Uses a Channel Event, Not a Global

- **Problem**: toggling the `theme` global on a docs page remounted the whole page — addon-docs'
  `DocsRenderer` wraps docs in `ErrorBoundary key={Math.random()}` and Storybook re-renders docs
  on _every_ globals change, so there is no config to avoid it. Story pages only re-rendered.
- **Decision**: the toggle is a local manager tool (`.storybook/manager.ts`) that persists the
  mode to `localStorage` and emits `lightproject/mode-changed` on the channel; `preview.tsx`
  subscribes with React state (`useStorybookMode`) in both the story decorator and the docs
  container (`.storybook/mode-channel.ts` holds the shared event/key). Verified via the real
  manager UI: docs and story views update in place, and the mode survives reload.
- **Gotchas**: `manager.ts` must not use JSX — Storybook compiles the manager entry with the
  classic runtime and crashes the manager with "React is not defined". The old
  `?globals=theme:light` URL param no longer applies. Storybook 10's `themes.normal` follows the OS
  color scheme, so the docs container uses `themes.light` explicitly. Bare `bg-adaptive` /
  `text-adaptive` generate no CSS — use the suffixed tokens (`bg-adaptive-surface`, …).

## 2026-09-24: Browser (e2e) Tests for the Light/Dark Toggle; Frontend Share Tags

- **Tests**: jsdom unit tests (`packages/design-system/tests/unit/storybook-*.test.ts(x)`,
  `apps/frontend/tests/unit/preview-page.test.tsx`) plus Playwright e2e (`tests/e2e/` +
  `playwright.config.ts` in both workspaces, `vp run -r test:e2e`). Each was mutation-checked: re-introducing
  `themes.normal`, JSX in `.storybook/manager.ts`, or a remount-on-toggle (`key={mode}`) makes them
  fail. Probes must sit _inside_ the `ModeProvider` being toggled — `Preview` owns its own provider,
  so the frontend Home link (outside it) could not detect a remount.
- **Test-environment gotchas**: emulate a _dark_ OS (`colorScheme: 'dark'` / a `matchMedia` stub)
  or `themes.normal` looks correct by accident; `:root` has a 0.5s background transition, so disable
  transitions before comparing colors; the page background lives on `<html>`, not `<body>`.
- **Not in `ready` yet**: Dagger's `ready` runs root `vp run ready` in the browser-less `vite-plus`
  container, so e2e stays a separate task until CI installs Chromium (see `TODO.md`).
- **Share tags**: `apps/frontend/social-meta.ts` injects absolute `og:url`/`og:image`/`twitter:image`
  only when the frontend's public URL `ADMIN_URL`/`VITE_ADMIN_URL` is set (same precedence as
  `adminUrl` in `packages/common`; wired in `deploy-workspace.yml` from `vars.VITE_ADMIN_URL`).
  `og-image.png` / `apple-touch-icon.png` were rendered with headless Chrome from `favicon.svg`
  (the tooling gap noted on 2026-08-31 no longer applies).

## 2026-09-28: Test Layout — `tests/unit/` and `tests/e2e/` in Every Workspace

- **Decision**: all workspaces (backend, common, design-system, frontend, library, dagger) keep unit
  tests in `tests/unit/` and Playwright browser tests in `tests/e2e/`. The shared Vitest `include`
  (root `vite.config.ts`) only matches `tests/unit/**`, so e2e specs (`*.spec.ts`) never run under
  Vitest, and Playwright's `testDir` is `tests/e2e`. Setup/global-setup paths, the plop
  component-test template, and its output path moved accordingly.
- **Share-tag URL**: the frontend's og:url/og:image use the existing `ADMIN_URL` / `VITE_ADMIN_URL`
  (the frontend's public URL; same precedence as `adminUrl` in `packages/common`) instead of a new
  variable. Local builds with the default `.env` therefore emit `http://localhost:3001` share tags —
  harmless locally; deploys pass `vars.VITE_ADMIN_URL`.

## 2026-09-28: Vite Task Cache — Artifacts Busting the Cache, and Madge "Skipped" Warnings

- **Madge**: Storybook 10 packages are exports-only, which madge's resolver can't follow, so they
  showed as "Skipped". Fixed like the existing `vite-plus/test` entries: `@storybook/*` and
  `storybook/*` map to `package.json` in `tsconfig.madge.json` (external deps don't matter for
  circular-dependency detection).
- **Cause of artifact cache misses** (verified with `vp run --last-details`): automatic tracking
  fingerprints _directory listings_, and `input` `!` globs exclude paths but NOT entries inside a
  tracked listing. So creating/deleting `coverage/`, `tsconfig.tsbuildinfo`, `.wrangler/`, … changed
  the listing of the folder holding them. (`dist/` was already fine: Vite+ reports `build.outDir`.)
- **Fix** (`getTaskCache` in root `vite.config.ts`, formerly `getCommonRunProps`, verified by a hit/miss battery):
  - package tasks: `'!.'` drops the package root's listing; an explicit `'**'` minus artifact globs
    keeps new/removed/edited package files (incl. new root-level files) invalidating the cache.
  - workspace-root tasks (`root`, `madge`, `dagger:*`, scope `'workspace'`): `'**'` + `'!apps/*'`,
    `'!packages/*'`, `'!dagger'`. Do NOT use `'!.'` there — it hid new repo-root files (stale hits).
  - `.git/**` is excluded explicitly (`'**'` otherwise picks up `.git/index`, changed by any git op).
  - Rejected: workspace-based negations (`{ base: 'workspace', pattern: '!…' }`) — they suppressed
    new-file detection in the task's own package.
- **`vite.config.d.ts(.map)`** was a by-product of `vp pack`'s tsgo dts step: tsgo runs with
  `--rootDir <tsconfig dir>` and the package tsconfigs include `../../vite.config.ts`, so its
  declaration landed in the repo root. Fixed at the source with per-package `tsconfig.pack.json`
  (`include: src/**`) via `pack.dts.tsconfig`; published declarations verified byte-identical.
  (The `tsc` generator also avoids it, but prints types differently; tsgo was kept by choice.)
- **Result**: deleting every artifact (20 paths, incl. both `.wrangler/`) then `vp run ready` →
  41/41 cache hits. The last gap (`apps/frontend#test` missing when `apps/backend/.wrangler`
  changed — its tests start the backend worker, which lists `apps/backend`) is closed by `'!../*'`
  in the package scope (drops same-group sibling folder listings). Verified: backend source edits
  still invalidate the frontend tests; new frontend src/root files still invalidate its check.
- **Testing gotcha**: `input` changes don't invalidate an existing fingerprint by themselves; a replayed
  (hit) run doesn't re-record. Run `vp cache clean` before evaluating a new `input` config.

## 2026-09-28: Vite+ 1.0.0 (Vitest 5) Upgrade

- **Versions**: `vite-plus` / `@voidzero-dev/vite-plus-core` 1.0.0 (bundles vite 8.3.1, rolldown
  1.2.11, tsdown 0.23.0; depends on vitest 5.0.1, oxlint 1.85.0, oxfmt 0.70.0),
  `@vitest/coverage-v8` 5.0.1. Pins that must move together: catalog, `VITE_PLUS_IMAGE`
  (dagger/src/helpers/constants.ts), `vp-version` default in `.github/actions/setup-toolchain`,
  `VP_VERSION` in install.sh, mise.toml's `viteplus` comment (listed in renovate.json's toolchain
  rule). `vp upgrade <version>` upgrades the repo-local CLI in `tmp/.local/bin/vp` (the only `vp`
  on PATH here; keeps the previous versions for `vp upgrade --rollback`).
- **Vitest pin**: as the 1.0 upgrade guide recommends, the catalog has `vitest` and
  `pnpm-workspace.yaml` overrides `vite@*` / `vitest@*` → `catalog:` (the `@*` keys leave
  `catalog:` specs alone), so the whole workspace shares the Vitest copy `vp test` runs.
- **Breaking change — task cache config**: `env` / `untrackedEnv` / `input` / `output` moved under
  `cache: { … }`. 1.0 hard-errors on the old shape ("Cache settings … must be set under `cache`"),
  so the shared helper is now `getTaskCache()` (root `vite.config.ts`, exported to workspace
  configs), typed as `TaskCacheConfig` derived from `UserConfig['run']` (Vite+ doesn't export it):
  every cached task sets `cache: taskCache` or `cache: { ...taskCache, output }` explicitly. Cache battery re-verified on 1.0.
- **`vp migrate` gotchas**: it walked into `bak/` and rewrote 7 archived files (restored from git),
  rewrote catalog entries to bare versions (breaking the `npm:<pkg>@<ver>` convention), then
  crashed in its Vitest 5 step ("Migration input changed: pnpm-lock.yaml"). Prefer applying its
  intended changes by hand; if it is ever run, check `git status bak/` afterwards.
- **oxlint 1.85** newly flagged `consistent-function-scoping` in `packages/common/src/utils/rum.ts`.
- **Audit**: the remaining low `esbuild <0.28.1` advisory did NOT clear with 1.0 (an earlier TODO
  assumed it would): `@voidzero-dev/vite-plus-core@1.0.0` still depends on `tsx`, which pins
  `esbuild ~0.27`. Dev-server-on-Windows only; waits on an upstream tsx/vite-plus-core bump.
- **CI**: `tsconfig.pack.json` is in Dagger's `BUILD_ARTIFACT_KEEP` (dagger/src/helpers/constants.ts), so
  `dagger call build-artifact` keeps it next to `tsconfig.json`/`vite.config.ts` (the kept
  `vite.config.ts`'s `pack.dts.tsconfig` points at it); `index.build.test.ts` asserts the keep list.
  Source mounts and affected-workspace detection needed no change (whole workspace dirs /
  `vp pm list --filter "...[sha]"`). Verified with real `build-artifact` calls (library, design-system).
- **Storybook e2e flake (fixed 2026-09-28)**: on a freshly started `storybook dev` (Playwright's
  `webServer` starts one per run), Vite reloads the preview iframe ~2s after first load while it
  finishes pre-bundling deps; the mode class only appears after that reload, so the first test (docs
  page) intermittently missed its 5s window. The spec now waits for a _settled_ preview (mode class
  present and no iframe navigation for 1s, up to 30s) and asserts no preview navigation happens while
  toggling. Verified 6/6 runs; `themes.normal` and remount mutations still fail it.

## 2026-09-28: `test:unit` / `test:e2e` Split, E2E in CI, Videos

- **Renames**: package task `test` → `test:unit`, root `dagger:test` → `dagger:test:unit`, Dagger
  function `test` → `testUnit` (CLI `test-unit`; exports `test-unit.output|exit-code|row.md`). The
  built-in `vp test` command is unchanged. `mise run dagger <fn> --export` names files after the CLI
  function name, so file names must follow it.
- **Dagger CLI naming gotcha**: `testE2e` becomes `test-e-2-e` (digits are split; a
  `@func('test_e2e')` alias doesn't help), hence the function is `testEndToEnd` → `test-end-to-end`.
- **E2E in CI**: `testEndToEnd` requires a `playwright.config.ts` in the workspace, installs
  Chromium's apt deps as root and the browser as `vp` into the `playwright-browsers` cache volume,
  runs `test:e2e`, and returns `e2e/` (videos, JSON, HTML report) + `test-end-to-end.row.md`.
  `verify-workspace.yml` runs/uploads it (`e2e-<workspace>`) when `hashFiles('*/<ws>/playwright.config.ts')`
  matches; `verify.yml`'s setup job outputs `e2e_workspace_list` and the artifacts job posts an
  `e2e-report` PR comment.
- **apt through the engine proxy**: the Dagger engine forwards `HTTP(S)_PROXY` (the
  `registry-cache` proxy) into containers, and that proxy mangles plain-HTTP responses from
  `deb.debian.org` ("Clearsigned file isn't valid, got 'NOSPLIT'"). `withPlaywrightChromium`
  rewrites `/etc/apt/sources.list.d/debian.sources` to HTTPS first (HTTPS is a clean CONNECT tunnel).
- **Videos/reports**: Playwright `video: 'on'` + `json`/`html` reporters, all under `tmp/e2e/`.
- **`test:e2e` is cached** (`...commonTaskProps.cache` + output `tmp/e2e/**`): verified a hit
  restores the report/videos, and edits to the workspace _and_ to design-system source (read by the
  frontend's dev server child process) invalidate it.
- **apt must bypass the engine proxy** (2026-09-29): even over HTTPS, `apt-get update` later hung
  indefinitely on the `registry-cache` CONNECT tunnel (direct egress answered in 0.1s). So
  `withPlaywrightChromium` also writes `/etc/apt/apt.conf.d/99-no-proxy`
  (`Acquire::http(s)::Proxy "false"`); registry/npm traffic still uses the proxy. Verified real
  `test-end-to-end` runs: design-system 2 passed, frontend 1 passed, with videos exported.

## 2026-09-29: Vitest `fsModuleCache`; More E2E Coverage

- **`test.fsModuleCache: true`** (root `getCommonViteConfig`, stable in Vitest 5) persists module
  transforms in `node_modules/.vitest-cache` — removes the "Transform … re-done on every run"
  diagnostic; dagger's warm `vp test` 5.2s → 2.8s. Verified a source edit is re-transformed.
- **New e2e**: `apps/frontend/tests/e2e/home-navigation.spec.ts` (home renders + counter; home ↔
  `/preview` via links and browser back/forward) and
  `packages/design-system/tests/e2e/preview-app-mode.spec.ts` (the design-system preview app — same
  `<Preview>` as frontend `/preview` — toggling in place). The design-system Playwright config now
  starts two `webServer`s (Storybook 6116 + `vp dev` preview app 6117; ports in `tests/e2e/ports.ts`).
  Mutation-checked (broken Home link; remount on toggle). Passing locally 3/3 and in Dagger.

## 2026-09-29: Repo-Wide Review Fixes — Fail-Closed Deploy ENV, Error Masking, `common` Split

- **Found (verified live)**: the deployed backend Worker ran as `ENV=local` — nothing set `ENV`,
  and `getEnvName()` defaults to `local`. On `lightproject-backend.wataru.workers.dev`, `/docs`,
  `/docs/openapi-http.json` and `/metrics` returned 200, error bodies carried stack traces, and the
  IP allowlist was bypassed (local/other envs counted as "safe").
- **Decision**: fail closed at the deploy layer, not by changing `getEnvName()`'s default (that
  would break local dev/tests with no `.env`). `apps/backend/wrangler.toml` sets
  `ENV = "production"`; `deploy-workspace.yml` passes `--environment=<env>` to the Dagger
  `wrangler` function, which appends `--var ENV:<env>` (validated kebab-case). Unrecognized ENV
  values are no longer "safe" in `trust-proxy.ts`, and `dev` is accepted as an alias of `develop`
  (corrected below: the GitHub Environment is actually `develop`). The wrangler test runtime passes the host's `getEnvName()` so
  the toml default doesn't leak into tests.
- **Other fixes**: 500 messages masked unless stack traces are allowed; `X-Request-Id` header
  (exposed via CORS); CORS origins trimmed; telemetry force-flushed per request only on edge
  (`waitUntil`) — Node relies on batch processors (tests call `flush` from `runtimes`); added an
  `http.server.request.duration` SDK histogram next to the exemplar gauge; public
  `PrometheusSerializer` import; `exemplar-metrics` moved `server/` → `utils/` and `rum`
  `utils/` → new `browser/` entry, which let the frontend drop its Node-builtin `external` list;
  `tsconfig.base.json` `customConditions` is now just `["typescript"]` (forcing `require` resolved
  culori's CJS types for ESM imports); compose ports bound to `127.0.0.1`; undici audit overrides;
  `ready` no longer re-runs `format`/`lint` (covered by `vp check`), and `mise run check` = fixes +
  `vp run ready`.
- **Not a bug**: the AI instruction files (`.github/copilot-instructions.md`, `.cursor/…`,
  `.aiassistant/…`) were already symlinks to AGENTS.md (git mode 120000).

## 2026-09-29: Per-Environment Workers, `requestId`, Logger Decoupled From Faro

- **Per-environment Workers**: every wrangler config has `[env.develop|staging|production]` blocks
  naming `lightproject-<app>-<dev|staging|production>` (user's choice: suffix all three; the old
  unsuffixed Workers are orphaned — see TODO). The Dagger `wrangler` function now takes a required
  `environment` (runtime-checked against `DEPLOY_ENVIRONMENTS`) and sets `CLOUDFLARE_ENV` instead of
  appending `--env`/`--var`, because design-system's `wrangler:deploy` task runs two
  `wrangler deploy` commands and trailing args only reach the last. Verified with
  `CLOUDFLARE_ENV=<env> wrangler deploy --dry-run` (per-env vars bind; assets/observability inherit).
  **Correction**: the GitHub Environment is `develop` (on-push-main/release/trigger), not `dev` —
  `dev` is only the Worker suffix; `deploy-workspace.yml` maps it via `WORKER_SUFFIX`.
- **`ALLOW_ALL_IPS = "true"`** is hardcoded in each backend env block (user's choice), so the
  deployed API is public; the top-level config keeps fail-closed `ENV = "production"` without it.
- **`sessionId` → `requestId`** in the backend: context var, tRPC ctx, both envelopes (breaking
  API field rename), `X-Request-Id`. `common`'s `RequestContext` now has optional `sessionId`
  (client/RUM session) and `requestId` (server request); logs, spans (`request.id`) and exemplars
  carry `requestId`. `requestLogger` reads `c.get('requestId')` rather than the ambient context —
  OTel `context.with` only propagates once a context manager is registered.
- **Logger no longer imports Faro**: `logger/browser-sink.ts` holds a `BrowserLogSink` that
  `browser/rum.ts`'s `initializeRum()` registers (`createFaroLogSink`). A sink registered after
  `setSessionId()` is synced immediately. The backend Worker bundle now has zero Faro references.
- **Gotcha**: wrangler (esbuild) resolves `@lightproject/common` via its `dist/` (no `typescript`
  condition), so wrangler-runtime tests and dry-run bundles use a stale `common` until
  `vp run --filter @lightproject/common build` — `vp run ready` builds before testing.

## 2026-10-09: One `requestId` Everywhere; Faro Keeps Its Own Session

- **Decision (user)**: rename the remaining `sessionId` too, frontend included — the app has a
  single id concept, `requestId`. `common/logger`: `setRequestId`/`getRequestId` (explicit id →
  request-context store → `'no-id'`), `startSpanWithRequestId`, `RequestContext.requestId` only,
  log entries/spans/exemplars carry `requestId`/`request.id` (no more `session.id`).
  design-system: `RequestIdProvider`/`useRequestId` (`request-id-context.tsx`,
  `request-id-provider.tsx`). Backend `resolveRequestId` = `ctx.requestId ?? getRequestId()`.
- **Faro**: we no longer override Faro's session (`setSession({ id })`/`resetSession()` are gone);
  Faro auto-generates and rotates its own session id. Our id is added as the session attribute
  `requestId` (`createFaroLogSink().setRequestId`, keeping Faro's session id), so it rides on every
  Faro signal and is carried into rotated sessions (faro-web-sdk's
  `addSessionMetadataToNextSession` merges current session attributes). Verified in
  faro-web-sdk 2.9.0: an attribute-only change keeps the session id. The sink is now
  `{ pushLog, setRequestId }`; `getRequestId()` no longer falls back to the Faro session id.
- `LogEntry`/`LogLevel`/`LogMode` live in dependency-free `logger/types.ts` again (re-exported from
  `formatters.ts`): `browser-sink.ts` importing them from `formatters.ts` is a madge cycle
  (`browser-sink → formatters → context → browser-sink`).
- **Follow-up (same day)**: dropped passing `requestId` to Faro at all — our log entries already
  carry it in their body, spans/exemplars carry `request.id`, and Faro's own signals share Faro's
  auto session id with our logs (the frontend id never reached the backend anyway; the trace link
  is `traceparent`). The browser sink is just `{ pushLog }`; `rum.ts` no longer touches Faro's
  session API. `registerBrowserLogSink` now lives in `browser-sink.ts` (not `context.ts`), which
  breaks the `browser-sink → formatters → context → browser-sink` cycle without `logger/types.ts`
  (removed; `LogEntry` stays in `formatters.ts`).

## 2026-10-09: Review Fixes — Wrangler Tasks Uncached, nginx `^~`, Prometheus Deep Import

- **Verified bug**: `wrangler:deploy` (and `:delete`/`:dev`) were cached Vite Tasks. Cached tasks
  run in a filtered env (only `cache.env`/`untrackedEnv` + a small default set), so
  `CLOUDFLARE_ENV` never reached wrangler — `CLOUDFLARE_ENV=staging vp run --filter
  @lightproject/backend wrangler:deploy --dry-run` resolved the top-level `ENV=production`, i.e.
  the old unsuffixed Worker — and a second run replayed from cache without deploying. All
  `wrangler:*` tasks are now `cache: false` (full env, always runs); re-verified the dry-run shows
  `ENV=staging` on every run. Backend `wrangler:dev` passes `--var ENV:local`.
- nginx `location /assets/` → `location ^~ /assets/`: regex locations are checked before plain
  prefix ones, so hashed JS/CSS got the 7d rule. Verified with a real nginx container
  (`/assets/*.js` → 1y `immutable`).
- `PrometheusSerializer` stays on the package-root import (user's call — no deep
  `build/src/...` path). The root also bundles `PrometheusExporter` (Node `http`/`url`
  references) into the Worker, but verified harmless: with the root import, the wrangler-runtime
  `/metrics` test (real workerd, no `nodejs_compat`) passes. Cost is only ~10 KB of unused code.
- `isRequestContext` accepts any non-array object (`requestId` is optional).

## 2026-10-09: Third Review Round

- `getRequestId()`: the request-scoped store now wins over the process-wide `setRequestId()` value
  (a server request's own id must not be shadowed by a page-level id in the same process).
- Dagger `wrangler` sets `DEPLOY_REQUESTED_AT` (timestamp) before `wrangler:deploy`, so Dagger's
  op cache can't replay a re-deploy/rollback of identical source without calling Cloudflare
  (`disableDefaultFunctionCaching` only covers function-call caching, not exec ops).
- `deploy-workspace.yml`: `VITE_API_URL` is always derived (`lightproject-backend-<suffix>`), no
  `vars.VITE_API_URL` override; `WORKERS_SUBDOMAIN` is a fixed `wataru.workers.dev` that must match
  `apps/backend/wrangler.toml`'s CORS origins. `develop` → `dev` Worker suffix via
  `inputs.environment == 'develop' && 'dev' || inputs.environment` (no ternary in GH expressions).
- Both duration metrics use stable HTTP semconv attributes (`http.request.method`,
  `http.response.status_code`, `http.route`). `isOtherEnvironment` removed (no callers).
- User will delete the old unsuffixed Cloudflare Workers manually.
- **Removed the top-level `[vars] ENV = "production"`** from `apps/backend/wrangler.toml` (user's
  call) and the now-redundant `--var ENV:local` on `wrangler:dev`. A wrangler run with no
  environment (local `wrangler dev`, tests) is `local` again via `getEnvName()`'s default.
  Deploys are unaffected: the Dagger `wrangler` function requires `--environment`, and each
  `[env.*]` block sets its own `ENV`. Remaining risk: a manual `wrangler deploy` with no env would
  deploy an unhardened `lightproject-backend` Worker.

## 2026-10-09: Final Review Fixes

- `http.server.request.duration` uses seconds-based `advice.explicitBucketBoundaries` (HTTP semconv);
  the sdk-metrics default `[0, 5, 10, …, 10000]` is milliseconds-based and put every request in one
  bucket. Verified via `/metrics`: buckets start at `le="0.005"`.
- OTel stable packages bumped to 2.11.0 (resources, sdk-metrics, sdk-trace-web) to match the
  0.222.0 experimental ones, then `vp dedupe` — no more 2.10/2.11 split. Faro's own pinned 0.219.x
  packages still bring a 2.8.0 set (pre-existing, not fixable from our catalog).
- `shutdownTelemetry()` flushes buffered exemplar metrics (Node no longer flushes per request).
- OTel log record attribute is `request.id` (same key as spans/exemplars).
- `deploy-workspace.yml` builds `VITE_API_URL` in-step from `WORKER_SUFFIX`/`WORKERS_SUBDOMAIN`.
- New audit advisories since 2026-09-29 (handlebars critical via plop; brace-expansion, braces,
  source-map-js, wrangler's sharp) — all dev-only, same versions as HEAD, not caused by this change.
- **Advisory follow-up**: overrides pin `brace-expansion` (1.1.21 / 5.0.12), `handlebars` 4.7.10,
  `sharp` 0.35.5 (miniflare pins 0.35.4 exactly) and `source-map-js` 1.2.2 — all patch releases
  > 24h old. `vp pm audit` is down to `esbuild` (low, via tsx) and `braces` (no fixed version
  > published). Verified with `vp run ready` and plop/commitizen smoke checks.

## 2026-10-09: Vite+ 1.1.0; Fourth Review Fixes

- **Vite+ 1.0.0 → 1.1.0** (released 2026-10-07): catalog `vite-plus`/`vite` (vite-plus-core) 1.1.0,
  `vitest` and `@vitest/coverage-v8` 5.0.3 (vite-plus 1.1.0 pins vitest 5.0.3), Dagger
  `VITE_PLUS_IMAGE` `ghcr.io/voidzero-dev/vite-plus:1.1.0` (verified with a real
  `dagger call check --workspace=@lightproject/library`), setup-toolchain `vp-version` default,
  `install.sh` `VP_VERSION`, mise.toml's commented entry. Global CLI upgraded by the user.
  `vp toolchain`: one vitest (5.0.3) and one vite-plus-core (1.1.0).
- **Gotcha**: Workers forbid random values (and timers/I/O) in global scope — a module-level
  `crypto.randomUUID()` made workerd fail to start (all wrangler-runtime tests). `service.instance.id`
  is now generated lazily by `getServiceInstanceId()` (utils/telemetry), on both OTel resources and
  the exemplar export, so concurrent isolates/pages don't share cumulative series.
- Overrides trimmed to exact-pin parents only: `undici` 7.x + `sharp` (miniflare), `source-map-js`
  (magicast pins 1.2.1 exactly — the lockfile keeping 1.2.2 without an override is stale). Overrides
  for in-range parents (`undici` 8, `brace-expansion`, `handlebars`) dropped; the lockfile keeps the
  patched versions.
- nginx: only static media keeps the 7d cache; unhashed JS/CSS (e.g. Storybook `sb-manager/`) falls
  through to `no-cache`. `X-Request-Id` is set on the final response after `next()` (tested on
  `/metrics` and tRPC). TODO no longer says to delete `vars.VITE_API_URL` (PR verify builds use it).

## 2026-10-09: Fifth Review — Delta Temporality Instead of Instance IDs

- **Metrics design (supersedes the per-instance `service.instance.id`)**: many concurrent/short-lived
  exporters (browser tabs, Workers isolates) share one resource identity. A random instance id
  per page/isolate fixed the cumulative-series collisions but exploded Mimir series cardinality
  (it becomes the `instance` label). Now both OTLP metric exporters (`server/telemetry.ts`,
  `browser/rum.ts`) use `temporalityPreference: DELTA`, and the collector's `deltatocumulative`
  processor (first in the metrics pipeline) sums the deltas into cumulative series for
  `prometheusremotewrite`. Verified: `otelcol-contrib validate` on the config, and an end-to-end
  run (two deltas 2 then 3 under one identity → cumulative 2 then 5). The backend's Prometheus
  pull `/metrics` stays cumulative (temporality is per reader). `getServiceInstanceId` removed.
  The hand-rolled exemplar gauge is last-value (cumulative non-monotonic) and passes through.
- 5xx messages are masked unless stack traces are allowed, for every error type — tRPC failures
  arrive as `HTTPException(500, <original message>)` and were leaking. 4xx messages pass through.
- **Metric samples are intentional (user)**: this starter's telemetry examples are backend =
  request duration (`http_server_duration_seconds` exemplar gauge) + `request_hits` Counter, and
  frontend = tRPC call duration (`http_client_duration_seconds`) + button clicks (`counter.ts`) —
  there to illustrate Grafana for starters, not redundant. `request_hits` was briefly removed as a
  "duplicate" and restored; the `http.server.request.duration` histogram added in round 1 was
  removed to keep the backend to those two samples.
- Renovate's vite-plus group includes `vitest` (vite-plus and coverage-v8 both pin it exactly) and
  lists mise.toml's commented `viteplus` entry.

## 2026-10-09: Sixth Review — Single-Writer Metrics, tRPC Error Formatter

- **Correction to the delta-only design above**: `deltatocumulative` assumes one writer per stream
  and silently drops overlapping deltas from concurrent writers sharing an identity (verified on
  otelcol-contrib 0.131.0: writers A=2,1 and B=3 → 3 instead of 6; the `interval` processor does
  not help). Best practice = OTel single-writer principle: every SDK instance sets a unique
  `service.instance.id` (lazy `getServiceInstanceId()` via `generateUuid`, on both OTel resources
  and the exemplar export), exporters send deltas, the collector's `deltatocumulative`
  (`max_stale: 5m`) builds a cumulative stream per instance, and Grafana sums across instances
  (`sum without (instance, service_instance_id) (...)`). Verified end to end: A → 3, B → 3,
  sum 6. Series churn per instance is the accepted cost (like short-lived pods in Prometheus).
- tRPC `errorFormatter` (in `routers/utils.ts` `t`): strips `stack` and masks 5xx messages unless
  `config.enableErrorStack` — covers batched responses (the frontend's default), which bypass Hono's
  global error handler because the body is an array.
- Flaky `shutdownTelemetry` exemplar-flush test: test files share module state (`isolate: false`),
  so it now calls `resetTelemetryForTests()` first.

## 2026-10-09: Eighth Review — Error Policy Module, Observability Fixes, Loopback CORS

- `apps/backend/src/errors.ts` is the single client-exposure policy (`toClientErrorMessage`,
  `toClientErrorStack`), used by Hono's error handler and the tRPC `errorFormatter`
  (routers no longer import middleware for it).
- tRPC handling is `handleTrpcRequest(c, router)` (route via `trpcRouter.all('/*')` — a typed route
  context, unlike `.use`'s `any` input, so Hono's context can be passed straight to
  `logTrpcServerError`); tests drive it with a throwing router to check masking + onError logging.
  tRPC context `requestId` is required (no ambient fallback).
- Logger: `serializeErrors` (redactor) turns Errors (incl. `cause`) into plain objects before
  redaction — Error fields are non-enumerable, so every `{ err }` log was `{}` before.
- Observability: 5xx request spans get `SpanStatusCode.ERROR`; `respondWithError` records 5xx
  exceptions on the span and logs 4xx at `warn`; `requestType` comes from the path (the full URL
  only matched on localhost).
- CORS/CSP: API/admin/site URLs default to localhost when unset; loopback origins are only trusted
  when `isLocal() || isTest()`. Verified with `wrangler dev --env production`.
- `wrangler dev` loads the package `.env` (symlink to root) **by design** — that is how the local
  dev server gets its environment variables, and those values override the `[env.*]` vars. Only
  when deliberately emulating a deployed environment's behaviour locally (e.g. checking production
  CORS/CSP), run with `CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false`.
- AGENTS.md: Dagger test functions are `test-unit` / `test-end-to-end` (no `test`).

## 2026-10-10: Ninth Review — Fail-Closed Redaction, JSON-Shaped Serialization

- **Redaction (security, pre-existing)**: redact-object 4.0.4 throws on any non-plain value unless
  `ignoreUnknown: true`, and the old fallback logged the raw data — so e.g. a `password` next to a
  `Date` was logged in clear text. It also matched keys case-sensitively (`strict: true` default), so
  `Authorization` headers weren't masked. Now: `serializeErrors` first converts metadata to exactly
  what `JSON.stringify` emits (Errors → name/message/stack/cause/AggregateError.errors; `toJSON()` for
  Date/URL; own enumerable fields for class instances and plain objects), then redact-object runs
  with `{ ignoreUnknown: true, strict: false }`, and any failure fails closed to
  `{ metadata: '[REDACTION FAILED]' }` (visible in the log line, never the raw data).
- `serializeErrors` tracks only the ancestor path (shared refs are not `[Circular]`) and skips
  own enumerable `cause`/`errors` in the generic copy (tRPC defines `cause` enumerable — it was being
  overwritten with `[Circular]`). Verified with the real redact-object and `TRPCError`.
- AppEnv `span` is `Span | undefined` (errors can be handled before requestLogger sets it);
  `runWithRequestContext` accepts an undefined span. Request span attributes use stable semconv
  (`http.request.method`, `url.full`, `url.path`, `http.response.status_code`), matching metrics.
- Process note: each fix is now checked against the real libraries and adversarially self-reviewed
  before reporting (this round that caught class-instance leakage and a silent fail-closed value).

## 2026-10-10: Tenth Review — Log Serialization Mirrors JSON, URL Redaction

- `serializeErrors` → `serializeForLog` (redactor.ts), typed `(value: unknown) => JsonValue |
  undefined`, split into helpers (primitive/collection/error). It mirrors `JSON.stringify`:
  `toJSON()` honoured **before** the Error branch (custom errors that hide PII via toJSON stay
  hidden), functions/symbols/undefined omitted (`null` in arrays), non-finite → null, bigint →
  string (no more `formatJSON` BigInt throw). Richer than JSON where JSON loses data: Errors keep
  name/message/stack/cause plus AggregateError `errors` (an own enumerable `errors` on other errors
  is kept as-is); Map/Set/Headers/URLSearchParams keep entries (so they get redacted, not `{}`);
  errors are detected by brand (`[object Error]`) so cross-realm errors work.
- `redactUrl(url)` (common/logger): masks userinfo and sensitive query values (same field list,
  case-insensitive substring). Used for every logged/traced request URL in the backend
  (`url.full`, request/response/error/not-found/tRPC logs) and for URL objects in log metadata.
- `RedactFn` uses redact-object's own `ConfigOptions`; `getRedactFn` narrows via `assumeShape`.
- requestLogger: `finish(status)` ends the span / records duration even if the downstream chain
  (incl. the error handler) throws — counted as 500, then rethrown.
- **Decision (user)**: per-request context relies on the explicit `runWithRequestContext(span,
  { requestId }, …)` workaround (the WebTracerProvider's StackContextManager doesn't propagate
  across `await`). Do NOT enable `nodejs_compat` or add non-web-standard deps (e.g.
  `@opentelemetry/context-async-hooks`) to fix it.
- Note: a standalone `vp test` in apps/backend can resolve `@lightproject/common` from a stale
  `dist/` — rebuild common (`vp run --filter @lightproject/common build`) or use `vp run ready`.

## 2026-10-10: Eleventh Review — Redaction Hardening, Collector-Level URL Redaction

- `redactWith(data, fields, redactValue)` (redactor.ts) is the core: serialization **and**
  redaction run inside one fail-closed `try`, so throwing getters/`toJSON`, revoked proxies, etc.
  yield `{ metadata: '[REDACTION FAILED]' }` and the logger never throws. `serializeForLog` cuts
  nesting at depth 32 (`[Max Depth]`), serializes `toJSON() { return this }` as the object's
  fields, and labels Map keys (objects as JSON, collisions suffixed ` (n)`).
- `redactUrl` edits the URL **text** (no `new URL()` round-trip): untouched params keep their exact
  encoding; works for relative URLs; redacts sensitive query **and fragment** params, userinfo, and
  sensitive keys inside JSON-valued params (tRPC GET `?input={...}`).
- `isErrorLike` lives in `common/validators` (shared guard, brand check).
- requestLogger: when the downstream chain (error handler) throws, the exception is recorded on the
  span and logged ("Unhandled error") before `finish(500)`.
- **Collector**: `transform/redact-urls` (first in the traces and logs pipelines) runs OTTL
  `replace_all_patterns` over every span/log attribute value and `replace_pattern` on string log
  bodies: userinfo, sensitive `?&#` params, and sensitive keys inside URL-encoded JSON (handles
  `%3A%20` spacing and `%5C%22` escaped quotes). Covers Faro/browser fetch spans (`http.url`).
  `$${1}` escapes `$` from collector config expansion. Verified on otelcol-contrib 0.131.0 with the
  repo config. `error_mode: ignore` (fails open on a runtime statement error; `propagate` would
  drop instead). Restart the `otel-collector` container to apply.

## 2026-10-10: Self-Review Loop Until Clean (Twelfth Review)

- **Process**: fixes are now looped through the same code-review agent _before_ reporting, repeating
  until a pass returns no verified defects (this round: 5 passes → empty).
- Collector `transform/redact-urls`: `error_mode: propagate` (fail closed); contexts resource/span/
  spanevent (traces) and resource/log (logs; string **and** map bodies); explicit OTTL context
  prefixes; patterns cover userinfo (protocol-relative, greedy to the last `@`), sensitive `?&#`
  params, and sensitive keys in URL JSON (`%3A` or literal `:`, string or scalar values). Every
  URL-part class stops at whitespace/quotes/backslash (userinfo also at `,`) — otherwise matches ran
  past the URL and corrupted compact-JSON log bodies (verified: backend-shaped JSON stays valid).
- App side: `__proto__` keys renamed `[__proto__]` (else redact-object treats the object as
  non-plain and skips redaction); custom redact fields reach `redactUrl`; JSON-param detection
  decodes like URLSearchParams + `trimStart()`; extremely deep JSON params fail closed (no throw).
- Backend: `getLogUrl(c)` (`src/log-url.ts`) redacts the URL once per request; `ReportedHttpException`
  (errors.ts) marks tRPC 5xx already reported by `onError`, so the global handler doesn't log/record
  them again; deploy-workspace.yml fails fast for refs without `[env.<environment>]`.
- `packages/common` tests run with `isolate: true`: the intermittent shutdown-flush failure was
  rum.test's `vi.mock('utils/exemplar-metrics')` leaking into telemetry.test in the same worker.
- Open decision (user): browser metrics get a per-page-load `service.instance.id` → one Mimir series
  per page view.

## 2026-10-11: Tests No Longer Export Telemetry; SKIP_OPENTELEMETRY Works

- Found by review: backend/frontend unit tests sent ~411 real OTLP requests to `localhost:4318` per
  run (polluting a running local LGTM stack), and `SKIP_OPENTELEMETRY` was parsed but never read.
- `getApp()` now skips `initializeTelemetry` when `config.skipOpenTelemetry`; uninitialized
  telemetry makes flush/exemplar/OTel-log export no-ops. Backend + frontend vitest `test.env` set
  `SKIP_OPENTELEMETRY: 'true'`; the backend wrangler test helper forwards it as a var; the frontend
  `globalSetup` (main process, no test.env) passes it to `unstable_dev` explicitly. Telemetry tests
  opt back in (`SKIP_OPENTELEMETRY: 'false'`) against `startFakeOtelCollector`.
- Verified with a listener on 4318/12347 (IPv4+IPv6) during `vp run --no-cache -r test:unit`:
  0 requests (was 411).
- `.ai-data/web-standards.md` common-subpath section corrected: `./server` is backend-only but
  runs on Workers too (no `node:*`), `./browser` is frontend-only, `./node` is the only Node-only
  subpath, and there is no `"browser"` stub map anymore.
- Follow-up found by self-review: skipping `initializeTelemetry` also skipped context-manager
  registration (done by `WebTracerProvider.register()`), so with `SKIP_OPENTELEMETRY=true` logs
  lost their `requestId` (`no-id`). Fix: `initializeContextPropagation()` in
  `@lightproject/common/server` registers the same `StackContextManager` without any exporter;
  `getApp()` calls it on the skip path, and `resetTelemetryForTests` now `context.disable()`s.
  Covered by a common test and a backend test (log `requestId` === `X-Request-Id`), confirmed to
  fail with the call removed.
- Final-review fixes: `AGENTS.md` named a nonexistent `validate.yml` (it's `scan.yml`);
  `web-standards.md` still said telemetry init was unconditional. `release.yml` passed the
  free-text `custom_version` straight into `run:` (shell injection by anyone with write access):
  it now goes through `env:` and must match a whole-string bash `[[ =~ ]]` semver check.
  `grep -x` was tried first and rejected, because it matches per line, so `1.2.3\nx=y` passed and
  could forge `$GITHUB_OUTPUT` lines. The release summary now says `develop`, not "dev".

## 2026-10-15: Per-Operation `requestId`, Page-Level `clientId`, Faro Log Fields

- **Decision (user)**: the frontend `requestId` changes per operation (app init, each counter
  click) and is sent to the backend; the old page-load-stable id is now `clientId`.
  `common/logger`: `startRequestScope(name)` → `{ requestId, span, run }` (fresh UUID; span gets
  `request.id`; `run(fn)` re-enters span + requestId — re-enter after every `await`, the browser's
  context manager is Faro's synchronous `StackContextManager`). `setClientId`/`getClientId`
  (store → explicit → undefined); logs carry `clientId`, spans/exemplars/OTel log attrs `client.id`.
  design-system: `RequestIdProvider`/`useRequestId` → `ClientIdProvider`/`useClientId`.
- **Backend adopts `X-Request-Id`** when it matches `^[\w.:-]{1,128}$` (log-safe), else generates
  its own (user's twist). CORS `allowHeaders` includes `X-Request-Id`.
- **Frontend tRPC is unbatched** (`httpLink`): a batch is one backend request, so it can carry only
  one requestId (StrictMode's double init would otherwise batch two ids). `requestIdLink` reads
  `getRequestId()` synchronously inside `.query()` (links run sync; `headers` runs after an await).
- **Faro logs → Loki fields**: the faro receiver flattens logs into a logfmt body and only sets
  `kind`; the sink sends `{ requestId, clientId }` as Faro log context and the collector's
  `transform/faro-logs` promotes `context_requestId`/`context_clientId` to `request.id`/`client.id`
  (Loki structured metadata `request_id`/`client_id`). Verified live: Loki fields, Tempo span
  attributes, backend logs share the frontend operation's id.
- **Intentional (user)**: `app.initialize` is an illustrative root span (like the backend's
  telemetry init), so the browser's tRPC fetch span starting its own trace is expected — do not
  "fix" it. The shared `request.id` links the two traces when needed.

## 2026-10-15: Playwright Output Moved to `e2e-test-results/`

- **Decision (user)**: each workspace's Playwright output (videos under `results/`,
  `results.json`, HTML `report/`) now lives in `<workspace>/e2e-test-results/` instead of
  `<workspace>/tmp/e2e/` (supersedes the `tmp/e2e/` paths in the 2026-10-0x entries above).
  Updated: both `playwright.config.ts`, the `test:e2e` cache output pattern in both
  `vite.config.ts`, Dagger `testEndToEnd` (`/app/<ws>/e2e-test-results`) and its test. Excluded
  everywhere `tmp` is: `.gitignore`, root `ignorePatterns` + madge regex, Dagger `SOURCE_IGNORE`,
  Sonar, CodeQL, `.templates/scaffold.ts`, `.vscode` search/UnoCSS excludes, UnoCSS pipeline
  exclude, `clean:build`. CI's exported copy (Dagger result dir + `verify-workspace.yml` upload path) is
  `tmp/artifacts/<ws>/e2e-test-results` too.
  Verified: a real `test:e2e` writes there, and a cache hit replays the folder.

## 2026-10-15: IDs Once Per Log, Backend `clientId`, Consistent Span IDs, Exemplar Limit

- **Logs**: `requestId`/`clientId` appear once, at the top level of the entry — never inside
  `context` (metadata may still override them; they are lifted out). Pretty mode prints
  `request=… client=… trace=… span=…` after the message and colors by `entry.requestId`.
- **Backend `clientId`**: the frontend tRPC link sends `X-Client-Id`; the backend adopts it with
  the same log-safe pattern as `X-Request-Id` (`apps/backend/src/request-context.ts`:
  `parseIncomingId`, `getRequestStore(c)` used by every `runWithRequestContext` call). Not sent or
  invalid (direct browser, curl, Postman, CORS preflights) → `clientId` is omitted, never invented.
- **Exemplars carry both ids via short ids**: Prometheus caps exemplar labels at 128 chars total
  (trace_id + span_id = 63) and the collector's remote write silently drops all filtered
  attributes over it (verified: UUID request.id + client.id = 154 → Mimir had neither). Fix:
  `requestId`/`clientId` are `generateShortUuid()` — a UUID v4 from `generateUuid()` losslessly
  encoded as 22 base62 chars (letters/digits only — base64url's `-`/`_` looked messy and broke
  double-click selection; 62^22 > 2^128 so nothing is truncated; `decodeShortUuid` recovers the
  UUID) — so both fit at 126/128. `fitExemplarLabels` leaves off any attribute that would
  overflow (e.g. a long caller-supplied X-Request-Id) so the others survive. Don't add more
  exemplar attributes: there are 2 chars left.
- **`ClientIdProvider` takes `createId`** (required) — the frontend passes `generateShortUuid`.
  design-system deliberately does NOT depend on `@lightproject/common` (user's call).
- **Span attributes**: backend registers `requestContextSpanProcessor` (common/server) so every
  span in a request (incl. auto-instrumented fetches) gets `request.id`/`client.id`. Browser:
  Faro owns the span pipeline (a custom `spanProcessor` replaces its exporter), so fetch spans are
  tagged via `fetchInstrumentationOptions.applyCustomAttributesOnSpan` (X-Request-Id header +
  page clientId). Both sides exclude the OTLP endpoint from fetch tracing (self-export noise).
  `opentelemetry.initialize` has no ids by design (no request).
- **Never `XMLHttpRequest` (user)**: fetch only; XHR and `axios` are lint-banned in the root
  `vite.config.ts`. Faro still instruments XHR, so `tagXhrSpan` stays as a safety net for
  third-party code.
- **Id uniqueness is probabilistic, and tested as such**: ids are 122 random CSPRNG bits
  (`crypto.randomUUID`), losslessly encoded, so a repeat is ~1e-13 likely even after 1e12 ids;
  absolute uniqueness would need central coordination. Tests cover the CSPRNG source,
  one-to-one encoding (min/max UUID, 10k round trips), 1M generator ids, 10k request scopes,
  500 concurrent backend requests and one clientId per `ClientIdProvider` mount; the uniqueness
  tests were checked to fail against a deliberately weakened generator.
- **Storybook drops `server.watch`**: builder-vite replaces the loaded config's `server` block, so
  `.storybook/main.ts` re-applies `devServerWatchIgnored` (exported from the root config).

## 2026-10-15: Telemetry Dashboard, Span Flush on Hide, Faster Metrics, Tempo 2.10

- **Provisioned dashboard**: `configs/grafana/provisioning/dashboards/telemetry-correlation.json`
  (provider `dashboards.yaml`, folder "Lightproject"): signal health, request/client id
  correlation (Loki matrix tables), trace tables, log panels, metrics with exemplars. Mimir
  `exemplarTraceIdDestinations` also maps `traceID` (Tempo span-metrics exemplar label).
- **Browser spans flushed on hide/reload**: `rum.ts` passes Faro its default span pipeline
  (`FaroMetaAttributesSpanProcessor` → `BatchSpanProcessor` → `FaroTraceExporter`), built lazily on
  the first span (faro.api/metas exist only after `initializeFaro`), so `flushRum` can
  `forceFlush` it before Faro's own visibilitychange send. Verified A/B with quick reloads: 10
  orphaned traces without, 0 with. Residual: instrumentation-fetch ends fetch spans ~300ms after
  the response, so an unload inside that window still loses the span.
- **Metrics export every 5s** (`METRIC_EXPORT_INTERVAL_MS`, browser + server; OTel default was
  60s), collector batch timeout 1s, dashboard refresh 10s.
- **CORS `maxAge: 600`**: preflights (standalone backend `http.request:OPTIONS` traces) are
  cached 10 minutes instead of ~5s.
- **Tempo 2.8.1 → 2.10.8**: 2.8's `tracesToCut` used `time.Now().Add(cutoff)` (no negation), so
  every live trace was cut on each 10s flush check; frontend/backend spans straddling a check
  were stored as separate pieces and backend-only searches showed `<root span not yet received>`.
  Reproduced with synthetic span pairs (gap ≥4s split on 2.8.1, none on 2.10.8). Stay on Tempo
  ≥2.9; 3.x is a separate architecture decision.

## 2026-10-15: Deployed Telemetry → Local Stack via CI (`mise tunnel`)

- **GitHub Environment variables** `OTLP_ENDPOINT` / `FARO_ENDPOINT` (optional, per
  environment) are read by `deploy-workspace.yml`. Frontend: baked in as
  `VITE_OTLP_ENDPOINT` / `VITE_FARO_ENDPOINT` build env (both the publish and the
  wrangler step, so image and Worker match). Backend: runtime Worker var via the new Dagger
  `wrangler --worker-var=KEY=VALUE` (repeatable) → `wrangler deploy --var KEY:VALUE` (forwarded by
  `vp run … wrangler:deploy <args>`; verified with `--dry-run` that it binds next to
  `[env.<env>.vars]`). Unset = unchanged deploy.
- **`--worker-var` is backend-only** (runtime-validated: UPPER_SNAKE_CASE key, non-empty value with no
  whitespace, rejected before building): frontend Workers are static assets, and design-system's
  `wrangler:deploy` runs two `wrangler deploy` commands, so trailing args would only reach the last.
- `mise tunnel` now prints these variable names; quick-tunnel URLs change per run.
- **`VITE_ADMIN_URL` derived in deploys** (supersedes `vars.VITE_ADMIN_URL`, closes the TODO):
  `deploy-workspace.yml` sets it to `https://lightproject-frontend-${WORKER_SUFFIX}.${WORKERS_SUBDOMAIN}`
  next to `VITE_API_URL` and always passes it to frontend builds, so `og:url`/`og:image` are emitted
  in every deployed environment. Verify no longer passes `VITE_ENV`/`VITE_API_URL` (the verify build
  is never deployed; both fall back to defaults) or an `environment` input to `verify-workspace.yml`.

## 2026-10-16: Workflow `env` Hoisting and Full Runner Labels

- **Shared step `env` hoisted to job level** in `deploy-workspace.yml` and `verify-workspace.yml`
  (`WORKSPACE`, `WORKSPACE_ID`, `ENVIRONMENT`, `VITE_ENV`, `OTLP_ENDPOINT`, `FARO_ENDPOINT`).
  Secrets (`CLOUDFLARE_*`, `SONAR_TOKEN`) and single-use values stay step-scoped so checkout and
  composite actions never see them.
- **`runs-on: [self-hosted, linux, arm64, dagger]`** on every job, matching the compose runner's
  `LABELS` exactly; an x64 runner would need `arm64` changed. `.github/actionlint.yaml` declares the
  custom `dagger` label so actionlint passes with no ignores.
- **Repeatable Dagger flags are named in the singular**: `wrangler()`'s parameter is `workerVar`
  (CLI `--worker-var=VAR1=123 --worker-var=VAR2=456`, one entry per flag), while helpers that take
  the whole list (`workerVarArgs(workspace, workerVars)`) keep the plural. `buildEnv`/`--build-env`
  is left as-is.

## 2026-10-16: Sonar Coverage/Duplication Exclusions

- **`**/vite.config.ts` is excluded from Sonar coverage** (like `**/playwright.config.ts`): it is
  build/tooling configuration, not runtime code, and was the only uncovered file in every project.
- **`**/*.stories.tsx` is excluded from Sonar duplication (`sonar.cpd.exclusions`)**: each story
  file is part hand-written (imports, `meta`/`argTypes`, `Default`) and part generated —
  `packages/design-system/src/utils/update-stories.ts` rewrites the per-variant stories from
  `argTypes` on every build (it updates existing files, it does not create them). The resulting
  near-identical blocks are the expected one-story-file-per-component pattern in dev-only Storybook
  docs, not shipped code (stories were already excluded from coverage). Trade-off accepted: a new
  story file copied from an existing one won't be flagged.

## 2026-10-17: Template App Env Vars Renamed to `BACKEND_*` / `FRONTEND_*`

- The template apps now use `BACKEND_PORT`/`BACKEND_INSPECTOR_PORT`/`BACKEND_URL` (2000/8230) and
  `FRONTEND_PORT`/`FRONTEND_INSPECTOR_PORT`/`FRONTEND_E2E_PORT`/`FRONTEND_URL` (2001/8231/2111), each
  with its `VITE_*` twin. `@lightproject/common/configs` exposes `backendBaseUrl`, `backendUrl`,
  `backendTrpcUrl`, `backendHealthCheckUrl`, `backendDocs{Http,Trpc}Url` and `frontendUrl`.
- **`API_*` / `ADMIN_*` (3000/9230, 3001/9231/3111) are reserved** for future real API/admin apps
  and are unused by apps for now. `endpoints.ts` already exports them (`apiBaseUrl`, `adminUrl`,
  `apiUrl`, `apiTrpcUrl`, `apiHealthCheckUrl`, `apiDocs{Http,Trpc}Url`; shared paths use
  `httpEndpoint`) and they are unit-tested — do not remove them or their `.env.example` entries.
- **`initializeRum()` no longer assumes a backend**: `propagateTraceHeaderUrls?: string[]` lists the
  cross-origin backends that receive trace headers (default none; same-origin always does). Each
  app passes its own (the frontend passes `[backendBaseUrl]`), since `packages/common` is shared by
  many frontends talking to many backends.
- `mise run docker` passes `BACKEND_PORT` into the backend container so it listens on the published
  port (`containerPort` follows `BACKEND_PORT`).

## 2026-10-17: Typed Env with `@t3-oss/env-core`

- **Decision (user)**: adopt `@t3-oss/env-core` 0.13.11 (catalog) with zod 4: fail fast on invalid env,
  keep the `is*()` helper API, tests stub then re-import. Plan: `.ai-data/artifacts/t3-env-plan.md`.
- **Shape**: `commonEnv` (`packages/common/src/environment/schema.ts`) holds the shared keys as
  `shared`; `variables.ts` getters/`is*()` read it; `env.ts` keeps only primitives (`getEnv` etc.).
  Apps: `apps/backend/src/env.ts` (`server` keys, `isServer: true`) and `apps/frontend/src/env.ts`
  (`FRONTEND_PORT`). `validator.ts` (`validateEnv`/`commonEnvSchema`) removed.
- **env-core gotchas (verified)**: without a `clientPrefix`, every key (even `shared`) throws on the
  client, so `clientPrefix: 'VITE_'` + `client: {}` is required. `extends` makes inherited keys
  server-only on the client, so app envs don't extend `commonEnv`. A generic wrapper around
  `createEnv` loses key types; apps call `createEnv` directly with `appEnvOptions`.
- **Workers**: workerd fills `process.env` with bindings at module load even without
  `nodejs_compat` (checked with `unstable_dev`), so module-level validation works there.
- **Pre-existing bug fixed**: `design-system/src/utils/compile.ts` called `process.loadEnvFile(.env)`
  at import, so every process loading the UnoCSS config (frontend dev/build/tests) got the raw,
  unexpanded `.env` (`BACKEND_URL="http://localhost:${BACKEND_PORT}"`) in `process.env`. Now only
  the CLI path loads it. Validation surfaced it.
- Flags set by external tools (`CI`, `DEBUG`, `VITEST`, `TELEMETRY_DEBUG`) stay lenient (`isTrue`);
  app-owned backend flags are strict `true`/`false`. A non-integer port now fails at load.
- **Follow-up (user)**: the backend env drops `client: {}`. `serverEnvOptions` (no `clientPrefix`)
  is for server-only envs, because env-core's server-only option shape forbids `clientPrefix`.
  `appEnvOptions` = `serverEnvOptions` + `clientPrefix: 'VITE_'`; the frontend omits `server: {}`.
  `readRuntimeEnv` must get every declared shape (`{ ...client, ...shared }`): keys left out read
  as unset (this is why `VITE_SAMPLE` was missing).

## 2026-10-18: `packages/database` (Drizzle 1.0 RC, Postgres + D1)

- **Decisions (user)**: a shared `packages/database` comes before `apps/workers`; ORM = Drizzle
  `1.0.0-rc.4` (after a Drizzle/Prisma/Kysely comparison); support **both** Postgres and D1; one
  shared D1 for all apps; start with `users` (sample) and `worker_jobs` (from the stashed workers).
- **Verified facts**: Drizzle 1.0 writes folder-per-migration (`<ts>_name/migration.sql` +
  `snapshot.json`), which `wrangler d1 migrations apply` can't read, so D1 uses Drizzle's migrator
  (local: `getPlatformProxy` + `drizzle-orm/d1/migrator`; remote: drizzle-kit `d1-http`).
  `drizzle-orm/zod` ships inside 1.0. `drizzle-kit/api-postgres` can diff snapshots but the
  sqlite API can't, hence the CLI-based drift test. Drizzle's `AnyD1Database` is `any` unless
  Cloudflare's types are visible; `@cloudflare/workers-types/index.ts` is importable (real
  exports, no globals) but must be a `dependency`, not a devDependency, or the dts bundler
  resolves it to the ambient `index.d.ts` and fails (`MISSING_EXPORT`).
  `getPlatformProxy({ persist: { path: X/v3 } })` and `wrangler --persist-to X` share one local D1.
- **Local Postgres** recreated with `lightproject` credentials (the earlier container was
  initialized as `workers`; POSTGRES_* only apply on first init).

## 2026-10-18: Packages Don't Depend on Other Workspace Packages

- **Decision (user)**: packages in `packages/` have no `@lightproject/*` dependencies; only apps
  combine them. `packages/database` dropped `@lightproject/common`: ids use
  `globalThis.crypto.randomUUID()` (`newId` in `src/shared`), Postgres notices go to an
  `onNotice` option (ignored by default; apps pass their logger), and the local D1 migration
  script writes to stdout/stderr. Moving `database` to `apps/` was rejected: `apps/` is for
  deployables. AGENTS.md now states the rule; "Shared Foundation" scopes `common` to the apps.

## 2026-10-18: `db:sync` — D1 Schema Generated from Postgres

- **Decision (user, after a recommendation)**: one-way Postgres → D1 generation instead of
  two-way sync (two-way overwrites hand edits, conflicts when both change, and SQLite → Postgres
  loses precision silently). `vp run db:sync` = generate `src/d1/schema.ts` + `vp check --fix` +
  `drizzle-kit generate` for both dialects. The parity test discovers tables itself (no script
  edits a test file); its type-level check is a mapped type over all exported tables.
- **Verified facts**: Drizzle exposes everything needed at runtime (`columnType`, `dimensions`,
  `defaultFn` identity, `enumValues` identity with the `src/shared` array, index `where` as SQL
  rendered by `PgDialect.sqlToQuery`); index columns are `IndexedColumn` wrappers, matched by
  name. JSON `$type` exists only at compile time, so the generated D1 column reuses the Postgres
  one via `typeof postgres.<table>.<column>['_']['data']` (type-only import). Lint
  `no-use-before-define` rejects even lazy `.references(() => t.id)` to a later const, so tables
  are ordered by FK dependency. Regenerating changed D1 column order (alphabetical) without a
  new migration. Mutation-checked: a hand edit to the generated file fails both tsc and parity.
- **Follow-up (user)**: `db:sync` was folded into `vp run db:generate [name]`, the single command
  for schema changes (regenerate D1 schema + write both migrations, optional folder name).

## 2026-10-18: Remote D1 Migrations (`packages/database`)

- **Decision (user)**: `packages/database/wrangler.toml` holds the local `DB` binding plus
  `[env.develop|staging|production]` D1 blocks; `CLOUDFLARE_ENV` picks one for remote D1
  migrations (now `DATABASE_DIALECT=d1 vp run db:migrate`). develop temporarily uses the throwaway `lightproject-migrate-test`.
- **Verified facts**: wrangler's published `.d.ts` imports packages it doesn't ship, so
  `unstable_readConfig` is error-typed under lint; `wrangler.toml` is read with `smol-toml` + zod
  instead. drizzle-kit `migrate` with `d1-http` (1.0.0-rc.4, latest) fails on every run after
  the first (array vs object rows in the migrations-table upgrade check), so the remote path is
  our own script on `drizzle-orm/sqlite-proxy` + D1 `/raw`; the migrator also calls the batch
  callback with nothing to apply, which D1 rejects as empty SQL. Trial-applied a new migration to
  the remote test DB, re-ran (no-op), then reverted it remotely (DROP COLUMN + delete row).
- Empty migration folders (files deleted, folder kept) also break migrate; now a unit test.

## 2026-10-19: `packages/database` in CI

- **Decision (user)**: verify `database` on PRs (incl. integration tests), apply migrations at
  deploy, and run `test:integration` in `vp run ready` / `mise run check`. Where deploys migrate
  is chosen per environment by a GitHub variable (`d1`/`postgres`; now `DATABASE_DIALECT`, see
  "migrator image" below).
- Dagger: `testIntegration` binds a throwaway Postgres (`withPostgres`, also used by `ready`);
  `migrate(workspace, environment, …secrets)` applied the migrations (now runs the migrator image).
  The deploy `database` job gates `backend`.
- **Verified**: `test-integration` passed in Dagger; `migrate --target=postgres` applied the
  migrations to the local compose Postgres via `host.docker.internal`; `--target=d1` with dummy
  credentials reached Cloudflare and was rejected (no remote change).

## 2026-10-19: Sonar Branch and Pull Request Analysis

- **Community branch plugin** (`mc1arke/sonarqube-with-community-branch-plugin:26.5.0.122743-community`)
  replaces `sonarqube:26.9.0.129388-community`. The Community Build rejects `sonar.branch.name` /
  `sonar.pullrequest.*`, so before this every scan overwrote one analysis per project and the UI
  showed whichever PR ran last. The plugin's newest release is 26.5, so SonarQube was downgraded,
  which meant recreating the `sonarqube-data` volume and generating a new `SONAR_TOKEN`.
- **Every CI scan is scoped and goes through `sonar.yml`**: a matrix over the affected workspaces
  that passes the PR number/head/base on `pull_request` and `--branch=<ref_name>` otherwise. It moved
  out of `verify-workspace.yml`: `verify.yml` calls it after all verify jobs (so `testUnit` is
  cached) and before the PR comment job, and `on-push-main.yml` calls it next to `scan.yml`
  (not gating the deploy), so `main` is the baseline PRs are compared against. Issue search in the report is scoped the same way.
- **Known gap**: the scan root has no `.git`, so PR analysis can't compute changed lines.

## 2026-10-19: Stale Self-Hosted Runner Cleanup

- **Why runners were left behind**: the `myoung34/github-runner` entrypoint deregisters on SIGTERM
  (fetches a token, runs `config.sh remove`), but Docker's default 10 s stop timeout could SIGKILL
  it first, and `docker rm -f`/Docker Desktop quit/crashes never run the deregistration step.
- **Fix**: `stop_grace_period: 60s` on `github-runner` (and `docker stop --time 60` in
  `scale-runners`); new `.mise/tasks/prune-runners` deletes offline, idle `GH_RUNNER_NAME-*` runners
  with no local container. `runner-scaler` runs it every tick, so leftovers are cleared on the next
  `docker compose up`. Run it by hand (`--dry-run` first) right after a `down`.

## 2026-10-19: Sonar Gates the Develop Deploy

- **`on-push-main.yml`**: the jobs now run in sequence, `scan` → `sonar` → `develop` (`sonar` needs
  `scan`; `develop` needs both), so a failed `main` Sonar scan
  (including a failed quality gate) blocks the deploy. Before this, Sonar ran next to `scan.yml`
  without gating it. When no workspace is affected, the inner Sonar matrix is skipped and the
  caller job still succeeds, so the deploy goes ahead.
- **`resolve-workspaces`**: `^\dagger/` became `^dagger/`. `\d` is not a valid escape in grep's
  BRE/ERE; it matched a literal `d`, but newer GNU grep warns "stray \ before d".

## 2026-10-19: Sonar Back to the Official Image, One Project per Pull Request

- **Reverted the branch plugin**: the compose `sonarqube` service is `sonarqube:26.9.0.129388-community`
  again. Going from the plugin image (26.5) to 26.9 is an upgrade, but the `sonarqube-extensions`
  volume still holds the plugin jar, so recreate it (and `sonarqube-data`, then a new `SONAR_TOKEN`).
- **`sonar.yml` removed, `main` no longer scanned**: the SonarQube step is back in
  `verify-workspace.yml`; the `main` scan only served as the plugin's comparison baseline, and it gated
  the `develop` deploy.
- **Isolation without branches**: `sonarProject` gives each PR (`-pr-<n>`) or dispatched branch
  (`-<branch>`, `/` → `-`) its own project key, so concurrent PRs never overwrite each other.
  Trade-off: a fresh project has no new-code baseline on its first analysis.
- **Cleanup on close**: `on-pull-request-closed.yml` → Dagger `sonarCleanup` deletes
  `lightproject-viteplus-<ws>-pr-<n>` for every workspace under `apps/` and `packages/` plus `dagger`
  (404 is fine). It checks out the base branch (trusted code) and shares the `pr-<n>` concurrency group,
  so closing cancels a running scan. Needs a `SONAR_TOKEN` with Administer permission.

## 2026-10-19 — `packages/database` migrator image

- **Container migrations**: `packages/database` now publishes an image (Dagger `vp`) whose command is
  `node dist/scripts/migrate.mjs`. `scripts/` moved into `src/scripts/` so the regular `vp pack`
  builds it (no TS runner at runtime); `src/scripts/migrate.ts` loads each migrator via dynamic
  `import()`, so the image never needs wrangler (only the local D1 migrator uses it).
  `smol-toml`, `zod` moved to `dependencies` (drizzle-kit stays dev-only: running it needed the
  `.ts` drizzle config in the image; the orm migrator reuses the same migrations table, verified
  against a drizzle-kit-migrated database); `wrangler` is also an optional
  `peerDependency`, because tsdown bundles devDependencies (it pulled wrangler/workerd into `dist`,
  101 MB, and broke local D1 migrations). Built scripts resolve paths from `process.cwd()` (the package dir),
  not `import.meta.dirname`, and avoid top-level await (the CJS build rejects it). `vp run
  db:migrate` runs the same built file, so `vp run build` must run first.
- **Dagger `vp` images bake Node in**: the vite-plus image's `node` is a shim that downloads Node
  into `VITE_PLUS_JS_RUNTIME_PATH`, a cache volume that published images do not carry, so offline
  containers failed to start (verified: `docker run --network none … node --version` errors).
  `vp()` now drops that mount and runs `node --version` to bake the runtime into the image.
- **CI**: deploy always publishes `<REGISTRY_ADDRESS>/database`; Dagger `migrate` runs that image
  and only runs when the GitHub variable `DATABASE_MIGRATION_ENABLED=true`.
- **One `db:migrate`, chosen by `DATABASE_DIALECT`** (`d1`/`postgres`; also the GitHub variable
  and Dagger `migrate --dialect`): `postgres` → drizzle-orm's postgres-js migrator.
  `d1` migrates the remote D1 when `CLOUDFLARE_ENV` is set, else the local one. The integration
  suite (`tests/integration/database.test.ts`) runs the contract against `DATABASE_DIALECT`; its
  task defaults it to `postgres` (`${DATABASE_DIALECT:-postgres}`) and fingerprints it in the cache.
- **Repository API**: apps call `createDatabase(env)` (one import; dialect from `DATABASE_DIALECT`)
  and get `users`/`workerJobs` repositories. Implemented once in `src/repositories/create.ts` over
  a table-generic `crud.ts` per dialect, cast-free by widening to `PgTable`/`SQLiteTable` and
  parsing rows with `drizzle-orm/zod`. A first attempt with two hand-written repository files was
  dropped as duplication; Prisma was weighed and rejected (schema and migrations stay per
  provider, plus codegen and a heavier Workers bundle).
- **Gotcha: cached Vite Tasks strip unlisted env vars.** A task with `cache` gets only its
  `cache.env`/`cache.untrackedEnv` vars (plus defaults such as `PATH`, `CI`, `GITHUB_*`,
  `*_TOKEN`). The root `getEnvArray` builds `cache.env` from the root `.env` keys, and Dagger
  excludes `.env`, so in CI the list is only `VITE_*`: `test:integration` lost Dagger's
  `POSTGRES_URL` and hit `localhost:5432` (ECONNREFUSED). Fixed by listing `DATABASE_DIALECT` and
  `POSTGRES_*` on the task; verified with `dagger call test-integration` (fails without, passes
  with). Any cached task that needs a CI-provided variable must list it the same way.

## 2026-10-20: `apps/workers` Rebuilt on `packages/database`

- **Decision (user)**: restart the stashed workers app from scratch instead of rewriting it in
  place, in reviewable steps (database queue → core → Node runtime → Cloudflare runtime → wiring).
  The app keeps no job model, SQL or migrations: `Job` = `types.WorkerJob`, `JobStore` mirrors
  `db.workerJobs`, `JOB_STORE=memory|database` (the dialect is `DATABASE_DIALECT`'s).
- **Queue in `packages/database`**: `db.workerJobs.enqueue/claim/heartbeat/complete/fail/purge`
  per dialect. `enqueue` targets the partial dedupe index with a no-op `DO UPDATE` (returns the
  existing job unchanged; any other conflict throws). Verified: drizzle 1.0.0-rc.4's SQLite
  `onConflictDoNothing({ where })` renders the `where` after `DO NOTHING` (syntax error), and its
  `onConflictDoUpdate` stamps `$onUpdateFn` columns (hence `SET updated_at = updated_at`).
- **Decision (user)**: Cloudflare runs always-on workers as a Durable Object alarm loop (not the
  old once-a-minute cron drain, not Containers); the cron is only a watchdog.
- **Decision (user)**: follow the backend: Node APIs only in `runtimes/node.ts`; the Node image is
  published on deploy like the backend's (containers can run it), the Worker via wrangler.
- **Decision (user)**: `vp run wrangler:dev` follows `.env` (`wrangler dev` loads it and it
  overrides `[vars]`), so with `DATABASE_DIALECT="postgres"` local Cloudflare dev uses Postgres.
- **Verified facts**: in local workerd without `nodejs_compat`, the core + database store ran on
  D1 and on Postgres (postgres.js over `cloudflare:sockets`), and `globalThis.process.env` holds
  `[vars]`. Wrangler bundles the Postgres driver even for D1-only use (dynamic `import()`); it
  does not stop D1 from loading. Vitest loads workspace packages from `dist/`, so
  `packages/database` must be built before workers tests see new exports. A `z.discriminatedUnion`
  over `schemas.workerJob` needs an explicit type annotation or `vp pack` fails
  (TS2883, non-portable inferred type). `vpx wrangler dev` children survive `pkill -f "wrangler
  dev --config …"` (different command line): track the PID you start.
- **Final review (same day)**: `EXPLAIN QUERY PLAN` showed the D1 purge scanning the whole
  table. SQLite uses a partial index only when the query provably implies its `WHERE`, and it
  cannot infer `status IN ('succeeded', 'dead')` from `status = ?`; the predicate must be repeated
  as the same literal (bound parameters do not count). `selectExpiredJobs` now adds it via
  `sql.raw`, and `tests/unit/d1-query-plans.test.ts` pins claim/purge to their indexes
  (mutation-checked). Postgres plans were already index scans. Also: the Cloudflare runtime now
  refuses `JOB_STORE=memory`, and `tsx` is a declared workers devDependency.

## 2026-10-21: `type-check` Runs `tsgo`; Why `vp check` Is Not Enough

- **Why `tsc` was still needed after `vp check`**: tsgolint (the engine behind `vp check`'s type
  check) reports only semantic diagnostics. `declaration`/`composite` (on in
  `tsconfig.base.json`) add a second set, declaration diagnostics, computed while working out the
  `.d.ts` (e.g. TS2883 "inferred type cannot be named… not portable", the TS9xxx
  `isolatedDeclarations` errors). tsgolint never computes them and has no flag for it, and
  `isolatedDeclarations` does not help (79 errors from tsgo on workers, none from `vp check`).
  TypeScript also skips declaration diagnostics while semantic errors exist.
- **Probe-verified** (temporary file): 9 semantic errors tied to tsconfig options (TS2307, TS2322,
  TS2375, TS4111, TS7006, TS7030, TS2532, TS1294, TS6133) — `tsc`, `tsgo` and `vp check` all
  identical; TS2883 alone — `tsc` and `tsgo` report it, `vp check` passes.
- **Decision (user)**: the `type-check` task runs `tsgo` (same TS 7 compiler as `vp check`, 2-4x
  faster cold) instead of `tsc`; it still runs after `vp check` for the declaration diagnostics.
  Verified: writes the same `tsconfig.tsbuildinfo` (task cache), fails on the TS2883 probe, and
  Dagger `type-check` passes for workers and database. `dagger:type-check` also switched to
  `tsgo` (from the root `.bin`; same TS2322 as tsc on a decorator probe; Dagger `type-check
  --workspace=dagger` passes).

## 2026-10-21: `apps/workers` Final-Review Fixes

- **Metrics were no-ops**: `jobs_processed`/`job_duration` were created at module load, before
  `initializeTelemetry()`; `@opentelemetry/api` has no proxy meter, so they stayed `NoopCounter`
  for good. Now created lazily (`getJobMetrics`), like the backend's `request_hits`.
- **Trace context**: only the runner's own logs are written under `job.run` (synchronous
  `runWithSpan` around each log call). Wrapping the whole async attempt does not work: the project's
  `StackContextManager` drops the active span at the first `await` (same limit as the backend).
  Handler logs/spans were then unlinked; resolved below (span-bound `context.logger`).
- **Thread crash**: per-job `error` listeners left an idle thread's uncaught error unhandled
  (`ERR_UNHANDLED_ERROR` in the main thread → process exit). Threads now keep lifetime listeners
  and are retired on error/exit (integration test `stray` mode fails without the fix).
- **`WORKER_CONCURRENCY`** is parsed by a zod transform in `env.ts`, so a bad value fails at load;
  before, it threw inside the edge `alarm()`/`scheduled()` outside their `try`, silently stopping
  the loops.
- **Enqueue** re-parses the JSON-stored payload with the function schema.
- **Edge abort**: `createInProcessExecutor` waits up to `abortGraceMs` (5 s) for an aborted handler
  to settle before the loop claims the next job; past that it logs a warning (cannot be killed).
- **Rejected**: reusing one store across edge alarms — Workers forbid sharing I/O objects across
  invocations, and Hyperdrive pools connections.
- `edge.ts` uses `@cloudflare/workers-types` instead of hand-written `*Like` interfaces. It is a
  `dependency`, as in `packages/database`: as a dev dependency the `.d.ts` bundler inlines it and
  fails with `MISSING_EXPORT` (its `index.d.ts` is ambient). `startWorker`/`startPurger` share
  `startLoop` (`core/loop.ts`).
- **Unknown `WORKER_CONCURRENCY` names** fail at startup: `config.assertKnownFunctions(functions)`
  takes the registry as an argument (config stays registry-free; `client.ts` re-exports the
  registry, so checking in `functions/index.ts` would fail enqueue-only consumers). Node calls it
  in `start()`; `edge.ts` at module load (workerd refuses to start — verified with `wrangler dev`).
- **Edge entry exports**: `edge.ts` exported helpers (`alarmBudgetMs`, …) by name, and workerd
  rejects any entry export that is not a handler or class ("Incorrect type for map entry"), so the
  Worker never started. It now exports only `WorkerLoop` and the default handler.
- **Second review round**: thread executor now reports an abort only after the handler settled or
  the thread was terminated (it rejected at once before, so a retry could overlap the old attempt);
  enqueue validates `maxAttempts`/`delayMs`/`runAt`; `WORKER_CONCURRENCY` entries are parsed strictly
  (`=3`, `ping=2=8`, `ping=0x4` rejected); a failed graceful shutdown exits 1; `vp run enqueue`
  validates its count; madge maps `@lightproject/workers` to `src/client.ts` (the package entry).
- **Local runs need mise's env**: `vp run` does not load `.env`; `mise.toml` (`[env] _.file`) does,
  with `${VAR}` expansion (Node's `--env-file` does not expand, so it breaks the URL keys). Verified
  end to end with `mise exec`: Node and edge each processed `ping` jobs against local Postgres.

## 2026-10-21: Job Handler Telemetry (Decision: user asked for best practice)

- **One SDK per thread + W3C propagation** (OTel's model for separate processes/threads): each Node
  worker thread runs `initializeTelemetry` (own `service.instance.id`, matching the single-writer
  rule), the `job.run` span crosses `postMessage` as a `traceparent` carrier, and the handler runs
  under `job.handler`, its child. Rejected: forwarding thread logs to the main thread (custom
  protocol, loses the thread's spans and fetch instrumentation).
- **Span-bound `context.logger` / `context.withTrace`** instead of relying on the active context:
  `StackContextManager` drops it at the first `await` (same reason the backend wraps each log in
  `runWithRequestContext`). `JobContext.logger` is now `JobLogger` (`Pick<Logger, 'debug' | 'info'
  | 'warn' | 'error'>`).
- **Flush on close**: `close()` sends `shutdown`; the thread runs `shutdownTelemetry()` and exits;
  terminated after `abortGraceMs` if it does not. A thread terminated for ignoring an abort loses
  its unexported batch (inevitable).
- Verified live (Grafana stack): Node — 2 jobs, Loki logs with distinct thread
  `service_instance_id`s and trace ids, Tempo `job.handler` (thread instance) parented to `job.run`
  (main instance); edge — the same trace id in the `ping` log. Unit test for the binding fails if
  the plain logger is passed (mutation-checked).
- **Gotcha**: `mise exec -- node …` does not forward SIGTERM to node; killing the `mise` PID left an
  orphan worker that kept claiming jobs. Send signals to the node PID (`eval "$(mise env -s bash)"`).

## 2026-10-21: D1 Query Modules Generated from Postgres (Decision: user — "avoid repeating code")

- `src/d1/{crud,worker-jobs}.ts` are rendered from `src/postgres/` by `db:generate`
  (`render-d1-queries.ts`), like the schema. Rejected: one dialect-generic module — Drizzle's
  `PgAsyncDatabase` and `BaseSQLiteDatabase` builders don't unify without `any`. Rejected: AST
  transforms — five identifier renames cover every difference, and anything else fails loudly.
- Unified the sources so only renames differ: the claim/purge subqueries (`selectNextJob`,
  `selectExpiredJobs`) live in the module, with Postgres' row lock as the one dropped call; D1's
  partial-index predicate now also guards the Postgres purge (equivalent: purge only takes a
  finished status); `crud.remove` uses `.returning().execute()` (types on both; a generic
  `SQLiteTable` `await …returning()` is an error type, the reason D1 had `.all()`).
- `AnyPostgresDatabase` (`PgAsyncDatabase<PgQueryResultHKT>`, postgres-js or PGlite) is the
  source's db type; `PostgresDatabase` stays the postgres-js type.
- Verified: `db:generate` → D1 schema unchanged, "No schema changes" for both migration sets;
  database contract passes on Postgres and local D1; drift test fails on a hand-edited D1 copy
  (mutation-checked).
- **Table wiring generated too** (user request): `src/postgres/tables.ts` (`createPostgresTables`)
  maps each table to the generic CRUD; `src/d1/tables.ts` is rendered from it. Both
  `repositories.ts` call it, so a new table needs no D1-side edit. How-to:
  `.ai-data/architecture.md` → "Adding a table".

## 2026-10-21: Final Review Before Commit

- **Edge entry exports regressed twice** (helpers re-exported from `edge.ts` → workerd refuses to
  start). The helpers now live in `src/runtimes/worker-loop.ts` (importable, e.g. for tests) and
  `edge.ts` only re-exports `WorkerLoop` + the default handler.
- **Abort race (Node)**: the in-thread executor's grace equals the main thread's (5 s), so the
  thread could reply "aborted" while its handler still ran and the main thread kept the thread.
  `JobAbortedError.handlerSettled` → `handlerRunning: true` in the thread response → main thread
  terminates instead. Integration test (`ignore` mode, main grace 6 s) fails without it (5.1 s).
- **Idle edge loops back off** (`nextIdleDelay`: poll interval doubling to 30 s), cutting ~170k
  alarms + D1 claims per day per env at `ping=2` while idle; telemetry flushed only on work/error.
- Sonar CPD excludes the generated `src/d1/{crud,tables,worker-jobs}.ts`.
- `EnqueueOptions`: `delayMs` and `runAt` mutually exclusive (type-level; `expectTypeOf` test).
- **`no-await-in-loop` was turned off** (user decision, root `vite.config.ts`; later scoped, see
  below): sequential awaits are a
  valid use case (one job, batch or migration statement after another), and the rule had forced
  recursion or `reduce` chains instead. `drain`, `sweepStatus` and the workers test's local-D1
  migration are plain loops now. Run independent work with `Promise.all`; loop only when each step
  depends on the previous one.
- **Not changed**: `schemas` stays eager — the edge bundle
  includes pg-core anyway (Postgres dialect via `createDatabase`), so laziness saves only two zod
  schema builds. `@cloudflare/workers-types` stays a runtime dependency (as a devDependency the
  `.d.ts` bundler inlines it and fails with `MISSING_EXPORT`).

## 2026-10-21: Final Review Round 3 (User: "fix all with best practices")

- **Outcome writes retried** (`writeWithRetry`, 3 tries, `storeRetryDelayMs` 250 ms × try): a
  store blip after a successful final attempt used to leave the job `running`, and the reclaim
  (`attempts + 1 > maxAttempts`) stored it `dead`. Docs had claimed store errors never count.
- **Heartbeat expiry aborts**: failing heartbeats used to only warn, so a worker cut off from the
  database kept running past its lease while another worker reclaimed the job. Now it aborts when
  the lease would expire before the next heartbeat (test hangs to timeout without it).
- **`UnrecoverableJobError`** (exported): handlers throw it for failures retries cannot fix; an
  invalid payload throws it too. The runner settles `dead` at once; the thread protocol carries
  `unrecoverable: true`. Naming follows BullMQ's `UnrecoverableError`.
- **Idle backoff on Node too**, cap configurable: `WORKER_IDLE_POLL_MAX_MS` (default 30 s).
- **Edge purge honours `JOB_PURGE_INTERVAL_MS`**: `isPurgeDue(scheduledTime, interval, 60 s)` —
  stateless (no Durable Object), deterministic; a missed tick waits for the next interval.
- **Worker dialect from one source**: the deploy passes the GitHub `DATABASE_DIALECT` variable as
  `--worker-var` (job-level env, validated like the migrate step); `wrangler.toml` keeps `d1` as
  the default when unset.
- **`no-await-in-loop` scoped**: back on repo-wide, off via `lint.overrides` for
  `apps/workers/src/core/**` and `**/tests/**` (the only five hits). A probe in `packages/common`
  is still flagged. Keeps the guard against accidental serialization elsewhere without disable
  comments.
- `crud.remove` counts deleted rows (`Array.isArray(rows) && rows.length > 0`) instead of parsing
  them, so a legacy row cannot turn a committed delete into an error.
- Unit-only test helpers moved from `apps/workers/tests/shared/` to `tests/unit/helpers/` (folder
  rule).
- **Kept**: a store per edge alarm (Hyperdrive pools; per-invocation connect is the pattern).

## 2026-10-21: Final Review Round 4 — Converging (User: "fix all once and for all")

- **Why reviews kept finding issues** (told the user): fixes during final review widened scope
  (new features → new edge cases), a fixed bug (edge entry exports) was reintroduced three times by
  later edits with no regression guard, and each review samples differently. Process now: one pass
  of minimal fixes, a regression test per fix, adversarial verification (mutation where possible),
  then triage every review finding into fixed / rejected-with-recorded-reason.
- **Edge entry guard**: `tests/unit/runtimes/edge.test.ts` asserts the entry's runtime exports are
  exactly `WorkerLoop` + `default`; `cronTickMs` moved to `core/retention.ts`.
- **Dialect**: forwarding the GitHub variable was reverted (a Worker switched to Postgres without
  Hyperdrive/`POSTGRES_URL` cannot connect); the deploy now fails when it disagrees with
  `wrangler.toml` (awk on `[env.<env>.vars]`, tested for match, mismatch and invalid values).
- Telemetry setup failures are logged and retried, never thrown (unit test with a mocked SDK).
- Heartbeat lease clock starts from the claim's `leaseExpiresAt`.
- `isPurgeDue` compares interval windows of this tick and the previous one: once per interval for
  any interval (90 s over 30 min → 20).
- Claim split into `selectExpiredLease` then `selectDuePending`, each index-ordered `LIMIT 1`;
  plan test asserts no `TEMP B-TREE` (mutation-checked).
- `no-await-in-loop`: the override was then removed at the user's request — the rule is off
  repo-wide again (user dislikes `lint.overrides`).
- **Rejected, with reasons in architecture.md**: success after abort counts as aborted (cannot
  tell finished from bailed-out); store per edge alarm (Hyperdrive pools); a committed-but-unacked
  outcome write reported as lease-lost (metric label only, stored status correct);
  `Array.isArray` in `crud.remove` (native narrowing, allowed by CLAUDE.md).

## 2026-10-21: Final Review Round 5 — Triage

- Every finding verified, then fixed or rejected with the reason recorded in `architecture.md`
  ("Accepted trade-offs").
- **Fixed**: telemetry failure is logged once and never retried (the old "retry" was a no-op:
  common's `initialized` flag is set before the failing steps); memory store claims in the
  database order (expired lease first, then oldest pending) and a contract test pins it on memory,
  local D1, PGlite and Postgres (fails when the order is reversed); `cronTickMs` checked against
  every `crons` entry in `wrangler.toml`; D1 plan tests require a keyed `SEARCH … (function_name=?`;
  failing polls/alarms back off like idle ones (edge alarm also no longer re-arms in the past);
  the thread bootstrap no longer has an unreachable rejection branch; the deploy's dialect parse
  accepts any spacing, either quote style and trailing comments.
- **Rejected**: one-statement claim (cheap second query vs. derived-table SQL in both dialects);
  awaiting `returning()` directly (types are `unknown`/error, verified earlier); removing the
  workers smoke-test exclusion (would warn on every deploy).
- `no-await-in-loop` is off repo-wide (user: no overrides) — saved as user feedback.

## 2026-10-21: Final Review Round 6 — Triage

- **Fixed**: heartbeat abort is clock-based at each tick (a hanging heartbeat used to skip the
  check; test hangs to timeout without it) and renewals only extend the lease (out-of-order
  replies); `writeWithRetry` uses `withRetry` from `@lightproject/common/utils`; `WorkerLoop.fetch`
  writes its slot only when none is stored (~1,440 billed writes/slot/day saved).
- **Rejected (recorded in architecture.md)**: retrying telemetry setup (config errors only; export
  retries are the SDK's); single-statement claim (repeat); lease-lost label on an unacked
  committed write (repeat); purge catch-up after a dropped tick; one `vp check` spawn for
  `db:generate`.

## 2026-10-21: Final Review Round 7 — Triage

- **Regression found and fixed**: round 6's tick-start abort used `leaseMs / 3`, so one failed
  heartbeat aborted a healthy job. Now `leaseMs / 4`: a failed heartbeat between successful ones
  is ridden out (fake-timer test with a 36 ms lease fails under `/3`), and a lease still ends with
  a quarter left when heartbeats keep failing or hang. The earlier tolerance test had claimed with
  a 30 s lease, so it could not see this.
- **Attempt fencing**: `HeldWorkerJob.attempt`; Postgres/D1/memory `updateHeld` match
  `attempts = attempt`, so a late write from an earlier attempt (even by the same worker) is
  ignored. Contract test in both packages. Heartbeats are sent one at a time and stop on loss.
- `WORKER_LEASE_MS` ≥ 20 s (quarter lease ≥ 5 s abort grace); thread exit during the grace
  settles at once (integration test); `createIdleBackoff` replaces four copies of the backoff.
- Note: the workers' D1 store tests load `@lightproject/database` from `dist/` — rebuild the
  package after changing its API or they test stale code.
- **Rejected (recorded)**: eager `schemas`; regex-based D1 generation (user-chosen design).

## 2026-10-22: Final Review Round 8 — Triage

- **Fixed**: the abort reserve is now `interval + abortGraceMs + margin` (was `interval` only, which
  at a 20 s lease left exactly the 5 s grace and nothing for claim latency); grace, margin and
  the lease minimum (now 30 s = default) share `src/core/timing.ts`, with a unit test tying them;
  reclaim tests pass the current attempt for the old owner, so the owner fence is tested on its
  own (mutation: removing the owner check now fails both owner tests).
- **Rejected (recorded)**: success reply racing an abort (repeat); "dead" thread-bootstrap catch
  (still guards `serveThread`/`createJobStore`); shared error/idle backoff (same documented bound).
- Vitest here bails after the first failure: use `--bail=0` when mutation-checking several tests.

## 2026-10-22: Final Review Round 9 — Stopping Rule Applied

- The review (unverified by its own account) found new classes again; per the agreed rule, each
  was verified, the clear bugs fixed with tests, and design questions moved to `TODO.md`.
- **Fixed**: timer settings capped at 2^31-1 ms (`maxTimerMs`); a `delayMs` that overflows the
  date is rejected; idle backoff never polls faster than the poll interval; an invalid run request
  gets an unrecoverable error instead of crashing the thread (unit test with a fake port);
  `vp run enqueue` validates the payload once (in `enqueue`).
- **To decide (TODO.md)**: shutdown deadline vs orchestrator kill timeout; thread start failures
  burning attempts; database clock vs replica clocks for lease expiry.
- **Recorded/inherent**: terminated threads lose telemetry. **Settled**: `no-await-in-loop` off.

## 2026-10-23: The Three Open Decisions, Resolved (User: "fix all applying best practices")

- **Database clock** (pg-boss/graphile-worker pattern): `ClaimWorkerJob`/`RenewWorkerJob`/
  `FailWorkerJob` take durations (`leaseMs`, `retryAfterMs`); `now` is optional, injected only by
  tests. Per-dialect `clock.ts` (`dbTime(now, plusMs)`: `now() + n * interval '1 millisecond'` /
  `CAST(unixepoch('subsec') * 1000 AS INTEGER) + n`; D1 blocks `sqlite_version()` but allows
  this). The runner times its own abort from when it sent the claim, never from a DB timestamp.
  Contract test without `now` on PGlite, local D1, Postgres and D1 integration.
- **`release`** (BullMQ "move back to wait" equivalent): fenced like other writes; `attempts - 1`,
  `run_at = now`, `pending`. Outcome `released` (span OK).
- **Shutdown**: pool `stop({ graceMs })` aborts in-flight jobs after `WORKER_SHUTDOWN_GRACE_MS`
  (20 s default) → runner releases them. Pool test covers it.
- **Thread start failures**: `ready` handshake; death before it → `JobNotStartedError` → release;
  3 consecutive → `registerShutdown(...)('Worker threads keep failing to start', 1)`. Integration
  test with a fixture that throws at load; mutation (no `ready`) misclassifies a crash and fails.
- `registerShutdownSignals` → `registerShutdown` (returns the shutdown function).

## 2026-10-23: Final Review Round 10 — Fixed All

- **Shutdown requests are idempotent**: several executors reaching 3 start failures each called
  `shutdown`, and the repeat took the "again" branch → `process.exit(1)`, skipping releases and
  flushes. Only a second _signal_ escalates now (unit test; fails with the old behavior).
- **Retry delay clamped** (`retryDelay`: rounded, 0..2^31-1, non-finite → max): a custom backoff
  returning fractions or huge values made Postgres reject `::integer` and the job lost its retry.
- **Shutdown budget**: default grace 15 s (was 20 s); worst case ≈ 26 s incl. thread telemetry
  flush and store close, within Kubernetes' 30 s.
- **Dialect check moved** into the first deploy step, before "Build and publish" pushes the image.
- **Edge alarm** computes its next time after the drain (a long drain no longer re-arms in the past).
- **Workers' local D1 helper** uses drizzle's `migrate` (devDependency `drizzle-orm: catalog:`),
  like `packages/database`, instead of splitting migration files by hand.
- **Dedupe revives dead jobs** (BullMQ deduplication semantics): one upsert with per-column
  `CASE WHEN status = 'dead'`; contract test on memory, PGlite, local D1, Postgres and D1.
- `strictFlag` (strict `'true'`/`'false'` env boolean) moved to `@lightproject/common/environment`;
  backend and workers import it (`as flag`). Note: apps' tests load common from `dist/` — rebuild
  `packages/common` after changing it.
- `bindLogger` builds its four methods from one `at(level)` helper.

## 2026-10-23 — Final Review Round 11 — Fixed All

- **Main-process telemetry flush is capped** at `telemetryFlushMs` (3 s, `core/timing.ts`) via the
  runner's `settleWithin` (now log-free; callers log). An unreachable collector held it for the
  OTel batch processors' 30 s default, past the orchestrator's stop timeout. Worst-case stop is now
  grace + 5 s abort + 5 s thread flush + 3 s ≈ 28 s; `shutdownGraceMs` (15 s) moved to `timing.ts`
  (env default) and `timing.test.ts` checks the sum stays under 29 s.
- **AGENTS.md** said "stop timeout above grace + 5 s"; corrected to grace + 13 s (≈ 28 s, keep ≥ 30 s),
  matching `architecture.md`.
