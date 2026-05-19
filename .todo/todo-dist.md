# Dist Migration Tasks

## Completed

- Clean the `dist` branch root so permanent branch files stay separate from generated `/dist` output.
- Make Railway install and run from the generated `/dist` package instead of rebuilding source on the deployment branch.
- Keep the source generator aligned with the published `dist` branch runtime package and Railway config.
- Add local runtime env loading from the parent of the Git checkout so one local env file can serve `main`, `beta`, and `dist` checkouts.

## Next Suggestions

- Confirm Railway watches the `dist` branch with `/dist` as the service root and waits for GitHub Actions before deploying.
- Remove or disable any older Railway service still deploying from `main` if it continues to report failed statuses.
- Add a small smoke-check action on the `dist` branch that runs `cd dist && pnpm install && PORT=8080 pnpm start` against `/api/health`.
- Decide whether database migrations should stay in Railway `preDeployCommand` or move to a separate controlled migration job.
- Keep `node_modules/` out of the deployment branch and rely on Railway/pnpm caching; committing installed dependencies would create large, noisy deploy commits.
- Add a published-dist manifest file with the source commit SHA, build timestamp, Node version, pnpm version, and healthcheck path for quick deploy audits.
- Add a Railway environment checklist for required account-backed services: Neon, Gemini, Stripe, upload storage, and Railway project/service IDs.
- Consider a two-service Railway setup only if background jobs or migrations need isolation; keep the web service focused on `node server.js`.
- Keep a manual rollback note: revert the latest `dist` branch commit or redeploy a previous Railway deployment, rather than rebuilding from a local machine.
