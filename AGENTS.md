<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

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

## Guidelines

- **Tooling**: Always use the `vp` CLI for any task (install, dev, test, build, lint, fmt). Never use `npm`, `pnpm`, or `yarn` directly.
- **Monorepo Structure**:
  - `apps/`: Dedicated to deployable applications:
    - `apps/frontend`: Frontend application built with Vite.
    - `apps/backend`: Backend service.
  - `packages/`: Dedicated to shared libraries and utilities:
    - `packages/common`: Shared internal library.
    - `packages/design-system`: Shared UI component library using UnoCSS.
- **Imports**:
  - Always import from `vite-plus` or `vite-plus/test` instead of `vite` or `vitest`.
  - Use `workspace:*` for internal package dependencies.
- **Package Management**:
  - Update `exports` in `package.json` immediately when adding new public modules to a package.
  - Maintain `tsconfig.json` references between workspace projects.
- **Configuration**: Use `defineConfig` from `vite-plus` for all configuration files.
- **Command Selection**:
  - Use `vp run <script>` for custom scripts defined in `package.json`.
  - Use `vp <command>` (e.g., `vp dev`, `vp test`) for built-in Vite+ functionality.
- **Configuration Hub**: Treat `vite.config.ts` as the source of truth for formatting, linting, and building.

## Exploration Strategy

When first entering the repository or a new package:

1. **Root Analysis**: Start with `package.json` and `vite.config.ts` to understand the global configuration and available custom scripts (e.g., `vp run init`, `vp run ready`).
2. **Dependency Graph**: Check `pnpm-workspace.yaml` and internal `package.json` files to map project relationships. Note the use of `catalog:` for shared external dependencies.
3. **Task Discovery**: Run `vp help` and `vp run --help` to identify available tools and tasks. Note that `vp run <command>` at the root level executes recursively across all workspace projects.
4. **Validation Check**: Run `vp install` followed by `vp run ready` to ensure the local environment is healthy before making changes.

## Environment Management

- **Isomorphic Access**: Use the unified `getEnv` and boolean helpers from `@lightproject/common/environment` for all environment variable access. This ensures compatibility across Node.js, Vite, and fallback global contexts.
- **Boolean Helpers**: Favor semantic helpers like `isLocal()`, `isProduction()`, `isCi()`, and `isDebug()` over manual string comparisons.
- **Type Safety**: The environment utility provides typed access and fallbacks for common variables like `LOG_LEVEL` and `LOG_FORMAT`.

## Dependency Management

- **Catalogs**: Use `catalog:` in `package.json` for shared external dependencies defined in `pnpm-workspace.yaml`.
- **Internal**: Use `workspace:*` for all internal package/app references.
- **Strictness**: Do not add dependencies directly with `pnpm` or `npm`. Use `vp add`.

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
- **Staged Checks**: Use `vp staged` for pre-commit checks to ensure only valid code is committed.
- **Shared Foundation**: Treat `packages/common` as the foundation for the entire monorepo. Use it for shared logic, types, and cross-cutting concerns like logging and environment management.
- **Design System Sovereignty**:
  - All UI components, styles, and decorative elements (beams, noise, etc.) must reside in `packages/design-system`.
  - **Tokens First**: Favor semantic tokens (`adaptive`, `inverse`, `primary`) over hard-coded hex or Tailwind colors.
  - **Shortcuts**: Use standardized UnoCSS shortcuts for common elements (e.g., `btn-primary`, `btn-ghost`, `glass-nav`).
  - **Header Safety**: When using the sticky `Header`, always add a `pt-20` (80px) buffer to the main content area in the app to prevent overlapping.
- **Documentation**: Keep `README.md` and `AGENTS.md` updated with any architectural changes.
- **AI Data**: AI agents should store data in `./.ai-data` directory and use it for reference and knowledge sharing.

<!--AI AGENT END-->
