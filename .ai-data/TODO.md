# Open TODOs

## Smoke test / real deploy gap

**Status**: Blocked on decisions only the repo owner can make — not something to build unilaterally.

The `Deploy` step in `.github/workflows/deploy.yml` is still a placeholder `echo`, and the
`Smoke test` step right after it is currently stubbed to always succeed (for pipeline-orchestration
testing). Until both are wired up for real, every environment gate (`dev`/`staging`/`production`)
only proves "the build didn't crash" — not that the deployed thing is actually serving traffic
correctly.

To close this out:

1. Wire the `Deploy` step to the existing `wrangler()` Dagger function in
   `.dagger/src/index.ts` — it's already fully implemented (Cloudflare deploy, takes a
   `cloudflareApiToken: Secret` + `buildEnv`), just never called from CI. Needs a
   `CLOUDFLARE_API_TOKEN` secret and `CLOUDFLARE_ACCOUNT_ID` configured.
2. Configure `HEALTH_CHECK_URL` as a GitHub Environment variable per environment (`dev`,
   `staging`, `production`), pointing at each deployed target's health endpoint.
3. Revert the `Smoke test` step in `deploy.yml` back to the real curl-based check (currently
   commented out directly below the `echo "Success"; exit 0` stub — just delete the stub and
   uncomment the real logic).
