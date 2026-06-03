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

## Active

### Code Security

- T-607. Implement SQL injection prevention using parameterized queries and input validation for all database operations.
- T-608. Add Content Security Policy (CSP) headers with nonce-based script and style allowlisting.
- T-609. Implement rate limiting on all API endpoints using Redis-backed sliding window counter.
- T-610. Add request size limits and timeout protection to prevent DoS attacks.
- T-611. Implement proper CORS configuration with strict origin validation.
- T-612. Add security scanning dependencies and integrate with CI pipeline for vulnerability detection.
- T-613. Implement JWT token rotation and refresh token invalidation on password change.
- T-614. Add audit logging for sensitive operations (user data access, permission changes, financial transactions).
- T-615. Implement input sanitization for all user-provided data displayed in HTML contexts.
- T-616. Add password breach detection using HaveIBeenPwned API during registration and password change.

### Code Improvement

- T-617. Replace all `any` types with proper TypeScript interfaces and utility types.
- T-618. Extract duplicated utility functions into shared modules with comprehensive unit tests.
- T-619. Implement proper error boundaries in React components with fallback UIs.
- T-620. Add lazy loading for non-critical components and routes to improve initial load performance.
- T-621. Implement image optimization with responsive formats (WebP, AVIF) and proper sizing.
- T-622. Add bundle analysis to CI pipeline to monitor and reduce JavaScript bundle size.
- T-623. Implement server-side rendering for SEO-critical pages with proper meta tags.
- T-624. Add centralized error reporting with contextual information for production debugging.
- T-625. Implement feature flags system for gradual rollouts and A/B testing.
- T-626. Add comprehensive JSDoc documentation for all public APIs and complex functions.

### Code Structure

- T-627. Refactor monolithic service classes into cohesive, single-responsibility modules.
- T-628. Implement domain-driven design with clear bounded contexts for business logic.
- T-629. Add dependency injection container for better testability and loose coupling.
- T-630. Implement CQRS pattern for read/write operations separation in complex business domains.
- T-631. Add event-driven architecture with message broker for inter-service communication.
- T-632. Implement plugin architecture for extensible functionality without core modifications.
- T-633. Add proper layering (presentation, application, domain, infrastructure) with clear boundaries.
- T-634. Implement repository pattern for data access abstraction.
- T-635. Add unit test coverage >90% for all business logic and utility functions.
- T-636. Implement comprehensive integration tests covering critical user journeys.


## Deferred

### Development Experience

- T-667. Implement Mock AI mode for development with fake AI responses - enables rapid UI/UX development without API credits
- T-668. Add environment variable configuration (MOCK_AI_MODE, MOCK_AI_RESPONSE_DELAY_MS, etc.)
- T-669. Create mock response templates for AI Assistant, dataset analysis, and report generation
- T-670. Modify AI router to return mock responses when MOCK_AI_MODE is enabled
- T-671. Add configurable response delay and variability for realistic simulation
- T-672. Implement persistent mock storage for consistent testing scenarios
- T-673. Create toggle in development settings/UI for easy switching between mock and real AI
- T-674. Ensure mock mode is automatically disabled in production builds
- T-675. Add documentation for enabling/disabling mock mode and creating custom mock responses

