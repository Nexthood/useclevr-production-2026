# Dist Branch Deployment Done

## Completed

- [x] Kept the active branch model focused on `main`, `beta`, and `dist`.
- [x] Replaced separate fast/full CI language with one required source check:
      `Validate source and production build`.
- [x] Documented the beta test flow: push to `beta`, open a pull request to `main`, then merge after
      checks pass.
- [x] Updated source-branch ignore rules so local `dist/` output is not committed from `main` or
      `beta`.
- [x] Removed tracked generated `dist/` files from source control while leaving the local folder
      available for testing.
- [x] Updated branch maintenance automation so `beta` sync runs before publishing deployment output.
- [x] Changed the publish strategy from orphan force-push replacement to updating only `/dist` on the
      existing `dist` branch.
- [x] Preserved root-level `dist` branch files such as `.gitignore` and `README.md`.
- [x] Removed root-level generated framework files from the `dist` branch.
- [x] Kept `railway.json` out of the `dist` branch root and inside the generated `/dist` folder.
- [x] Confirmed the deployment branch root has no `railway.json`; only `/dist/railway.json` is used.
- [x] Removed the duplicate `dist-root/railway.json` source so generated Railway config has one
      source of truth.
- [x] Kept `node_modules/` and build caches out of the published deployment branch.
- [x] Generated `/dist/pnpm-workspace.yaml` so Railway can run approved pnpm dependency build scripts
      during install.
- [x] Confirmed generated installs pass locally with pnpm build approvals and without committing
      `node_modules/`.
- [x] Added parent-checkout env loading for local production starts across `main`, `beta`, and `dist`
      checkouts.
- [x] Chose Railway `preDeployCommand` for database migrations during this phase, with separate
      migration jobs deferred until isolation is actually needed.
- [x] Renamed `ci-settings/` to `server-settings/` so server-host templates are not confused
      with GitHub Actions workflow files.
- [x] Moved Railway helper scripts under `scripts/server/railway/`, separating server-specific
      deployment helpers from local/general scripts.
- [x] Renamed the dist packaging script folder to `scripts/package-dist/` so it is not blocked by the
      `dist/` ignore rule.
- [x] Consolidated all todo files into the root `.TODO/` folder, including main queue, next backlog,
      dist migration, and dist completion notes.
- [x] Moved Railway deployment templates into `server-settings/railway/` so future hosts can use
      their own target subfolders.
- [x] Hardened Railway install against `pnpm approve-builds` failures with generated approvals and a
      build-command config override.
- [x] Hardened Railway pre-deploy against old npm command overrides by generating
      `railway:predeploy`, `db:push`, and `db:migrate` scripts that run through pnpm.
- [x] Moved dist lockfile generation before final publish cleanup so `pnpm install --lockfile-only`
      cannot leave large local dependency links in the staged deployment branch.
- [x] Removed root-level build workspace leftovers after orphan checkout so `.next/cache` and
      root `node_modules` cannot trip the dist publish size gate.
- [x] Disabled optional dependency installs in the generated Railway runtime package so Next.js SWC
      compiler binaries are not pulled during deploy installs.
- [x] Updated dist publish commits to use the merged PR title, with `PR:` enforced and long source
      commit ids removed from normal dist commit titles.
- [x] Updated developer docs, requirements, changelog, and agent guidance with the current deployment
      workflow.
- [x] Split generated production start commands by target so local starts use localhost auth defaults
      and Railway keeps its `0.0.0.0` host binding.
- [x] Added Vercel source-branch deploy settings alongside Railway generated-output settings.
- [x] Aligned deploy scripts and docs with the current `dist-root/server-settings/` template path.
- [x] Added a dist publish guard that fails if `railway.json` is missing from `/dist` or appears at
      the deployment branch root.
- [x] Added a source-cleanliness guard to the dist publish job so type validation, dist config
      validation, and lint must pass before generated output is published.

## Result

Source branches now stay source-only. GitHub Actions builds generated output from `main`, syncs
`beta`, publishes only `dist:/dist`, and leaves Railway to install runtime dependencies with its own
cache and the generated pnpm build approvals.
