# Active TODO Queue

This file is the only active queue. Add confirmed implementation work here before it starts.

Get the T-number from `.TODO/config.json` before adding new tasks. Keep task numbers stable when
moving work between states.

## Links

- [TODO-next.md](todo-next.md)
- [TODO-done.md](todo-done.md)
- [TODO-ignore.md](todo-ignore.md)
- [TODO-future.md](todo-future.md)
- [.TODO/config.json](config.json)

## Label: business

- T-628. Implement domain-driven design with clear bounded contexts for business logic. (labels: business, workflow)
- T-630. Implement CQRS pattern for read/write operations separation in complex business domains. (labels: business, workflow)

## Label: ci-build

- T-622. Add bundle analysis to CI pipeline to monitor and reduce JavaScript bundle size. (labels: ci-build, data, performance)
- T-680. Set NEXT_PUBLIC_APP_VERSION env var for version display. (labels: ci-build, deployment)
- T-705. Add build metadata to Docker image labels for traceability. (labels: ci-build, deployment)
- T-682. Implement automated dependency security scanning in CI pipeline. (labels: ci-build, security)

## Label: data

- T-615. Implement input sanitization for all user-provided data displayed in HTML contexts. (labels: data, workflow)
- T-634. Implement repository pattern for data access abstraction. (labels: data, workflow)
- T-683. Add data validation middleware for all API endpoints using Zod schemas. (labels: data, api, workflow)
- T-684. Implement database connection pooling with automatic retry logic. (labels: data, performance)

## Label: deployment

- T-624. Add centralized error reporting with contextual information for production debugging. (labels: deployment, reports, workflow)
- T-685. Add health check endpoints for all external service dependencies. (labels: deployment, monitoring)
- T-686. Implement blue-green deployment strategy for zero-downtime releases. (labels: deployment, devops)

## Label: docs

- T-626. Add comprehensive JSDoc documentation for all public APIs and complex functions. (labels: docs, workflow)
- T-687. Create API documentation with OpenAPI/Swagger for all backend endpoints. (labels: docs, api)
- T-688. Add code examples to documentation for common usage patterns. (labels: docs, workflow)

## Label: monitoring

- T-689. Add distributed tracing with OpenTelemetry for all service interactions. (labels: monitoring, observability)
- T-690. Implement custom metrics collection for business KPIs and system performance. (labels: monitoring, metrics)
- T-691. Add log aggregation and structured logging for all application components. (labels: monitoring, logging)

## Label: performance

- T-620. Add lazy loading for non-critical components and routes to improve initial load performance. (labels: api, ui, performance, workflow)
- T-679. Remove unused components (TopbarSidebarToggle, shadcn sidebar). (labels: ui, performance)
- T-711. Improve perceived dashboard speed with route-level loading states, cached summary data, and fewer blocking startup requests. (labels: performance, dashboard, ui)
- T-712. Reduce memory use in dataset and assistant flows by paging large records, sampling previews, and avoiding full-row duplication in client state. (labels: performance, data, ai)
- T-692. Implement HTTP/2 push for critical assets in production builds. (labels: performance, deployment)
- T-693. Add server-side caching with Redis for expensive database queries. (labels: performance, data, caching)

## Label: reports

- T-633. Add proper layering (presentation, application, domain, infrastructure) with clear boundaries. (labels: reports, sales, workflow)
- T-694. Add report scheduling and automated delivery via email. (labels: reports, workflow)
- T-695. Implement report versioning and change tracking for audit trails. (labels: reports, data)

## Label: security

- T-608. Add Content Security Policy (CSP) headers with nonce-based script and style allowlisting. (labels: security, content)
- T-609. Implement rate limiting on all API endpoints using Redis-backed sliding window counter. (labels: security, api, performance)
- T-612. Add security scanning dependencies and integrate with CI pipeline for vulnerability detection. (labels: security, ci-build)
- T-614. Add audit logging for sensitive operations (user data access, permission changes, financial transactions). (labels: security, auth, business, data)
- T-616. Add password breach detection using HaveIBeenPwned API during registration and password change. (labels: security, api)
- T-676. Store external API keys in a persistent, owner-scoped table with hashed key values, expiry, revocation, last-used tracking, and audit logging. (labels: security, api, dashboard, ui)
- T-696. Implement API gateway with request/response validation and threat protection. (labels: security, api, deployment)
- T-697. Add file upload virus scanning for all user-uploaded content. (labels: security, upload)
- T-698. Implement account lockout mechanism after failed login attempts. (labels: security, auth)

## Label: ui

- T-701. Implement responsive design breakpoints for all screen sizes. (labels: ui, accessibility)
- T-702. Add keyboard navigation support for all interactive components. (labels: ui, accessibility)
- T-713. Add plain expectation text to upload, assistant, reports, and accountancy queues so users know what happens next. (labels: ui, content, dashboard)
- T-714. Serve AI answers in a straight response format with the direct result first, followed by short evidence and next action. (labels: ui, ai, content)
- T-715. Change progress into an onboarding checklist that shows completed setup, missing setup, visited pages, and next best action. (labels: ui, dashboard, workflow)

## Label: upload

- T-610. Add request size limits and timeout protection to prevent DoS attacks. (labels: api, upload, performance, workflow)

## Label: workflow

- T-619. Implement proper error boundaries in React components with fallback UIs. (labels: workflow)
- T-617. Replace all `any` types with proper TypeScript interfaces and utility types. (labels: workflow)
- T-621. Implement image optimization with responsive formats (WebP, AVIF) and proper sizing. (labels: workflow)
- T-623. Implement server-side rendering for SEO-critical pages with proper meta tags. (labels: workflow)
- T-627. Refactor monolithic service classes into cohesive, single-responsibility modules. (labels: workflow)
- T-631. Add event-driven architecture with message broker for inter-service communication. (labels: workflow)
- T-632. Implement plugin architecture for extensible functionality without core modifications. (labels: workflow)
- T-703. Add pre-commit hooks for code quality and formatting checks. (labels: workflow, ci-build)
- T-704. Implement automated release notes generation from commit history. (labels: workflow, deployment)
- T-716. Add automated dependency update checks with security vulnerability scanning. (labels: workflow, ci-build)
- T-718. Add documentation generation from code comments and JSDoc. (labels: workflow, docs)
- T-720. Implement rollback mechanism for failed deployments with health check verification. (labels: workflow, deployment)

## Deferred

## Suggestions