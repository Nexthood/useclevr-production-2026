# Railway Deploy Review Prompt

Use this prompt for Railway deployment, dist branch, dist-test branch, generated output, and healthcheck work.

```text
Review Railway deploy for the requested source and deployment branch pair.

Branch scope:
- Test deploy uses beta as source and dist-test as deployment branch.
- Production deploy uses main as source and dist as deployment branch.
- Do not inspect or trigger live production when the request names test deploy only.

Check:
- GitHub Actions latest runs for the relevant branch.
- Generated deployment config under dist-root/server-config.
- Railway config path and service root.
- Test service uses test.useclevr.com and production service uses app.useclevr.com.
- Test service variables stay separate from production variables.
- Stripe test mode is used for test deploys and live Stripe keys stay production-only.
- railpack.json provider format.
- dist/node_modules presence and pnpm symlink preservation.
- Generated output excludes source workspace metadata.
- Generated output excludes environment files, caches, and forbidden generated-branch files.
- Runtime start command and healthcheck path.
- Railway logs for build-phase or runtime-phase failure.

Runtime 502 checklist:
- Check startup logs.
- Check DATABASE_URL and AUTH_SECRET availability without printing secrets.
- Check database connectivity and SSL requirements.
- Check /api/health liveness and strict readiness behavior.
- Check fixed auth host variables only when strict host mode is required.

CLI deploy status:
- Use pnpm railway:login to verify auth
- Use pnpm railway:status to check project connectivity
- Use railway deployment list to list recent deployments with statuses
- Use pnpm railway:logs to view deploy/runtime logs
- Do NOT hand-craft Railway GraphQL API queries — use the wrapper at scripts/server/railway/railway.cjs instead

CLI deploy history cleanup:
- Use `pnpm railway:cleanup` only when the user explicitly requests removal of every deployment in
  every service and environment in the linked project.
- Treat cleanup as a bulk destructive operation even though Railway keeps `REMOVED` history entries.
- Use the project wrapper instead of direct GraphQL or hand-built API requests.
- Railway has no permanent deployment-history deletion API.

Validate:
- pnpm validate:dist
- pnpm prod:build when packaging can be affected
- HTTP healthcheck after deploy
- Sign-in, protected dashboard access, dataset upload, dataset table, AI analysis, and reports/downloads on the requested service
```
