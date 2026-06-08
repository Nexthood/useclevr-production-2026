# Ignored TODO

This retired queue stores deliberate no-fix decisions with rationale.

Get the T-number from `.TODO/config.json` before adding new tasks. Keep task numbers stable when
moving work between states.

## Links

- [TODO-next.md](todo-next.md)
- [TODO-done.md](todo-done.md)
- [TODO-ignore.md](todo-ignore.md)
- [TODO-future.md](todo-future.md)
- [.TODO/config.json](config.json)

## Label: ai

- T-482. Test AI chat using uploaded dataset context. (labels: ai, data, upload, testing)

## Label: auth

- T-479. Test login, signup, logout, and session refresh. (labels: auth, testing)
- T-484. Test admin/superadmin access. (labels: auth, testing)

## Label: billing

- T-199. Do not replace the current app, auth, billing, datasets, reports, tickets, AI traces, workspaces, or business records with Payload CMS; keep Payload limited to a future editable-content layer. (labels: billing, auth, ai, dashboard)
- T-485. Test subscription access limits. (labels: billing, testing)

## Label: business

- T-523. Do not present tax, legal, insurance, or financing outputs as professional advice; label them as estimates, user-provided values, or professional-verification items. (labels: business, content, workflow)
- T-635. Add unit test coverage >90% for all business logic and utility functions. (labels: business, testing)

## Label: ci-build

- T-522. Do not build Business Profile as an ERP, accounting ledger, payroll system, policy-management system, or lending platform; keep it as SME business-intelligence setup context. (labels: ci-build, business, data, upload)

## Label: data

- T-452. Retire `.TODO/todo-analysis.md` — detailed codebase analysis folded into regular TODO queue. Items already addressed by prior tasks; remaining findings moved to todo-next.md and todo-future.md. (labels: data, todo, workflow)
- T-480. Test dataset upload with normal CSV. (labels: data, upload, testing)
- T-481. Test dataset upload with bad/dirty CSV. (labels: data, upload, testing)
- T-483. Test dataset generation after upload. (labels: data, upload, testing)

## Label: deployment

- T-200. Review database migrations as a separate job while the app has one web service and migrations can run in the target runtime pre-deploy phase. (labels: deployment, data, workflow)
- T-201. Review server-host templates under build scripts; they are host templates, not executable build scripts. (labels: deployment, ci-build, dashboard, ui)
- T-202. Do not commit `node_modules/` to the dist branch; Railway installs runtime dependencies. (labels: deployment, workflow)
- T-203. Avoid separate dist-specific TODO files after the dist deployment path succeeds and folds into the regular queues. (labels: deployment, data, upload, todo)
- T-454. Ensures reproducible builds for production and test builds. (labels: deployment, ci-build, testing, workflow)
- T-473. Verify /api/health returns OK after every deploy. (labels: deployment, api)
- T-474. Verify Railway production starts from a fresh deploy. (labels: deployment, workflow)
- T-475. Check runtime logs after deploy, not only build logs. (labels: deployment, ci-build)
- T-487. Run production smoke test before each main deploy. (labels: deployment, ci-build, testing, workflow)

## Label: payment

- T-476. Test Stripe checkout from pricing page and billing page. (labels: payment, billing, testing, workflow)
- T-477. Test Stripe webhook delivery and subscription status update. (labels: payment, billing, api, testing)
- T-486. Test failed payment / unpaid subscription handling. (labels: payment, billing, testing)

## Label: testing

- T-618. Extract duplicated utility functions into shared modules with comprehensive unit tests. (labels: testing, workflow)
- T-625. Implement feature flags system for gradual rollouts and A/B testing. (labels: testing)
- T-629. Add dependency injection container for better testability and loose coupling. (labels: testing, workflow)
- T-636. Implement comprehensive integration tests covering critical user journeys. (labels: testing, workflow)
- T-699. Add mutation testing to evaluate test suite effectiveness. (labels: testing, quality)
- T-700. Implement performance regression testing in CI pipeline. (labels: testing, performance)

## Label: workflow

- T-453. Accept tsconfig `target: "ES6"` — Next.js handles transpilation internally; changing target has no practical effect on output. (labels: workflow)
- T-478. Confirm all pages show the same pricing. (labels: workflow)
- T-717. Implement feature flag system for gradual rollouts and A/B testing in production. (labels: workflow, testing)
- T-719. Create automated database migration testing in CI pipeline. (labels: workflow, testing, data)

## Label: security

- T-607. Implement SQL injection prevention using parameterized queries and input validation for all database operations. (labels: security, data, testing, workflow)
- T-611. Implement proper CORS configuration with strict origin validation. (labels: security, testing, workflow)
- T-613. Implement JWT token rotation and refresh token invalidation on password change. (labels: security, testing)
- T-616. Add password breach detection using HaveIBeenPwned API during registration and password change. (labels: security, api)

## Label: mcp

- T-810. Add MCP endpoint at subdomain root (e.g., `mcp.useclevr.com/` serves `/api/mcp` without redirect) when MCP becomes an external customer-facing service. (labels: mcp, deployment, api)

## Additional

- T-689. Add distributed tracing with OpenTelemetry for all service interactions. (labels: monitoring, observability)
- T-690. Implement custom metrics collection for business KPIs and system performance. (labels: monitoring, metrics)
- T-691. Add log aggregation and structured logging for all application components. (labels: monitoring, logging)
