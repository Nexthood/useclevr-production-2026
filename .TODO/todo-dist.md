# Dist Branch Deployment Todo

## Goal

Keep `main` as the reviewed source branch, keep `beta` synced for test work, and publish generated
deployment output to the `dist` branch for Railway.

Railway must deploy from branch `dist` with `/dist` as the service root. The `dist` branch root keeps
only permanent branch files such as `.gitignore` and `README.md`; deployment config lives inside
`/server-config`.

## Remaining Tasks

### Railway

- [x] Confirm Railway deploys from branch `dist`.
- [x] Confirm Railway root directory is `/dist`.
- [x] Remove or disable any older Railway service still deploying from `main` if it continues to report failed statuses.
- [x] Confirm runtime secrets exist only in Railway environment variables.

### Deployment Validation

- [ ] Confirm the next `beta` to `main` merge publishes a fresh `dist:/dist` folder.
- [ ] Confirm only `/dist` changes on the `dist` branch after publish.

These checks intentionally stay open until the next real merge. Local validation now passes:
`pnpm validate:dist`, `pnpm build`, and `pnpm build:prod`.

## Migration Notes

- Keep server-host templates in `dist-root/server-config/` with platform-native filenames;
  if Railway, Vercel, or Docker targets diverge, keep one folder per destination.
- Keep `scripts/package-dist/create-dist.cjs` as the only assembly point for generated output.
- Keep `node_modules/` out of Git and rely on Railway Nixpacks plus pnpm caching.
- Keep pull request titles short and prefixed with `PR:` because the dist publish commit uses the PR
  title.
- Keep local generated-output starts as the default `npm run start`, and reserve named commands such
  as `npm run start:railway` and `npm run start:vercel` for server target parity testing.

## Suggestions And Questions

- [ ] Measure Railway build memory and local `pnpm prod:build` peak memory after the next publish.
- [ ] Add a small CI assertion that generated `/dist` contains `nixpacks.toml` and does not contain
      `pnpm-workspace.yaml`, `railway.json`, or `vercel.json`.
- [ ] Decide whether generated `/dist/nixpacks.toml` should stay copied from
      `dist-root/server-config/nixpacks.toml` or move to a Railway-supported config path if Railway
      adds one for service-root-relative Nixpacks config.
- [ ] Review whether dist branch history should keep exactly two commits or use tags/releases for
      longer deployment audit history.
- [ ] Confirm whether Vercel remains a live deployment target or only a documented fallback.

## Future

- [ ] Track Railway's Nixpacks support status. If Railway deprecates Nixpacks in favor of Railpack,
      re-test Railpack with Corepack pnpm and remove the old `mise install` failure path.
- [ ] Add a Docker deployment option if Nixpacks and Railpack both create unstable install behavior.
- [ ] Split database migrations into a separate job only if migration duration, lock risk, or
      background work makes the single web-service pre-deploy phase unsafe.
