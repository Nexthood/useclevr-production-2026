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
- railpack.json provider format.
- dist/node_modules presence and pnpm symlink preservation.
- Generated output excludes source workspace metadata.
- Runtime start command and healthcheck path.
- Railway logs for build-phase or runtime-phase failure.

Runtime 502 checklist:
- Check startup logs.
- Check DATABASE_URL and AUTH_SECRET availability without printing secrets.
- Check database connectivity and SSL requirements.
- Check /api/health liveness and strict readiness behavior.
- Check fixed auth host variables only when strict host mode is required.

Validate:
- pnpm validate:dist
- pnpm prod:build when packaging can be affected
- HTTP healthcheck after deploy
```
