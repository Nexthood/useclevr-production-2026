# GitHub Development Workflow

This project separates source code from deployment output.

`main` is the source branch. Developers review, test, and merge source changes there. Vercel deploys
from `main` using root `vercel.json`.
`dist` is the generated deployment branch. GitHub Actions publishes build output there for Railway.

Do not merge `dist` back into `main`. Do not edit generated files on `dist` by hand.

## Branch Model

| Branch           | Purpose                             | Updated by                                           |
| ---------------- | ----------------------------------- | ---------------------------------------------------- |
| `main`           | Stable source code                  | Pull requests                                        |
| `beta`           | Test branch before release          | Developers, then GitHub Actions after `main` updates |
| `dist`           | Generated Railway deployment output | GitHub Actions                                       |
| Feature branches | Individual changes before review    | Developers                                           |

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

The `pre-push` hook runs the heavier local validation gate before code leaves the machine. It checks
TypeScript, deployment config, lint rules, production packaging, and workflow files.
It also checks the current workflow check-run names against
`.github/workflow-job-names.golden.json` so branch protection does not drift onto a stale required
job name.

## Pull Request Titles

Pull request titles should start with `PR:` for deployment tracking. The auto-merge workflow formats them as `PR-{number}: title`. The formatted title becomes the dist branch commit message.

## GitHub Issues, Projects, Releases, And Artifacts

Use GitHub Issues for work that needs collaboration, triage, or historical discussion outside the
local `.TODO/` queue. Use `.TODO/todo-next.md` for local agent-ready implementation tasks. When an
issue becomes implementation work, give the local task a `T-` number and link the issue in the task
body or pull request.

Use GitHub Projects for cross-cutting planning across issues, pull requests, releases, and deployment
follow-up. Keep project fields product-oriented: status, owner, priority, release target, and risk.
Do not duplicate every local TODO item into a project board; promote only work that benefits from
coordination or reporting.

Use version tags only for reviewed releases. Keep release notes aligned with `CHANGELOG.md`, and do
not add follow-up work to an already released version section. If a fix follows a release, document it
under `## [Unreleased]` until the next release tag.

Use GitHub Releases when a version needs a stable changelog, deployment reference, or downloadable
artifact set. Attach artifacts only when they are useful outside CI logs, such as generated manifests,
smoke-test summaries, or signed packages. Do not attach generated `.next/`, `dist/`, or dependency
folders unless a release process explicitly requires them.

Use workflow artifacts for temporary CI evidence: build manifests, smoke-test output, coverage
reports, screenshots, or logs that help review a pull request. Keep artifact retention short unless
the artifact is needed for compliance or incident review.

## Test Flow: Beta To Main

Use this flow when testing a change before release:

1. Push the test change to `beta`.
2. Verify the behavior from `beta`.
3. Open a pull request from `beta` into `main`.
4. Enable auto-merge on the pull request when the required check is selected.
5. Wait for `Validate source and production build / validate` to pass.
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

The main CI workflow is `.github/workflows/ci.yml`. It runs on:

- Pushes to `main` and `beta`
- Pull requests targeting `main` and `beta`

CI is automatically skipped for commits containing `[skip ci]` in the commit message.

All CI workflows use a PostgreSQL 17 ephemeral service container so database-dependent steps
(schema push, build with DB imports) can execute without a permanent database. Production and
preview deployments connect to the external Neon PostgreSQL instance.

The required branch-rule check is:

- `Validate source and production build / validate`

This one check protects `main`, because `main` generates the production `dist` branch and can also
deploy directly to Vercel. It installs dependencies, runs type validation, verifies Railway and
Vercel config sync, runs lint and tests with the Postgres service container, then proves Next.js
can compile the app.

### Auto-Merge Workflow

The `.github/workflows/auto-merge.yml` workflow automatically enables auto-merge for PRs from
`beta` to `main` when all checks pass. It listens for pull requests targeting `main` and then checks
that the source branch is `beta`, because GitHub's `pull_request.branches` filter matches the base
branch, not the head branch. The workflow calls `gh pr merge <event PR number> --auto` explicitly so
it does not depend on the runner's current Git branch.

After the PR merges to `main`, the `branch-maintenance.yml` workflow automatically triggers on the
`push` event to `main`, handling both beta sync and dist publish.

### Deployment Workflow

The `.github/workflows/branch-maintenance.yml` workflow handles deployment branch maintenance in parallel jobs:

- **sync-beta**: Triggers on push to `main` and `workflow_dispatch`
  - Syncs `beta` with `main` using `git merge --strategy-option=theirs` to handle conflicts
  - Commit message includes `[skip ci]` to prevent CI duplication

- **publish-dist**: Triggers on push to `main` and `workflow_dispatch`
- Uses same Node.js (`26.x`) and pnpm (`11.5.0`) setup as `ci.yml` with pnpm cache enabled
- Includes a PostgreSQL 17 service container for the build step (production uses external Neon)
- Runs type validation, dist config validation, and lint before publishing generated output
- Runs `pnpm prod:build` to create the dist output
- Starts the generated server and checks `/api/health` before publishing; exits with code 1 if the server never starts
- Checks out the existing `dist` branch after the build
- Replaces only the generated `/dist` folder
- Syncs `dist-root/` from `main` to the deployment branch root
- Publishes `server-config/railway.json` and `server-config/vercel.json` under `/server-config`
- Fails if `railway.json` or `vercel.json` lands at the branch root or inside `/dist`
- Pushes a normal commit to `dist` when generated output changes, using the merged PR number and title (e.g., `PR-28: fix: ...`) instead of a long source commit id

Concurrency control prevents duplicate workflow runs: only one `branch-maintenance` workflow can run at a time, avoiding the race condition where both PR close event and auto-merge dispatch would trigger simultaneously.

`dist-root/` stores deployment-branch root files, not the CI workflow itself. Host config templates
live at `dist-root/server-config/railway.json` and `dist-root/server-config/vercel.json`.

### Action Version Policy

Workflow actions use reviewed GitHub-owned major tags:

- `actions/checkout@v6`
- `actions/setup-node@v6`
- `actions/github-script@v9`

The workflow guard rejects unapproved action names and refs. This keeps accidental action renames,
third-party replacements, and stale copied examples out of CI until a maintainer reviews them.

Do not use `pnpm/action-setup`. CI activates pnpm through Corepack with the package manager version
declared by the repository, which avoids depending on the pnpm action name, tag availability, or
download path.

### Host Deployment Guides

Railway runtime behavior lives in [`RAILWAY_DEPLOYMENT.md`](RAILWAY_DEPLOYMENT.md). Vercel
source-branch behavior lives in [`VERCEL_DEPLOYMENT.md`](VERCEL_DEPLOYMENT.md). Keep host-specific
CLI, dashboard, runtime, and troubleshooting steps in those files.

### Local And Server Start Commands

Generated `dist/package.json` keeps local and server starts separate:

```bash
npm run start          # local default, AUTH_URL=http://localhost:8080
npm run start:railway  # Railway target, HOSTNAME=0.0.0.0, request-host auth
npm run start:vercel   # Vercel target placeholder
```

The source checkout mirrors this with `pnpm start:dist`, `pnpm prod:railway`, and
`pnpm prod:vercel`. Use the named server target only when testing that host's environment.

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
.turbo
.vercel
```

The publish workflow keeps generated `dist/node_modules/` because Railpack uses it for the source
graph and the standalone server uses it at runtime. The generated package keeps a minimal
`package-lock.json` for npm detection and excludes pnpm workspace metadata before staging. After
switching to the orphan deployment branch workspace, the workflow deletes root-level build leftovers
such as `.next/` and source checkout `node_modules/`; those are untracked workspace files from the
build job, not deployment files.

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
4. Return to the ruleset and select `Validate source and production build / validate`.

Do not select the older plain job name `Validate source and production build`. The current required
check is the emitted GitHub Actions check-run name from the reusable workflow job.

## Workflow Check-Name Golden File

The repository keeps the expected workflow check-run names in:

- `.github/workflow-job-names.golden.json`

Local guard:

- `pnpm lint:workflows` checks the current workflow files against the golden file.
- `pnpm lint:workflows:refresh` rewrites the golden file after a deliberate workflow-name change.

Automatic refresh:

- `.github/workflows/refresh-workflow-golden.yml` runs as a non-blocking follow-up when workflow
  files or workflow-name scripts change on `main` or `beta`.
- If the workflow names changed, it commits the refreshed golden file back to the same branch with
  a bot commit.

This setup keeps the local pre-push gate strict while still giving the repository a safe self-heal
path after intentional workflow renames.

## GitHub Actions Verification

The GitHub Actions workflows have been verified and are correct:

**ci.yml:**

- Validation runs on push to branches [main, beta] ✓
- No duplicate CI runs on beta pushes (single workflow covers both) ✓
- Skips CI for commits containing [skip ci] ✓

**branch-maintenance.yml:**

- Runs only on push to branches: [main] or workflow_dispatch ✓ (dist deployment from main only)
- Both jobs have `if: github.event_name == 'workflow_dispatch' || github.event_name == 'push' && github.ref == 'refs/heads/main'` ✓
- Concurrency control prevents duplicate runs ✓
- Sync job merges main into beta with [skip ci] in commit message ✓
- Uses `--strategy-option=theirs` to handle merge conflicts ✓
- Publish job runs independently, not dependent on sync-beta ✓
- Publish job force-cleans dist branch with git checkout --orphan new-dist and git rm -rf . ✓
- Publishes generated `/dist` folder contents without changing the folder shape ✓
- Syncs `dist-root/` to the deployment branch root ✓
- Publishes `server-config/railway.json` and `server-config/vercel.json` from `dist-root/server-config/` ✓
