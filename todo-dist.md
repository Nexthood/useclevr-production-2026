# Dist Branch Deployment Todo

## Goal

Use `main` as the source branch, keep `beta` synced after releases, and publish generated deployment
output to the `dist` branch for Railway.

Railway should read from the `dist` branch and use the `/dist` folder as its app root. The `dist`
branch should keep permanent branch-level files such as `.gitignore`, `README.md`, and any future
branch-only metadata, while the generated `/dist` directory is replaced from the latest `main` build.

## Current Recommendation

- Keep `node_modules/` out of Git.
- Let Railway install runtime dependencies and use Railway/Railpack caching.
- Publish generated standalone output and package manifests to `dist:/dist`.
- Do not add a dist-branch GitHub Action just to install dependencies.
- Add a dist-branch GitHub Action only if Railway must wait for an extra validation check before deploy.
- Prefer Railway starting the generated server from `/dist` instead of rebuilding the full Next.js source app.

## Target Flow

1. A pull request merges into `main`.
2. GitHub Actions runs source validation.
3. GitHub Actions syncs `beta` with `main`.
4. GitHub Actions builds the deployable output from `main`.
5. GitHub Actions updates only `/dist` on the `dist` branch.
6. Railway deploys from the `dist` branch with root directory `/dist`.

## Branch Rules

- [ ] Keep only `main`, `beta`, and `dist` branches locally and on origin.
- [ ] Keep `main` protected with required checks.
- [ ] Keep `dist` protected against deletion.
- [ ] Allow force push to `dist` only if the publish strategy still replaces branch history.
- [ ] Prefer a non-force publish once `/dist` can be updated without replacing branch-level files.
- [ ] Do not require pull requests or status checks on `dist`.

## Source Branch Ignore Rules

- [ ] Ignore local `dist/` output on source branches.
- [ ] Confirm `.gitignore` on `main` and `beta` contains `dist/`.
- [ ] Confirm local testing still works with `pnpm prod:build`.
- [ ] Confirm generated output is never committed to `main` or `beta`.

## Workflow Structure

- [ ] Combine branch maintenance into one workflow triggered by pushes to `main`.
- [ ] Run `sync-beta` first.
- [ ] Run `publish-dist` after `sync-beta` succeeds.
- [ ] Keep `publish-dist` separate from validation jobs so validation remains clear and branch rules
      can require source-focused checks only.
- [ ] Use descriptive job names:
  - `Validate source and production build`
  - `Sync beta with main`
  - `Publish dist deployment folder`

## Dist Branch Layout

- [ ] Change the `dist` branch from "deployment files at branch root" to "deployment files in `/dist`".
- [ ] Keep branch-level files persistent:
  - `.gitignore`
  - `README.md`
  - optional `.github/` files if a dist-branch workflow is ever needed
- [ ] Replace only the generated `/dist` directory during publish.
- [ ] Do not delete branch-level dotfiles during publish.
- [ ] Confirm the branch-level README says the branch is generated and should not be merged into source branches.

## Publish Strategy

- [ ] Build from source on `main` using `pnpm prod:build`.
- [ ] Move the generated local `dist/` output into a temporary folder.
- [ ] Checkout the existing `dist` branch.
- [ ] Delete only the tracked `/dist` directory on the `dist` branch.
- [ ] Copy the new build output into `/dist`.
- [ ] Preserve permanent root files on the `dist` branch.
- [ ] Commit the `/dist` update with a message that includes the source `main` SHA.
- [ ] Push to `dist`.
- [ ] Avoid `git checkout --orphan` unless the branch must be recreated from scratch.
- [ ] Never commit `node_modules/` to the `dist` branch.
- [ ] Confirm the publish step removes dependency folders and caches before committing:
  - `dist/node_modules/`
  - `dist/.next/cache/`
  - `dist/.cache/`
  - `dist/cache/`
- [ ] Keep the Git payload small enough for GitHub by publishing build output and manifests, not installed dependencies.
- [ ] Let Railway install runtime dependencies and use its own install/build cache.

## Dependency And Cache Strategy

- [ ] Do not use Git as a dependency cache.
- [ ] Do not publish CI-built `node_modules/`; native packages can be platform-specific and may not match Railway.
- [ ] Use Railway/Railpack caching for dependency installs.
- [ ] Keep generated `/dist/package.json` as small as practical.
- [ ] Include only runtime dependencies needed by the generated standalone server.
- [ ] Include deploy-time tools such as `drizzle-kit` only if Railway still runs migrations from `preDeployCommand`.
- [ ] Prefer `pnpm install --prod` or Railway's equivalent production install when the generated app does not need dev dependencies.
- [ ] Keep generated package manager metadata compatible with Railway's available pnpm version.
- [ ] Confirm `.gitignore` on the `dist` branch excludes:

```gitignore
node_modules/
.next/cache/
.cache/
cache/
*.log
```

## Railway Configuration

- [ ] Confirm Railway project deploys from branch `dist`.
- [ ] Set Railway root directory to `/dist`.
- [ ] Confirm Railway build command for `dist` branch.
- [ ] Confirm Railway start command points at the generated server entry inside `/dist`.
- [ ] Prefer Railway installing runtime dependencies and starting the generated server, not rebuilding Next.js from source.
- [ ] Decide whether Railway should run `pnpm install --prod`, `pnpm install`, or the Railpack equivalent.
- [ ] Avoid any Railway command that creates and commits or depends on committed `node_modules/`.
- [ ] Keep runtime secrets only in Railway.
- [ ] Confirm `.env` files are never copied into `/dist`.

## Build Output Questions

- [ ] Confirm whether Railway needs a full standalone Next.js server in `/dist`.
- [ ] Confirm whether the generated `server.js` and `.next/` output are sufficient without rebuilding on Railway.
- [ ] Confirm whether `drizzle-kit` must remain in the generated `dist/package.json` for `preDeployCommand`.
- [ ] Confirm whether `pnpm exec drizzle-kit push` should run from the `/dist` root or from another deployment phase.
- [ ] Confirm whether package manager metadata in generated `dist/package.json` should avoid Railway pnpm version conflicts.

## Dist-Branch GitHub Action Question

- [ ] Decide whether the `dist` branch needs its own GitHub Action.
- [ ] If Railway already waits for the `dist` branch push, avoid adding a dist-branch Action.
- [ ] If a dist-branch Action is needed, use it only for validation or lightweight prep, not for publishing `node_modules/`.
- [ ] If Railway is configured to wait for a dist-branch Action, ensure that Action finishes before Railway deploys.
- [ ] Do not add a dist-branch Action that rebuilds source code unless the source files are intentionally present on `dist`.
- [ ] Do not add a dist-branch Action just to install dependencies; Railway should handle dependency install and caching.

## Validation Plan

- [ ] Open a PR from `beta` to `main` with workflow changes.
- [ ] Confirm required `main` checks pass.
- [ ] Merge into `main`.
- [ ] Confirm `sync-beta` runs before `publish-dist`.
- [ ] Confirm `beta` receives the merge from `main`.
- [ ] Confirm `dist` branch root files remain stable.
- [ ] Confirm only `/dist` changes on the `dist` branch.
- [ ] Confirm `node_modules/` is absent from `dist` branch commits.
- [ ] Confirm no committed file exceeds GitHub size limits.
- [ ] Confirm Railway deploys from `dist:/dist`.
- [ ] Confirm the deployed app starts without rebuilding source.

## Notes

- `main` and `beta` are source branches.
- `dist` is generated deployment output.
- Local `dist/` is for testing only.
- Railway should not require source files from `main` once it deploys from `dist:/dist`.
- If the generated standalone server is complete, Railway should not need a full Next.js source build.
- Large dependency folders belong in Railway's install cache, not in Git.
- A dist-branch GitHub Action can be useful for checks, but it should not prepare or commit `node_modules/`.
