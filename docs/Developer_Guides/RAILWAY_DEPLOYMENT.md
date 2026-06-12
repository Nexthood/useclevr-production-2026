# Railway Deployment

## Table Of Contents

- [Railway Settings](#railway-settings)
- [Build Shape](#build-shape)
- [Runtime Commands](#runtime-commands)
- [Railway CLI](#railway-cli)
- [Local Checks](#local-checks)
- [Troubleshooting](#troubleshooting)

Railway deploys generated production output from the `dist` branch.

Railway test deploy review uses the `beta` source branch and `dist-test` deployment branch. Keep
test deploy checks away from `main`, `dist`, and the live app unless a task explicitly changes scope.

Production and test deploy flows stay isolated:

| Source branch | Generated branch | Railway service                  | Domain              |
| ------------- | ---------------- | -------------------------------- | ------------------- |
| `main`        | `dist`           | Production service, root `/dist` | `app.useclevr.com`  |
| `beta`        | `dist-test`      | Test service, root `/dist`       | `test.useclevr.com` |

Generated deployment branches are output branches. Do not merge `dist` or `dist-test` back into
source branches.

## Railway Settings

- Branch: `dist`
- Root directory: `/dist`
- Config file path: `/server-config/railway.json`
- Builder: Railpack

Leave Railway dashboard build, pre-deploy, and start command overrides empty unless debugging a
temporary incident. The config file owns those commands.

## Build Shape

```mermaid
flowchart TD
  Main[main branch] --> Build[pnpm prod:build]
  Beta[beta branch] --> TestBuild[pnpm prod:build]

  Build --> DistBranch[dist branch /dist]
  TestBuild --> DistTestBranch[dist-test branch /dist]

  Config[dist-root/server-config/railway.json] --> ServerConfig[server-config/railway.json]
  Railpack[dist-root/railpack.json] --> RailpackRoot[railpack.json at deployment root]

  DistBranch --> ProdRailway[Production Railway service]
  DistTestBranch --> TestRailway[Test Railway service]
  ServerConfig --> ProdRailway
  ServerConfig --> TestRailway
  RailpackRoot --> ProdRailway
  RailpackRoot --> TestRailway
```

GitHub Actions builds the app from `main`, publishes generated output to `/dist` on the `dist`
branch, and publishes Railway config to `/server-config/railway.json` on the same branch.

The test flow builds from `beta`, publishes generated output to `/dist` on the `dist-test` branch,
and lets the dedicated Railway test service deploy from that branch.

`dist-root/server-config/railway.json` controls deploy with a prebuilt `/dist`. The build command
outputs `"echo prebuilt"` since GitHub Actions publishes generated output directly to `/dist`.

`dist-root/railpack.json` declares the Node.js provider and skips dependency installation — the
standalone bundle includes all production modules in `dist/node_modules/`.

The generated output intentionally does not include `pnpm-workspace.yaml`, `railway.json`, or
`vercel.json`.

Generated output also excludes repository secrets, environment files, caches, source workspace
metadata, and dependency folders that are not part of the standalone runtime contract.

## Local Private Config

- `.railway/project.json` is a local machine link file and stays ignored.
- Keep a private restore-ready copy of `.railway/project.json` outside the repo so a fresh checkout
  can reconnect to the right Railway project without guesswork.
- Keep real tokens and environment files in private local storage only, never in source control.

## Runtime Commands

Railway config uses:

```bash
node ./scripts/runtime/railway-predeploy.cjs
sh start.sh
```

The predeploy command runs an idempotent additive schema sync for generated deployments. It creates
the Business table and required Profile preference fields when an existing production database
lacks them, and supplies timestamp defaults required by dashboard and dataset writes. The start
script uses POSIX `sh` and then runs `node -r ./scripts/runtime/load-env.cjs
./scripts/runtime/start-dist.cjs`. The runtime helper binds to Railway `$PORT`, forces `0.0.0.0`,
and lets Auth.js infer the active public host from Railway proxy headers.

Generated Railway output also stores a regular-file copy of the required Next.js runtime build
directory under `next-build-extra/`. The generated deployment Dockerfile copies the deployment
branch root with `COPY . .` and runs the predeploy helper during image creation; the source-side
Dockerfile copies `dist/` with `COPY dist/ .`. In both layouts, the helper restores the saved files
into the packaged Next.js installation before startup. The runtime start helper repeats the restore
as a safety check.

The image-build predeploy step has no database connection, so it performs only file restoration when
`DATABASE_URL` and `DIRECT_URL` are absent. Railway's configured predeploy command performs the
database schema sync before runtime startup.

## Railway CLI

Fastest safe local operator flow:

```bash
pnpm railway:login
pnpm railway:link -- --project <project-id-or-name> --environment <environment-id-or-name> --service <service-id-or-name>
pnpm railway:status
pnpm railway inspect
pnpm railway:logs
pnpm railway:cleanup
pnpm railway:cleanup -- --keep-success
```

List recent deployments with statuses:

```bash
railway deployment list
```

Trigger the latest deploy:

```bash
railway redeploy
```

If `redeploy` is unavailable in the installed CLI:

```bash
railway up
```

The Railway CLI v4 native binary does not work well in non-TTY environments
(see [railwayapp/cli#683](https://github.com/railwayapp/cli/issues/683)).
This project uses a GraphQL wrapper (`scripts/server/railway/railway.cjs`)
that makes API calls directly. It replaces the native binary for auth,
project listing, linking, and status. Unsupported commands fall through
to the native binary.

```bash
pnpm railway:login           # Verify token & show user info
pnpm railway:list            # List projects (create one on Railway first)
pnpm railway:link            # Link current directory to a project
pnpm railway:status          # Show linked project status
pnpm railway inspect         # Show linked project environments, services, domains, and latest deployments
```

Token auth is required. Set `RAILWAY_API_TOKEN` in `.env` (loads
automatically — no need to source). Generate a token at
https://railway.app/account/tokens.

Shell-provided `RAILWAY_API_TOKEN` or `RAILWAY_TOKEN` takes priority over `.env`. Use a shell
token when you need to inspect a different Railway account or project without changing the private
local token file.

**Important:** Always use the project's Railway wrapper or native Railway CLI to query deploy
status. Do not hand-craft GraphQL queries against the Railway API — the schema changes frequently
and direct queries are brittle. The wrapper at `scripts/server/railway/railway.cjs` handles auth,
token loading, and error formatting.

`pnpm railway:cleanup` marks every deployment across every service and environment in the linked
project as `REMOVED`. `pnpm railway:cleanup -- --keep-success` removes only deployments whose
status is not `SUCCESS`. Confirm the linked project before either command. Railway keeps removed
entries in API history and provides no permanent-delete operation.

## Railpack Configuration

Railpack uses `railpack.json` at the deployment root (the `dist` branch root, not inside `/dist`).
The config declares only the Node.js provider — no custom install/build steps:

```json
{
  "provider": "node"
}
```

- `provider` must be a singular string (`"node"`), not a plural array (`["node"]`) — the plural form
  is silently ignored by Railpack.
- Custom `install`/`build` steps were removed because they prevent Railpack from setting up the
  Node.js runtime, causing `node: command not found` at deploy time.
- Railpack's default npm install is instant because `dist/package.json` has empty `dependencies: {}`.
  The real production modules are bundled in `dist/node_modules/` from `.next/standalone`.

## Node Modules in Dist Output

`dist/node_modules/` (33MB, pnpm symlink structure via `.pnpm/`) is committed to the `dist` branch.
Railpack needs `node_modules` present in the source for its build graph checksum calculation.
Without it, Railway fails with:

```
failed to calculate checksum of ref ...: "/app/node_modules": not found
```

Key requirements:

- `node_modules/` must NOT appear in any `.gitignore` that applies to the `dist` branch.
- The symlink structure must be relative, not absolute. Use `cp -a` (not `fs.cpSync`) when copying
  the standalone output — Node.js `fs.cpSync` resolves relative symlinks to absolute paths, which
  breaks the pnpm structure on Railway.

## Local Checks

```bash
pnpm validate:dist
pnpm prod:build
test ! -f dist/pnpm-workspace.yaml
test ! -f dist/pnpm-lock.yaml
test -f dist/package-lock.json  # minimal lockfile for Railpack npm detection
test ! -f dist/railway.json
test ! -f dist/vercel.json
test -f dist/node_modules/.pnpm  # node_modules must be present
test -f dist/railpack.json
```

## Troubleshooting

### Build Phase Failures

If Railway logs show `RUN npm i`, Railpack did not activate pnpm from the generated deployment
package or Railway is building the wrong root directory. Confirm Railway uses branch `dist`, root
directory `/dist`, and config file path `/server-config/railway.json`.

If logs show workspace metadata errors, confirm generated `/dist` does not contain
`pnpm-workspace.yaml` and the deployment branch root does not contain `pnpm-workspace.yaml`.

If logs show pnpm requiring a newer Node release, keep the deployment package on a pnpm version that
matches Railway's current Node runtime until Railway moves past the requirement.

If Railpack starts a dependency install for the test deploy, confirm the `dist-test` branch contains
only the minimal npm lockfile inside `/dist`. The standalone bundle includes production modules, and
the generated deployment package must not include pnpm workspace metadata.

If logs show `ERR_PNPM_NO_LOCKFILE`, keep Railway runtime installs on `--no-frozen-lockfile` because
the generated deployment package is smaller than the source workspace and Railway installs from
generated output only.

If logs show `failed to calculate checksum of ref ... "/app/node_modules": not found`:

- `node_modules/` is missing from the deployed branch.
- Check `.gitignore` on the deployment branch — `node_modules/` must not be ignored.
- Check the publish workflow — cleanup steps must not `rm -rf node_modules`.
- Regenerate dist output with `pnpm prod:build` and republish.

### Runtime Errors (502 / Healthcheck Failures)

If Railway deploys successfully but the app returns 502:

1. Check Railway logs for server startup errors or crash traces.
2. Verify `DATABASE_URL` and `AUTH_SECRET` are set in Railway environment variables.
3. Confirm the generated start command is `sh start.sh`, with no dashboard start override.
4. Confirm the database is reachable — Railway Postgres may require SSL:
   - The `pg` Pool in `src/lib/db/index.ts` uses `{ connectionString: url, max: 10 }` without SSL.
   - Add `ssl: { rejectUnauthorized: false }` when the hostname contains `railway.app` or `neon.tech`.
5. Check `/api/health` JSON for `database: "ready"` after startup:
   - Railway receives HTTP 200 from the liveness healthcheck while database readiness is reported in
     the response body.
   - Use `POST /api/health` for a strict readiness check that returns 503 while the database is not
     ready.

If the test app redirects to the live app host, remove fixed auth host variables from the Railway
test service or set `USECLEVR_AUTH_URL_STRICT=true` only when a single fixed callback host is
required. The default Railway runtime trusts the request host so `test.useclevr.com` stays on the test
service.

Generated Railway startup sets `USECLEVR_SERVER_TARGET=railway`. Auth redirects accept the current
origin, local development origins, and HTTPS `useclevr.com` origins; internal listener addresses such
as `0.0.0.0:8080` are never the destination for a successful browser login.

Keep test-service environment variables separate from production. Stripe test mode belongs on the
test service, and live Stripe keys belong only on the production service.

If runtime logs show `Could not find a production build in the './.next' directory`, keep the
generated `next-build` folder and the runtime restore step. Railway can omit dot-directories from the
service snapshot, while Next still expects `.next` at runtime.

## Smoke Checks

After a test deployment:

- Check `/api/health`.
- Verify sign-in and protected dashboard access.
- Upload a small dataset.
- Confirm the datasets table renders.
- Ask one AI analysis question.
- Open Reports & Downloads.
- Review Railway logs for startup, database, auth, and healthcheck errors.
