# @lightproject/library

Template for a new shared package: the minimal setup every package here uses (dual ESM/CJS
`vp pack` build with `tsgo` declarations, `exports` with a `typescript` condition for source
imports, Vitest with 100% coverage, the shared task set). Its only code is a sample, so nothing
depends on it; copy it to start a package. Package rules (no `@lightproject/*` dependencies, take
app-provided things as options): `AGENTS.md` → "Monorepo Structure".

```ts
import { samples } from '@lightproject/library';
import { greet } from '@lightproject/library/samples';

greet(); // 'Hello World!' (same as samples.greet())
```

Commands run from `templates/library` unless noted.

## Setup

1. Install (from the repo root):

   ```sh
   vp install
   ```

2. Build and test:

   ```sh
   vp run build   # dist/: index.mjs, index.cjs, *.d.mts, *.d.cts per entry
   vp test
   ```

### Using it as a template

`mise run create --type=library --name=<name>` (from the repo root) copies this package to
`packages/<name>` without its build output, renames `@lightproject/library` and the other
`library` names, runs `vp install` and `vp check --fix`, and prints the CI wiring still to add
(root README → "Creating an App or Package from a Template"). Then:

1. Replace `src/samples/` and `tests/unit/` with real code and tests. `exports` needs no change for
   folders: `./*` maps `@lightproject/<name>/<folder>` to `src/<folder>/index.ts` (and its `dist/`
   build), and `.` to `src/index.ts`. Edit `exports` only for an entry that is not a folder.
2. Add dependencies with `vp add <pkg>` from `packages/<name>`, as `catalog:` versions from
   `pnpm-workspace.yaml`; never another `@lightproject/*` package. Add `"types": ["node"]` in
   `tsconfig.json` only if the code uses Node APIs.
3. Apps add it as `"@lightproject/<name>": "workspace:*"`.

## Environment variables

The package code reads none. Only the shared config (root `vite.config.ts`, used through
`getPackageViteConfig`) reads one:

| Variable | Read by                               | Purpose                                                                                  |
| -------- | ------------------------------------- | ---------------------------------------------------------------------------------------- |
| `ENV`    | root `vite.config.ts` (shared config) | `local` packs unbundled and unminified with source maps; anything else or unset minifies |

Every key in the root `.env` is part of the task cache key, so changing any of them reruns cached
tasks. Tests run with `LOG_LEVEL=silent`.

## Development

| Task               | What it does                                                                     |
| ------------------ | -------------------------------------------------------------------------------- |
| `vp run build`     | `vp pack` to `dist/` (ESM + CJS, declarations via `tsconfig.pack.json`)          |
| `vp run check`     | `vp check` (format, lint, type check); also `format`, `lint`, `type-check` tasks |
| `vp run test:unit` | `vp test` with coverage (task-cached)                                            |

Every file under `src/` except `*.stories.ts(x)` is a pack entry. There is no `dev` or `start`
task; pass `devCommand`/`startCommand` (and `excludeDevCommand: false`/`excludeStartCommand:
false`) to `getPackageViteConfig` in `vite.config.ts` to add them.

## Testing

```sh
vp test   # unit (Node), tests/unit/**/*.test.ts, 100% coverage of src/ (index.ts files excluded)
```

Before finishing, run `vp run ready` from the repo root. To reproduce CI (from the repo root):
`dagger call test-unit --workspace=@lightproject/library`. The `library` job in `verify.yml` is
currently commented out, so pull requests do not verify this package in CI.

## Deployment

Nothing to deploy: it is not in `deploy.yml` and is never published to a registry (`"private": true`).
No app depends on it; a package made from it is consumed by apps through `workspace:*`.
