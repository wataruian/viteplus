<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, but it invokes Vite through `vp dev` and `vp build`.

## Vite+ Workflow

`vp` is a global binary that handles the full development lifecycle. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

### Start

- create - Create a new project from a template
- migrate - Migrate an existing project to Vite+
- config - Configure hooks and agent integration
- staged - Run linters on staged files
- install (`i`) - Install dependencies
- env - Manage Node.js versions

### Develop

- dev - Run the development server
- check - Run format, lint, and TypeScript type checks
- lint - Lint code
- fmt - Format code
- test - Run tests

### Execute

- run - Run monorepo tasks
- exec - Execute a command from local `node_modules/.bin`
- dlx - Execute a package binary without installing it as a dependency
- cache - Manage the task cache

### Build

- build - Build for production
- pack - Build libraries
- preview - Preview production build

### Manage Dependencies

Vite+ automatically detects and wraps the underlying package manager such as pnpm, npm, or Yarn through the `packageManager` field in `package.json` or package manager-specific lockfiles.

- add - Add packages to dependencies
- remove (`rm`, `un`, `uninstall`) - Remove packages from dependencies
- update (`up`) - Update packages to latest versions
- dedupe - Deduplicate dependencies
- outdated - Check for outdated packages
- list (`ls`) - List installed packages
- why (`explain`) - Show why a package is installed
- info (`view`, `show`) - View package information from the registry
- link (`ln`) / unlink - Manage local package links
- pm - Forward a command to the package manager

### Maintain

- upgrade - Update `vp` itself to the latest version

These commands map to their corresponding tools. For example, `vp dev --port 3000` runs Vite's dev server and works the same as Vite. `vp test` runs JavaScript tests through the bundled Vitest. The version of all tools can be checked using `vp --version`. This is useful when researching documentation, features, and bugs.

## Common Pitfalls

- **Using the package manager directly:** Do not use pnpm, npm, or Yarn directly. Vite+ can handle all package manager operations.
- **Always use Vite commands to run tools:** Don't attempt to run `vp vitest` or `vp oxlint`. They do not exist. Use `vp test` and `vp lint` instead.
- **Running scripts:** Vite+ built-in commands (`vp dev`, `vp build`, `vp test`, etc.) always run the Vite+ built-in tool, not any `package.json` script of the same name. To run a custom script that shares a name with a built-in command, use `vp run <script>`. For example, if you have a custom `dev` script that runs multiple services concurrently, run it with `vp run dev`, not `vp dev` (which always starts Vite's dev server).
- **Do not install Vitest, Oxlint, Oxfmt, or tsdown directly:** Vite+ wraps these tools. They must not be installed directly. You cannot upgrade these tools by installing their latest versions. Always use Vite+ commands.
- **Use Vite+ wrappers for one-off binaries:** Use `vp dlx` instead of package-manager-specific `dlx`/`npx` commands.
- **Import JavaScript modules from `vite-plus`:** Instead of importing from `vite` or `vitest`, all modules should be imported from the project's `vite-plus` dependency. For example, `import { defineConfig } from 'vite-plus';` or `import { expect, test, vi } from 'vite-plus/test';`. You must not install `vitest` to import test utilities.
- **Type-Aware Linting:** There is no need to install `oxlint-tsgolint`, `vp lint --type-aware` works out of the box.

## CI Integration

For GitHub Actions, consider using [`voidzero-dev/setup-vp`](https://github.com/voidzero-dev/setup-vp) to replace separate `actions/setup-node`, package-manager setup, cache, and install steps with a single action.

```yaml
- uses: voidzero-dev/setup-vp@v1
  with:
    cache: true
- run: vp check
- run: vp test
```

## Review Checklist for Agents

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to validate changes.
<!--VITE PLUS END-->

---

<!--LIGHTPROJECT START-->

## LightProject

# AI Agent Guidelines

This document outlines the goals, guidelines, and best practices for AI agents working on this project.

## Goals

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
  - Avoid `any` and `@ts-ignore`.
  - Prefer proper TypeScript interfaces and types.
  - Use `vite-plus` provided types for configuration and tests.
- **Refactoring**: When moving code between packages, ensure `exports`, `imports`, and `tsconfig` references are updated atomically.
- **Troubleshooting**:
  - Use `vp cache clean` as a standard first step for resolving unexpected build or test issues.
  - **UnoCSS Keyframe Syntax**: When defining raw keyframe strings in `uno.config.ts`, ensure every property is followed by a semicolon (e.g., `{transform:translateX(0);opacity:1}`). Missing semicolons will cause `CssSyntaxError [postcss]` during production builds.
- **Staged Checks**: Use `vp staged` for pre-commit checks to ensure only valid code is committed.
- **Shared Foundation**: Treat `packages/common` as the foundation for the entire monorepo. Use it for shared logic, types, and cross-cutting concerns like logging and environment management.
- **Design System Sovereignty**: All UI components, styles, and decorative elements (beams, noise, etc.) must reside in `packages/design-system`. `apps/frontend` should be a "thin" consumer that only handles page layout and data fetching.
- **Documentation**: Keep `README.md` and `AGENTS.md` updated with any architectural changes.

<!--LIGHTPROJECT END-->
