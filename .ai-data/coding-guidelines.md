# Coding Guidelines

## Environment Management

- Read env through the typed `commonEnv` getters and boolean helpers from `@lightproject/common/environment`; app-specific keys go in the app's `src/env.ts` (`createEnv` + `serverEnvOptions` for server-only envs, `appEnvOptions` when there are `client` keys). `getEnv` is the low-level reader.
- Use semantic helpers like `isProduction()`, `isLocal()`, and `isDebug()` instead of manually comparing string environment variables.
- This provides isomorphic support across Node.js, Vite, and fallback global contexts.

## Structured Logging

- Use the shared logger from `@lightproject/common`.
- It supports isomorphic logging with multi-mode formatting (`pretty` for dev, `json` for production).
- Includes built-in PII redaction and file rotation for backend services.

## UI & Design System (`packages/design-system`)

- **Tokens First**: Use semantic UnoCSS tokens (`adaptive`, `inverse`, `primary`) rather than hard-coded hex colors or standard Tailwind utilities.
- **Shortcuts**: Rely on standardized shortcuts defined in the design system (e.g., `btn-primary`, `glass-nav`).
- **Theme Awareness**: Use the suffixed `adaptive-*` / `inverse-*` tokens (e.g. `bg-adaptive-surface` + `text-inverse-surface`) so elements respond to Light/Dark modes. Bare `bg-adaptive` / `text-adaptive` / `bg-inverse` don't exist and generate no CSS. `surface` is the neutral (untinted) scale; `primary`/`accent`/etc. follow the active theme.
- **Keyframes**: When defining raw keyframes in `uno.config.ts`, always terminate properties with a semicolon to avoid PostCSS syntax errors during production builds.

## Code Quality

- **Type Safety**: Strictly avoid `any` and `unknown`. Do not use `@ts-ignore` or `eslint-disable`.
- **Testing**: Maintain a 100% test pass rate using Vitest (`vp test`).
- **Awaiting in loops**: `no-await-in-loop` is off repo-wide (user decision; no per-file
  overrides), because sequential awaits are often the point (claim one job after another, purge
  batch by batch, retry a write, run migrations in order). Loop with `await` only when each step
  depends on the previous one; run independent work with `Promise.all`/`Promise.allSettled`. Never
  fake a loop with recursion or a `reduce` chain.
