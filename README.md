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

## 🚀 Getting Started

### Quick Start Checklist

1.  **Node.js**: Ensure you are using `v24.14.1` (check `.tool-versions`).
2.  **Vite+ CLI**: Install globally: `npm i -g vite-plus`.
3.  **Install dependencies**: Run `vp install`.
4.  **Initialize**: Run `vp run init` to build, format, and test everything.
5.  **Develop**: Run `vp dev` to start the frontend application.
6.  **Backend**: Run `vp run dev --filter @lightproject/backend` to start the backend API.

> [!TIP]
> Use `vp run <command>` at the root to execute tasks recursively. For example, `vp run test` runs tests for all packages and apps.

### Prerequisites

| Tool    | Version    | Notes                         |
| :------ | :--------- | :---------------------------- |
| Node.js | `^24.14.1` | Defined in `.tool-versions`   |
| Vite+   | `latest`   | Global CLI for all operations |
| pnpm    | `latest`   | Managed automatically by `vp` |

> [!NOTE]
> You do not need to install `pnpm` manually; `vp` wraps it and ensures the correct version is used based on `package.json`.

## 🛠 Development Workflow

### The `vp` Command Reference

| Category     | Command          | Description                                       |
| :----------- | :--------------- | :------------------------------------------------ |
| **Start**    | `vp install`     | Install dependencies and setup hooks.             |
|              | `vp run init`    | One-time project initialization script.           |
| **Develop**  | `vp run dev`     | Start the development server for all apps.        |
|              | `vp check`       | Run format, lint, and type checks.                |
|              | `vp test`        | Run all tests in the workspace recursively.       |
| **Build**    | `vp run build`   | Build all apps and packages for production.       |
| **Maintain** | `vp cache clean` | Clear the task cache if behavior is inconsistent. |
|              | `vp run ready`   | Full suite of checks (recommended before push).   |

### App Specific Scripts

| Application                                   | Command    | Description                           |
| :-------------------------------------------- | :--------- | :------------------------------------ |
| **Frontend** (`/apps/frontend`)               | `vp dev`   | Start Vite development server.        |
|                                               | `vp build` | Build production bundle.              |
| **Backend** (`/apps/backend`)                 | `vp dev`   | Start Express via `vite-plugin-node`. |
|                                               | `vp pack`  | Build optimized CJS/ESM library.      |
| **Common** (`/packages/common`)               | `vp pack`  | Build shared library modules.         |
| **Design System** (`/packages/design-system`) | `vp pack`  | Build UI library components.          |

### ⚓️ Git Hooks

We use `vp staged` as a pre-commit hook. It automatically runs:

- `oxfmt` to format your code.
- `oxlint` to lint and fix common issues.
- TypeScript type checks.

Only code that passes these checks can be committed.

## 🏗 Monorepo Conventions

### Structure

- **`apps/`**: Deployable units:
  - `frontend`: Vite-powered SPA.
  - `backend`: Node.js backend service.
- **`packages/`**: Shared libraries:
  - `common`: Shared internal utilities and types.
  - `design-system`: Shared UI component library using UnoCSS.
- **`vite.config.ts`**: The **Configuration Hub**. This single file controls linting, formatting, building, and testing for the entire monorepo.

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
