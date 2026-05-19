# GitHub Development Workflow

This project separates source code from deployment output.

`main` is the source branch. Developers review, test, and merge source changes there.
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

The required branch-rule check is:

- `Validate source and production build`

This one check protects `main`, because `main` generates the production `dist` branch. It installs
dependencies, runs type validation, verifies dist config, runs lint and tests, then proves Next.js can
compile the app for Railway.

### Deployment Workflow

The `.github/workflows/branch-maintenance.yml` workflow handles deployment branch maintenance:

- Triggers on push to `main` (not PRs)
- Syncs `beta` with `main` first
- Uses same Node.js (`26.x`) and pnpm (`11.1.2`) setup as `ci.yml`
- Runs `pnpm prod:build` to create the dist output
- Checks out the existing `dist` branch after the build
- Replaces only the generated `/dist` folder
- Preserves root-level branch files such as `.gitignore`, `README.md`, and future deployment metadata
- Pushes a normal commit to `dist` when generated output changes

The publish job does not commit `node_modules/`. Railway installs runtime dependencies and uses its
own install cache.

The `dist` branch root is intentionally small. Permanent files live at the branch root, while Railway
runs from the generated `/dist` folder. To test the Railway runtime locally, switch to `dist`, run
`cd dist && pnpm install && PORT=8080 pnpm start`, and load local environment variables from the
repository root before starting if needed.

For one local env shared by `main`, `beta`, and `dist` checkouts, place it next to the checkout
folder as `../.env.local`. The runtime loader applies parent env values first, then checkout-local
env values, while shell and Railway variables remain authoritative.

## Auto-Merge Setup

If all checks pass, then you can enable auto-merge for main.

Recommended safe setup:

| Setting | Value |
| --- | --- |
| Require PR before merging | ✅ Yes |
| Require status checks to pass | ✅ Yes |
| Required checks | `Validate source and production build` |
| Require branches up to date | ❌ Optional, not needed solo |
| Auto-merge | ✅ Yes |
| Block deletion | ✅ Yes |
| Block force push | ✅ Yes |

Best workflow:

```
push to beta → beta PR to main → CI passes → auto-merge → sync beta → publish dist → Railway
```

Only enable auto-merge if the PR is from a trusted branch like `beta`, not from random branches.

**One note:** GitHub auto-merge needs to be enabled in repo settings:

Settings → General → Pull Requests → Allow auto-merge

### Complete Flow

```
PR opened: beta → main
    ↓
GitHub Actions runs
    ↓
If checks fail → no merge
    ↓
If all checks pass → auto-merge allowed/executed
    ↓
main updates
    ↓
Action syncs beta from main
    ↓
Action publishes generated /dist folder
    ↓
Railway deploys dist
```

**Important:** auto-merge only works safely when you have required status checks selected. Otherwise GitHub may allow merge without real validation.

Best setting:

- Auto-merge: enabled
- Required status checks: enabled
- Only selected CI checks can unlock merge

So yes: auto-merge only if all green is possible and recommended once CI is stable.

## Main Branch Rules

`main` is protected through a GitHub repository ruleset.

Ruleset:

- Name: `main requires CI`
- Target: `refs/heads/main`
- Enforcement: active

Required status check:

- `Validate source and production build`

Keep strict status checks enabled so pull requests must be up to date before merge.

Recommended behavior:

- Require pull requests before merging.
- Require passing CI checks.
- Block deletion.
- Block force pushes.
- Do not bypass the rule for normal development.

## Dist Branch Rules

`dist` is a generated deployment branch, not a development branch.

Ruleset:

- Name: `dist protects deploy output`
- Target: `refs/heads/dist`
- Enforcement: active

Current behavior:

| Setting | Value |
| --- | --- |
| Require pull request | No |
| Require status checks | No |
| Block deletion | Yes |
| Block force pushes | Yes, if the publish workflow uses normal pushes |
| Intended updater | GitHub Actions |

The current publish strategy updates only `/dist` on the existing branch, so force pushes are not
required. Allow force pushes only if the workflow returns to an orphan-branch replacement strategy.

Do not require pull requests on `dist`. The deployment workflow must be able to push generated output directly.

## Source Branch Dist Ignore

If GitHub Actions builds and publishes the `dist` branch, then `dist/` should be ignored on source branches such as `main` and `beta`.

Best setup:

- `main` and `beta`: source code only, with `dist/` ignored.
- `dist`: generated deployment output in `/dist`, with root-level branch metadata preserved.
- Local testing: run `pnpm prod:build` to create local `dist/`, but do not commit it.
- GitHub Actions: build from `main`, then publish generated `dist/` contents to `dist:/dist`.

Source branches should include this ignore rule:

```gitignore
dist/
```

This avoids noisy generated files and prevents humans from accidentally committing local build output.
Since Railway deploys from the `dist` branch, source branches do not need to track the local `dist/` folder.

## Railway Deployment

Railway should deploy from:

| Setting | Value |
| --- | --- |
| Branch | `dist` |
| Root directory | `/dist` |
| Build command | Install/runtime dependency setup only |
| Start command | `node server.js`, unless Railway config overrides it |

Runtime secrets stay in Railway environment variables. Never commit `.env` files to `main` or `dist`.

## Do And Do Not

Do:

- Work from `main` or a feature branch based on `main`.
- Open pull requests into `main`.
- Let GitHub Actions publish `dist`.
- Treat `dist` as disposable generated output.

Do not:

- Edit `dist` manually.
- Merge `dist` into `main`.
- Open pull requests from `dist`.
- Add secrets, local uploads, or `.env` files to any branch.
- Change Railway to build from `main` unless the deployment strategy changes.

## If Checks Do Not Appear In Branch Rules

GitHub only shows status checks after they have run in the repository.

If the selector is empty:

1. Confirm `.github/workflows/ci.yml` exists on `main`.
2. Open a small pull request targeting `main`.
3. Wait for the workflow to run.
4. Return to the ruleset and select `Validate source and production build`.

The check name may appear as either `Validate source and production build` or
`Validate Source / Validate source and production build`, depending on the GitHub settings page.
