<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

<!--AI AGENT START-->

# AI Agent Guidelines

This document outlines the goals, guidelines, and best practices for AI agents working on this project.

### Goals

- **Maintain Monoculture**: Strictly adhere to the Vite+ toolchain and conventions.
- **Code Quality**: Ensure all code is type-safe, linted, and formatted according to project standards.
- **Reliability**: Maintain 100% test pass rate and high coverage.
- **Efficiency**: Use the `vp` task cache effectively to speed up development and CI.
- **Zero-Volatility Build**: Ensure repeatable builds through strict dependency management and task caching.
- **High-Speed Iteration**: Leverage `vp`'s task cache to minimize redundant work.

## AI Experience & Context Management

- **Persistent Context**: Always mandate the use of the `.ai-data` directory as a persistent scratchpad for architectural decisions, knowledge items, and context sharing between agent sessions.
- **Concise Communication**: Keep conversational responses extremely concise. Prioritize action over exposition.
- **Codebase Primacy**: Always prioritize specific codebase patterns and abstractions found in this repository (e.g., `packages/common`) over generic knowledge or standard library implementations.
- **Ambiguity Resolution**: If a user's design intent is ambiguous or underspecified, stop and ask clarifying questions rather than guessing.
- **Artifact Generation**: When drafting plans, outlining architectures, or documenting significant changes, use `.md` artifacts so state can be retained and reviewed easily.

## Guidelines

- **Tooling**: Always use the `vp` CLI for any build/dev task, and `mise` for high-level repository automation. Never use `npm`, `pnpm`, or `yarn` directly.
- **Monorepo Structure**:
  - `apps/`: Dedicated to deployable applications:
    - `apps/frontend`: Frontend application built with Vite.
    - `apps/backend`: Hono API (Fetch-API/WinterCG-compatible), served via `@hono/node-server` locally and `wrangler` at the edge.
    - `apps/workers`: Always-running background job workers (several functions, N workers each). Keeps no job model, SQL or migrations: jobs are `packages/database`'s `worker_jobs` rows, queried through `db.workerJobs` (`JOB_STORE=memory|database`; dialect from `DATABASE_DIALECT`). Runs as a Node process (one worker thread per worker; published as a container image) or on Cloudflare as one Durable Object alarm loop per worker (the cron is only a watchdog). Node APIs only in `src/runtimes/node.ts`, like the backend. Delivery is at-least-once, so **job handlers must be idempotent** (use `context.idempotencyKey`). Lease times come from the database clock; on SIGTERM in-flight jobs get `WORKER_SHUTDOWN_GRACE_MS`, then are released without charging the attempt (a stop takes up to that + 13 s, about 28 s by default, so keep the orchestrator's stop timeout at 30 s or more). Handlers log through `context.logger` (bound to the job's `job.handler` span, so entries carry its trace id) and wrap calls that should become child spans in `context.withTrace(fn)`. The Worker entry (`src/runtimes/edge.ts`) may export only handlers and the `WorkerLoop` class (workerd rejects anything else). Details (incl. the step-by-step "Adding a job function"): `.ai-data/architecture.md` → "Background Workers".
  - `packages/`: Dedicated to shared libraries and utilities. **A package never depends on another workspace package** (no `@lightproject/*` in its `dependencies`); only apps combine packages. When a package needs something an app provides (e.g. logging), take it as an option (e.g. `onNotice` in `packages/database`) instead of importing `packages/common`:
    - `packages/common`: Shared internal library (logging, environment).
    - `packages/database`: Shared Drizzle ORM (1.0 RC) schema, clients and migrations for **both** Postgres (Node, or Cloudflare via Hyperdrive) and D1. **Only edit `src/postgres/`**: `src/d1/schema.ts`, `src/d1/crud.ts`, `src/d1/tables.ts` and `src/d1/worker-jobs.ts` are generated from their Postgres counterparts (`client.ts`/`repositories.ts` stay hand-written per dialect). After any schema or query change run `vp run db:generate <name>` (e.g. `add_sample`; names both migration folders; regenerates the D1 files, formats/lints them, writes both migrations), then `DATABASE_DIALECT=postgres|d1 vp run db:migrate` (after `vp run build`). Constructs with no faithful SQLite equivalent (arrays, numeric, serial, SQL defaults, …) make `db:generate` fail with the reason; so does a Postgres-only query construct the renderer cannot map (`render-d1-queries.ts`); parity, migration-drift and query-drift tests fail if the files diverge. It owns all tables and migrations — apps never keep their own. Apps query through `db.createDatabase(env)` (`import { db, type types } from '@lightproject/database'`) (dialect from `DATABASE_DIALECT`; D1 binding as `env.DB`), the package exports only that root entry (no `/postgres` or `/d1` subpaths). Details (incl. the step-by-step "Adding a table"): `.ai-data/architecture.md` → "Database".
    - `packages/design-system`: Shared UI component library using UnoCSS.
    - `packages/library`: General purpose library templates.
  - `bak/`: **Intentionally tracked** archive of earlier app/library setups (incl. build caches and a Prisma engine binary), kept for future reuse. It is not a workspace member and is excluded from lint/format (`ignorePatterns`), Sonar, and CodeQL. Do not flag it as cleanup/TODO or propose removing it from git; leave it untouched unless explicitly asked.
- **Observability**: A Grafana LGTM stack (Loki, Grafana, Tempo, Mimir) + OpenTelemetry Collector is configured in `docker-compose.yml`. Backend services must emit metrics, logs, and traces to the OTEL collector.
  - **Metrics are one stream per SDK instance**: every Worker isolate, Node process and browser tab sets its own `service.instance.id` (OTel single-writer principle). Exporters send deltas, and the collector's `deltatocumulative` (`max_stale: 5m`) keeps a running total per instance. Grafana queries must aggregate across instances, e.g. `sum without (instance, service_instance_id) (rate(button_clicks_total[5m]))`. Frontend metrics deliberately use the browser Counter API as a sample, the same as backend `request_hits`; at high traffic, move them to collector-derived metrics (`spanmetrics`/`count` connector over browser spans/events).
  - **Exemplar label budget is full (126/128)**: Prometheus caps an exemplar's labels at 128 characters in total, and the collector's remote write silently drops all of them when over. `trace_id` + `span_id` (63) + `request.id` + `client.id` (two 22-char base62 ids from `generateShortUuid()`, 63) = 126. Do not add exemplar attributes or lengthen these ids; `fitExemplarLabels` in `packages/common/src/utils/exemplar-metrics.ts` leaves off anything that would overflow.
  - **`fetch` only, never `XMLHttpRequest`**: browser tracing and id propagation (`X-Request-Id`/`X-Client-Id`) are built on `fetch`. `XMLHttpRequest` and XHR-based clients such as `axios` are banned by lint rules (`no-restricted-globals`/`-properties`/`-imports` in the root `vite.config.ts`).
  - **Redaction happens twice**: app-side via `@lightproject/common/logger` (`redact`/`redactUrl`, fail-closed), and in the collector's `transform/redact-urls` for every producer (incl. browser spans).
- **Imports**:
  - Always import from `vite-plus` or `vite-plus/test` instead of `vite` or `vitest`.
  - Use `workspace:*` for internal package dependencies.
- **Package Management**:
  - Update `exports` in `package.json` immediately when adding new public modules to a package.
  - Maintain `tsconfig.json` references between workspace projects.
- **Configuration**: Use `defineConfig` from `vite-plus` for all configuration files.
- **Command Selection**:
  - Use `mise run <task>` for high-level automation (defined in `.mise/tasks/`).
  - Use `vp run <script>` for custom scripts defined in `package.json`.
  - Use `vp <command>` (e.g., `vp dev`, `vp test`) for built-in Vite+ functionality.
  - Use `dagger call <function> [--workspace=<pkg>]` to reproduce CI locally in the same containerized environment (see CI Pipeline below).
- **Configuration Hub**: Treat `vite.config.ts` as the source of truth for formatting, linting, and building.
- **GitHub CLI (`gh`)**: Not part of the standard toolchain. Only use it when explicitly asked, and always ask for confirmation before running any `gh` command (including read-only ones), even mid-task.

## Exploration Strategy

When first entering the repository or a new package:

1. **Root Analysis**: Start by checking `.mise/tasks/` for high-level automation scripts and `vite.config.ts` / `package.json` for global configurations.
2. **Dependency Graph**: Check `pnpm-workspace.yaml` and internal `package.json` files to map project relationships. Note the use of `catalog:` for shared external dependencies.
3. **Task Discovery**: Run `mise tasks` to list all available root commands, or check `package.json` scripts. Run `vp help` and `vp run --help` to identify available tooling commands.
4. **Validation Check**: Run `vp install` followed by `mise run check` or `vp run ready` to ensure the local environment is healthy before making changes.

## Environment Management

- **Typed Env (`@t3-oss/env-core`)**: `packages/common/src/environment/schema.ts` defines `commonEnv`, the zod schema for variables both runtimes read (`ENV`, `LOG_LEVEL`, URLs, OTel settings, …). It is validated **once, at module load**, and fails fast with a list of invalid keys (values are never echoed). Each app adds its own keys in `src/env.ts` via `createEnv`: the backend uses `{ ...serverEnvOptions, isServer: true, server, runtimeEnv: readRuntimeEnv(server) }` (no `client` section; env-core rejects `clientPrefix` without one), the frontend `{ ...appEnvOptions, client, shared, runtimeEnv: readRuntimeEnv({ ...client, ...shared }) }`. `runtimeEnv` must cover every declared key, or the missing ones read as unset. `server` keys throw if read in the browser. App envs hold only app keys — read shared keys from `commonEnv` or its getters (env-core's `extends` treats inherited keys as server-only in the browser).
- **Isomorphic Access**: Use the named getters and boolean helpers from `@lightproject/common/environment` (`variables.ts`, backed by `commonEnv`). `getEnv('X')` is the low-level reader: it reads `X`, then falls back to `VITE_X` (every `VITE_X` mirrors `X`, see `.env.example`), and feeds `readRuntimeEnv`. Add new shared variables to `commonEnv` + a getter instead of calling `getEnv` in several places.
- **Testing Env**: Because values are read once, tests stub first and then re-import (`vi.resetModules()` + `await import(...)`); stubbing after import has no effect. When asserting an unset variable, also clear its `VITE_` mirror (Vitest copies `VITE_*` from `.env` into `process.env`).
- **Config Files Exception**: `vite.config.ts` / `playwright.config.ts` read `process.env` directly — they load before `@lightproject/common` is built, and its `dist/` would not resolve.
- **Boolean Helpers**: Favor semantic helpers like `isLocal()`, `isProduction()`, `isCi()`, and `isDebug()` over manual string comparisons.

## Dependency Management

- **Catalogs**: Use `catalog:` in `package.json` for shared external dependencies defined in `pnpm-workspace.yaml`.
- **Internal**: Use `workspace:*` for all internal package/app references.
- **Strictness**: Do not add dependencies directly with `pnpm` or `npm`. Use `vp add`.

## CI Pipeline (Dagger)

- **Source of truth**: `dagger/src/index.ts` defines the `Monorepo` Dagger object. It is a standalone project (its own `package.json`/`tsconfig.json`, not a pnpm workspace member) — it is covered by the root `vp check` task, not the per-workspace `-r check`.
- **Local parity**: `dagger call <function> [--workspace=<pkg>]` runs the same containerized pipeline CI does. Run `dagger functions` to list them (`ready`, `check`, `build`, `test-unit`, `test-integration`, `test-end-to-end`, `vp`, `nginx`, `publish`, `load`, `wrangler`, `migrate`, etc.).
- **Database in CI**: `packages/database` is verified like any workspace, plus `test-integration` (a throwaway `postgres:17.6-alpine` Dagger service bound as `postgres`, applying every Postgres migration from scratch; the Dagger `ready` gets the same service). On deploy, the `database` job runs before `backend` and always publishes the migrator image (`<REGISTRY_ADDRESS>/database`: Dagger `vp` image whose command is `node dist/scripts/migrate.mjs`, built from `src/scripts/migrate.ts`, which picks the target from `DATABASE_DIALECT`: `postgres` → drizzle-orm's postgres-js migrator (same `drizzle.__drizzle_migrations` table drizzle-kit uses) with `POSTGRES_URL` or the `POSTGRES_*` parts, `d1` → the local D1, or with `CLOUDFLARE_ENV` set the remote D1 of that `[env.*]` (`CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`); hence `smol-toml` and `zod` are runtime `dependencies` and the image holds no `.ts` files or drizzle-kit, while `wrangler` is an optional peer so the build never bundles it). Run that image as a Kubernetes Job/initContainer or `docker run` on any container runtime. CI applies migrations itself only when the GitHub variable `DATABASE_MIGRATION_ENABLED` is `true` (default off): Dagger `migrate` runs the same image with the dialect from the GitHub variable `DATABASE_DIALECT` (repository level; an Environment-level value overrides it) and the `CLOUDFLARE_*` / `POSTGRES_URL` secrets; enabled with no dialect fails the job. The `workers` deploy fails when that variable is set and differs from the dialect in `apps/workers/wrangler.toml`'s `[env.<env>.vars]`, so the Worker never reads a database CI did not migrate. Locally, `vp run db:migrate` runs the same built script (local D1 needs wrangler, so it only works in the repo). `test:integration` runs the shared contract against `DATABASE_DIALECT` (default `postgres`; `d1` uses a throwaway local D1). Locally, `vp run ready` / `mise run check` run `vp run -r test:integration`, which needs the docker-compose Postgres up.
- **GitHub Actions**: `.github/workflows/on-pull-request.yml` (pull requests into `main`) calls the reusable `.github/workflows/verify.yml`, which resolves the affected workspaces and fans out to `.github/workflows/verify-workspace.yml` per workspace, running `mise run dagger <fn> --workspace=<pkg> --export` — full verification (check/lint/type-check/test/Semgrep/Sonar) happens once, here, at the PR boundary. `.github/workflows/on-push-main.yml` (push to `main`) does not re-verify (branch protection requires the PR to be up to date first); it only runs `scan.yml` (commit-lint/secret scan/CodeQL) then deploys to `develop` via the reusable `.github/workflows/deploy.yml`, which resolves the affected workspaces and fans out to `.github/workflows/deploy-workspace.yml` per workspace. Promoting a specific version to `staging`/`production` is a manual `.github/workflows/trigger.yml` dispatch naming a `version` (tag or full SHA), gated by each environment's required-reviewer rule; `.github/workflows/release.yml` cuts the version bump/tag/GitHub Release and deploys that commit to `develop`. Each deploy target (`develop`/`staging`/`production`) has its own concurrency group so a pending approval on one never blocks another, and its own Cloudflare Workers: every wrangler config has `[env.develop|staging|production]` blocks naming `lightproject-<app>-<dev|staging|production>`, selected at deploy time via `CLOUDFLARE_ENV` by the Dagger `wrangler` function (vars are not inherited by `[env.*]` blocks, so each lists its own).
- **Sonar, one project per PR**: the compose `sonarqube` service is the official Community Build, which has no branch/PR analysis and keeps one analysis per project. The SonarQube step in `verify-workspace.yml` therefore passes `--pull-request=<number>` (on `pull_request`) or `--branch=<ref>` (otherwise) to the Dagger `sonar` function, and `sonarProject` in `dagger/src/helpers/sonar.ts` turns that into its own project key (`lightproject-viteplus-<workspace>-pr-<n>` / `-<branch>`). Never scan without a scope in CI, or it overwrites the base project. `main` is not scanned. `.github/workflows/on-pull-request-closed.yml` (PR closed or merged, same `pr-<n>` concurrency group as `on-pull-request.yml`) calls the Dagger `sonar-cleanup` function to delete that PR's projects for every workspace; `SONAR_TOKEN` needs Administer permission on them. `sonarProject` validates the values, because they reach `sh -c` and a URL.
- **Caching**: install-level caches (Node.js runtime, pnpm binary, pnpm store) are shared globally across every workspace via `withInstallCaches`. Vite Task's own task cache is scoped **per target workspace** via `withTaskCache(container, key)` — `turbo prune` rewrites `pnpm-lock.yaml` differently per build target, so a single shared task-cache volume would otherwise bust itself whenever a different workspace triggered the build.
- **Self-hosted runner + persistent engine**: every workflow job runs on `runs-on: [self-hosted, linux, arm64, dagger]` instead of `ubuntu-latest`, matching the runner's `LABELS` in `docker-compose.yml` exactly (a job needs a runner with all four; `.github/actionlint.yaml` declares the custom `dagger` label). Both the runner and a long-lived `dagger-engine` container are defined in `docker-compose.yml`; the runner's `_EXPERIMENTAL_DAGGER_RUNNER_HOST=docker-container://dagger-engine` env points every `dagger` call in a job at that shared engine, so cache volumes persist across CI runs instead of starting cold per job. The runner talks to Docker via the mounted host socket (docker-outside-of-docker, same pattern `dagger call load`/`publish` use locally) and re-registers after each job (`EPHEMERAL=1` + compose `restart: unless-stopped`). **Stale runners**: on stop, the runner image deregisters itself from GitHub, and `stop_grace_period: 60s` gives it time before Docker's SIGKILL (the scaler's `docker stop --time 60` does the same). For containers that die without a clean stop (`docker rm -f`, Docker Desktop quit, crash), `runner-scaler` runs `.mise/tasks/prune-runners` every tick: it deletes offline, idle `GH_RUNNER_NAME-*` runners whose container no longer exists. After a `docker compose down`, run `mise run prune-runners` (add `--dry-run` to only list them), or let the next `up` clean them. GitHub also drops offline ephemeral runners by itself after a day.
- **When editing `dagger/src/index.ts`**: verify with `vpx tsc --noEmit -p dagger/tsconfig.json` and `vp check dagger/src/index.ts`, then confirm with a real `dagger call` — Dagger's own op-cache and cache-volume behavior can hide correctness issues that a type-check alone won't catch (e.g. a `withMountedCache` mount silently shadowing existing container content).
- **Feature-level promotion**: This is a single-trunk pipeline — a promotion to staging/production is whatever merged since the last one, deployed as a batch. Never cherry-pick commits between environments to isolate one feature. If partial rollout is ever needed, gate the feature behind a runtime check, not a git operation:
  - **Level 1 (start here)**: a GitHub Environment variable (e.g. `vars.FEATURE_X`) read at runtime via the existing `getEnv`/`isProduction()`-style helpers in `packages/common/environment` — same pattern as `OTLP_ENDPOINT`/`FARO_ENDPOINT` (a per-environment `vars.*` passed into the build/deploy). No new dependencies, but flipping it requires a redeploy.
  - **Level 2 (only if needed)**: a dynamic, no-redeploy flag backed by a store the running service queries at request time (a KV/D1 table, or a service like LaunchDarkly/Unleash/Flagsmith/GrowthBook) — for kill switches, percentage rollout, or per-user targeting. Put the interface behind a single `packages/common` helper (e.g. `isFeatureEnabled(flag)`) so callers don't know which level is backing it, and level 1 can be swapped for level 2 later without touching call sites.

## Best Practices

- **Pre-execution**: Always run `vp install` if `package.json` or `pnpm-lock.yaml` has changed.
- **Verification**: Run `vp run ready` as a mandatory final verification step before completing a task.
- **Type Safety**:
  - Avoid `any` and `unknown` typings. Always use correct and specific types.
  - Avoid `@ts-ignore`.
  - Since correct and precise typings should be used, don't write ad hoc type-guard helpers (e.g. a local `isRecord()`) to paper over imprecise types — fix the types, and narrow with native operators. Runtime guards are only for genuinely untyped boundaries (parsed JSON, dynamic `import()` results, third-party values typed `unknown`); use the shared ones in `@lightproject/common/validators` there (or a `zod` schema) rather than defining new ones.
  - Do not use ESLint or TypeScript disable comments (e.g. `eslint-disable` or `@ts-nocheck`).
  - Use `vite-plus` provided types for configuration and tests.
- **Refactoring**: When moving code between packages, ensure `exports`, `imports`, and `tsconfig` references are updated atomically.
- **File Naming**: Use kebab-case for file names.
- **Troubleshooting**:
  - Use `vp cache clean` as a standard first step for resolving unexpected build or test issues.
  - **UnoCSS Keyframe Syntax**: When defining raw keyframe strings in `uno.config.ts`, ensure every property is followed by a semicolon (e.g., `{transform:translateX(0);opacity:1}`). Missing semicolons will cause `CssSyntaxError [postcss]` during production builds.
  - **Theme Awareness**: If UI elements are invisible or low-contrast, check that the suffixed `adaptive-*` / `inverse-*` tokens are used (e.g. `bg-adaptive-surface` with `text-inverse-surface`, or `border-adaptive-primary`). There is no bare `bg-adaptive` / `text-adaptive` / `bg-inverse` — those generate no CSS, leaving the element transparent over the primary-tinted `:root` background. Use `surface` for neutral backgrounds; the other colors (`primary`, `accent`, …) tint with the theme.
  - **Stuck GitHub Actions runs**: A run can get stuck `queued` with zero jobs ever assigned (a GitHub-side scheduling issue, sometimes tied to the self-hosted `dagger` runner/engine not picking it up). In that state, `gh run cancel` fails with a 409 ("not queued yet") and `gh run delete` fails with a 403 — neither works via CLI/API. It has to time out on GitHub's side; check the runner/dagger-engine health to prevent new runs from getting stuck the same way.
- **Staged Checks**: Use `vp staged` for pre-commit checks to ensure only valid code is committed.
- **Shared Foundation**: Treat `packages/common` as the foundation for the apps. Use it for shared logic, types, and cross-cutting concerns like logging and environment management. Other packages stay independent of it (see Monorepo Structure).
- **Design System Sovereignty**:
  - All UI components, styles, and decorative elements (beams, noise, etc.) must reside in `packages/design-system`.
  - **Tokens First**: Favor semantic tokens (`adaptive`, `inverse`, `primary`) over hard-coded hex or Tailwind colors.
  - **Shortcuts**: Use standardized UnoCSS shortcuts for common elements (e.g., `btn-primary`, `btn-ghost`, `glass-nav`).
  - **Header Safety**: When using the sticky `Header`, always add a `pt-20` (80px) buffer to the main content area in the app to prevent overlapping.
- **Documentation**: Keep `README.md` and `AGENTS.md` updated with any architectural changes.
  - The root `README.md` is generic to the monorepo; app/package specifics go in that workspace's own README.
  - **Every app and package has its own `README.md`** (new ones get it when created), following `packages/database/README.md`: a short intro, then `## Setup`, `## Environment variables` (every variable the code reads, with its purpose and default), `## Development`, `## Testing`, `## Deployment`.
- **AI Data & Context Management**:
  - The `./.ai-data` directory is the persistent, version-controlled knowledge base for the monorepo. Agents MUST always review the context files here (`architecture.md`, `coding-guidelines.md`, `tooling-and-tasks.md`, `web-standards.md`, and open items in `TODO.md`; `memory.md` is the chronological decision log) when starting a new task to align with repository standards.
  - The `./.ai-data/artifacts` directory is `.gitignore`d and must be used as a temporary scratchpad. Agents should write all drafts, implementation plans, generated code snippets, and temporary task output here before finalizing them.

<!--AI AGENT END-->
