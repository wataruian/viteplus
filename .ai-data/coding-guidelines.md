# Coding Guidelines

## Environment Management

- Use the unified `getEnv` utility and boolean helpers from `@lightproject/common/environment`.
- Use semantic helpers like `isProduction()`, `isLocal()`, and `isDebug()` instead of manually comparing string environment variables.
- This provides isomorphic support across Node.js, Vite, and fallback global contexts.

## Structured Logging

- Use the shared logger from `@lightproject/common`.
- It supports isomorphic logging with multi-mode formatting (`pretty` for dev, `json` for production).
- Includes built-in PII redaction and file rotation for backend services.

## UI & Design System (`packages/design-system`)

- **Tokens First**: Use semantic UnoCSS tokens (`adaptive`, `inverse`, `primary`) rather than hard-coded hex colors or standard Tailwind utilities.
- **Shortcuts**: Rely on standardized shortcuts defined in the design system (e.g., `btn-primary`, `glass-nav`).
- **Theme Awareness**: Use `bg-adaptive`, `text-adaptive`, and `border-adaptive` to ensure elements respond correctly to Light/Dark modes.
- **Keyframes**: When defining raw keyframes in `uno.config.ts`, always terminate properties with a semicolon to avoid PostCSS syntax errors during production builds.

## Code Quality

- **Type Safety**: Strictly avoid `any` and `unknown`. Do not use `@ts-ignore` or `eslint-disable`.
- **Testing**: Maintain a 100% test pass rate using Vitest (`vp test`).
