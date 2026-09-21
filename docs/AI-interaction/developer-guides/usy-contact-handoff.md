# Usy Contact Handoff

Usy prepares contact requests for Sales, Technical Support / IT, Billing, Management, and Executive Management. Usy collects the department, request message, sender name, optional company, reply email, and user language, then shows a summary and requires an explicit confirmation before UseClevr sends any handoff.

## Endpoint

`POST /api/usy/contact`

The endpoint accepts only confirmed contact requests. Normal chat messages use `POST /api/usy/chat` and do not send inquiries.

## Required Environment

- `USY_CONTACT_N8N_WEBHOOK_URL`: central n8n inbound webhook URL.
- `USY_CONTACT_N8N_WEBHOOK_SECRET`: bearer secret sent only from the server to n8n.

When either value is missing, the endpoint returns `503` with a truthful user-safe message. The browser never receives the webhook URL or secret.

### Railway Configuration

Set both variables on every environment that serves the app (the production `useclevr app` service and the `useclevr TEST` service):

1. `USY_CONTACT_N8N_WEBHOOK_URL` — the published production webhook URL from the central n8n instance (`https://<n8n-host>/webhook/usy-contact`). The `/webhook-test/` path is the n8n manual-test endpoint and only responds while the workflow runs in manual test mode; deployed environments (app.useclevr.com and test.useclevr.com) must never use it.
2. `USY_CONTACT_N8N_WEBHOOK_SECRET` — generated with `openssl rand -hex 32`; the same value must be configured as the expected bearer token in the n8n workflow.

The values come from the operator's n8n instance; UseClevr does not generate the webhook URL. Until both variables exist, Usy truthfully reports the contact handoff as not configured instead of failing silently.

### Department Routing

UseClevr sends the confirmed payload's `category` (`sales`, `technical_support`, `billing`, `management`, `executive`) unchanged. The n8n workflow routes each category to its destination mailbox. The existing alias `support@useclevr.com` is the destination for `technical_support` (Technical Support / IT); the other departments keep their dedicated n8n-side destinations. UseClevr never embeds destination email addresses in the payload or the code.

## Submission Semantics

- The webhook call happens exactly once per confirmed request. A successful handoff marks the request fingerprint (server identity + contact fields) as delivered for 10 minutes; a duplicate confirmation of the same request returns `202` with the success confirmation and does not call n8n again.
- A second confirmation while the first submission is still in flight returns `409` with a retry-after hint; it never claims delivery.
- A failed or unreachable webhook returns `502` and releases the fingerprint so the same confirmed request can be retried; the chat keeps the confirmed draft so the user can retry without retyping.
- Secrets and the webhook URL are used only inside the server route handler.

## Authentication To n8n

UseClevr sends:

- `Authorization: Bearer <USY_CONTACT_N8N_WEBHOOK_SECRET>`
- `Content-Type: application/json`
- `X-UseClevr-Event: usy.contact_request`

n8n validates the bearer token before processing the request.

## Payload

```json
{
  "category": "sales",
  "message": "Please contact me about Business plan onboarding.",
  "senderName": "Alex Rivera",
  "company": "Delta Labs",
  "replyEmail": "alex@example.com",
  "language": "english",
  "timestamp": "2026-09-08T12:00:00.000Z",
  "userId": "user_123",
  "organizationId": "business_123"
}
```

`category` is one of `sales`, `technical_support`, `billing`, `management`, or `executive`. `company`, `userId`, and `organizationId` are omitted when unavailable. `userId` and `organizationId` are included only for the authenticated user and the user's own primary organization.

## Responses

- `202`: `{"ok":true,"message":"Your contact request has been submitted."}` — also returned idempotently for a duplicate confirmation of an already-delivered request.
- `400`: invalid JSON or validation failure.
- `409`: the same confirmed request is already being submitted.
- `429`: rate limit exceeded.
- `502`: n8n rejects the handoff or cannot be reached (retryable; the confirmed draft stays in the chat).
- `503`: required handoff environment variables are missing.
