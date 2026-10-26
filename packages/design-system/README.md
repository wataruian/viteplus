# @lightproject/design-system

Shared React + UnoCSS component library: components, theme/mode/client-id providers, design
tokens and the UnoCSS config every app builds its CSS with. All UI, styles and decorative elements
live here, never in an app. It also ships a preview app (every component and variant on one page)
and Storybook, both deployed as Cloudflare Workers and as one nginx image. Rules for apps:
`AGENTS.md` → "Design System Sovereignty".

```tsx
import { Button } from '@lightproject/design-system/components';
import { ModeProvider, ThemeProvider } from '@lightproject/design-system/context';

<ThemeProvider>
  <ModeProvider>
    <Button intent='ghost' size='sm'>
      Cancel
    </Button>
  </ModeProvider>
</ThemeProvider>;
```

Commands run from `packages/design-system` unless noted.

## Setup

1. Install (from the repo root) and, once, the Chromium build Playwright expects:

   ```sh
   vp install
   vp exec --filter @lightproject/design-system playwright install chromium
   ```

2. Start the preview app and Storybook:

   ```sh
   vp run dev   # preview app http://localhost:6007, Storybook http://localhost:6006
   ```

Apps need no build of this package in dev: `templates/frontend` aliases it to `src/` and loads
`uno.config.ts` directly.

### Exports

`package.json` `exports` maps `.` to `src/index.ts` and `./*` to `src/*/index.ts` (the
`typescript` condition, used in dev and tests), or to `dist/` once packed:

| Import path                   | Contents                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `@lightproject/design-system` | Namespaces `components`, `context`, `tokens`, `utils`                                                                   |
| `…/components`                | `Badge`, `Button`, `Card`, `ErrorBoundary`, `Header`, `Icon`, `Input`, `Layout`, `Logo`, `Marquee`, …, `Preview`        |
| `…/context`                   | `ThemeProvider`, `ModeProvider`, `ClientIdProvider` and their contexts and hooks (`useTheme`, `useMode`, `useClientId`) |
| `…/tokens`                    | `animation`, `base` (`baseStyles`, `intentSolid`, …), `breakpoints`, `effects`, `icons`, `spacing`, `typography`        |
| `…/utils`                     | `shortcuts`, theme generator (`getCSS`, `getThemes`, `themes`), helpers                                                 |
| `…/configs`                   | `unoCssConfig` (also the default export of `uno.config.ts`)                                                             |

## Environment variables

Read from `process.env` by the Node-side scripts and configs; the root `.env` reaches them through
mise (`.env.example` lists the ports and `STYLE_COMPILE_DEBUG`). Components read no variables.

| Variable                       | Read by                               | Purpose                                                                                               |
| ------------------------------ | ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `DESIGN_SYSTEM_PORT`           | `vite.config.ts`, `src/start.ts`      | Preview app port for `dev`, `start` and `wrangler:dev` (default `6007`)                               |
| `DESIGN_SYSTEM_INSPECTOR_PORT` | `src/start.ts`                        | Inspector port of the preview Worker in `wrangler:dev` (default `6233`)                               |
| `STORYBOOK_PORT`               | `src/start.ts`                        | Storybook port for `dev`, `start` and `wrangler:dev` (default `6006`)                                 |
| `STORYBOOK_INSPECTOR_PORT`     | `src/start.ts`                        | Inspector port of the Storybook Worker in `wrangler:dev` (default `6232`)                             |
| `STORYBOOK_E2E_PORT`           | `tests/e2e/ports.ts` (Playwright)     | Storybook port Playwright starts (default `6116`)                                                     |
| `DESIGN_SYSTEM_E2E_PORT`       | `tests/e2e/ports.ts` (Playwright)     | Preview app port Playwright starts (default `6117`)                                                   |
| `STYLE_COMPILE_DEBUG`          | `src/utils/compile.ts`                | `true` prints the compiled styles registry during `build` (default unset; `.env.example` has `false`) |
| `ENV`                          | root `vite.config.ts` (shared config) | `local` builds unminified with source maps (`vp pack` unbundled); anything else or unset minifies     |
| `VITEST`                       | `src/configs/unocss.ts`               | Set by Vitest; `true` turns off the web-font provider so tests never fetch fonts                      |

`compile.ts` loads the root `.env` itself when run directly. Every key in the root `.env` is part
of the task cache key, so changing any of them reruns cached tasks. In CI the deploy also passes
`VITE_ENV` and `VITE_BACKEND_URL` as build env (see Deployment); this package's code reads neither.

## Development

| Task                     | What it does                                                                                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vp run dev`             | Preview app (`vp dev`, `DESIGN_SYSTEM_PORT`) + Storybook dev (`STORYBOOK_PORT`), via `src/start.ts`                                                                         |
| `vp run build`           | Regenerates variant stories, compiles the styles registry, then `vp pack` (`dist/`), `vp build` (preview app, `out/`), `storybook build` (`storybook-static/`); task-cached |
| `vp run start`           | `vp preview` of `out/` and `storybook-static/` on the same ports (build first)                                                                                              |
| `vp run wrangler:dev`    | Serves `out/` and `storybook-static/` through both Workers locally (build first)                                                                                            |
| `vp run wrangler:deploy` | `wrangler deploy` of both configs (`CLOUDFLARE_ENV` picks the `[env.*]`; see Deployment)                                                                                    |
| `vp run wrangler:delete` | `wrangler delete` of both Workers                                                                                                                                           |
| `vp run check`           | `vp check` (format, lint, type check); also `format`, `lint`, `type-check` tasks                                                                                            |
| `vp run test:unit`       | `vp test` with coverage (task-cached)                                                                                                                                       |
| `vp run test:e2e`        | Playwright browser tests (task-cached, restores `e2e-test-results/` on a cache hit)                                                                                         |

From the repo root, `mise run start dev` (or `prod`, `wrangler`) starts every app and this package
in parallel. To add a component (component, test, story, registry export), run `vp run plop` from the repo root.

- **Components**: each `src/components/<name>.tsx` defines a `<name>Styles` object (`base`,
  `default`, `variants`) fed to `cva`, and is exported from `src/components/registry.ts`. Variants
  are props (`<Button intent='ghost' size='sm'>`). The build regenerates the variant stories from
  these objects (`src/utils/update-stories.ts`) and safelists their classes (`compile.ts`), so
  classes built from token strings still get CSS.
- **UnoCSS**: `uno.config.ts` re-exports `src/configs/unocss.ts` (Wind3, attributify, icons,
  typography, web fonts; directives and variant groups). Its preflight `getCSS()` emits the theme
  CSS variables (`--ds-*`); its `theme` adds the semantic colors, `animation`, `spacing` and
  `borderRadius` from `src/tokens/`.
- **Tokens first**: use semantic colors, not hex or raw Tailwind colors. `primary`, `accent`,
  `success`, `warning`, `danger`, `info` and `surface` each have a `50`–`950` scale. The
  mode-aware pairs are always suffixed: `bg-adaptive-<color>` (light in light mode, dark in dark)
  with `text-inverse-<color>` (the opposite), e.g. `bg-adaptive-surface text-inverse-surface`. There
  is no bare `bg-adaptive` / `text-adaptive` / `bg-inverse`; they generate no CSS and leave the
  element transparent over the primary-tinted `:root` background. Use `surface` for neutral
  backgrounds; the other colors tint with the theme (`default`, `emerald`, `ocean`, `sunset`).
- **Shortcuts**: `src/utils/shortcuts.ts` is the place for UnoCSS shortcuts. It is currently
  empty, so `btn-primary`, `btn-ghost` and `glass-nav` produce no CSS yet; use the component
  variants (`<Button intent='primary'>`, `<Header>`) or add the shortcut there first.
- **Header**: `Header` is `fixed`, `h-20`; add `pt-20` to the app's main content so it is not
  hidden underneath.
- **Keyframes**: raw keyframe strings (`src/tokens/animation.ts`) need a semicolon after every
  property (`{from{transform:translateX(0);}to{…;}}`); a missing one fails production builds with
  `CssSyntaxError [postcss]`.

## Testing

```sh
vp test            # unit (jsdom), 100% coverage of src/ and the .storybook mode files
vp run test:e2e    # Playwright, Chromium: Storybook on 6116 + preview app on 6117
```

- Unit tests live in `tests/unit/`; `preview-registry-drift.test.tsx` fails when the registry and
  the `*Styles` objects disagree.
- E2E tests in `tests/e2e/` cover what jsdom cannot: the light/dark toggle updating in place (and
  persisting) on Storybook's docs and variant pages, and on the preview app. Playwright starts its
  own `storybook dev` and `vp dev` on `STORYBOOK_E2E_PORT`/`DESIGN_SYSTEM_E2E_PORT`, so they do not
  clash with `vp run dev`. Each run writes `e2e-test-results/`: a video per test
  (`results/**/video.webm`), `results.json`, and an HTML report (`report/index.html`).

Before finishing, run `vp run ready` from the repo root. To reproduce CI (from the repo root):
`dagger call test-unit --workspace=@lightproject/design-system` and
`dagger call test-end-to-end --workspace=@lightproject/design-system` (installs Chromium and its
system libraries in the container). The `design-system` job in `verify.yml` is currently commented
out, so pull requests do not verify this package in CI.

## Deployment

Two Workers per target (`[env.*]` in each config, selected by `CLOUDFLARE_ENV`), each serving its
static output with single-page-application fallback:

| `CLOUDFLARE_ENV` | Preview app (`wrangler.design-system.toml`, `out/`) | Storybook (`wrangler.storybook.toml`, `storybook-static/`) |
| ---------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| `develop`        | `lightproject-design-system-dev`                    | `lightproject-storybook-dev`                               |
| `staging`        | `lightproject-design-system-staging`                | `lightproject-storybook-staging`                           |
| `production`     | `lightproject-design-system-production`             | `lightproject-storybook-production`                        |

URLs are `https://<worker>.wataru.workers.dev`.

### CI

`deploy.yml` deploys this package (independently of the apps) with `--build-env=VITE_ENV=<env>`
and `--build-env=VITE_BACKEND_URL=https://lightproject-backend-<dev|staging|production>.wataru.workers.dev`.
It publishes the nginx image `<REGISTRY_ADDRESS>/design-system` via Dagger `publish` (`nginx.conf`:
the preview app from `out/` on port 80, Storybook from `storybook-static/` on port 81), deploys both
Workers via Dagger `wrangler` (`vp run wrangler:deploy` with `CLOUDFLARE_ENV` and the
`CLOUDFLARE_*` secrets), and smoke-tests both Worker URLs for HTTP 200. Promotion to
`staging`/`production` and the workflow chain: root `AGENTS.md` → "CI Pipeline (Dagger)".

### Manually

```sh
# Workers (credentials from the environment or the root .env)
vp run build
CLOUDFLARE_ENV=develop vp run wrangler:deploy

# Same path CI takes (from the repo root)
dagger call wrangler --workspace=@lightproject/design-system --environment=develop \
  --cloudflare-api-token=env:CLOUDFLARE_API_TOKEN --cloudflare-account-id=env:CLOUDFLARE_ACCOUNT_ID

# nginx image into the local Docker (design-system:latest), then serve it (from the repo root)
dagger call load --workspace=@lightproject/design-system --docker-socket=/var/run/docker.sock
docker run --rm -p 8080:80 -p 8081:81 design-system:latest   # preview :8080, Storybook :8081
```
