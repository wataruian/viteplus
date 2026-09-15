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
  - `packages/`: Dedicated to shared libraries and utilities:
    - `packages/common`: Shared internal library (logging, environment).
    - `packages/design-system`: Shared UI component library using UnoCSS.
    - `packages/library`: General purpose library templates.
- **Observability**: A Grafana LGTM stack (Loki, Grafana, Tempo, Mimir) + OpenTelemetry Collector is configured in `docker-compose.yml`. Backend services must emit metrics, logs, and traces to the OTEL collector.
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

- **Isomorphic Access**: Use the unified `getEnv` and boolean helpers from `@lightproject/common/environment` for all environment variable access. This ensures compatibility across Node.js, Vite, and fallback global contexts.
- **Boolean Helpers**: Favor semantic helpers like `isLocal()`, `isProduction()`, `isCi()`, and `isDebug()` over manual string comparisons.
- **Type Safety**: The environment utility provides typed access and fallbacks for common variables like `LOG_LEVEL` and `LOG_FORMAT`.

## Dependency Management

- **Catalogs**: Use `catalog:` in `package.json` for shared external dependencies defined in `pnpm-workspace.yaml`.
- **Internal**: Use `workspace:*` for all internal package/app references.
- **Strictness**: Do not add dependencies directly with `pnpm` or `npm`. Use `vp add`.

## CI Pipeline (Dagger)

- **Source of truth**: `.dagger/src/index.ts` defines the `Monorepo` Dagger object. It is a standalone project (its own `package.json`/`tsconfig.json`, not a pnpm workspace member) — it is covered by the root `vp check` task, not the per-workspace `-r check`.
- **Local parity**: `dagger call <function> [--workspace=<pkg>]` runs the same containerized pipeline CI does. Run `dagger functions` to list them (`ready`, `check`, `build`, `test`, `vp`, `nginx`, `publish`, `load`, `wrangler`, etc.).
- **GitHub Actions**: `.github/workflows/pr.yml` (pull requests into `main`) calls the reusable `.github/workflows/ci.yml`, which matrixes over workspaces and runs `mise run dagger <fn> --workspace=<pkg> --export` per workspace — full verification (check/lint/type-check/test/Semgrep/Sonar) happens once, here, at the PR boundary. `.github/workflows/main.yml` (push to `main`) does not re-verify (branch protection requires the PR to be up to date first); it only runs `validate.yml` (commit-lint/CodeQL) then deploys to `dev` via the reusable `.github/workflows/deploy.yml`. Promoting a specific version to `staging`/`production` is a manual `.github/workflows/trigger.yml` dispatch naming a `version` (tag or full SHA), gated by each environment's required-reviewer rule; `.github/workflows/release.yml` cuts the version bump/tag/GitHub Release and deploys that commit to `dev`. Each deploy target (`dev`/`staging`/`production`) has its own concurrency group so a pending approval on one never blocks another.
- **Caching**: install-level caches (Node.js runtime, pnpm binary, pnpm store) are shared globally across every workspace via `withInstallCaches`. Vite Task's own task cache is scoped **per target workspace** via `withTaskCache(container, key)` — `turbo prune` rewrites `pnpm-lock.yaml` differently per build target, so a single shared task-cache volume would otherwise bust itself whenever a different workspace triggered the build.
- **Self-hosted runner + persistent engine**: `ci.yml` runs on `runs-on: [self-hosted, dagger]` instead of `ubuntu-latest`. Both the runner and a long-lived `dagger-engine` container are defined in `docker-compose.yml`; the runner's `_EXPERIMENTAL_DAGGER_RUNNER_HOST=docker-container://dagger-engine` env points every `dagger` call in a job at that shared engine, so cache volumes persist across CI runs instead of starting cold per job. The runner talks to Docker via the mounted host socket (docker-outside-of-docker, same pattern `dagger call load`/`publish` use locally) and re-registers after each job (`EPHEMERAL=1` + compose `restart: unless-stopped`).
- **When editing `.dagger/src/index.ts`**: verify with `vpx tsc --noEmit -p .dagger/tsconfig.json` and `vp check .dagger/src/index.ts`, then confirm with a real `dagger call` — Dagger's own op-cache and cache-volume behavior can hide correctness issues that a type-check alone won't catch (e.g. a `withMountedCache` mount silently shadowing existing container content).
- **Feature-level promotion**: This is a single-trunk pipeline — a promotion to staging/production is whatever merged since the last one, deployed as a batch. Never cherry-pick commits between environments to isolate one feature. If partial rollout is ever needed, gate the feature behind a runtime check, not a git operation:
  - **Level 1 (start here)**: a GitHub Environment variable (e.g. `vars.FEATURE_X`) read at runtime via the existing `getEnv`/`isProduction()`-style helpers in `packages/common/environment` — same pattern as `VITE_API_URL`. No new dependencies, but flipping it requires a redeploy.
  - **Level 2 (only if needed)**: a dynamic, no-redeploy flag backed by a store the running service queries at request time (a KV/D1 table, or a service like LaunchDarkly/Unleash/Flagsmith/GrowthBook) — for kill switches, percentage rollout, or per-user targeting. Put the interface behind a single `packages/common` helper (e.g. `isFeatureEnabled(flag)`) so callers don't know which level is backing it, and level 1 can be swapped for level 2 later without touching call sites.

## Best Practices

- **Pre-execution**: Always run `vp install` if `package.json` or `pnpm-lock.yaml` has changed.
- **Verification**: Run `vp run ready` as a mandatory final verification step before completing a task.
- **Type Safety**:
  - Avoid `any` and `unknown` typings. Always use correct and specific types.
  - Avoid `@ts-ignore`.
  - Since correct and precise typings should be used, avoid type-checking helper functions like `isRecord()`. Prefer structural TypeScript validation and narrow types using native operators.
  - Do not use ESLint or TypeScript disable comments (e.g. `eslint-disable` or `@ts-nocheck`).
  - Use `vite-plus` provided types for configuration and tests.
- **Refactoring**: When moving code between packages, ensure `exports`, `imports`, and `tsconfig` references are updated atomically.
- **File Naming**: Use kebab-case for file names.
- **Troubleshooting**:
  - Use `vp cache clean` as a standard first step for resolving unexpected build or test issues.
  - **UnoCSS Keyframe Syntax**: When defining raw keyframe strings in `uno.config.ts`, ensure every property is followed by a semicolon (e.g., `{transform:translateX(0);opacity:1}`). Missing semicolons will cause `CssSyntaxError [postcss]` during production builds.
  - **Theme Awareness**: If UI elements are invisible or low-contrast, check if the `bg-adaptive`, `text-adaptive`, or `border-adaptive` tokens are being used correctly. Favor high-contrast pairings like `bg-inverse` for grid backgrounds.
  - **Stuck GitHub Actions runs**: A run can get stuck `queued` with zero jobs ever assigned (a GitHub-side scheduling issue, sometimes tied to the self-hosted `dagger` runner/engine not picking it up). In that state, `gh run cancel` fails with a 409 ("not queued yet") and `gh run delete` fails with a 403 — neither works via CLI/API. It has to time out on GitHub's side; check the runner/dagger-engine health to prevent new runs from getting stuck the same way.
- **Staged Checks**: Use `vp staged` for pre-commit checks to ensure only valid code is committed.
- **Shared Foundation**: Treat `packages/common` as the foundation for the entire monorepo. Use it for shared logic, types, and cross-cutting concerns like logging and environment management.
- **Design System Sovereignty**:
  - All UI components, styles, and decorative elements (beams, noise, etc.) must reside in `packages/design-system`.
  - **Tokens First**: Favor semantic tokens (`adaptive`, `inverse`, `primary`) over hard-coded hex or Tailwind colors.
  - **Shortcuts**: Use standardized UnoCSS shortcuts for common elements (e.g., `btn-primary`, `btn-ghost`, `glass-nav`).
  - **Header Safety**: When using the sticky `Header`, always add a `pt-20` (80px) buffer to the main content area in the app to prevent overlapping.
- **Documentation**: Keep `README.md` and `AGENTS.md` updated with any architectural changes.
- **AI Data & Context Management**:
  - The `./.ai-data` directory is the persistent, version-controlled knowledge base for the monorepo. Agents MUST always review the context files here (e.g., `architecture.md`, `coding-guidelines.md`, and `artifacts/architecture_analysis.md`) when starting a new task to align with repository standards.
  - The `./.ai-data/artifacts` directory is `.gitignore`d and must be used as a temporary scratchpad. Agents should write all drafts, implementation plans, generated code snippets, and temporary task output here before finalizing them.

<!--AI AGENT END-->
