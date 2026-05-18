# GitHub Development Workflow

This project separates source code from deployment output.

`main` is the source branch. Developers review, test, and merge source changes there.
`dist` is the generated deployment branch. GitHub Actions publishes build output there for Railway.

Do not merge `dist` back into `main`. Do not edit generated files on `dist` by hand.

## Branch Model

| Branch | Purpose | Updated by |
| --- | --- | --- |
| `main` | Stable source code | Pull requests |
| `dist` | Generated Railway deployment output | GitHub Actions |
| Feature branches | Individual changes before review | Developers |

The normal flow is:

1. Create a feature branch from `main`.
2. Commit and push source changes to the feature branch.
3. Open a pull request into `main`.
4. Wait for required CI checks to pass.
5. Merge into `main`.
6. GitHub Actions builds the app from `main` and publishes the generated output to `dist`.
7. Railway deploys from the root of the `dist` branch.

## Test Flow: Beta To Main

Use this flow when testing a change before release:

1. Push the test change to `beta`.
2. Verify the behavior from `beta`.
3. Open a pull request from `beta` into `main`.
4. Merge only after the required checks pass.

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

The required branch-rule checks are:

- `fast`
- `full`

`fast` runs type validation, dist config validation, lint, and tests.
`full` runs the production Next.js build after `fast` succeeds.

### Deployment Workflow

The `.github/workflows/dist-publish.yml` workflow handles deployment:

- Triggers on push to `main` (not PRs)
- Uses same Node.js (`26.x`) and pnpm (`11.1.2`) setup as `ci.yml`
- Runs `pnpm prod:build` to create the dist output
- **Uses `git checkout --orphan` to create a fresh branch** (since dist should contain only generated output)
- Then force-pushes it to the `dist` branch
- This works with the dist branch ruleset that allows force pushes

## Auto-Merge Setup

If all checks pass, then you can enable auto-merge for main.

Recommended safe setup:

| Setting | Value |
| --- | --- |
| Require PR before merging | ✅ Yes |
| Require status checks to pass | ✅ Yes |
| Required checks | `fast`, `full` |
| Require branches up to date | ❌ Optional, not needed solo |
| Auto-merge | ✅ Yes |
| Block deletion | ✅ Yes |
| Block force push | ✅ Yes |

Best workflow:

```
beta → PR → CI passes → auto-merge into main → Action builds dist → Railway deploys
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
dist build Action runs
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

Required status checks:

- `fast`
- `full`

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
| Block force pushes | No |
| Intended updater | GitHub Actions |

Force pushes are allowed because the publish workflow needs to completely replace the deployment output.

**The workflow uses `git checkout --orphan` to create a fresh branch** (since dist should contain only generated output), then force-pushes it to the `dist` branch. This works with the dist branch ruleset that allows force pushes.

Do not require pull requests on `dist`. The deployment workflow must be able to push generated output directly.

## Source Branch Dist Ignore

If GitHub Actions builds and publishes the `dist` branch, then `dist/` should be ignored on source branches such as `main` and `beta`.

Best setup:

- `main` and `beta`: source code only, with `dist/` ignored.
- `dist`: generated deployment output at the branch root.
- Local testing: run `pnpm prod:build` to create local `dist/`, but do not commit it.
- GitHub Actions: build from `main`, then publish generated `dist/` contents to the `dist` branch.

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
| Root directory | `/` |
| Build command | `pnpm install` |
| Start command | Same as the working `dist` setup |

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
4. Return to the ruleset and select `fast` and `full`.

The check names may appear as either `fast` and `full` or as `CI / fast` and `CI / full`, depending on the GitHub settings page.
