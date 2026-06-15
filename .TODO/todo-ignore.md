# Ignored TODO

This retired queue stores deliberate no-fix decisions with rationale.

Use plain labeled bullets here. Assign a T-number from `.TODO/config.json` only when restoring work
to the active queue.

- [TODO-next.md](todo-next.md) (labels: todo)
- [TODO-done.md](todo-done.md) (labels: todo)
- [TODO-ignore.md](todo-ignore.md) (labels: todo)
- [TODO-future.md](todo-future.md) (labels: todo)
- [.TODO/config.json](config.json) (labels: todo)

## Label: ai

- Test AI chat using uploaded dataset context. (labels: ai, data, upload, testing)

## Label: auth

- Test login, signup, logout, and session refresh. (labels: auth, testing)
- Test admin/superadmin access. (labels: auth, testing)

## Label: billing

- Do not replace app auth, billing, datasets, reports, tickets, AI traces, workspaces, or business records with Payload collections; use Payload for public content and superadmin operator views over existing application stores. (labels: billing, auth, ai, dashboard)
- Test subscription access limits. (labels: billing, testing)

## Label: business

- Do not present tax, legal, insurance, or financing outputs as professional advice; label them as estimates, user-provided values, or professional-verification items. (labels: business, content, workflow)
- Add unit test coverage >90% for all business logic and utility functions. (labels: business, testing)

## Label: ci-build

- Do not build Business Profile as an ERP, accounting ledger, payroll system, policy-management system, or lending platform; keep it as SME business-intelligence setup context. (labels: ci-build, business, data, upload)

## Label: data

- Retire `.TODO/todo-analysis.md` — detailed codebase analysis folded into regular TODO queue. Items already addressed by prior tasks; remaining findings moved to todo-next.md and todo-future.md. (labels: data, todo, workflow)
- Test dataset upload with normal CSV. (labels: data, upload, testing)
- Test dataset upload with bad/dirty CSV. (labels: data, upload, testing)
- Test dataset generation after upload. (labels: data, upload, testing)

## Label: deployment

- Review database migrations as a separate job while the app has one web service and migrations can run in the target runtime pre-deploy phase. (labels: deployment, data, workflow)
- Review server-host templates under build scripts; they are host templates, not executable build scripts. (labels: deployment, ci-build, dashboard, ui)
- Do not commit `node_modules/` to the dist branch; Railway installs runtime dependencies. (labels: deployment, workflow)
- Avoid separate dist-specific TODO files after the dist deployment path succeeds and folds into the regular queues. (labels: deployment, data, upload, todo)
- Ensures reproducible builds for production and test builds. (labels: deployment, ci-build, testing, workflow)
- Verify /api/health returns OK after every deploy. (labels: deployment, api)
- Verify Railway production starts from a fresh deploy. (labels: deployment, workflow)
- Check runtime logs after deploy, not only build logs. (labels: deployment, ci-build)
- Run production smoke test before each main deploy. (labels: deployment, ci-build, testing, workflow)

## Label: payment

- Test Stripe checkout from pricing page and billing page. (labels: payment, billing, testing, workflow)
- Test Stripe webhook delivery and subscription status update. (labels: payment, billing, api, testing)
- Test failed payment / unpaid subscription handling. (labels: payment, billing, testing)

## Label: testing

- Extract duplicated utility functions into shared modules with comprehensive unit tests. (labels: testing, workflow)
- Implement feature flags system for gradual rollouts and A/B testing. (labels: testing)
- Add dependency injection container for better testability and loose coupling. (labels: testing, workflow)
- Implement comprehensive integration tests covering critical user journeys. (labels: testing, workflow)
- Add mutation testing to evaluate test suite effectiveness. (labels: testing, quality)
- Implement performance regression testing in CI pipeline. (labels: testing, performance)

## Label: workflow

- Accept tsconfig `target: "ES6"` — Next.js handles transpilation internally; changing target has no practical effect on output. (labels: workflow)
- Confirm all pages show the same pricing. (labels: workflow)
- Implement feature flag system for gradual rollouts and A/B testing in production. (labels: workflow, testing)
- Create automated database migration testing in CI pipeline. (labels: workflow, testing, data)

## Label: security

- Implement SQL injection prevention using parameterized queries and input validation for all database operations. (labels: security, data, testing, workflow)
- Implement proper CORS configuration with strict origin validation. (labels: security, testing, workflow)
- Implement JWT token rotation and refresh token invalidation on password change. (labels: security, testing)
- Add password breach detection using HaveIBeenPwned API during registration and password change. (labels: security, api)

## Label: mcp

## Additional

- Add distributed tracing with OpenTelemetry for all service interactions. (labels: monitoring, observability)
- Implement custom metrics collection for business KPIs and system performance. (labels: monitoring, metrics)
- Add log aggregation and structured logging for all application components. (labels: monitoring, logging)
- Create a branch management guide documenting the deploy circulation loop, who pushes where, and how to unblock a failed publish. (labels: workflow, docs, deployment)
- Implement automated stale branch cleanup that deletes merged feature branches and warns about abandoned beta branches after 14 days. (labels: workflow, devops, deployment)
