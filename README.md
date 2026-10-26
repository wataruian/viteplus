# Vite+ Monorepo Starter

A modern, high-performance monorepo starter powered by [Vite+](https://vite.plus/). This repository provides a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task.

## 🌟 Core Principles

We adhere to **The Vite+ Way**, which emphasizes:

- **Unified Tooling**: One CLI (`vp`) to rule them all. No more juggling `npm`, `pnpm`, `eslint`, `prettier`, and `vitest` separately.
- **Performance First**: Leveraging Rust-based tools like Oxlint, Oxfmt, and Rolldown for lightning-fast development cycles.
- **Aesthetic Excellence**: A premium, engineering-focused UI design system built with UnoCSS. Features a sophisticated **Theme-Aware Architecture** using adaptive tokens (`adaptive`, `inverse`) that intelligently respond to Light and Dark modes.
- **Predictable Builds**: Strict dependency management and localized task caching ensure "if it works on my machine, it works on CI."
- **Design System Sovereignty**: A single source of truth in `packages/design-system` for all components, styles, and decorative elements, ensuring 100% visual consistency across the monorepo.
- **Monoculture**: Consistency across every package and app through unified patterns and a central configuration hub.

## 🏗 Monorepo Architecture & Structure

Every app and package has its own `README.md` with the same sections: Setup, Environment variables, Development, Testing and Deployment. Start there for anything specific to one workspace; a new app or package gets its README when it is created.

### Applications (`apps/`)

None yet: the real apps (`api`, `admin`, `site`, `workers`) will be created here from the templates below.

### Shared Libraries (`packages/`)

| Workspace                                           | Description                                                                       |
| :-------------------------------------------------- | :-------------------------------------------------------------------------------- |
| [`common`](packages/common/README.md)               | Foundation for the apps: typed environment, logging, telemetry, shared variables. |
| [`design-system`](packages/design-system/README.md) | Shared UI component library using UnoCSS and React.                               |

### Templates (`templates/`)

Ordinary workspaces (verified and deployed like the others) that real apps and packages are created from (see "Creating an App or Package from a Template" below).

| Workspace                                    | Description                                                                                                 |
| :------------------------------------------- | :---------------------------------------------------------------------------------------------------------- |
| [`frontend`](templates/frontend/README.md)   | Vite-powered single-page application.                                                                       |
| [`backend`](templates/backend/README.md)     | [Hono](https://hono.dev/) API (Fetch-API/WinterCG), on Node.js (`@hono/node-server`) or Cloudflare Workers. |
| [`tasks`](templates/tasks/README.md)         | Always-running background job workers, on Node.js or Cloudflare Durable Objects.                            |
| [`datastore`](templates/datastore/README.md) | Drizzle schema, clients and migrations for Postgres and D1; owns every table.                               |
| [`library`](templates/library/README.md)     | General purpose library.                                                                                    |

Apps combine packages; a package never depends on another workspace package.

### Templates and Reserved Names

`backend`, `frontend`, `tasks` and `datastore` are templates for the real workspaces to come. Each template and each real workspace owns an env prefix; the real ones' keys are already reserved in `.env.example` (unused until those workspaces exist).

| Template    | Future real workspace(s)  | Env prefix                         | Local ports / database                             |
| :---------- | :------------------------ | :--------------------------------- | :------------------------------------------------- |
| `backend`   | `apps/api`                | `BACKEND_*` → `API_*`              | 2000/8230 → 3000/9230                              |
| `frontend`  | `apps/admin`, `apps/site` | `FRONTEND_*` → `ADMIN_*`, `SITE_*` | 2001/8231/2111 → 3001/9231/3111, 3002/9232/3112    |
| `tasks`     | `apps/workers`            | `TASKS_*` → `WORKERS_*`            | 2002/8232 → 3003/9233                              |
| `datastore` | `packages/database`       | `DATASTORE_*` → `DATABASE_*`       | Postgres `lightproject_datastore` → `lightproject` |

Only variables that would clash when two of them run side by side get the prefix (ports, URLs, `<APP>_CONCURRENCY`, `<PKG>_POSTGRES_DB`/`_URL`); everything else, such as `POSTGRES_HOST`, `DATABASE_DIALECT` or `WORKER_LEASE_MS`, is shared.

### Creating an App or Package from a Template

```bash
mise run create --type=frontend --name=website3   # backend | frontend | tasks | datastore | library
```

This copies the template to `apps/<name>` (backend, frontend, tasks) or `packages/<name>` (datastore, library), then runs `vp install` and `vp check --fix` on it. In the copy, only the template's own names change; names of other apps it talks to (e.g. a frontend's `BACKEND_URL`) stay:

| In the copy                                    | Becomes (`frontend` → `website3`)         |
| :--------------------------------------------- | :---------------------------------------- |
| `@lightproject/frontend`, `templates/frontend` | `@lightproject/website3`, `apps/website3` |
| `lightproject-frontend-<env>` (Workers)        | `lightproject-website3-<env>`             |
| `FRONTEND_*`, `VITE_FRONTEND_*` env keys       | `WEBSITE3_*`, `VITE_WEBSITE3_*`           |
| `frontendPort` and other own identifiers       | `website3Port`                            |
| Own default ports (2001/8231/2111)             | Next free ones: 3000+, 9230+, 3111+       |

Missing keys are added to `.env.example` next to the template's own (a reserved name such as `admin` reuses its keys and ports). A `datastore` copy also gets its own Postgres database (`<NAME>_POSTGRES_DB` in `.env.example` and `docker-compose.yml`) and blank remote D1 ids. The command ends with a checklist of the CI wiring to add by hand (Dagger `WORKSPACES`, workflows, release, Sonar, madge). The logic is `scaffold/scaffold.ts`, tested in `tests/unit/scaffold.test.ts`.

### Archive (`bak/`)

- **Intentionally tracked**: `bak/` preserves earlier app/library setups (including their build caches and a Prisma engine binary) for future reuse. It is not a pnpm workspace member and is excluded from linting/formatting (`ignorePatterns` in `vite.config.ts`), Sonar, and CodeQL.
- **Not a cleanup target**: Its size and contents are known and accepted — don't remove it from Git or list it as a TODO.

### AI Context (`.ai-data/`)

- **Persistent Memory**: The `.ai-data` directory stores architectural decisions, guidelines, and context for AI agents. This directory should be checked into version control to share knowledge across the team.
- **Scratchpads**: The `.ai-data/artifacts/` directory is ignored by Git and used by agents for temporary outputs, drafts, and implementation plans.

## 📊 Observability & Docker Setup

We use a complete open-source telemetry stack configured via `docker-compose.yml`. The local stack leverages the Grafana LGTM stack alongside OpenTelemetry:

- **Grafana**: Dashboards and UI visualization (Port 3300).
- **Loki**: Log aggregation (Port 3100).
- **Tempo**: Distributed tracing (Port 3200).
- **Mimir**: Metrics storage (Ports 9009/9095).
- **OpenTelemetry Collector**: Standardized ingestion of traces, metrics, and logs (Ports 4317/4318).

Backend services are expected to emit telemetry to the OpenTelemetry Collector. Each workspace README lists its telemetry variables (e.g. `OTLP_ENDPOINT`, `SKIP_OPENTELEMETRY`).

### Querying Logs in Grafana (Loki)

When viewing logs in Grafana, you can use the following LogQL query to natively format and filter the JSON log payloads:

```logql
{service_name="@lightproject/backend"} |= ``
```

```logql
{service_name="@lightproject/frontend"} |~ "kind=(log|exception)" | logfmt | line_format "{{ if .message }}{{.message}}{{ else }}{{.type}}: {{.value}}{{ end }}"
```

### Querying Metrics in Grafana (Mimir)

The metric samples are counters and duration gauges emitted from both apps: backend `request_hits` and `http_server_duration_seconds`, frontend `button_clicks` and `http_client_duration_seconds`.

Every SDK instance (each backend Worker isolate or Node process, and **each browser tab**) reports under its own `service.instance.id`. OpenTelemetry requires one writer per metric stream, so the collector's `deltatocumulative` processor can keep a correct running total per instance. Idle instances are dropped after `max_stale` (5m). Each instance is therefore its own series (`instance` / `service_instance_id` labels). **Always aggregate across instances in queries:**

```promql
sum without (instance, service_instance_id) (rate(request_hits_total[5m]))
sum without (instance, service_instance_id) (rate(button_clicks_total[5m]))
```

A per-instance series only receives data while its tab or isolate is alive, then goes stale. The cost therefore scales with recently active instances (roughly concurrent visitors), not with total page views. At high browser traffic, switch the frontend to collector-derived metrics: browsers send spans or events, and the collector's `spanmetrics` / `count` connector aggregates them as the single writer.

### Querying Traces in Grafana (Tempo)

A request made from the browser is a single trace: its root is the frontend's `HTTP GET` span, with the backend span as its child. A filter such as `{resource.service.name="@lightproject/backend"}` therefore also lists frontend-rooted traces, because the search table shows each trace's root span, not the span that matched. To list only traces that start in the backend, without CORS preflights:

```traceql
{ trace:rootService = "@lightproject/backend" && trace:rootName != "http.request:OPTIONS" }
```

`http.request:OPTIONS` traces are CORS preflights. The browser sends them itself and does not trace them, so each one is a standalone backend trace. The backend lets browsers cache a preflight for 10 minutes (`maxAge: 600`).

Keep Tempo at 2.9 or later. Tempo 2.8's ingester cut every live trace on each 10s flush check, not after `trace_idle_period`. When a trace's frontend and backend spans arrived on either side of a check, Tempo stored them as separate pieces, and searches that matched only the backend piece showed `<root span not yet received>`.

### Sending a Deployed Environment's Telemetry to the Local Stack

`mise tunnel` exposes the local collector (OTLP, port 4318) and Faro receiver (port 12347) through free Cloudflare quick tunnels and prints their URLs. To point a deployed environment at them:

1. Set the GitHub Environment variables `OTLP_ENDPOINT` and `FARO_ENDPOINT` on that environment (Settings → Environments → `develop`/`staging`/`production` → Variables).
2. Redeploy the frontend and backend. The deploy workflow bakes both into the frontend build as `VITE_OTLP_ENDPOINT`/`VITE_FARO_ENDPOINT` (browsers send directly), and passes `OTLP_ENDPOINT` to the backend Worker as a runtime variable (Dagger `wrangler --worker-var=OTLP_ENDPOINT=<url>`; repeat the flag for more variables).
3. Keep `mise tunnel` running while testing. Its URLs change on every run, and anyone with them can send telemetry to your machine. Delete the variables and redeploy to restore the defaults.

## 🚀 Getting Started

### Prerequisites

| Tool    | Version   | Notes                         |
| :------ | :-------- | :---------------------------- |
| Node.js | `24.15.0` | Defined in `.tool-versions`   |
| mise    | `latest`  | Task runner and env manager   |
| Vite+   | `latest`  | Global CLI for all operations |
| pnpm    | `latest`  | Managed automatically by `vp` |

> [!NOTE]
> You do not need to install `pnpm` manually; `vp` wraps it and ensures the correct version is used based on `package.json`.

### Quick Start Checklist

1.  **Node.js**: Ensure you are using `v24.15.0` (check `.tool-versions`).
2.  **Mise**: Install globally for task execution.
3.  **Vite+ CLI**: Install globally: `npm i -g vite-plus`.
4.  **Install dependencies**: Run `vp install`, then `docker compose up -d postgres` (integration tests use it). On a Postgres volume created before `configs/postgres/create-databases.sh` existed, run it once: `docker compose exec postgres sh /docker-entrypoint-initdb.d/create-databases.sh` (creates every `*_POSTGRES_DB`, skips existing ones).
5.  **Initialize**: Run `mise run init` to build, format, and test everything.
6.  **Develop**: Run `mise run start dev` to start every app, or follow a workspace's README to run one.

> [!TIP]
> Use `vp run <command>` at the root to execute tasks recursively. For example, `vp run test:unit` runs unit tests for all packages and apps (the root's own files have `vp run root:check` and `vp run root:test:unit`) (`vp run test:e2e` runs the Playwright browser tests).

## 🛠 Development Workflow

### Mise Automation Tasks

We use `mise` as the primary task runner for high-level repository automation. Tasks are defined in `.mise/tasks/`.

| Command                                    | Description                                                                                                                             |
| :----------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| `mise run check`                           | Run type checking, formatting, linting, building, and tests                                                                             |
| `mise run clean`                           | Clean up build artifacts, tools, and AI caches                                                                                          |
| `mise run fix`                             | Export all top-level declarations, then apply the editor's on-save code actions to all files (`--remove-comments` also strips comments) |
| `mise run create`                          | Create an app or package from a template (see above)                                                                                    |
| `mise run init`                            | Initialize the workspace                                                                                                                |
| `mise run pin-action <owner>/<repo>@<tag>` | Print a SHA-pinned `uses:` line for a GitHub Action                                                                                     |
| `mise run start`                           | Start the dev or prod server                                                                                                            |

### The `vp` Command Reference

| Category     | Command          | Description                                       |
| :----------- | :--------------- | :------------------------------------------------ |
| **Start**    | `vp install`     | Install dependencies and setup hooks.             |
| **Develop**  | `vp run dev`     | Start the development server for all apps.        |
|              | `vp check`       | Run format, lint, and type checks.                |
|              | `vp test`        | Run all tests in the workspace recursively.       |
| **Build**    | `vp run build`   | Build all apps and packages for production.       |
| **Maintain** | `vp cache clean` | Clear the task cache if behavior is inconsistent. |
|              | `vp run ready`   | Full suite of checks (recommended before push).   |

### Workspace Tasks

Each workspace's tasks (dev servers, builds, `wrangler`, database generation and migration, …) are listed in its README's Development section. Run them from the workspace directory with `vp run <task>`, or from the root with `vp run --filter <package> <task>`. Remember that `vp dev` (built-in) and `vp run dev` (task) may differ; check the README.

### ⚓️ Git Hooks

We use `vp staged` as a pre-commit hook. It automatically runs:

- `oxfmt` to format your code.
- `oxlint` to lint and fix common issues.
- TypeScript type checks.

Only code that passes these checks can be committed.

## 🐳 CI Pipeline (Dagger)

CI runs entirely through a [Dagger](https://dagger.io/) module in `dagger/src/index.ts` (the `Monorepo` object), inside the official `ghcr.io/voidzero-dev/vite-plus` image — so CI runs the exact same containerized environment you can reproduce locally with the `dagger` CLI.

| Function                                                                                               | Description                                                                                                                                                                                                                                                                                                                                                                             |
| :----------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dagger call ready`                                                                                    | Full suite (madge, root, check, format, lint, type-check, build, test) against the whole repo, like `vp run ready`.                                                                                                                                                                                                                                                                     |
| `dagger call check --workspace=<pkg>`                                                                  | Format, lint, and type checks for one workspace (e.g. `@lightproject/backend`).                                                                                                                                                                                                                                                                                                         |
| `dagger call build --workspace=<pkg>`                                                                  | Build one workspace and its internal dependencies.                                                                                                                                                                                                                                                                                                                                      |
| `dagger call test-unit\|test-integration\|test-end-to-end --workspace=<pkg>`                           | Run one workspace's unit (with coverage), integration or browser tests.                                                                                                                                                                                                                                                                                                                 |
| `dagger call vp --workspace=<pkg>`                                                                     | Production-only container running the built Node.js app.                                                                                                                                                                                                                                                                                                                                |
| `dagger call nginx --workspace=<pkg>`                                                                  | Static/nginx container for frontend-type workspaces.                                                                                                                                                                                                                                                                                                                                    |
| `dagger call publish` / `load`                                                                         | Push or locally load a built container image.                                                                                                                                                                                                                                                                                                                                           |
| `dagger call migrate --workspace=@lightproject/datastore --environment=<env> --dialect=<d1\|postgres>` | Apply the database migrations to a deployed environment (see `templates/datastore`).                                                                                                                                                                                                                                                                                                    |
| `dagger call wrangler --workspace=<pkg> --environment=<env>`                                           | Deploy one workspace to its Cloudflare Worker for `develop`/`staging`/`production`. Pass frontend build-time env with `--build-env=KEY=VALUE` and backend runtime Worker vars with `--worker-var=KEY=VALUE`; repeat either flag per variable (e.g. `--worker-var=VAR1=123 --worker-var=VAR2=456`). Cloudflare credentials come from `--cloudflare-api-token`/`--cloudflare-account-id`. |

Run `dagger functions` to list everything available.

**Caching**: the module mounts persistent [cache volumes](https://docs.dagger.io/api/cache-volumes/) so repeated runs skip redundant work:

- Node.js runtime, the pnpm binary, and the pnpm package store are shared globally across every workspace and the root install.
- Vite Task's own task cache (`node_modules/.vite/task-cache`) is scoped **per target workspace**, since `turbo prune` rewrites `pnpm-lock.yaml` differently depending on which workspace is the build target — a shared cache volume would otherwise cause unrelated cache misses whenever a different workspace triggered the build.

**Self-hosted runner + persistent engine**: every GitHub Actions job runs on a self-hosted runner (`runs-on: [self-hosted, linux, arm64, dagger]`, matching the runner's `LABELS`) rather than `ubuntu-latest`. Both the runner (`github-runner`) and a long-lived Dagger engine (`dagger-engine`) are defined in `docker-compose.yml` — the runner points at the engine via `_EXPERIMENTAL_DAGGER_RUNNER_HOST=docker-container://dagger-engine`, so the cache volumes above survive across CI runs instead of starting cold on every ephemeral GitHub-hosted VM. Bring both up with `docker compose up -d dagger-engine github-runner` (needs `GH_RUNNER_TOKEN` in `.env`, a PAT with `repo` + `manage_runners` scope). **Stale runners**: on stop, the runner image deregisters itself from GitHub, and `stop_grace_period: 60s` gives it time before Docker's SIGKILL (the scaler's `docker stop --time 60` does the same). For containers that die without a clean stop (`docker rm -f`, Docker Desktop quit, crash), `runner-scaler` runs `.mise/tasks/prune-runners` every tick: it deletes offline, idle `GH_RUNNER_NAME-*` runners whose container no longer exists. After a `docker compose down`, run `mise run prune-runners` (add `--dry-run` to only list them), or let the next `up` clean them. GitHub also drops offline ephemeral runners by itself after a day.

**SonarQube (one project per pull request)**: the `sonarqube` service in `docker-compose.yml` (UI on port 9010) runs the official Community Build image, which keeps a single analysis per project and has no branch or pull request analysis. So that scans never overwrite each other, each scan goes to its own project.

- **Pull requests**: the SonarQube step in `.github/workflows/verify-workspace.yml` passes `--pull-request=<number>`, scanning into `lightproject-viteplus-<workspace>-pr-<number>`. The `sonar-<workspace>` artifacts feed the PR comment.
- **Manual `trigger.yml` runs** (`environment: pr`): the same step passes `--branch=<ref>`, scanning into `lightproject-viteplus-<workspace>-<branch>` (`/` becomes `-`).
- **Cleanup on close**: `.github/workflows/on-pull-request-closed.yml` runs when a pull request into `main` is closed or merged. It calls `dagger call sonar-cleanup --pull-request=<number>`, which deletes `lightproject-viteplus-<workspace>-pr-<number>` for every workspace (a missing project is fine). It shares the `pr-<number>` concurrency group with `on-pull-request.yml`, so closing cancels an in-flight scan instead of letting it recreate the project. `SONAR_TOKEN` must be a user token with Administer permission on those projects; an analysis token can only scan.
- **`main` is not scanned**: branch protection means every change was already scanned on its pull request.
- **Locally**: `dagger call sonar --workspace=<pkg> --sonar-token=env:SONAR_TOKEN --docker-socket=/var/run/docker.sock`, optionally with `--pull-request=<number>` or `--branch=<name>`. With neither, the scan lands on the base `lightproject-viteplus-<workspace>` project. Branch names may only contain letters, digits, `.`, `_`, `-` and `/`.
- **Known limitations**: each pull request project starts with no history, so quality gate conditions on new code only apply from its second analysis onward. The scanner doesn't get `.git`, so it can't tell which lines changed.

**Registry pull-through cache**: `registry-cache` (`rpardini/docker-registry-proxy`) is a transparent HTTPS caching proxy for `docker.io` and `ghcr.io` image pulls. `dagger-engine` is wired to it via `HTTP_PROXY`/`HTTPS_PROXY` (pointed at its static compose IP, since the engine's own internal build-sandbox resolver can't see compose service DNS names) plus its generated CA mounted into `/usr/local/share/ca-certificates`, which Dagger auto-trusts on startup — so every registry pull a Dagger Function makes, including CI's `mise run dagger ...` steps (via the persistent engine above), is cached automatically with no per-call or per-workflow changes needed.

Raw `docker pull`/`docker build` run directly against the host socket (from a GH Actions step, `dagger call load`, etc.) bypass this cache — `registry-cache` is only wired into `dagger-engine`'s own environment, not the host daemon itself. Caching that path would mean configuring the host daemon directly (out of scope while `github-runner` runs on Docker Desktop for local testing rather than a real Linux host).

## 🏗 Monorepo Conventions

### Dependency Management

- **Internal**: Use `workspace:*` in `package.json` to reference other local packages.
- **External**: Use `catalog:` for shared external dependencies. These are defined once in `pnpm-workspace.yaml` to ensure version parity across all projects.

### Adding a Dependency

To add a package to a specific project:

```bash
vp add <package-name> --filter <project-name>
```

## 💡 IDE Setup (Recommended)

To fully leverage the speed of the Vite+ toolchain, we recommend the following VS Code extensions:

1.  **[Oxlint](https://marketplace.visualstudio.com/items?itemName=voidzero.oxlint)**: Real-time, high-performance linting.
2.  **[Oxfmt](https://marketplace.visualstudio.com/items?itemName=voidzero.oxfmt)**: Instant code formatting.

**Settings Configuration:**

- Set `editor.formatOnSave` to `true`.
- Set `oxfmt` as the default formatter for your workspace.

## 🧪 Testing & Coverage

Testing is powered by Vitest, integrated directly into the `vp` CLI. Every workspace keeps unit tests in `tests/unit/` (the only place `vp test` looks, via the shared `include` in the root `vite.config.ts`) and browser tests in `tests/e2e/`.

```bash
# Run tests
vp test

# Run tests with coverage
vp test --coverage
```

Coverage reports are generated in the `coverage/` directory of each individual package.

### Browser (e2e) tests

Workspaces with a UI (`templates/frontend`, `packages/design-system`) also have Playwright tests in `tests/e2e/` that drive a real Chromium, for behavior jsdom can't reproduce. Their READMEs cover the one-time Chromium install, ports and what each suite tests.

```bash
vp run -r test:e2e    # browser tests in every workspace that has them
vp run -r test:unit   # unit tests
```

Both are cached like the other tasks; a cache hit also restores the e2e output. Each run writes to `e2e-test-results/` in the workspace: a video of every test (`results/**/video.webm`), a JSON report (`results.json`), and an HTML report (`report/index.html`, which embeds the videos).

In CI, `dagger call test-end-to-end --workspace=<pkg>` runs them in the `vite-plus` container (installing Chromium and its system libraries), and `verify-workspace.yml` uploads everything as the `e2e-<workspace>` artifact. On pull requests, an **E2E report** comment summarizes the results per workspace and links to those artifacts.
