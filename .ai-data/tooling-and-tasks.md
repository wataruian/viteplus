# Tooling and Tasks

## Task Runner: Mise

`mise` is the primary task runner for root-level repository automation. The tasks are defined in the `.mise/tasks/` directory and can be executed via `mise run <task>`.

Available automation commands:

- `type-check` runs `tsgo` (TypeScript 7, the compiler behind `vp check`), not `tsc`. `vp check`
  does not replace it: its tsgolint type check reports only semantic diagnostics, never the
  declaration diagnostics that `declaration`/`composite` enable (e.g. TS2883, a non-portable
  inferred type), and has no option to. `tsgo` reports exactly what `tsc` does (probe-verified).
  `dagger:type-check` runs `tsgo` too (`cd dagger && tsgo`): like its former `tsc`, it resolves
  from the root `node_modules/.bin`, so `dagger/package.json` needs no change.
- `mise run check`: Runs the same steps as `vpr ready` (madge, root/dagger/workspace check, format, lint, type-check, build, unit tests) inline, using the fixing variants (`--fix` / `--write`) where they exist, then saves `.outputs/styles.json`. It is not a substitute for the final `vpr ready` (which only verifies).
- `mise run clean`: Cleans up build artifacts, tools, and temporary AI caches (like `.ai-data/artifacts`).
- `mise run fix`: With `--remove-comments` (off by default), first removes comments from every TS/JS, JSON(C), CSS, YAML, TOML, HTML/XML/SVG, shell (`.mise/tasks/*`, `.vite-hooks/*`, `*.sh`) and `#`-comment config file (`.editorconfig`, `.npmrc`, …), keeping only `NOSONAR`/`NO_SONAR` comments, comments that are the sole content of an empty `{}`, and tool-read directives (shebang, `#MISE`/`#USAGE`, `#:tombi`, `/// <reference>`, `@vitest-environment`, `@vite-ignore`, `#__PURE__`, `@jsx*`, the `# vX.Y.Z` after a SHA-pinned `uses:`). Markdown (`<!--VITE PLUS START-->` markers, template prompts), YAML block scalars and the excluded files (`.env`, `.env.example`, `tsconfig.reference.json`, `install.sh`, `mise.toml`, `.gitignore`, `.vscode/extensions.json`, `.vscode/settings.json`, `.github/workflows/scan.yml`) are left alone (`scripts/remove-comments.ts`). Next it exports every top-level function, class, enum, `const`, interface and type alias not yet exported (merged into a single `export { … }` followed directly by `export type { … }`, then a blank line and `export default`, at the end of the file; a default export that can't move without changing evaluation order keeps its place and the lists go right above it), even if nothing imports it yet. Skipped: `let`/`var` and `const` collections (`new Map()`, …) holding module state, `declare` statements, files without imports/exports, CommonJS, test files (`tests/`, `*.test.*`, `*.spec.*`), and value exports in `*.stories.*` (Storybook would treat them as stories). Then applies the `.vscode/settings.json` `editor.codeActionsOnSave` actions to every file in the repo — organize/sort imports (TypeScript), sort JSON (`vscode-json-languageservice`), organize Markdown link definitions (`vscode-markdown-languageservice`) via `scripts/code-actions.ts`, then `vp lint --fix` (`source.fixAll.oxc`) and `vp format --write`.
- `mise run create --type=backend|frontend|tasks|scheduler|datastore|library --name=<kebab-name>`: copies the template to `apps/<name>` or `packages/<name>` (fixed by type; the task says so before `vp create`'s directory prompt, which the scaffold ignores) (`scaffold/scaffold.ts`), renaming only its own names (package, paths, `lightproject-<name>` Workers/D1, `lightproject_<name>` database, `<NAME>_*` env keys incl. `VITE_*`, camelCase identifiers, own default ports → next free 3000+/9230+/3111+), adds missing keys to `.env.example` (and the database to `docker-compose.yml` for a datastore; remote D1 ids blanked), runs `vp install` + `vp check --fix` (renamed keys need re-sorting), and prints the CI checklist. README blocks between `<!-- template-only -->` markers are dropped from copies.
- `mise run init`: Initializes the workspace, installs dependencies, and runs all checks.
- `mise run start`: Starts the dev or production servers.

## Build System: Vite+ (`vp`)

`vite-plus` (`vp`) is the core toolchain wrapper used for development, building, and internal task execution.

- `vp dev`: Starts Vite and backend development servers.
- `vp build`: Builds apps for production.
- `vp pack`: Packages libraries (like `design-system` and `common`) for ESM/CJS distribution.

## Database tasks (`templates/datastore`)

- `docker compose up -d postgres`: local Postgres (`lightproject`/`lightproject`, `DATASTORE_POSTGRES_URL`).
- `vpr db:generate [name]`: after editing anything in `src/postgres/` (`schema.ts`, `crud.ts`,
  `tables.ts`, `worker-jobs.ts`, `script-locks.ts`), regenerate their `src/d1/` copies (formatted/linted) and write
  both migrations (none when the schema did not change). Adding a table, step by step:
  `architecture.md` → "Database" → "Adding a table".
  `name` (e.g. `add_sample`: lowercase, digits, `_`/`-`) names both migration folders
  `<timestamp>_<name>`; without it drizzle-kit picks random words.
- `DATABASE_DIALECT=postgres|d1 vpr db:migrate`: one task for every target, running the built
  `dist/scripts/migrate.mjs` (from `src/scripts/migrate.ts`; run `vpr build` first, the
  migrator image runs the same file). `postgres` → `DATASTORE_POSTGRES_URL`/`POSTGRES_*`; `d1` → the local D1
  in the shared `.wrangler/state` that apps' `wrangler dev --persist-to ../../.wrangler/state`
  reads, or with `CLOUDFLARE_ENV=develop|staging|production` that remote D1 in
  `templates/datastore/wrangler.toml` (credentials from the root `.env`; see architecture).
- `vpr test:integration` runs the database contract against `DATABASE_DIALECT` (default
  `postgres`, needs the compose Postgres; `d1` uses a throwaway local D1).
- `vpr db:check` (drizzle-kit migration consistency), `vpr db:studio` (Postgres).
  Studio's UI is the public site `https://local.drizzle.studio` talking to `localhost:4983`, which
  browsers treat as local-network access: use Chrome (allow "Local network access" when asked).
  Brave kept "Connecting…" forever even with Shields off, Local network access allowed and an
  mkcert-trusted HTTPS server (2026-10-18); Safari needs `mkcert -install` first. DBeaver opens
  both databases (local D1 = the `.sqlite` file under `.wrangler/state/v3/d1/`).
- `vpr test:unit`: parity, drift, client tests and the contract on a local D1.
  `vpr test:integration`: the contract on real Postgres (not in `ready`/CI yet).

## Workers tasks (`templates/tasks`)

- Needs a migrated database (`DATABASE_DIALECT=postgres|d1 vpr db:migrate` in
  `templates/datastore`) for `JOB_STORE=database`, the `.env.example` default.
- `vpr dev` (Node, `vpx --watch`) / `vpr start` (built `dist/index.mjs`, what the image runs).
  `vpr` does not load `.env`; the mise-activated shell does (`mise.toml` `[env] _.file`, with
  `${VAR}` expansion — Node's `--env-file` cannot expand it). Outside it, use `mise exec -- …`,
  but signal the node process itself: `mise exec` does not forward SIGTERM.
- `vpr enqueue <function> '<json>' [count]`: enqueue from the CLI (Postgres only: `memory` is
  per process and D1 needs a Cloudflare binding).
- `vpr wrangler:dev`: the Cloudflare runtime on the shared `../../.wrangler/state`; trigger the
  watchdog with `curl "localhost:2002/__scheduled?cron=*+*+*+*+*"`. Follows `.env`'s
  `DATABASE_DIALECT` (`.env` overrides `[vars]`).
- `vpr test:unit`: core, memory store, and the job-store contract on both stores (local D1 from
  `templates/datastore`'s `wrangler.toml` + migrations; build `templates/datastore` first, Vitest loads
  workspace packages from `dist/`). `vpr test:integration`: worker threads (isolation, abort grace, idle-thread errors).

## Scheduler tasks (`templates/scheduler`)

- Needs a migrated database (every run takes its lock in `script_locks`): `DATABASE_DIALECT=postgres|d1 vpr db:migrate`
  in `templates/datastore`; build `templates/datastore` before `vp test` (Vitest loads `dist/`).
- `vpr script <name> [--input '<json>']` (or `vpr script <name> --scheduled`, which takes no input) / `vpr script --list` (`vpx`);
  `vpr start <name> …` runs the built `dist/index.mjs` (what the image runs). Exit 3 = skipped
  (lock held).
- `vpr wrangler:dev`: the Cloudflare runtime on `SCHEDULER_PORT` (2003); fire a cron with
  `curl "localhost:2003/__scheduled?cron=*/5+*+*+*+*"`, a one-off with `POST /run/<name>` and
  `--var SCHEDULER_RUN_TOKEN:<32+ chars>`. Follows `.env`'s `DATABASE_DIALECT` (add
  `--var DATABASE_DIALECT:d1` for the local D1).

## Dependency Management

The monorepo uses `pnpm` (managed automatically by `vp`) with a **Catalog-based approach**:

- **External Dependencies**: Defined centrally in `pnpm-workspace.yaml` under `catalog:`. Package `package.json` files reference them using `"catalog:"`.
- **Internal Dependencies**: Referenced using the `"workspace:*"` protocol.
- **Adding Dependencies**: Always use `vp add <package> --filter <project>` rather than using `npm` or `pnpm` directly.

## CI/CD: Dagger

`dagger.json` lives at the **repo root** (`"source": "dagger"` points at the actual module code
in `dagger/src/index.ts`), so `dagger` commands work from anywhere in the repo with no `-m` flag.
The module runs `pnpm install` + `vp` in a container, so the same pipeline runs locally and in CI
(see `.ai-data/memory.md`'s 2026-09-09 entries for the caching design, and the hard constraint
that `dagger/tsconfig.json` can't `extends` a root file).

- `dagger call ready` (or `mise run dagger ready`): full pipeline, same as CI.
- `mise run dagger <fn> --workspace=@lightproject/<name> [--export]`: one stage (`check`, `format`,
  `lint`, `type-check`, `test-unit`, `build`, …) for one workspace; `dagger functions` lists them.
- `mise run dagger wrangler --workspace=@lightproject/<name> --environment=<develop|staging|production> ...`:
  deploy. Sets `CLOUDFLARE_ENV`, so wrangler uses that `[env.<environment>]` block — a separate
  Worker per environment, `lightproject-<app>-<dev|staging|production>` (the backend's block also
  sets `ENV`, `ALLOW_ALL_IPS`, and that environment's CORS origins). The top-level config sets no `ENV`,
  so it runs as `local` (no IP allowlist, stack traces on) — it is only for local `wrangler dev` and
  tests; never `wrangler deploy` without an environment.
- `dagger call vp --workspace=@lightproject/<name> terminal`: drop into a shell in the built container.
- GitHub Actions: `on-pull-request.yml` → `verify.yml` → `verify-workspace.yml` (per workspace); every
  job runs on the self-hosted runner (`[self-hosted, linux, arm64, dagger]`); `on-push-main.yml` → `deploy.yml` → `deploy-workspace.yml`;
  `trigger.yml` promotes a version to `staging`/`production`. See AGENTS.md "CI Pipeline".
- `dagger/` is Dagger-managed tooling (its own `package.json` and `pnpm-lock.yaml`, outside the
  pnpm workspace) — Dagger's own conventions apply there. Don't hand-edit the generated
  `dagger/sdk/` (gitignored; regenerated by `dagger develop`).
