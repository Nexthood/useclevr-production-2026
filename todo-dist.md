# Dist Branch Deployment Todo

## Goal

Use `main` as the reviewed source branch, keep `beta` synced after releases, and publish generated
deployment output to the `dist` branch for Railway.

Railway should read from the `dist` branch and use `/dist` as its app root. The `dist` branch keeps
permanent branch-level files such as `.gitignore`, `README.md`, and any future branch-only metadata.
Only the generated `/dist` directory should be replaced by automation.

## Pending Tasks

### GitHub And Branch Rules

- [ ] Push the prepared migration commit to `beta`.
- [ ] Open a pull request from `beta` to `main`.
- [ ] Enable auto-merge on the `beta` to `main` pull request after the required check appears.
- [ ] Confirm the required `main` status check is `Validate source and production build`.
- [ ] Confirm the `dist` branch rules allow GitHub Actions to push generated commits.
- [ ] Enable force-push blocking on `dist` after confirming the non-force publish workflow succeeds.
- [ ] Keep pull request and status-check requirements disabled on `dist`.

### Railway

- [ ] Confirm Railway deploys from branch `dist`.
- [ ] Set Railway root directory to `/dist`.
- [ ] Confirm Railway installs runtime dependencies without committing `node_modules/`.
- [ ] Confirm Railway starts the generated server with `node server.js`, unless `railway.json`
      supplies the final command.
- [ ] Confirm runtime secrets exist only in Railway environment variables.
- [ ] Confirm the deployed app starts without rebuilding the full source app.

### Deployment Validation

- [ ] Let auto-merge merge the `beta` pull request into `main`.
- [ ] Confirm the branch maintenance workflow runs `Sync beta with main` before
      `Publish dist deployment folder`.
- [ ] Confirm `beta` receives the merge from `main`.
- [ ] Confirm the `dist` branch root files remain stable.
- [ ] Confirm only `/dist` changes on the `dist` branch.
- [ ] Confirm `node_modules/` is absent from `dist` branch commits.
- [ ] Confirm no committed file exceeds GitHub size limits.

## Working Notes

- Keep `node_modules/` out of Git.
- Let Railway install runtime dependencies and use Railway/Railpack caching.
- Publish generated standalone output and package manifests to `dist:/dist`.
- Do not add a dist-branch GitHub Action just to install dependencies.
- Add a dist-branch GitHub Action only if Railway must wait for an extra validation check before
  deploy.
- Prefer Railway starting the generated server from `/dist` instead of rebuilding the full Next.js
  source app.

## Additional Dist Migration Suggestions

- Keep the first non-force dist publish small and inspect the resulting `dist` branch before turning
  on stricter branch protection.
- Use Railway root directory `/dist` so root-level files on the deployment branch can stay permanent.
- Keep generated `dist/package.json` focused on runtime startup and migration needs only.
- Avoid a dist-branch workflow unless Railway requires a status check to wait on; otherwise the push
  to `dist` is enough to trigger deployment.
- If Railway build time becomes a problem, tune Railway/Railpack cache settings before considering
  committed dependency folders.
- Keep a rollback path by retaining normal commits on `dist`; reverting the previous deployment
  commit is cleaner than force-pushing a replacement branch.
- After the first successful Railway deploy, compare deploy logs for install time, start command, and
  migration command before changing the package contents further.
- Add a small generated-build manifest later if deployment debugging needs it. It can record the
  source branch, source commit, build time, and package-manager version without adding source code to
  the deployment branch.
- Keep database migration commands explicit in Railway. If migrations become slow or risky, split
  them into a separate Railway pre-deploy step instead of adding another GitHub publish stage.
- Do not copy `.env`, local upload files, cache folders, test fixtures, or reports into generated
  output. Treat `scripts/dist/create-dist.cjs` as the only assembly point.
- After two or three successful deployments, remove any temporary dist-branch force-push bypass from
  the ruleset and let GitHub Actions use normal commits only.
- If Railway can deploy directly from the generated standalone server, keep source files off `dist`.
  Copy source only for files that the runtime or migration tool demonstrably needs.
- If deployment size grows, inspect the largest files in the generated output before changing the
  strategy. Prefer pruning copied assets and package contents over committing installed dependencies.
- Keep the local testing command `pnpm prod:build` as the same command GitHub Actions uses, so local
  failures match CI failures.
