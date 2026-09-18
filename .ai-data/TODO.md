# Open TODOs

None currently. The previous entry here ("Smoke test / real deploy gap") is resolved:
`.github/workflows/deploy-workspace.yml` calls the real `wrangler` Dagger function and runs a
curl-based smoke test with retries against the deployed `*.workers.dev` URLs.
