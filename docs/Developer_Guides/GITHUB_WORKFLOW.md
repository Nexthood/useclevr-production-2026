# GitHub Development Workflow

This project separates source code from deployment output.

`main` is the source branch. Developers review, test, and merge source changes there. Vercel deploys
from `main` using root `vercel.json`.
`dist` is the generated deployment branch. GitHub Actions publishes build output there for Railway.

Do not merge `dist` back into `main`. Do not edit generated files on `dist` by hand.

## Branch Model

| Branch | Purpose | Updated by |
| --- | --- | --- |
| `main` | Stable source code | Pull requests |
| `beta` | Test branch before release | Developers, then GitHub Actions after `main` updates |
| `dist` | Generated Railway deployment output | GitHub Actions |
| Feature branches | Individual changes before review | Developers |

The normal flow is:

1. Create a feature branch from `main`.
2. Commit and push source changes to the feature branch.
3. Open a pull request into `main`.
4. Wait for required CI checks to pass.
5. Merge into `main`.
6. GitHub Actions syncs `beta` from `main`.
7. GitHub Actions builds the app from `main` and publishes the generated output to `dist:/dist`.
8. Railway deploys from the `/dist` folder on the `dist` branch.
9. Vercel deploys from `main` when its project is connected to the source branch.

## Conventional Commits

This project uses [commitlint](https://commitlint.js.org/) to enforce conventional commit messages. All commits must follow the format:

```
type(scope?): subject
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Examples:**
- `feat: add user authentication`
- `fix(api): handle null response`
- `docs: update deployment guide`
- `chore(deps): update dependencies`

The `commit-msg` hook validates commit messages automatically. Bypass with `git commit --no-verify` only for urgent fixes.

## Pull Request Titles

Pull request titles should start with `PR:` for deployment tracking. The auto-merge workflow formats them as `PR-{number}: title`. The formatted title becomes the dist branch commit message.

## Test Flow: Beta To Main

Use this flow when testing a change before release:

1. Push the test change to `beta`.
2. Verify the behavior from `beta`.
3. Open a pull request from `beta` into `main`.
4. Enable auto-merge on the pull request when the required check is selected.
5. Wait for `Validate source and production build` to pass.
6. Let GitHub merge the pull request into `main`.
7. Watch the branch maintenance workflow sync `beta` and publish `dist:/dist`.

Do not merge `dist` into `main` or open pull requests from `dist`.

## Required Local Checks

Run the focused checks before opening a pull request:

```bash
pnpm validate:types
pnpm validate:dist
pnpm lint
pnpm test:all
```

Run the production build when the change can affect deployment output:

```bash
pnpm prod:build
```

## GitHub Actions

The main CI workflow is `.github/workflows/ci.yml`.

It runs on:
- Pushes to `main`
- Pull requests targeting `main`

It intentionally does not run on `beta` pushes. A direct push to `beta` is only a test branch update;
it should not validate as a release candidate until it becomes a pull request into `main`. This also
keeps the automatic `main` → `beta` sync commit from starting CI on `beta`.
After the pull request merges, the push to `main` also runs the same validation so the protected
source branch and deployment publisher see a confirmed main-branch result.

CI is automatically skipped for commits containing `[skip ci]` in the commit message.

The required branch-rule check is:
- `Validate source and production build`

This one check protects `main`, because `main` generates the production `dist` branch and can also
deploy directly to Vercel. It installs dependencies, runs type validation, verifies Railway and
Vercel config sync, runs lint and tests, then proves Next.js can compile the app.

### Auto-Merge Workflow

The `.github/workflows/auto-merge.yml` workflow automatically enables auto-merge for PRs from
`beta` to `main` when all checks pass. It listens for pull requests targeting `main` and then checks
that the source branch is `beta`, because GitHub's `pull_request.branches` filter matches the base
branch, not the head branch. The workflow calls `gh pr merge <event PR number> --auto` explicitly so
it does not depend on the runner's current Git branch.

### Deployment Workflow

The `.github/workflows/branch-maintenance.yml` workflow handles deployment branch maintenance in parallel jobs:

- **sync-beta**: Triggers on push to `main` (not PRs)
  - Syncs `beta` with `main` using `git merge --strategy-option=theirs` to handle conflicts
  - Commit message includes `[skip ci]` to prevent CI duplication

- **publish-dist**: Triggers on push to `main` (not PRs)
- Runs independently, not dependent on sync-beta
- Uses same Node.js (`26.x`) and pnpm (`11.1.2`) setup as `ci.yml`
- Runs type validation, dist config validation, and lint before publishing generated output
- Runs `pnpm prod:build` to create the dist output
- Starts the generated server and checks `/api/health` before publishing
- Checks out the existing `dist` branch after the build
- Replaces only the generated `/dist` folder
- Syncs `dist-root/` from `main` to the deployment branch root
- Publishes `server-config/railway.json` and `server-config/vercel.json` as root `railway.json` and `vercel.json`
- Fails if root `railway.json`, root `vercel.json`, or generated `/dist/railway.json` is missing
- Pushes a normal commit to `dist` when generated output changes, using the merged PR number and title (e.g., `PR-28: fix: ...`) instead of a long source commit id

Running jobs in parallel means `publish-dist` can complete even if `sync-beta` fails due to merge conflicts.

`dist-root/` stores deployment-branch root files, not the CI workflow itself. Host config templates
live at `dist-root/server-config/railway.json` and `dist-root/server-config/vercel.json`.

### Railway Runtime Behavior

Railway deployment flow:

1. **Build phase** (controlled by `dist-root/server-config/railway.json`):
   - Nixpacks provides the deployment builder so Railway does not run Railpack `mise install`.
   - Corepack activates pnpm 11.1.2 before install.
   - `pnpm install --frozen-lockfile --prod --no-optional` - Installs only production dependencies
   - `optional = false` in `pnpm-workspace.yaml` prevents optional SWC binaries

2. **Pre-deploy phase**:
   - `pnpm run railway:predeploy` applies database schema changes through pnpm.

3. **Start phase**:
   - `pnpm run start:railway` starts the generated standalone server with Railway host binding.
   - Railway runs from `dist/` folder, so the path is relative to `/dist`

Database migrations stay in Railway `preDeployCommand` for this phase. A separate migration service or job is future work only when migrations or background jobs need isolation from the web process.

The `dist` branch root is intentionally small. Permanent files live at the branch root, while Railway runs from the generated `/dist` folder. To test the runtime locally, switch to `dist`, run `cd dist && pnpm install && npm run start`, and open `http://localhost:8080`. The default local start uses `localhost` for Auth.js; Railway and Vercel use named target scripts.

The `dist` branch root must contain `railway.json`. Railway should keep root directory `/dist` and
config file path `/railway.json`, while the generated folder also carries `dist/railway.json` for
local parity and `pnpm-workspace.yaml` so pnpm can run the approved dependency build scripts required
by `sharp`, `esbuild`, and `core-js`. The Railway build command also passes pnpm's build-approval
setting directly so Railpack cannot stop on an interactive `pnpm approve-builds` prompt.

Railway service settings must not keep old custom `npm` commands. Clear dashboard build, pre-deploy,
and start command overrides so `/railway.json` controls the deployment. If an override is
temporarily needed, use `pnpm run railway:predeploy` for migrations and `pnpm start` for runtime.

### Local And Server Start Commands

Generated `dist/package.json` keeps local and server starts separate:

```bash
npm run start          # local default, AUTH_URL=http://localhost:8080
npm run start:railway  # Railway target, HOSTNAME=0.0.0.0
npm run start:vercel   # Vercel target placeholder
```

The source checkout mirrors this with `pnpm start:dist`, `pnpm prod:railway`, and
`pnpm prod:vercel`. Use the named server target only when testing that host's environment.

### Vercel Source Deployment

Vercel deployment flow:

```text
beta → PR → main → Vercel builds from main
```

Vercel reads root `vercel.json`, which is synced from:

```text
dist-root/server-config/vercel.json
```

Edit the template, then run:

```bash
pnpm deploy:vercel:sync
pnpm validate:dist
```

Do not point Vercel at the generated `dist` branch. Railway owns the generated-output path; Vercel
owns source-branch builds. Database migrations do not run as a Vercel pre-deploy phase in this setup.

For one local env shared by `main`, `beta`, and `dist` checkouts, place it next to the checkout folder as `../.env.local`. The runtime loader applies parent env values first, then checkout-local env values, while shell and Railway variables remain authoritative.

## Deployment Strategy Notes

Current deployment flow:

```text
beta → PR → main → GitHub Action → dist branch → Railway deploys from /dist
```

The current setup keeps production deployment artifacts isolated from the source branch and allows
Railway to deploy only generated production output.

Current issue observed:

```text
Publishing to the dist branch can fail because some generated build/runtime dependency files exceed
GitHub file size limits (100 MB hard limit).
```

This mainly happens when large files are included inside:

```text
.next/standalone
.next/server
dependencies/runtime build artifacts
```

The current workflow already removes unnecessary cache folders such as:

```text
.next/cache
node_modules
.turbo
.vercel
```

The publish workflow also generates `dist/pnpm-lock.yaml` before final cleanup. `pnpm install
--lockfile-only` can create local dependency links, so the workflow removes `dist/node_modules` again
before staging and checks only files that will be committed. After switching to the orphan `dist`
branch workspace, the workflow also deletes root-level build leftovers such as `.next/` and
`node_modules/`; those are untracked workspace files from the build job, not deployment files.

The workflow also removes `.next/cache/webpack` which contains large webpack pack files that are
not needed for the standalone build. These are excluded during `create-dist.cjs` copy and cleaned
again before publishing.

Next.js SWC platform packages such as `@next/swc-linux-x64-gnu` are optional build-time dependencies.
The source build can install them, but the generated Railway runtime package uses `--no-optional` and
`optional: false` so deploy installs do not pull those compiler binaries.

However, if a required runtime file itself exceeds GitHub limits, the dist branch approach becomes
problematic.

### Option 1 — Railway Builds From Main

Simplest architecture:

```text
beta → PR → main → Railway builds from main
```

Advantages:

- No dist branch required
- No GitHub file size problems
- Simpler Git history
- Simpler CI/CD pipeline

Disadvantages:

- Railway performs the production build itself
- Less control over prebuilt deployment artifacts

### Option 2 — Dist Branch With Generated Artifacts

Current architecture:

```text
beta → PR → main → GitHub Action builds → dist branch → Railway deploys from /dist
```

Advantages:

- Production branch contains only deployment artifacts
- Railway deploys faster from prebuilt output
- Clear separation between source and deployment

Disadvantages:

- GitHub file size limits may block deployment
- More CI/CD complexity
- Requires force-cleaning dist branch history if large runtime artifacts must be removed from history

### Option 3 — Docker Image Deployment

Possible future architecture:

```text
beta → PR → main → GitHub Action builds Docker image → container registry → Railway deploys image
```

Advantages:

- No GitHub file size limitations for runtime artifacts
- Most production-grade deployment approach
- Consistent runtime environment

Disadvantages:

- More DevOps complexity
- Requires container registry management

### Option 4 — GitHub Actions Artifacts

Possible workflow:

```text
GitHub Action build → upload artifact → deploy artifact
```

Advantages:

- Avoids Git branch pollution
- Cleaner Git history

Disadvantages:

- Railway integration is less straightforward
- Artifact retention/management required

Current recommendation: keep the current dist branch architecture temporarily while investigating
which generated runtime files are actually required and which large files can safely be excluded from
deployment output.

Do not decide the final deployment architecture until runtime artifact size and Railway deployment
behavior are fully understood.

## If Checks Do Not Appear In Branch Rules

GitHub only shows status checks after they have run in the repository.

If the selector is empty:

1. Confirm `.github/workflows/ci.yml` exists on `main`.
2. Open a small pull request targeting `main`.
3. Wait for the workflow to run.
4. Return to the ruleset and select `Validate source and production build`.

The check name may appear as either `Validate source and production build` or `Validate Source / Validate source and production build`, depending on the GitHub settings page.

## GitHub Actions Verification

The GitHub Actions workflows have been verified and are correct:

**ci.yml:**
- Validation runs on push to branches [main] ✓
- Validation runs on pull_request to branches [main] ✓
- Beta pushes do not run the same validation twice; validation happens on the beta → main PR ✓
- Skips CI for commits containing [skip ci] in both validation and documentation jobs ✓

**branch-maintenance.yml:**
- Runs only on push to branches: [main] ✓ (dist deployment from main only)
- Both jobs have if: github.ref == 'refs/heads/main' ✓
- Sync job merges main into beta with [skip ci] in commit message ✓
- Uses `--strategy-option=theirs` to handle merge conflicts ✓
- Publish job runs independently, not dependent on sync-beta ✓
- Publish job force-cleans dist branch with git checkout --orphan new-dist and git rm -rf . ✓
- Publishes generated `/dist` folder contents without changing the folder shape ✓
- Syncs `dist-root/` to the deployment branch root ✓
- Publishes root `railway.json` and `vercel.json` from `dist-root/server-config/` ✓

**ci.yml:**
- Does not run on beta pushes (validated when PR targets main) ✓
