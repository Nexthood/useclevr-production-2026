# UseClevr TODO

## High Priority

### Documentation

- [x] Move technical guides into `docs/Developer_Guides/`.
- [x] Move flowcharts into `docs/Developer_Guides/Flowcharts/`.
- [x] Add separate `docs/User_Guides/` for user-facing docs.
- [x] Move project requirements into developer guides.
- [x] Replace troubleshooting folder with developer testing guide.
- [x] Split flowcharts into user-facing, production technical, and deployment charts.
- [x] Move TODO and future recommendation docs into root `.TODO/`.
- [x] Update docs links after folder changes.
- [x] Add Mermaid VS Code recommendation.
- [x] Move static files into `src/assets/` and serve them through `/assets/...`.
- [ ] Document API endpoints and request/response contracts.
- [ ] Create a user-facing product guide.

### Security Audit

- [ ] Review and remove production-facing debug logs.
- [ ] Check for exposed API keys, secrets, or real connection strings.
- [ ] Verify environment variables in Railway.
- [ ] Review authentication flow and protected route behavior.
- [ ] Check rate limiter behavior in the deployed environment.
- [ ] Verify security headers in `next.config.mjs`.
- [ ] Test authentication bypass scenarios.
- [ ] Review CORS and trusted host configuration.
- [ ] Review database queries for injection risks.
- [ ] Verify upload validation, including MIME type and file size handling.

### Production Stability

- [ ] Verify Railway deployment reaches the app shell.
- [ ] Verify `/api/health` returns quickly.
- [ ] Check Neon connection pooling and direct connection settings.
- [ ] Review memory usage in Railway runtime.
- [ ] Test cold start performance.

## Medium Priority

### Code Quality

- [ ] Remove unused imports and dependencies.
- [ ] Clean up dead code paths and old backup files.
- [ ] Add error boundaries to high-value React routes.
- [ ] Improve TypeScript types around analysis, forecasts, and reports.
- [ ] Add consistent loading and error states to async UI.

### Performance

- [ ] Review database query patterns for expensive dashboard/report flows.
- [ ] Add caching where data can be reused safely.
- [ ] Optimize image and static asset loading.
- [ ] Lazy-load heavy dashboard/report components where useful.
- [ ] Review production bundle size.

### Monitoring

- [ ] Add application error tracking.
- [ ] Define structured server logging conventions.
- [ ] Configure production health checks.
- [ ] Add basic performance metrics for upload, analysis, and report generation.

## Low Priority

### Product Features

- [ ] Add OAuth providers if required by the product roadmap.
- [ ] Implement email notifications.
- [ ] Add webhook support.
- [ ] Create API rate limiting per user.
- [ ] Add multi-workspace support.

### Testing

- [ ] Add unit tests for pure utilities and data transforms.
- [ ] Add integration tests for high-value API routes.
- [ ] Add E2E tests for upload, analyze, and report flows.
- [ ] Set up CI test gates once the baseline is stable.

## Completed

- [x] Remove Railway debug endpoint for homepage HTML.
- [x] Update runtime target from Node.js 20 to Node.js 22.
- [x] Update npm dependencies.
- [x] Create original system flowchart.
- [x] Add docs landing page and refresh onboarding docs.
