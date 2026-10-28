# @lightproject/scheduler

Scheduled (cron) and one-off scripts. Each script declares its name, an optional cron schedule, an
input schema and a timeout; the same scripts run on Node (one process per run, published as a
container image and started by a Kubernetes CronJob, `docker run` or CI) and on Cloudflare (Cron
Triggers, plus a token-protected `POST /run/<script>` for one-off runs). A script never overlaps
itself: every run first takes its lock in `templates/datastore`'s `script_locks` table, so a run
that finds it held is **skipped** (cron), answered with 409 (HTTP) or exits 3 (Node). Full
reference, including the step-by-step "Adding a script": `.ai-data/architecture.md` → "Scheduled
Scripts".

<!-- template-only -->

This is the **template** for the future real `apps/dispatcher`: its own env keys use the
`SCHEDULER_` prefix (ports 2003/8233), and the `DISPATCHER_*` keys in `.env.example` are reserved
for that app (root README → "Templates and Reserved Names").

<!-- /template-only -->

```ts
const checkAdmin = defineScript({
  input: z.object({ email: z.email().default('admin@example.com') }),
  name: 'check-admin',
  run: async ({ email }, { db, logger }) => {
    const admin = await db.users.findByEmail(email);
    logger.info(admin === undefined ? `no user ${email}` : `${email} is ${admin.name}`);
  },
  schedule: '0 * * * *', // UTC; leave it out for a one-off-only script
});
```

The full walkthrough is in "Adding a script" below.

Commands run from `templates/scheduler` unless noted.

## Setup

1. Install, start Postgres and apply the migrations: setup in `templates/datastore/README.md`
   (every run takes its lock in that database, so migrate it first).

2. Configure the root `.env` (copy `.env.example`): `DATABASE_DIALECT` and the Postgres settings;
   `SCHEDULER_RUN_TOKEN` (32+ characters) only to try the HTTP endpoint locally. mise loads `.env`
   into the shell for the Node run; `vite.config.ts` links it to `templates/scheduler/.env` for
   `wrangler dev`, where its values override `[vars]`.

## Environment variables

`SKIP_OPENTELEMETRY` is validated once at module load (`src/env.ts`). The run token is a Worker
binding, read per request. On Cloudflare the values come from `wrangler.toml`'s `[vars]` /
`[env.<env>.vars]` and secrets.

| Variable                   | Purpose                                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `SCHEDULER_RUN_TOKEN`      | Cloudflare: bearer token of `POST /run/<script>` (a `wrangler secret`, 32+ characters). Unset: the endpoint does not exist (404) |
| `SKIP_OPENTELEMETRY`       | `true` skips the OTel SDK (context propagation only); `true`/`false` only (default `false`)                                      |
| `SCHEDULER_PORT`           | `vite.config.ts`: `wrangler dev` port (default `2003`)                                                                           |
| `SCHEDULER_INSPECTOR_PORT` | `vite.config.ts`: `wrangler dev` inspector port (default `8233`)                                                                 |

Shared variables, defined in `packages/common/README.md` and `templates/datastore/README.md`:

- `ENV` (default `local`; non-local forces JSON logs), `LOG_LEVEL`, `LOG_FORMAT`.
- `OTLP_ENDPOINT` (default `http://localhost:4318`; CI passes it as a Worker var),
  `TELEMETRY_DEBUG`.
- `DATABASE_DIALECT`, `DATASTORE_POSTGRES_URL` or the `POSTGRES_*` parts.

Worker bindings (`wrangler.toml`, every env):

| Binding      | Purpose                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------- |
| `DB`         | The shared D1 (same ids as `templates/datastore`); used when `DATABASE_DIALECT=d1`                 |
| `HYPERDRIVE` | Optional, not bound today: Postgres through Hyperdrive for an env with `DATABASE_DIALECT=postgres` |

## Development

Add scripts in `src/scripts/` and register them in `src/scripts/index.ts`; give a scheduled one's
cron to `[triggers] crons` in `wrangler.toml` too (`wrangler-crons.test.ts` fails until both
match). Node APIs only in `src/runtimes/node.ts`; the Worker entry `src/runtimes/edge.ts` may
export only the default handler.

| Task                                      | What it does                                                                        |
| ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `vp run script <name> [--input '<json>']` | Runs a script once from source (`vpx`); `--scheduled` runs it as its cron would     |
| `vp run script --list`                    | Lists the scripts and their schedules                                               |
| `vp run build`                            | Builds `dist/` (`dist/index.mjs`, the client entry)                                 |
| `vp run start <name> …`                   | Same as `script`, from the built `node dist/index.mjs` (what the image runs)        |
| `vp run wrangler:dev`                     | Local Worker on `SCHEDULER_PORT`, D1 in `../../.wrangler/state`, `--test-scheduled` |
| `vp run wrangler:deploy`                  | `wrangler deploy` (CI uses `dagger wrangler`; see Deployment)                       |
| `vp run wrangler:delete`                  | `wrangler delete`                                                                   |

Exit codes (Node): `0` succeeded, `1` failed, timed out or stopped, `2` usage error, unknown
script or invalid input, `3` skipped because a previous run still holds the lock, `4` the run
lost its lock (renewals kept failing, another run took it over, or the script blocked the event
loop for ~20 s or more) and was aborted. SIGTERM aborts
the script (`context.signal`) and gives it 5 s to settle; a second signal exits at once.

### Adding a script

Example: `check-admin`, hourly and also runnable on demand. This exact code was linted, tested and
run on both runtimes before being documented; the same steps with the full test file and a
complete CronJob are in `.ai-data/architecture.md` → "Adding a script".

1. **Define it** in `src/scripts/check-admin.ts`. `input`, `name` and `run` are required;
   `schedule` is optional and `timeoutMs` defaults to 10 min. Keep the event loop free: the lock is
   renewed on the same thread, so long synchronous work must `await` at least every ~15 s (a
   block of ~20 s can already cost the lock). `timeoutMs` covers the whole run, including opening
   the database and taking the lock. A scheduled script's schema must
   accept `{}` (what a cron passes), hence the `.default(…)`:

   ```ts
   import { z } from 'zod';

   import { defineScript } from '../core/script';

   const checkAdmin = defineScript({
     input: z.object({ email: z.email().default('admin@example.com') }),
     name: 'check-admin',
     run: async ({ email }, { db, logger, signal }) => {
       signal.throwIfAborted();
       const admin = await db.users.findByEmail(email);
       if (admin === undefined) {
         logger.warn(`check-admin: no user ${email}`);
         return;
       }
       logger.info(`check-admin: ${email} is ${admin.name}`, { userId: admin.id });
     },
     schedule: '0 * * * *',
     timeoutMs: 60_000,
   });

   export { checkAdmin };
   ```

2. **Register it** in `src/scripts/index.ts`:

   ```ts
   import { checkAdmin } from './check-admin';

   const scripts = registerScripts([ping, checkAdmin]);
   export { checkAdmin } from './check-admin';
   ```

3. **Add its cron** to `wrangler.toml` (every `[env.*]` inherits it; `vp test` fails until code and
   `wrangler.toml` agree; a one-off-only script needs no entry):

   ```toml
   [triggers]
   crons = ["*/5 * * * *", "0 * * * *"]
   ```

4. **Test it** in `tests/unit/scripts/check-admin.test.ts` on a throwaway local D1:

   ```ts
   const { openDatabase } = useLocalDatabase();

   test('finds the admin by email', async () => {
     const database = await openDatabase();
     const admin = await database.users.insert({ email: 'ada@example.com', name: 'Ada' });
     const info = vi.spyOn(logger, 'info');

     await runDirectly(checkAdmin, { email: 'ada@example.com' }, context(database));

     expect(info).toHaveBeenCalledWith('check-admin: ada@example.com is Ada', { userId: admin.id });
   });
   ```

5. **Run it**:

   ```sh
   vp run script check-admin --input '{"email":"ada@example.com"}'   # INFO : check-admin: ada@example.com is Ada
   vp run script check-admin --scheduled                             # WARN : check-admin: no user admin@example.com
   vp run script check-admin --input '{"email":"nope"}'              # invalid-input, exit 2
   ```

   On the local Worker (see "Run on Cloudflare" below): the cron
   `curl "http://localhost:2003/__scheduled?cron=0+*+*+*+*"`, a one-off
   `curl -X POST -H "Authorization: Bearer …" -d '{"email":"ada@example.com"}' http://localhost:2003/run/check-admin`
   (answers `{"durationMs":…,"outcome":"succeeded","script":"check-admin"}`).

6. **Deploy**: the Worker picks up the new cron on its next deploy. On Node, add a CronJob for it
   (see Deployment).

### Run on Node

```sh
vp run script ping --input '{"message":"hello"}'
```

Expected: `ping: hello`, then `Script ping succeeded`.

### Run on Cloudflare (local)

```sh
vp run wrangler:dev --var SCHEDULER_RUN_TOKEN:abcdefghijklmnopqrstuvwxyz0123456789
# another terminal
curl "http://localhost:2003/__scheduled?cron=*/5+*+*+*+*"
curl -X POST -H "Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789" \
  -d '{"message":"edge"}' http://localhost:2003/run/ping
```

The cron logs `ping: pong`; the request answers `{"durationMs":…,"outcome":"succeeded","script":"ping"}`
(200; 400 invalid input, 401 bad token, 404 unknown script or no token, 409 already running, 500
failed, 503 stopped or lock lost, 504 timed out). The answer leaves out error details except for invalid input;
they are in the logs. `wrangler dev` follows `.env`'s `DATABASE_DIALECT` (Postgres by default);
add `--var DATABASE_DIALECT:d1` for the local D1.

## Testing

```sh
vp test   # unit: core, HTTP handler, CLI, cron/wrangler.toml drift; locks on a throwaway local D1
```

- Build `templates/datastore` first: Vitest loads workspace packages from `dist/`.
- The lock queries themselves are covered by `templates/datastore`'s contract tests (local D1,
  PGlite and, in `test:integration`, the real Postgres).
- Coverage is 100% (runtimes and entry files excluded).

Before finishing, run `vp run ready` from the repo root. To reproduce CI:
`dagger call test-unit --workspace=@lightproject/scheduler`.

### Local testing

Manual end-to-end checks with the sample `ping` script against real databases. Every case below
was run as written; the expected column is the real output (timestamps and trace ids left out).
`ping` takes `{"message": "…", "delayMs": n}` (both optional): it waits `delayMs` (stopping early on
abort), then logs `ping: <message>`. Postgres runs on Node, the local D1 on the Worker
(`wrangler dev`): Node has no D1 binding.

**Environment**: the commands need the root `.env` in the shell (mise does this when activated).
`vp run` passes the exit code through, but not signals: signal cases use `node dist/index.mjs`.

**Prerequisites** (once):

```sh
docker compose up -d postgres   # repo root
cd ../../templates/datastore && vp run build \
  && DATABASE_DIALECT=postgres vp run db:migrate && DATABASE_DIALECT=d1 vp run db:migrate
cd ../../templates/scheduler && vp run build
```

**Query helpers**:

```sh
pgq() { docker exec postgres psql -U lightproject -d lightproject_datastore -c "$1"; }
d1() { vp exec wrangler d1 execute DB --local --persist-to ../../.wrangler/state --command "$1"; }
```

#### Postgres (Node runtime)

| Case                         | Commands                                                  | Expected                                                                                                                       |
| ---------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| P1. One-off with input       | `vp run script ping --input '{"message":"hello"}'`        | `INFO : ping: hello`, `INFO : Script ping succeeded`, exit 0                                                                   |
| P2. As its cron would        | `vp run script ping --scheduled`                          | `INFO : ping: pong` (default input, `trigger: schedule`), succeeded                                                            |
| P3. Invalid input            | `vp run script ping --input '{"message":5}'; echo $?`     | `ERROR: Script ping invalid-input` (`expected string, received number → at message`), exit 2                                   |
| P4. Unknown script           | `vp run script nope; echo $?`                             | `ERROR: Unknown script "nope" (--list shows the registered ones)`, exit 2                                                      |
| P5. List                     | `vp run script --list`                                    | `ping	*/5 * * * *`                                                                                                            |
| P6. **Overlap** (real runs)  | the P6 block below                                        | 2nd run: `WARN : Script ping skipped: a previous run still holds its lock`, exit 3; 1st: `ping: first`, exit 0; 3rd: succeeded |
| P7. Lock held by hand        | the P7 block below                                        | `WARN : Script ping skipped: …`, exit 3; after the `DELETE` the next run succeeds                                              |
| P8. SIGTERM mid-run          | the P8 block below                                        | `Received SIGTERM; aborting the script`, `ERROR: Script ping aborted`, exit 1, no lock row left                                |
| P9. Timeout                  | `vp run script ping --input '{"delayMs":45000}'; echo $?` | `ping: waiting 45000ms`, after 30 s (`timeoutMs`) `ERROR: Script ping timed-out`, exit 1                                       |
| P10. Built output            | `vp run start ping --input '{"message":"from dist"}'`     | Same as P1, from `dist/index.mjs`                                                                                              |
| P11. Crashed run (`SIGKILL`) | the P11 block below                                       | Right after: ~58 s left on the lease, next run skipped (exit 3); after the 60 s lease the next run succeeds, no lock row left  |

```sh
# P6: a second run while the first is still running
node dist/index.mjs ping --input '{"delayMs":8000,"message":"first"}' & sleep 2
node dist/index.mjs ping --input '{"message":"second"}'; echo "second: $?"   # skipped, 3
wait; node dist/index.mjs ping --input '{"message":"third"}'                  # succeeded

# P7: hold ping's lock by hand for 10 minutes, then release it
pgq "INSERT INTO script_locks VALUES (now() + interval '10 minutes', '@lightproject/scheduler/ping', 'by-hand', now(), now());"
vp run script ping; echo $?          # skipped, 3
pgq "DELETE FROM script_locks;"
vp run script ping                   # succeeded

# P8: stop a run in the middle
node dist/index.mjs ping --input '{"delayMs":60000}' & sleep 2
pgq "SELECT name, owner FROM script_locks;"   # held by a random owner id
kill -TERM $!; wait $!; echo $?               # aborted, 1
pgq "SELECT count(*) FROM script_locks;"      # 0

# P11: a run killed without cleanup frees its lock within one lease (60 s, renewed while running)
node dist/index.mjs ping --input '{"delayMs":25000}' & P=$!
until [ "$(docker exec postgres psql -U lightproject -d lightproject_datastore -tAc 'SELECT count(*) FROM script_locks')" = 1 ]; do sleep 0.5; done
kill -9 $P   # once the run holds its lock
pgq "SELECT round(extract(epoch from expires_at - now())) FROM script_locks;"   # ~58
node dist/index.mjs ping; echo $?                                                # skipped, 3
sleep 60; node dist/index.mjs ping; echo $?                                      # succeeded, 0
```

#### D1 (Cloudflare runtime)

Extra flags after `vp run wrangler:dev` reach `wrangler dev`, and `--var KEY:value` overrides
`.env`, so `.env` can stay on `postgres`. Stop with Ctrl+C.

```sh
vp run wrangler:dev --var DATABASE_DIALECT:d1 --var SCHEDULER_RUN_TOKEN:abcdefghijklmnopqrstuvwxyz0123456789
# another terminal
U=http://localhost:2003; H="Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789"
```

| Case                    | Commands                                                                                | Expected                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| D1. Cron                | `curl "$U/__scheduled?cron=*/5+*+*+*+*"`                                                | Worker log `INFO : ping: pong`, `Script ping succeeded`                                               |
| D2. Cron with no script | `curl "$U/__scheduled?cron=0+0+*+*+*"`                                                  | `WARN : Cron 0 0 * * * matches no script; check wrangler.toml [triggers]`                             |
| D3. One-off             | `curl -X POST -H "$H" -d '{"message":"edge"}' $U/run/ping`                              | `{"durationMs":5,"outcome":"succeeded","script":"ping"}` (200)                                        |
| D4. Empty body          | `curl -X POST -H "$H" $U/run/ping`                                                      | 200, `ping: pong`                                                                                     |
| D5. Invalid input       | `curl -X POST -H "$H" -d '{"message":5}' $U/run/ping`                                   | 400, `"outcome":"invalid-input"` with the validation message                                          |
| D6. Not JSON            | `curl -X POST -H "$H" -d '{nope' $U/run/ping`                                           | 400, `{"error":"the body must be empty or JSON"}`                                                     |
| D7. Bad or no token     | `curl -X POST -H "Authorization: Bearer wrong" $U/run/ping`, `curl -X POST $U/run/ping` | 401, `{"error":"unauthorized"}`                                                                       |
| D8. Unknown, GET, other | `curl -X POST -H "$H" $U/run/nope`, `curl -H "$H" $U/run/ping`, `curl $U/`              | 404 `unknown script "nope"`, 405 `method not allowed`, 404 `not found`                                |
| D9. **Overlap**         | the D9 block below                                                                      | 2nd request 409 `"outcome":"skipped"`, cron logs `Script ping skipped: …`; 1st 200 after 8 s; 3rd 200 |
| D10. Timeout            | `curl -X POST -H "$H" -d '{"delayMs":45000}' $U/run/ping`                               | After 30 s: `{"durationMs":30019,"outcome":"timed-out","script":"ping"}` (504)                        |
| D11. No token set       | restart with only `--var DATABASE_DIALECT:d1` (`.env`'s token is empty), then D3        | 404 `{"error":"not found"}`; crons still run                                                          |

```sh
# D9: a one-off and a cron while a run is still in progress
curl -s -X POST -H "$H" -d '{"delayMs":8000,"message":"first"}' $U/run/ping & sleep 2
curl -s -w ' %{http_code}\n' -X POST -H "$H" -d '{"message":"second"}' $U/run/ping   # 409
curl -s "$U/__scheduled?cron=*/5+*+*+*+*"                                             # skipped (Worker log)
wait; curl -s -X POST -H "$H" -d '{"message":"third"}' $U/run/ping                    # 200
```

To hold the lock by hand instead (as a killed run would):
`d1 "INSERT INTO script_locks (name, owner, expires_at, created_at, updated_at) VALUES ('@lightproject/scheduler/ping', 'by-hand', unixepoch()*1000 + 600000, 0, 0);"`,
then `d1 "DELETE FROM script_locks;"`.

#### Container image (what CI publishes; from the repo root)

```sh
dagger call load --workspace=@lightproject/scheduler --docker-socket=/var/run/docker.sock
DB=postgres://lightproject:lightproject@host.docker.internal:5432/lightproject_datastore
```

| Case                 | Commands                                                                                                                                                      | Expected                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| C1. Run a script     | `docker run --rm -e DATABASE_DIALECT=postgres -e DATASTORE_POSTGRES_URL=$DB scheduler:latest node dist/index.mjs ping --input '{"message":"from the image"}'` | `ping: from the image`, succeeded, exit 0                                                                                                |
| C2. No arguments     | `docker run --rm scheduler:latest`                                                                                                                            | The usage line, exit 2 (the default command has no script)                                                                               |
| C3. Script name only | `docker run --rm scheduler:latest ping`                                                                                                                       | `exec: "ping": executable file not found`, exit 127: arguments replace the whole default command, so always pass `node dist/index.mjs …` |
| C4. Graceful stop    | `docker run -d --name stop-test … node dist/index.mjs ping --input '{"delayMs":60000}'`, then `docker stop -t 30 stop-test; docker logs stop-test`            | `Received SIGTERM; aborting the script`, `Script ping aborted`, exit 1, lock released                                                    |

#### Telemetry (either runtime)

`docker compose up -d` (repo root), run any case (without `SKIP_OPENTELEMETRY`), then in Grafana
(http://localhost:3300):

- Tempo: `{resource.service.name="@lightproject/scheduler" && name="script.run"}`.
- Loki: `{service_name="@lightproject/scheduler"} |= "ping:"` (Node and Worker logs).
- Mimir: `sum by (script, trigger, outcome) (script_runs_total)` — one series per outcome
  (`succeeded`, `skipped`, `invalid-input`, `aborted`, `timed-out`, …); `script_duration_seconds`
  is the matching histogram.

## Deployment

The `scheduler` deploy runs after `datastore` (it needs its migrations) and does two things:

| Step              | Result                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `dagger publish`  | Node image `<REGISTRY_ADDRESS>/scheduler:<tag>` (default command `node dist/index.mjs`)             |
| `dagger wrangler` | Worker `lightproject-scheduler-<dev\|staging\|production>` with the crons, `OTLP_ENDPOINT` as a var |

- **Cloudflare**: `[triggers] crons` (inherited by every `[env.*]`) fires the scheduled scripts.
  One-off runs need the token: `vp exec wrangler secret put SCHEDULER_RUN_TOKEN --env <env>`.
  A cron invocation may run at most 15 minutes, so on the Worker cron runs stop after 14 minutes
  whatever their `timeoutMs` (the Worker warns at startup for scripts it shortens) and release
  their lock cleanly. CPU time is limited separately (30 s for crons under an hour on Paid, 15
  minutes for longer ones); CPU-heavy or long scripts belong on Node. A run Cloudflare kills anyway
  keeps its lock until the lease ends (at most 60 s). A one-off whose client disconnects is
  aborted (`enable_request_signal`) and releases its lock; local `wrangler dev` does not pass the
  disconnect on, so there it runs to the end.
- **Node**: one CronJob per scheduled script. The image's command is a default (CMD), so pass the
  whole command, and run it in UTC without overlapping CronJob pods (the lock skips them anyway):

  ```yaml
  schedule: '0 * * * *'
  timeZone: Etc/UTC
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      backoffLimit: 0 # exit 3 (skipped) is not worth a retry
      template:
        spec:
          restartPolicy: Never
          terminationGracePeriodSeconds: 30
          containers:
            - name: check-admin
              image: <REGISTRY_ADDRESS>/scheduler:<tag>
              command: ['node', 'dist/index.mjs', 'check-admin', '--scheduled']
  ```

- When the GitHub variable `DATABASE_DIALECT` is set, the deploy fails unless
  `[env.<env>.vars]` names the same dialect, as for `tasks`.
- No smoke test: without a token the Worker serves nothing.

### Manually

```sh
# Worker, per env (credentials from the environment or the root .env)
CLOUDFLARE_ENV=develop vp run wrangler:deploy

# A one-off run on a deployed Worker
curl -X POST -H "Authorization: Bearer $SCHEDULER_RUN_TOKEN" -d '{}' \
  https://lightproject-scheduler-dev.<subdomain>.workers.dev/run/ping

# Node, via the published image (any container runtime)
docker run --rm -e DATABASE_DIALECT=postgres -e DATASTORE_POSTGRES_URL="postgres://…" \
  <REGISTRY_ADDRESS>/scheduler:<tag> node dist/index.mjs ping --input '{"message":"hi"}'
```
