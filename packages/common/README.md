# @lightproject/common

Shared foundation for the apps: logging and redaction, the typed environment, telemetry (Node,
Workers and browser), endpoint configs, validators and small utilities. Apps (`backend`,
`frontend`, `workers`) depend on it; other packages never do (a package takes what it needs as an
option instead, e.g. `onNotice` in `packages/database`). This README is the canonical list of the
shared environment variables; the full pattern is in `AGENTS.md` → "Environment Management".

```ts
import { isLocal, getOtlpEndpoint } from '@lightproject/common/environment';
import { logger, redactUrl } from '@lightproject/common/logger';

logger.info('started', { local: isLocal(), otlp: redactUrl(getOtlpEndpoint()) });
```

Commands run from `packages/common` unless noted.

## Setup

1. Install (from the repo root): `vp install`. No services or `.env` keys are needed; every
   shared variable has a default or is optional.

2. Build `dist/`:

   ```sh
   vp run build
   ```

   Apps resolve `@lightproject/common` from `dist/` at runtime (Node, `wrangler`, and the apps'
   own tests), so **rebuild after every change** here, or a stale build is used. From the repo
   root: `vp run --filter @lightproject/common build`; `vp run ready` builds before testing.

## Environment variables

`commonEnv` (`src/environment/schema.ts`, `@t3-oss/env-core` + zod) validates every key below
**once, at module load**, and throws with the list of invalid keys (values are never echoed).
Empty strings count as unset. Each key is read through `getEnv('X')`: `process.env.X`, then
`import.meta.env.X` (browser), then the `VITE_X` mirror. Read them through the named getters and
boolean helpers in `src/environment/variables.ts` (`getOtlpEndpoint()`, `isLocal()`,
`isProduction()`, `isCi()`, …), not `getEnv`; a new shared variable goes into `commonEnv` plus a
getter. Flags (`flag`) are on for `true` (any case) or `1`.

| Variable            | Used by                           | Purpose                                                                                                         |
| ------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `ENV`               | `isLocal()`, `isProduction()`, …  | `local` (default), `test`, `develop`, `staging`, `production` (lower-cased). Telemetry `deployment.environment` |
| `NODE_ENV`          | `getNodeEnv()`, `isNodeEnvTest()` | `development`, `production` or `test`; optional                                                                 |
| `CI`                | `isCi()`, `isNonProduction()`     | Flag (default off)                                                                                              |
| `DEBUG`             | `isDebug()`                       | Flag (default off)                                                                                              |
| `VITEST`            | `isVitest()`                      | Flag, set by Vitest itself                                                                                      |
| `LOG_LEVEL`         | `logger`                          | `silent`, `error`, `warn`, `info`, `debug`, `trace` (default `info`; `trace` logs as `info`)                    |
| `LOG_FORMAT`        | `logger`                          | `pretty` (default) or `json`; only honored when `ENV=local`, every other `ENV` logs JSON                        |
| `CHALK_LEVEL`       | `utils` (colors)                  | Color depth `0`–`3`, clamped; non-numeric means `3` (default `3`)                                               |
| `BACKEND_URL`       | `getBackendBaseUrl()`, `configs`  | Backend base URL (default `http://localhost:2000`)                                                              |
| `FRONTEND_URL`      | `getFrontendUrl()`, `configs`     | Frontend URL (default `http://localhost:2001`)                                                                  |
| `API_URL`           | `getApiBaseUrl()`, `configs`      | API base URL (default `http://localhost:3000`)                                                                  |
| `ADMIN_URL`         | `getAdminUrl()`, `configs`        | Admin URL (default `http://localhost:3001`)                                                                     |
| `SITE_URL`          | `getSiteUrl()`, `configs`         | Site URL (default `http://localhost:3002`)                                                                      |
| `OTLP_ENDPOINT`     | `server`, `browser`               | OTLP/HTTP collector (default `http://localhost:4318`)                                                           |
| `FARO_ENDPOINT`     | `browser`                         | Faro receiver for RUM logs/traces (default `http://localhost:12347`)                                            |
| `TELEMETRY_DEBUG`   | `server`                          | Flag: turns on the OTel SDK's debug logger (default off)                                                        |
| `OTEL_SERVICE_NAME` | `utils` (`tracer`, `getMeter()`)  | Tracer/meter name (default `application`)                                                                       |
| `SERVICE_NAME`      | `server`, `browser`               | Resource `service.name` when the caller passes none (default `@lightproject/app`)                               |
| `SERVICE_VERSION`   | `server`, `browser`               | Resource `service.version` when the caller passes none (default `1.0.0`)                                        |

All URL variables must be valid URLs. The apps pass their own `serviceName`/`serviceVersion`
(from `package.json`), so `SERVICE_NAME`/`SERVICE_VERSION` are only fallbacks. Build-time, from
the root `.env` via the root `vite.config.ts`: `ENV=local` packs unminified, unbundled and with
source maps; unit tests run with `LOG_LEVEL=silent`.

Each app adds its own keys in `src/env.ts` with `createEnv`, spreading `serverEnvOptions`
(backend, workers) or `appEnvOptions` (frontend) and building `runtimeEnv` with
`readRuntimeEnv(...)`; app envs hold only app keys and read shared ones from here.

## Development

Every `src/<dir>/index.ts` is a subpath export (`./*` in `package.json`, `typescript` condition →
`src/`, otherwise `dist/`). The root entry re-exports the runtime-neutral ones as namespaces
(`configs`, `environment`, `logger`, `typecast`, `utils`, `validators`).

| Subpath       | Provides                                                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `environment` | `commonEnv`, getters and `is*()` helpers, `getEnv`, `createEnv` options (`serverEnvOptions`, `appEnvOptions`), `strictFlag` |
| `logger`      | `logger`/`Logger`, `redact`/`redactUrl` (fail-closed), request context (`runWithRequestContext`, request/client ids)        |
| `configs`     | Endpoint paths and URLs (`backendUrl`, `backendTrpcUrl`, `/docs`, …), default OTLP/Faro endpoints                           |
| `server`      | Server telemetry: `initializeTelemetry`, `flushTelemetry`, `shutdownTelemetry`, request-context span processor              |
| `browser`     | Browser RUM: `initializeRum` (Faro + OTel fetch tracing and metrics), `flushRum`, Faro log sink                             |
| `utils`       | OTel re-exports and `tracer`/`runWithSpan`, `fitExemplarLabels`, `generateShortUuid`, dates, colors, `sleep`/`withRetry`    |
| `validators`  | Runtime guards for untyped boundaries (`isRecord`, `isPlainObject`, `isErrorLike`, …)                                       |
| `typecast`    | `assertType`, `createTypeGuard`, `deepMerge`                                                                                |
| `node`        | Node-only filesystem helpers (`getProjectRoot`, `readFile`, `copyPath`, …)                                                  |
| `testing`     | `startFakeOtelCollector()` for apps' tests                                                                                  |

| Task                | What it does                                            |
| ------------------- | ------------------------------------------------------- |
| `vp run build`      | `vp pack`: ESM + CJS and `.d.mts`/`.d.cts` into `dist/` |
| `vp run check`      | `vp check` (format, lint, type check)                   |
| `vp run type-check` | `tsgo`                                                  |
| `vp run test:unit`  | `vp test`, cached                                       |

### `#import-meta-env`

`src/environment/env.ts` reads `import.meta.env` through the subpath import `#import-meta-env`
(`imports` in `package.json` → `src/environment/import-meta-env.ts`). `import.meta` exists only in
ES modules, so the CJS build would break on it: `vite.config.ts` aliases `#import-meta-env` to
`import-meta-env.node.ts` (always `undefined`) for the `cjs` format only. Both files are
excluded as pack entries, so each format gets only its own variant. CJS consumers are Node, which
reads `process.env` first anyway. `apps/workers` uses the same pattern for `#tsx-api`.

## Testing

```sh
vp test   # unit only, no services needed; 100% coverage thresholds
```

- `tests/unit/helpers/setup.ts` mocks `#import-meta-env` to `undefined`, so tests see only
  `process.env`.
- Values are read once: stub first, then `vi.resetModules()` and `await import(...)`; stubbing
  after the import has no effect. When asserting an unset variable, also clear its `VITE_` mirror
  (Vitest copies `VITE_*` from `.env` into `process.env`).

Before finishing, run `vp run ready` from the repo root (it rebuilds common before the apps'
tests). To reproduce CI: `dagger call test-unit --workspace=@lightproject/common`.

## Deployment

Not deployed or published: `package.json` is `private`, and no deploy or publish job exists for
it (the release only bumps its version in lockstep). It ships inside the apps:

| App              | How common gets in                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------- |
| backend, workers | Node images (`dagger vp`) include the built `packages/common/dist` as a workspace dependency |
| backend, workers | `wrangler` bundles it from `dist/` into the Worker                                           |
| frontend         | Vite bundles it into the static build (`typescript` condition → `src/`)                      |

A change here therefore reaches an environment only when an app that uses it is redeployed.
