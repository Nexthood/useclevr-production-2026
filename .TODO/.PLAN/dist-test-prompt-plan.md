# Dist-Test Branch Prompt Plan

Status: planning only. Do not create branches, publish generated output, change Railway services, or
touch DNS until this plan is explicitly approved for execution.

## Prompt for Agent

Set up and validate deployment to `test.useclevr.com` using a Railway link to the `dist-test` branch.

**Tasks:**

1. Review source-of-truth deployment files and document required changes before editing.
2. Add a test publish path that builds from `beta` or manual dispatch and publishes generated output
   to `dist-test` under `/dist`.
3. Keep the production publish path unchanged: `main` publishes generated output only to `dist`.
4. Validate shared deployment config with `node ./scripts/server/railway/sync-config.cjs --check`.
5. Generate `dist/` locally with `pnpm prod:build` before any branch publish attempt.
6. Verify Railway test service settings: branch `dist-test`, root directory `/dist`, domain
   `test.useclevr.com`, and test-specific environment variables.
7. Validate core test endpoints after deploy: `/api/health`, auth entry points, dataset list/upload,
   dashboard shell, and report generation.
8. Report deployment status, DNS state, environment differences, and any follow-up config changes.

## Execution Phases

### Phase 0 - Planning Gate

- Confirm this plan is approved for execution.
- Confirm whether `dist-test` should use a dedicated GitHub Actions workflow or a parameterized
  existing publish workflow.
- Confirm Railway has a separate test service before adding branch publish automation.
- Confirm test service environment variables exist outside the repository.

### Phase 1 - Source Workflow Changes

- Add the test publish flow without changing production publish behavior.
- Guard production publish so only `main` can publish `dist`.
- Guard test publish so only `beta` or manual dispatch can publish `dist-test`.
- Add pre-push size and ignore checks for generated deployment output.

### Phase 2 - Generated Branch Rules

- Treat `dist` and `dist-test` as generated deployment branches only.
- Keep permanent branch-root files sourced from `dist-root`.
- Publish app runtime files inside `/dist`.
- Do not commit `.env`, `node_modules`, `.next/cache`, or oversized files.

### Phase 3 - Railway And Domain Validation

- Configure Railway test service to branch `dist-test` and root `/dist`.
- Add `test.useclevr.com` as a Railway custom domain and create the provider DNS record Railway
  supplies.
- Keep production domain and production Railway service untouched.
- Verify test service uses test-safe provider keys, especially billing keys.

### Phase 4 - Smoke Test

- Check `/api/health`.
- Check sign-in and protected dashboard access.
- Upload a small dataset and load the datasets table.
- Run analysis and open Reports & Downloads.
- Review Railway logs for test-service errors.

[additional]

Create a safe test deployment setup for UseClevr using Railway and a new GitHub deployment branch.

Goal:
Set up a separate test deployment at test.useclevr.com using a new generated deployment branch called dist-test.

Current architecture:
- beta = active development branch
- main = stable source branch
- dist = production generated deployment branch
- Railway production deploys from dist branch, /dist folder
- Generated deploy output lives inside /dist on the deployment branch
- dist-root contains permanent root files copied into deployment branches

Required new setup:
- Add support for dist-test branch
- test.useclevr.com should point to Railway test service
- Railway test service should deploy from:
  Branch: dist-test
  Root Directory: /dist
- Production should continue using:
  Branch: dist
  Root Directory: /dist
- Do not break production dist publishing
- Do not change app UI or app logic

Workflow requirements:
1. Keep existing production publish flow:
   main → build → publish generated output to dist branch /dist folder

2. Add test publish flow:
   beta or manual workflow trigger → build → publish generated output to dist-test branch /dist folder

3. The dist-test branch must be generated like dist:
   - clean generated history if possible
   - app files copied into /dist
   - branch root keeps permanent files from dist-root
   - no secrets or .env files committed
   - no node_modules committed
   - no .next/cache committed
   - no pnpm-workspace.yaml committed if it breaks Railway pnpm install
   - large files over GitHub limit must fail the workflow before push

4. dist-root must support both deployment branches:
   - production dist
   - test dist-test
   It should contain reusable root-level files such as:
   - .gitignore
   - README.md
   - optional Railway notes
   Do not hardcode production-only text if it is also used by dist-test.
   Update README text so it says the branch may be generated for production or test deployment.

5. Railway config:
   - Ensure generated /dist contains railway.json
   - railway.json must work for both production and test service
   - Start command should remain compatible with standalone Next.js:
     node .next/standalone/server.js
   - If pnpm is required in Railway build/predeploy, use Corepack:
     corepack enable && corepack prepare pnpm@11.1.2 --activate
   - Do not rely on local disk for persistent media/uploads.

6. Domain:
   - test.useclevr.com will be configured in Railway as custom domain on the test service.
   - DNS should be added at the domain provider as CNAME or the exact record Railway gives.
   - Do not change nameservers unless explicitly required.
   - Do not change production domain config.

7. Environment variables:
   - Do not commit env files.
   - Test Railway service should have its own env vars copied/adjusted from production.
   - NEXT_PUBLIC_SERVER_URL or equivalent should point to https://test.useclevr.com for test service.
   - Stripe test/live keys must not be mixed accidentally.
   - If Stripe is used in test service, prefer Stripe test mode keys.

8. Safety:
   - dist-test must never be merged into main.
   - dist and dist-test are generated deployment branches only.
   - main and beta remain source branches.
   - GitHub Actions should guard production publish so it only publishes to dist from main.
   - GitHub Actions should guard test publish so it only publishes to dist-test from beta or manual workflow dispatch.
   - Do not publish production dist from beta.
   - Do not publish test dist from main unless explicitly manual.

9. Documentation:
   Update or create a short doc explaining:
   - main → dist = production deploy
   - beta/manual → dist-test = test deploy
   - Railway production uses dist /dist
   - Railway test uses dist-test /dist
   - test.useclevr.com DNS setup
   - dist-root shared purpose
   - dist and dist-test should never be merged back into source branches

Acceptance criteria:
- Production dist workflow still works
- New dist-test workflow works
- dist-test branch contains /dist deploy folder
- dist-test branch root contains shared dist-root files
- No node_modules, .next/cache, .env, or invalid pnpm-workspace.yaml are published
- Railway test service can deploy from dist-test /dist
- test.useclevr.com can be connected as Railway custom domain
- No unrelated refactor or UI change

## Non-Goals

- Do not execute the deploy during plan review.
- Do not merge `dist-test` into `main`, `beta`, or `dist`.
- Do not change production Railway service settings.
- Do not add app UI changes as part of the dist-test setup.
