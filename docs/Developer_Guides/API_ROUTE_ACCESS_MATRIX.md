# API Route Access Matrix

This document defines the security boundaries, authentication requirements, authorization rules, rate limiting, and audit logging specifications for all API endpoints in the **UseClevr** platform.

---

## Access Classification Matrix

| Route Path Prefix  | Access Classification | Authentication Helper / Mechanism                      | Authorization / Ownership Check                           | Rate Limiting                                              | Audit Evidence / Logging             |
| :----------------- | :-------------------- | :----------------------------------------------------- | :-------------------------------------------------------- | :--------------------------------------------------------- | :----------------------------------- |
| `/api/public/*`    | **External API**      | API key in `x-api-key` header through `validateAPIKey` | Key has specific action permission through `hasAPIPermission` | Endpoint-level rate limiting is active work under `T-609` | System log output                    |
| `/api/webhooks/*`  | **Webhook**           | Platform signature validation (e.g. Stripe signature)  | Verified by provider webhook secret                       | Provider retry behavior plus endpoint hardening work       | Webhook handler result logging       |
| `/api/auth/*`      | **Auth Internal**     | Auth.js standard session handlers                      | Handled by Auth.js                                        | Auth-provider controls                                     | System log output                    |
| `/api/health`      | **Public Status**     | None                                                   | Liveness is public; readiness reports degraded states     | Health probe traffic only                                  | None                                 |
| `/api/admin/*`     | **Super-Admin**       | `requireSuperAdmin` helper                            | User role must be `superadmin`                            | Standard authenticated-user limits                         | System log output                    |
| `/api/mentoring/*` | **Signed-In**         | Session helper                                         | User ID context matching session                          | Standard authenticated-user limits                         | System log output                    |
| `/api/datasets/*`  | **Owner-Scoped**      | Session helper                                         | Queries filter strictly on the signed-in user unless super-admin access is explicit | Standard authenticated-user limits             | System log output                    |
| `/api/reports/*`   | **Owner-Scoped**      | Session helper                                         | Queries filter strictly on the signed-in user unless super-admin access is explicit | Standard authenticated-user limits             | System log output                    |
| `/api/chat`        | **Signed-In Analyst** | Session helper or middleware guard                     | User ID context matching session plus credit checks       | Credit and endpoint controls                               | Trace saved to `aiInteractionTraces` |
| `/api/analyze`     | **Signed-In Analyst** | Session helper                                         | User ID context matching session plus credit checks       | 30 requests/minute                                         | Trace saved to `aiInteractionTraces` |
| `/api/debug/*`     | **Development-Only**  | Environment guard                                      | Returns 404 in production                                 | None                                                       | Development log output               |

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
- **Sensitive Data Scrubbing**: Trace storage redacts email-like values, provider keys, tokens, webhook secrets, and credential-like assignments before prompts, answers, and errors are persisted.
- **Dataset Privacy**: No raw database row results or parsed file content may be recorded inside the audit trace fields.

## Active Audit Follow-Up

- Persist external API keys outside the in-memory helper before public API access is considered production-ready.
- Keep endpoint-level rate limiting, audit logging, and persistent key revocation aligned with `.TODO/todo-next.md`.
