# API Route Access Matrix

This document defines the security boundaries, authentication requirements, authorization rules, rate limiting, and audit logging specifications for all API endpoints in the **UseClevr** platform.

---

## Access Classification Matrix

| Route Path Prefix | Access Classification | Authentication Helper / Mechanism | Authorization / Ownership Check | Rate Limiting | Audit Evidence / Logging |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/public/*` | **Public API** | API Key in `x-api-key` header (`validateAPIKey`) | Key has specific action permission via `hasAPIPermission` | Default limit per IP / Key | Trace logged to external service metrics |
| `/api/webhooks/*` | **Webhook** | Platform signature validation (e.g., Stripe-Signature) | Verified by Stripe Webhook secret | Bounded by Stripe retry policy | Logged as incoming event webhook records |
| `/api/auth/*` | **Auth Internal** | Auth.js standard session handlers | None (handled by Auth.js) | IP-based limits | System log output only |
| `/api/health` | **Public Status** | None (public route) | None (anonymous access) | High threshold (liveness/readiness probe) | None |
| `/api/admin/*` | **Super-Admin** | `requireSuperAdmin` helper (checks session role) | User role must be `superadmin` | Standard user limits | Dedicated security audit log |
| `/api/mentoring/*` | **Signed-In** | `requireSession` or `requireAuthResult` | User ID context matching session | Standard user limits | System log output |
| `/api/datasets/*` | **Owner-Scoped** | `requireAuthResult` | Queries filter strictly on `userId = session.userId` | Standard user limits | System log output |
| `/api/reports/*` | **Owner-Scoped** | `requireAuthResult` | Queries filter strictly on `userId = session.userId` | Standard user limits | System log output |
| `/api/chat` | **Signed-In Analyst**| `requireAuthResult` | User ID context matching session + credit checks | 30 questions/min limit | Trace saved to `aiInteractionTraces` |
| `/api/analyze` | **Signed-In Analyst**| `requireAuthResult` | User ID context matching session + credit checks | 30 questions/min limit | Trace saved to `aiInteractionTraces` |
| `/api/debug/*` | **Development-Only** | Localhost only guard | Fails 404 in production environment | None | Development log console only |

---

## Core Security Rules

### 1. Fail-Closed on Error
Any error in authenticating the session, parsing the API key, verifying signatures, or executing database calls must result in an immediate termination of the request lifecycle with a secure 401/403/400 status. No data payload may be returned upon an unhandled routing error.

### 2. Strict Owner Scoping
Any route returning or modifying specific datasets, files, businesses, or settings must explicitly scope queries using `session.userId`. Direct object references (e.g. fetching `/api/datasets/[id]` using only the route parameter ID) without an explicit `and(eq(datasets.userId, session.userId))` database check is strictly forbidden.

### 3. Development Routes Sandbox
Diagnostic or debugging endpoints under `/api/debug/*` must be completely deactivated in non-development environments, returning a 404 Not Found error instantly if `process.env.NODE_ENV === 'production'`.

---

## Audit Evidence Tracking

The primary table for tracking analytical and assistant execution is `aiInteractionTraces`. 

- **Trace Fields**: `userId`, `prompt`, `response`, `providerName`, `modelName`, `promptVersion`, `latencyMs`, `error`.
- **Sensitive Data Scrubbing**: Prompts and responses are automatically passed through `anonymizeUserTraces()` to strip out emails, keys, and PII before commit.
- **Dataset Privacy**: No raw database row results or parsed file content may be recorded inside the audit trace fields.
