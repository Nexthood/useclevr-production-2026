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

- T-789. Identify and remove the Next.js or Payload compile warning that production builds currently report without warning details. (labels: ci-build, quality, content)
- T-622. Add bundle analysis to CI pipeline to monitor and reduce JavaScript bundle size. (labels: ci-build, data, performance)
- T-680. Set NEXT_PUBLIC_APP_VERSION env var for version display. (labels: ci-build, deployment)
- T-705. Add build metadata to Docker image labels for traceability. (labels: ci-build, deployment)
- T-682. Implement automated dependency security scanning in CI pipeline. (labels: ci-build, security)
- T-725. Reduce production build work by skipping duplicate packaging checks and reusing validated artifacts between build phases. (labels: ci-build, performance, workflow)
- T-726. Measure build memory spikes and cap the heaviest packaging steps before Railway and local dist builds run out of RAM. (labels: ci-build, performance, monitoring)
- T-777. Stop CI force-push to dist-test when smoke test fails, preventing broken builds from reaching Railway deployment. (labels: ci-build, deployment, workflow)

## Label: data

- T-615. Implement input sanitization for all user-provided data displayed in HTML contexts. (labels: data, workflow)
- T-634. Implement repository pattern for data access abstraction. (labels: data, workflow)
- T-683. Add data validation middleware for all API endpoints using Zod schemas. (labels: data, api, workflow)
- T-684. Implement database connection pooling with automatic retry logic. (labels: data, performance)

## Label: deployment

- T-624. Add centralized error reporting with contextual information for production debugging. (labels: deployment, reports, workflow)
- T-685. Add health check endpoints for all external service dependencies. (labels: deployment, monitoring)
- T-686. Implement blue-green deployment strategy for zero-downtime releases. (labels: deployment, devops)
- T-776. Fix Payload CMS seed crash during next build by wrapping onInit cms_users query with graceful table-existence check, so static page generation succeeds on fresh databases. (labels: deployment, content, ci-build)
- T-778. Fix Railway test service deploy so test.useclevr.com serves the beta build instead of returning 404. (labels: deployment, ci-build)

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
- T-727. Reduce dashboard memory pressure by unloading inactive panels, trimming oversized client stores, and limiting repeated fetch payloads. (labels: performance, dashboard, data)
- T-728. Serve faster first responses by prioritizing above-the-fold dashboard data and deferring low-value background requests. (labels: performance, ui, dashboard)

## Label: quality

- T-788. Remove the existing ESLint warning backlog so the production validation gate completes with zero warnings. (labels: quality, ci-build, workflow)

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
- T-729. Tighten security headers, cookie flags, and session defaults across local and deployed environments. (labels: security, auth, deployment)
- T-730. Add secret-exposure review for docs, prompts, logs, and trace exports so operational text cannot leak credentials or private data. (labels: security, docs, ai)

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
- T-731. Track slow developer workflows and remove repeated manual steps from local setup, build packaging, and deploy verification. (labels: workflow, performance, deployment)


## Label: accessibility

- T-740. Implement automated accessibility testing in CI pipeline. (labels: accessibility, testing, ci-build)

## Label: ai

- T-741. Add AI response caching layer for repeated queries. (labels: ai, performance, caching)

## Label: api

- T-742. Implement API versioning and deprecation policy. (labels: api, workflow, docs)

## Label: auth

- T-743. Add multi-factor authentication option for sensitive operations. (labels: auth, security)

## Label: billing

- T-744. Implement usage-based billing for API consumption. (labels: billing, payment, api)

## Label: caching

- T-745. Add Redis cache warming strategy for peak hours. (labels: caching, performance)

## Label: devops

- T-746. Implement automated rollback on health check failure. (labels: devops, deployment, workflow)

## Label: faq

- T-747. Create automated FAQ generation from support tickets. (labels: faq, ai, content)

## Label: local-ai

- T-748. Add local AI model quantization for reduced memory usage. (labels: local-ai, performance)

## Label: mcp

- T-749. Implement MCP server for external tool integration. (labels: mcp, api, workflow)

## Label: metrics

- T-750. Add business metrics dashboard for executive summary. (labels: metrics, dashboard, reporting)

## Label: notice

- T-751. Implement notice prioritization and filtering system. (labels: notice, ui, workflow)
- T-752. Add notice snooze and reminder functionality for non-critical alerts. (labels: notice, ui)

## Label: observability

- T-753. Implement service mesh for microservices communication observability. (labels: observability, monitoring, performance)

## Label: payment

- T-754. Add support for multiple payment providers (PayPal, Stripe, etc.). (labels: payment, billing)

## Label: performance

- T-755. Implement adaptive loading based on network conditions and device capabilities. (labels: performance, ui, api)
- T-756. Add server-side rendering caching with stale-while-revalidate strategy. (labels: performance, docs)

## Label: quality

- T-757. Implement code quality gates in CI pipeline with minimum coverage thresholds. (labels: quality, ci-build, testing)

## Label: reports

- T-758. Add report templates for common business use cases. (labels: reports, docs)
- T-759. Implement report sharing and collaboration features. (labels: reports, workflow)

## Label: search

- T-760. Add search analytics and popular queries tracking. (labels: search, monitoring)
- T-761. Implement search result personalization based on user history. (labels: search, ui)

## Label: security

- T-762. Add regular security audit automation and compliance reporting. (labels: security, ci-build)
- T-763. Implement zero-trust architecture principles for service-to-service communication. (labels: security, monitoring)

## Label: testing

- T-764. Add visual regression testing for UI components. (labels: testing, ui)
- T-765. Implement contract testing for API integrations. (labels: testing, api)

## Label: ui

- T-766. Add dark mode automatic switching based on system preferences. (labels: ui, accessibility)
- T-767. Implement responsive typography scaling for better readability. (labels: ui, accessibility)

## Label: upload

- T-768. Add upload progress tracking with resumable uploads for large files. (labels: upload, api)
- T-769. Implement upload file validation beyond extension (MIME type, content inspection). (labels: upload, api)

## Label: workflow

- T-770. Add automated dependency licensing compliance checks. (labels: workflow, ci-build)
- T-771. Implement feature flag lifecycle management with automated cleanup. (labels: workflow, testing)

## Deferred

## Suggestions

## Suggestions
