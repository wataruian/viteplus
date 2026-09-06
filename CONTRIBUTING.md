# Contributing

Thanks for your interest in contributing! This repository uses
[Vite+](https://vite.plus/), a unified toolchain wrapping runtime management,
package management, and frontend tooling behind a single `vp` CLI. See
[AGENTS.md](./AGENTS.md) for the full set of conventions this project follows.

## Getting Started

1. Install dependencies (after pulling remote changes, and whenever
   `package.json` or `pnpm-lock.yaml` changes):

   ```sh
   vp install
   ```

2. Validate your environment:

   ```sh
   vp run ready
   ```

## Development Workflow

- Never run `npm`, `pnpm`, or `yarn` directly — use `vp` (e.g. `vp add <package> --filter <project>`
  to add a dependency).
- Use `vp dev` to start development servers, `vp build` to build production assets.
- Before committing, run:

  ```sh
  vp check   # format, lint, type-check
  vp test    # run the test suite
  ```

  `vp staged` runs automatically as a pre-commit hook to catch issues early.

- If something looks broken, `vp cache clean` is the standard first troubleshooting
  step, followed by `vp env doctor` if setup/runtime issues persist.

## Commit Messages

This repository uses [Conventional Commits](https://www.conventionalcommits.org/)
(enforced via `commitlint`). You can use `vp run` or `git commit` normally, or
run the interactive prompt via `commitizen`:

```sh
npx cz
```

## Pull Requests

- Keep changes scoped and include tests for behavior changes.
- Ensure `vp run ready` passes before requesting review.
- Fill out the pull request template — it mirrors the review checklist in
  [AGENTS.md](./AGENTS.md).

## Reporting Issues

Use the issue templates under `.github/ISSUE_TEMPLATE/` to file bugs or feature
requests. For security vulnerabilities, see [SECURITY.md](./SECURITY.md) instead
of filing a public issue.
