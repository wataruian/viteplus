# Tooling and Tasks

## Task Runner: Mise

`mise` is the primary task runner for root-level repository automation. The tasks are defined in the `.mise/tasks/` directory and can be executed via `mise run <task>`.

Available automation commands:

- `mise run check`: Runs type checking, formatting, linting, building, and tests across the workspace.
- `mise run clean`: Cleans up build artifacts, tools, and temporary AI caches (like `.ai-data/artifacts`).
- `mise run create`: Scaffolds standard backend, frontend, and library templates.
- `mise run init`: Initializes the workspace, installs dependencies, and runs all checks.
- `mise run start`: Starts the dev or production servers.

## Build System: Vite+ (`vp`)

`vite-plus` (`vp`) is the core toolchain wrapper used for development, building, and internal task execution.

- `vp dev`: Starts Vite and backend development servers.
- `vp build`: Builds apps for production.
- `vp pack`: Packages libraries (like `design-system` and `common`) for ESM/CJS distribution.

## Dependency Management

The monorepo uses `pnpm` (managed automatically by `vp`) with a **Catalog-based approach**:

- **External Dependencies**: Defined centrally in `pnpm-workspace.yaml` under `catalog:`. Package `package.json` files reference them using `"catalog:"`.
- **Internal Dependencies**: Referenced using the `"workspace:*"` protocol.
- **Adding Dependencies**: Always use `vp add <package> --filter <project>` rather than using `npm` or `pnpm` directly.
