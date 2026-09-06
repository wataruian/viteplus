# Web Platform Standards in This Repository

This is a reference note for agents and developers on where this monorepo already relies on
Web Platform (WHATWG/Fetch/WinterCG) APIs versus Node.js-specific APIs, so future work doesn't
"fix" things that are already correct — and knows where Node APIs are intentionally, legitimately
used.

## Backend (`apps/backend`) is Fetch-API-based

- `src/app.ts` builds a [Hono](https://hono.dev/) app. Hono's entire contract is
  `fetch(Request) => Response | Promise<Response>` — the same signature the Fetch API, Service
  Workers, and Cloudflare Workers/Deno/Bun all use.
- `src/runtimes/edge.ts` (the `wrangler.toml` entry, `main = "src/runtimes/edge.ts"`) exports
  that `fetch` handler directly with no Node dependency — this is what runs on Cloudflare
  Workers.
- `src/runtimes/node.ts` is the **only** place Node-specific server APIs (`@hono/node-server`'s
  `serve()`) are used, to run the same `fetch` handler as a local Node.js dev server. This is
  the correct, intentional boundary: one Fetch-API app (`src/app.ts`), two thin runtime
  adapters under `src/runtimes/`.

## `packages/common/src/server/telemetry.ts` is shared by both backend runtimes

`src/app.ts` (the one Fetch-API app used by both `runtimes/node.ts` and `runtimes/edge.ts`) calls
`initializeTelemetry`/`flushTelemetry` unconditionally, so this module must run on Cloudflare
Workers with **no** `nodejs_compat` flag (`wrangler.toml` leaves it commented out on purpose — see
"Review Checklist"/troubleshooting notes for why it should stay off unless something new needs
it). It provisions the OTel SDK (trace/metric/log providers) using only fetch-based OTLP
exporters and the Fetch `Response` constructor — no top-level `node:*` imports at runtime (the
`node:http` import is `import type` only, erased at build time).

Until 2026-09-04 this file also registered `process.once('SIGTERM'/'SIGINT'/'SIGHUP', ...)` and
called `process.exit()` directly, which threw on Workers (`globalThis.process` is undefined
without `nodejs_compat`) and was meaningless there anyway (no OS signals, no long-lived process).
That's fixed: the module now only exposes `shutdownTelemetry()` (flushes/shuts down the
providers, no `process` reference). The actual signal wiring lives in
`apps/backend/src/runtimes/node.ts` (`registerShutdownSignals`), the one place `process` access
is legitimate. `runtimes/edge.ts` doesn't need equivalent wiring — Workers already flushes via
`c.executionCtx.waitUntil(flushTelemetry())` per-request in `app.ts`.

## Web APIs preferred over Node equivalents

- `globalThis.crypto.randomUUID()` is used instead of `node:crypto` in
  `packages/common/src/utils/text.ts` (`generateUuid`) and
  `packages/design-system/src/context/session-provider.tsx`.
- No `axios`, `node-fetch`, or `XMLHttpRequest` usage anywhere in the codebase — `fetch` is used
  throughout.

## Where Node APIs are legitimately used (do not "fix" these)

- `apps/backend/src/runtimes/node.ts` — local dev server entry (`@hono/node-server`). Also the
  **only** place that registers `process` signal handlers (`SIGTERM`/`SIGINT`/`SIGHUP`) to call
  `shutdownTelemetry()` before `process.exit()` — see below.
- `packages/common/src/node/directory.ts` — a filesystem toolkit (`fs`, `path`,
  `fileURLToPath`) with no Web equivalent (synchronous file I/O, project-root detection). Lives
  under the `./node` subpath specifically so it's never reachable from the isomorphic root/
  `utils` barrels — see "`packages/common`'s isomorphic-vs-Node split" below.
  - Verified 2026-09-06: real filesystem I/O has no browser/Workers equivalent at all (no
    sandbox there provides one), so this file can't become universally runtime-agnostic the way
    `packages/common/src/testing/otel-collector.ts` did. What _was_ checked is Node/Deno/Bun
    parity, since all three support `node:fs`/`node:path`/`node:url` and
    `import.meta.dirname`/`import.meta.filename` as compatibility shims. Every exported function
    (`pathExists`, `getScriptDir`/`FilePath`/`FileName`, `getImporterDir`/`FilePath`/`FileName`
    — via `error.stack` parsing — `getProjectRoot`, `readFile`, `createDir`, `createFile`,
    `deletePath`, `copyPath`, `movePath`, `backupPath`) was exercised unmodified under Node
    24.14.1, Bun 1.4.2, and Deno 2.9.6 and produced identical results on all three when the
    process has normal filesystem permissions.
  - Caveat found only under Deno: Deno denies filesystem access by default (`--allow-read`/
    `--allow-write` opt in per path). `pathExists`'s `try { fs.existsSync(...) } catch { return
false }` swallows _any_ thrown error, so under Deno's default sandbox a
    `Deno.errors.PermissionDenied` is indistinguishable from "path does not exist" — every
    function built on `pathExists` (including `getProjectRoot`, which walks up looking for
    `.git`) silently reports paths as missing instead of surfacing a permission error. Node and
    Bun don't sandbox filesystem access by default, so this only bites under Deno. Not a bug for
    this repo today (Deno isn't a runtime target here; `vp` is Node-only tooling) — noted in case
    `./node` code is ever run under Deno.
  - Added 2026-09-06: a fail-fast guard at the top of the module — `if (typeof
globalThis.process.versions.node !== 'string') throw new TypeError(...)`. This is not the
    isomorphic-surface dynamic-import guard described below (the static `node:fs`/`node:path`/
    `node:url` imports are untouched, and this file was already excluded from the isomorphic
    barrel, so a normal browser/Workers build never resolves it in the first place). It only
    matters if something deep-imports `@lightproject/common/node/directory` into a bundle that
    stubs those builtins to empty modules (as `apps/frontend`'s `package.json` `"browser"` field
    has done for other Node builtins in the past) — without the guard, that surfaces as a
    cryptic `fs.existsSync is not a function` inside whichever function runs first; with it, the
    module throws one clear error the moment it's imported. Verified this doesn't change
    behavior on Node/Bun/Deno (all three set `process.versions.node`, re-ran the same
    unmodified-function check above and got identical results with the guard in place).
- `packages/design-system` build/tooling scripts (`src/start.ts`, `src/utils/compile.ts`,
  `src/utils/update-stories.ts`, `vite.config.ts`) — build-time tooling, not runtime app code.
- `apps/backend/src/runtimes/node.ts` is likewise the only place `@hono/node-server`'s `serve()`
  wraps the shared `fetch` app in a real Node listener.

## `packages/common/src/testing/otel-collector.ts` mirrors the app/runtime split

Updated 2026-09-06: this test-only helper (mocks an OTEL collector for `apps/backend` and
`apps/frontend` tests) used to import `node:http`, `node:buffer`, and `node:zlib` directly. It's
now written the same way as `apps/backend/src/app.ts` — a plain `fetch(request: Request):
Promise<Response>` handler using only Web-standard APIs (`Request`/`Response`,
`DecompressionStream` for gzip bodies, `URL`) — and delegates actually binding a listening port to
`@hono/node-server`'s `serve()`, the same Node adapter `apps/backend/src/runtimes/node.ts` uses.
`@hono/node-server` was added as a `dependency` (not `devDependency`) of `packages/common`, since
`apps/frontend`'s tests import `@lightproject/common/testing` without declaring the package
themselves — pnpm resolves it transitively through `@lightproject/common`'s own dependency, so it
must live in `dependencies` to be resolvable by every consumer, not just this workspace's own dev
environment. Web platform globals (`Response`, `URL`, `DecompressionStream`) are referenced via
`globalThis.X`, matching the existing `globalThis.crypto`/`globalThis.setTimeout` convention in
this codebase (lint has no browser/node globals configured, so bare references to these
identifiers are flagged as undefined). Still Node-only in practice (never shipped to production
runtime) — the fix is about not hard-coding Node builtins into the fake collector itself, not
about running it outside Node.

## `packages/common`'s isomorphic-vs-Node split

`packages/common` ships both to the browser (via `apps/frontend`) and to Node (via
`apps/backend`), so its subpath layout enforces which parts are safe where:

- `.` (root, `src/index.ts`) and `./utils`, `./environment`, `./logger`, `./configs`,
  `./typecast`, `./validators` are the **isomorphic surface** — no top-level Node-builtin
  imports. Runtime-conditional Node usage in this surface must stay behind a guard
  (`globalThis.process?.exit?.(...)` in `utils/base.ts`) or a _dynamic_, type-erased import —
  never a static top-level `import ... from 'node:*'`, since that forces every consumer
  (including the browser bundle) to resolve it. (The file that used to demonstrate the dynamic
  import — `logger/rotation.ts`, log-file rotation — was removed on this branch along with the
  rotation feature; `utils/base.ts` is the current example of the guard style.)
- `./node` and `./server` are **Node-only subpaths**, deliberately **not** re-exported from the
  root barrel (`src/index.ts`) or from `./utils`. `apps/frontend` never imports them.
- Corollary: `package.json`'s `"browser"` field only needs to stub Node builtins that some
  _isomorphic-surface_ module (or its dependencies) still statically imports. If you move a
  Node-only module out of the isomorphic surface, check whether its builtin(s) can be dropped
  from that `"browser"` map too (verify with a real `vp run build` in `apps/frontend`, not just
  by inspection — a transitive dependency of an isomorphic module can need the same stub).
- History: `directory.ts` used to live in `./utils` (the isomorphic barrel) with static
  `node:fs`/`node:path`/`node:url` imports, forcing `package.json`'s `"browser"` field to stub
  all three — and it had zero consumers anywhere in the monorepo. Moved to `./node` on
  2026-08-31; the now-unnecessary `node:fs`/`node:path`/`node:url` browser stubs were removed
  (verified via a frontend build). `node:async_hooks`/`node:crypto`/`node:util` stubs were left
  in place — no source file imports them directly, so they're presumably needed by a transitive
  dependency; don't remove without verifying via a real frontend build.

## `packages/design-system`'s isomorphic-vs-Node split

Same principle, same fix, applied to `packages/design-system` (also ships to the browser via
`apps/frontend`):

- `src/utils/compile.ts` — glob-scans component source with `node:fs`/`node:path`/`node:util`
  to build the UnoCSS safelist at build time. Genuinely needed only by
  `src/configs/unocss.ts` -> `uno.config.ts` (consumed via a _relative_ import, not the
  package's public exports). Not re-exported from `utils/index.ts` (mirrors
  `update-stories.ts`, which was already correctly excluded).
- `src/configs/` (the UnoCSS build config) is **not** re-exported from the root `src/index.ts`
  barrel, for the same reason `@lightproject/common` doesn't re-export `./server`/`./node` —
  it's build-time-only. Still reachable directly via `@lightproject/design-system/configs` (the
  wildcard subpath export) for anyone who explicitly wants it.
- `package.json`'s `"browser"` field was removed entirely (previously stubbed
  `node:async_hooks`/`node:crypto`/`node:fs`/`node:path`/`node:url`/`node:util`) — none of it
  was protecting against anything real once the barrels above were fixed. Verified by removing
  the field and rebuilding `apps/frontend` (browser target): no new externalized-module warnings.
- `src/start.ts` and `src/utils/update-stories.ts` (also Node-only: `child_process`, `fs`) were
  already correctly excluded from every barrel — they're standalone dev scripts, invoked
  directly, same convention as `apps/backend/src/runtimes/node.ts`.

## History

See `.ai-data/memory.md` (2026-08-31 entries) — earlier documentation incorrectly described the
backend as "a standard Node.js Express API"; it has been Hono/Fetch-API-based, and the docs have
been corrected.
