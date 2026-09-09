# Persistent Memory & Decision Log

This file acts as a chronological ledger for major architectural shifts, context updates, and monorepo conventions.

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

- **Decision**: Added a TypeScript Dagger module at `.dagger/` (`dagger init --sdk=typescript`)
  that wraps `pnpm install` + the `vp` task runner in a hermetic container. GitHub Actions
  (`.github/workflows/ci.yml`) now runs `dagger/dagger-for-github@v8` calling `dagger call ready`
  instead of `voidzero-dev/setup-vp@v1` + `vp run ready` directly on the runner — the exact same
  containerized pipeline now runs on a laptop (`dagger -m .dagger call ready`, or `mise run ci`)
  and in CI, closing the "works on my machine" gap.
- **Why a container at all**: `dagger` was already added to `mise.toml`'s `[tools]` (see
  `mise.lock`/`mise.toml` diff from an earlier session) before this module existed — this entry
  fills in the module itself.
- **Caching design** (`.dagger/src/index.ts`): dependency install is cached on manifests alone
  (`package.json` + `pnpm-lock.yaml` + `pnpm-workspace.yaml`, via `Directory.filter`) so Dagger's
  own content-addressed cache skips `pnpm install` entirely when only source files change — the
  common case. The pnpm store and vp's own task cache (`.vite-hooks/`, see `clean:build` script)
  are mounted as `LOCKED` `CacheVolume`s so warm caches survive across separate `dagger call`
  invocations on the same engine (i.e. iterative local dev). In CI, cross-run persistence of
  those cache volumes requires a `DAGGER_CLOUD_TOKEN` repo secret (optional, wired into
  `ci.yml`'s `cloud-token` input) — without it every CI run is a cold cache, no worse than the
  previous setup.
- **Container needs `git`**: `node:24.14.1-slim` has no `git`; `pnpm install`'s `prepare` script
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
- **Not committed**: `.dagger/sdk/` (Dagger's vendored TS SDK client) is gitignored by Dagger's
  own default `.dagger/.gitignore` — verified it regenerates automatically on `dagger call` even
  when absent, so this isn't something to "fix."

### 2026-09-09 follow-up: module discovery, and two hard walls in Dagger's isolation

- **`dagger.json` moved to repo root**: originally `dagger.json` lived inside `.dagger/` (module
  root = `.dagger/`), which meant every invocation needed `dagger -m .dagger call ...`. Re-ran
  `dagger init --sdk=typescript --name=viteplus --source=.dagger .` from the repo root instead —
  this puts `dagger.json` at the repo root with `"source": ".dagger"` pointing at the actual
  module code, and `dagger call`/`dagger functions`/`mise run ci` now all work with **no `-m`
  flag** from anywhere in the repo (Dagger's own module auto-discovery finds root `dagger.json`).
  `.github/workflows/ci.yml`'s `dagger/dagger-for-github` step no longer needs a `module:` input
  either, for the same reason.
- **Wall #1 — can't `extends` a tsconfig outside `.dagger/`**: tried making `.dagger/tsconfig.json`
  extend the root `tsconfig.base.json` (to stop duplicating `strict`/`target`/etc.) via
  `"extends": "../tsconfig.base.json"` plus `dagger.json`'s `"include": ["tsconfig.base.json"]`.
  This reproducibly fails with `Error: File '../tsconfig.base.json' not found` from inside the
  module's own bootstrap. Root cause: the Dagger TS module's entrypoint is loaded by `tsx`,
  which resolves `tsconfig.json#extends` against the container's disk **before** any Dagger API
  call runs — and `include` only makes extra repo files fetchable _through_ the Dagger API
  (`dag.currentModule().source()`) at runtime, not present on disk at that early boot point. So
  `.dagger/tsconfig.json` **must stay self-contained** (reverted to the plain `dagger init`
  version: `target`/`moduleResolution`/`experimentalDecorators`/`strict`/`skipLibCheck` +
  the `paths` mapping to `./sdk`). This is a hard constraint of how the TS SDK boots, not a
  config mistake — don't retry this without a different mechanism.
- **Wall #2 — `.dagger/package.json`'s `typescript` dependency + `yarn.lock` keep coming back**:
  removed both (module doesn't need a local `typescript` install to execute — `tsx` handles
  transpilation itself, and `dagger call` runs fine without them, confirmed). But `dagger develop`
  (needed whenever the module's exported functions change, or the pinned `engineVersion` bumps)
  regenerates both unconditionally — same root cause as wall #1: the module's build container
  can't see the monorepo's hoisted root `node_modules/typescript`, so Dagger's own TS SDK codegen
  provisions an isolated one via `yarn`. Currently removed per an explicit ask, but expect them
  to reappear after the next `dagger develop` — that's Dagger managing its own module tooling,
  not a bug, and not worth fighting (don't add a script to re-delete them after every `develop`).
