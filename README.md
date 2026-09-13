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

### Querying Logs in Grafana (Loki)

When viewing logs in Grafana, you can use the following LogQL query to natively format and filter the JSON log payloads:

```logql
{service_name="@lightproject/backend"} |= ``
```

```logql
{service_name="@lightproject/frontend"} |~ "kind=(log|exception)" | logfmt | line_format "{{ if .message }}{{.message}}{{ else }}{{.type}}: {{.value}}{{ end }}"
```

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
> Use `vp run <command>` at the root to execute tasks recursively. For example, `vp run test` runs tests for all packages and apps.

## 🛠 Development Workflow

### Mise Automation Tasks

We use `mise` as the primary task runner for high-level repository automation. Tasks are defined in `.mise/tasks/`.

| Command           | Description                                                 |
| :---------------- | :---------------------------------------------------------- |
| `mise run check`  | Run type checking, formatting, linting, building, and tests |
| `mise run clean`  | Clean up build artifacts, tools, and AI caches              |
| `mise run create` | Create standard backend, frontend, and library templates    |
| `mise run init`   | Initialize the workspace                                    |
| `mise run start`  | Start the dev or prod server                                |

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

| Application                                   | Command    | Description                      |
| :-------------------------------------------- | :--------- | :------------------------------- |
| **Frontend** (`/apps/frontend`)               | `vp dev`   | Start Vite development server.   |
|                                               | `vp build` | Build production bundle.         |
| **Backend** (`/apps/backend`)                 | `vp dev`   | Start Hono API.                  |
|                                               | `vp pack`  | Build optimized CJS/ESM library. |
| **Common** (`/packages/common`)               | `vp pack`  | Build shared library modules.    |
| **Design System** (`/packages/design-system`) | `vp pack`  | Build UI library components.     |

### ⚓️ Git Hooks

We use `vp staged` as a pre-commit hook. It automatically runs:

- `oxfmt` to format your code.
- `oxlint` to lint and fix common issues.
- TypeScript type checks.

Only code that passes these checks can be committed.

## 🐳 CI Pipeline (Dagger)

CI runs entirely through a [Dagger](https://dagger.io/) module in `.dagger/src/index.ts` (the `Monorepo` object), inside the official `ghcr.io/voidzero-dev/vite-plus` image — so CI runs the exact same containerized environment you can reproduce locally with the `dagger` CLI.

| Function                              | Description                                                                                                                    |
| :------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------- |
| `dagger call ready`                   | Full suite (madge, root, check, format, lint, type-check, build, test) against the whole repo — what CI runs on every push/PR. |
| `dagger call check --workspace=<pkg>` | Format, lint, and type checks for one workspace (e.g. `@lightproject/backend`).                                                |
| `dagger call build --workspace=<pkg>` | Build one workspace and its internal dependencies.                                                                             |
| `dagger call test --workspace=<pkg>`  | Run tests (with coverage) for one workspace.                                                                                   |
| `dagger call vp --workspace=<pkg>`    | Production-only container running the built Node.js app.                                                                       |
| `dagger call nginx --workspace=<pkg>` | Static/nginx container for frontend-type workspaces.                                                                           |
| `dagger call publish` / `load`        | Push or locally load a built container image.                                                                                  |

Run `dagger functions` to list everything available.

**Caching**: the module mounts persistent [cache volumes](https://docs.dagger.io/api/cache-volumes/) so repeated runs skip redundant work:

- Node.js runtime, the pnpm binary, and the pnpm package store are shared globally across every workspace and the root install.
- Vite Task's own task cache (`node_modules/.vite/task-cache`) is scoped **per target workspace**, since `turbo prune` rewrites `pnpm-lock.yaml` differently depending on which workspace is the build target — a shared cache volume would otherwise cause unrelated cache misses whenever a different workspace triggered the build.

**Self-hosted runner + persistent engine**: CI (`.github/workflows/check.yml`) runs on a self-hosted GitHub Actions runner rather than `ubuntu-latest`. Both the runner (`github-runner`) and a long-lived Dagger engine (`dagger-engine`) are defined in `docker-compose.yml` — the runner points at the engine via `_EXPERIMENTAL_DAGGER_RUNNER_HOST=docker-container://dagger-engine`, so the cache volumes above survive across CI runs instead of starting cold on every ephemeral GitHub-hosted VM. Bring both up with `docker compose up -d dagger-engine github-runner` (needs `GH_RUNNER_TOKEN` in `.env`, a PAT with `repo` + `manage_runners` scope).

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

Testing is powered by Vitest, integrated directly into the `vp` CLI.

```bash
# Run tests
vp test

# Run tests with coverage
vp test --coverage
```

Coverage reports are generated in the `coverage/` directory of each individual package.
