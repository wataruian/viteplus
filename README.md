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

### Applications (`apps/`)

- **`frontend`**: Vite-powered Single Page Application (SPA).
- **`backend`**: [Hono](https://hono.dev/) API — a Fetch-API/WinterCG-compatible framework, deployable to Node.js (`@hono/node-server`) or the edge (Cloudflare Workers via `wrangler`).

### Shared Libraries (`packages/`)

- **`common`**: Foundational library providing isomorphic environment management and structured logging.
- **`design-system`**: Shared UI component library using UnoCSS and React.
- **`library`**: General purpose shared library templates.

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

Backend services are expected to emit telemetry to the OpenTelemetry Collector.

Set `SKIP_OPENTELEMETRY=true` to run the backend without exporting telemetry (no collector needed); request context, such as the `requestId` in logs, keeps working. Unit tests default to it and never send telemetry to a real endpoint. The telemetry tests opt back in against a fake collector.

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
4.  **Install dependencies**: Run `vp install`.
5.  **Initialize**: Run `mise run init` to build, format, and test everything.
6.  **Develop**: Run `mise run start dev` or `vp dev` to start the local development environment.

> [!TIP]
> Use `vp run <command>` at the root to execute tasks recursively. For example, `vp run test:unit` runs unit tests for all packages and apps (`vp run test:e2e` runs the Playwright browser tests).

## 🛠 Development Workflow

### Mise Automation Tasks

We use `mise` as the primary task runner for high-level repository automation. Tasks are defined in `.mise/tasks/`.

| Command                                    | Description                                                                                                                             |
| :----------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| `mise run check`                           | Run type checking, formatting, linting, building, and tests                                                                             |
| `mise run clean`                           | Clean up build artifacts, tools, and AI caches                                                                                          |
| `mise run fix`                             | Export all top-level declarations, then apply the editor's on-save code actions to all files (`--remove-comments` also strips comments) |
| `mise run create`                          | Create standard backend, frontend, and library templates                                                                                |
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

### App Specific Scripts

| Application                                   | Command                                              | Description                                                                                  |
| :-------------------------------------------- | :--------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| **Frontend** (`/apps/frontend`)               | `vp dev`                                             | Start Vite development server.                                                               |
|                                               | `vp build`                                           | Build production bundle.                                                                     |
| **Backend** (`/apps/backend`)                 | `vp dev`                                             | Start Hono API.                                                                              |
|                                               | `vp pack`                                            | Build optimized CJS/ESM library.                                                             |
| **Common** (`/packages/common`)               | `vp pack`                                            | Build shared library modules.                                                                |
| **Database** (`/packages/database`)           | `vp run db:generate [name]`                          | Generate the D1 schema from Postgres + both migrations (folders named `<timestamp>_<name>`). |
|                                               | `vp run db:migrate:postgres` / `db:migrate:d1:local` | Apply them locally.                                                                          |
|                                               | `CLOUDFLARE_ENV=develop vp run db:migrate:d1:remote` | Apply them to a remote D1.                                                                   |
| **Design System** (`/packages/design-system`) | `vp pack`                                            | Build UI library components.                                                                 |

### ⚓️ Git Hooks

We use `vp staged` as a pre-commit hook. It automatically runs:

- `oxfmt` to format your code.
- `oxlint` to lint and fix common issues.
- TypeScript type checks.

Only code that passes these checks can be committed.

## 🐳 CI Pipeline (Dagger)

CI runs entirely through a [Dagger](https://dagger.io/) module in `dagger/src/index.ts` (the `Monorepo` object), inside the official `ghcr.io/voidzero-dev/vite-plus` image — so CI runs the exact same containerized environment you can reproduce locally with the `dagger` CLI.

| Function                                                     | Description                                                                                                                                                                                                                                                                                                                                                                             |
| :----------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dagger call ready`                                          | Full suite (madge, root, check, format, lint, type-check, build, test) against the whole repo — what CI runs on every push/PR.                                                                                                                                                                                                                                                          |
| `dagger call check --workspace=<pkg>`                        | Format, lint, and type checks for one workspace (e.g. `@lightproject/backend`).                                                                                                                                                                                                                                                                                                         |
| `dagger call build --workspace=<pkg>`                        | Build one workspace and its internal dependencies.                                                                                                                                                                                                                                                                                                                                      |
| `dagger call test --workspace=<pkg>`                         | Run tests (with coverage) for one workspace.                                                                                                                                                                                                                                                                                                                                            |
| `dagger call vp --workspace=<pkg>`                           | Production-only container running the built Node.js app.                                                                                                                                                                                                                                                                                                                                |
| `dagger call nginx --workspace=<pkg>`                        | Static/nginx container for frontend-type workspaces.                                                                                                                                                                                                                                                                                                                                    |
| `dagger call publish` / `load`                               | Push or locally load a built container image.                                                                                                                                                                                                                                                                                                                                           |
| `dagger call wrangler --workspace=<pkg> --environment=<env>` | Deploy one workspace to its Cloudflare Worker for `develop`/`staging`/`production`. Pass frontend build-time env with `--build-env=KEY=VALUE` and backend runtime Worker vars with `--worker-var=KEY=VALUE`; repeat either flag per variable (e.g. `--worker-var=VAR1=123 --worker-var=VAR2=456`). Cloudflare credentials come from `--cloudflare-api-token`/`--cloudflare-account-id`. |

Run `dagger functions` to list everything available.

**Caching**: the module mounts persistent [cache volumes](https://docs.dagger.io/api/cache-volumes/) so repeated runs skip redundant work:

- Node.js runtime, the pnpm binary, and the pnpm package store are shared globally across every workspace and the root install.
- Vite Task's own task cache (`node_modules/.vite/task-cache`) is scoped **per target workspace**, since `turbo prune` rewrites `pnpm-lock.yaml` differently depending on which workspace is the build target — a shared cache volume would otherwise cause unrelated cache misses whenever a different workspace triggered the build.

**Self-hosted runner + persistent engine**: every GitHub Actions job runs on a self-hosted runner (`runs-on: [self-hosted, linux, arm64, dagger]`, matching the runner's `LABELS`) rather than `ubuntu-latest`. Both the runner (`github-runner`) and a long-lived Dagger engine (`dagger-engine`) are defined in `docker-compose.yml` — the runner points at the engine via `_EXPERIMENTAL_DAGGER_RUNNER_HOST=docker-container://dagger-engine`, so the cache volumes above survive across CI runs instead of starting cold on every ephemeral GitHub-hosted VM. Bring both up with `docker compose up -d dagger-engine github-runner` (needs `GH_RUNNER_TOKEN` in `.env`, a PAT with `repo` + `manage_runners` scope).

**SonarQube (branch + pull request analysis)**: the `sonarqube` service in `docker-compose.yml` (UI on port 9010) runs `mc1arke/sonarqube-with-community-branch-plugin`, the Community Build plus the [community branch plugin](https://github.com/mc1arke/sonarqube-community-branch-plugin), so every branch and pull request gets its own analysis instead of overwriting one shared result. The plugin's version must match SonarQube's, so the image stays on the newest version the plugin supports (26.5) until a matching plugin release lands. SonarQube cannot downgrade a database, so moving between versions means recreating the `sonarqube-data` volume and generating a new `SONAR_TOKEN`.

- **One workflow for every scan**: `.github/workflows/sonar.yml` resolves the affected workspaces (plus `dagger` when it changed), scans each one in a matrix job, and picks the scope from the event. A `pull_request` passes `--pull-request`, `--pull-request-branch` and `--pull-request-base`; anything else passes `--branch=<ref>`.
- **Pull requests** (`verify.yml` → `sonar.yml`): scans run after the per-workspace verify jobs, so the unit tests they re-run come from the Dagger cache. The `sonar-<workspace>` artifacts feed the PR comment.
- **`main`** (`on-push-main.yml` → `sonar.yml`): each affected workspace is scanned as branch `main` after every push. This is the baseline pull requests are compared against. It runs alongside the deploy and never blocks it.
- **Manual `trigger.yml` runs** (`environment: pr`): the same `verify.yml` → `sonar.yml` path, scanned as the dispatched branch.
- **Locally**: `dagger call sonar --workspace=<pkg> --sonar-token=env:SONAR_TOKEN --docker-socket=/var/run/docker.sock` plus `--branch=<name>` or the three `--pull-request*` flags. With neither, the scan lands on `main`. Branch names may only contain letters, digits, `.`, `_`, `-` and `/`.
- **Known limitation**: the scanner doesn't get `.git`, so it can't tell which lines a pull request changed, and every issue in a scanned file counts as new.

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

`packages/design-system` and `apps/frontend` also have Playwright tests in `tests/e2e/` that drive a real Chromium, for behavior jsdom can't reproduce — the light/dark toggle updating in place on Storybook's docs and variant pages, the design-system preview app, and the frontend's `/preview` page, plus the frontend home page and its navigation to and from `/preview`.

```bash
# One-time: download the Chromium build Playwright expects
vp exec --filter @lightproject/design-system playwright install chromium

# Run them (each starts its own servers on dedicated ports: design-system Storybook 6116 +
# preview app 6117, frontend 2111)
vp run -r test:e2e
```

Unit tests are `vp run -r test:unit`. Both are cached like the other tasks; a cache hit also restores the e2e output.

Each run writes to `e2e-test-results/` in the workspace: a video of every test (`results/**/video.webm`), a JSON report (`results.json`), and an HTML report (`report/index.html`, which embeds the videos).

In CI, `dagger call test-end-to-end --workspace=<pkg>` runs them in the `vite-plus` container (installing Chromium and its system libraries), and `verify-workspace.yml` uploads everything as the `e2e-<workspace>` artifact. On pull requests, an **E2E report** comment summarizes the results per workspace and links to those artifacts.

### Share tags (`apps/frontend`)

`og:url`, `og:image`, and `twitter:image` must be absolute, so the frontend build only emits them when its public URL is known: `FRONTEND_URL` (or `VITE_FRONTEND_URL`), the same variable `@lightproject/common/configs` uses for `frontendUrl` (see `.env.example`). Deploys derive it from the target environment's frontend Worker (`https://lightproject-frontend-<dev|staging|production>.wataru.workers.dev`), the same way they derive `VITE_BACKEND_URL`. The share image (`public/og-image.png`) and `public/apple-touch-icon.png` are generated from `favicon.svg`; replace them with brand assets any time.
