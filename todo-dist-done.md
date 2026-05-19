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
- [x] Kept `node_modules/` and build caches out of the published deployment branch.
- [x] Updated developer docs, requirements, changelog, and agent guidance with the current deployment
      workflow.

## Result

Source branches now stay source-only. GitHub Actions builds generated output from `main`, syncs
`beta`, publishes only `dist:/dist`, and leaves Railway to install runtime dependencies with its own
cache.
