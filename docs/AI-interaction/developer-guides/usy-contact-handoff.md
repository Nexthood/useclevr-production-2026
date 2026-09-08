# Usy Contact Handoff

Usy prepares contact requests for Sales, Technical Support / IT, Billing, Management, and Executive Management. Usy collects the department, request message, sender name, optional company, reply email, and user language, then shows a summary and requires an explicit confirmation before UseClevr sends any handoff.

## Endpoint

`POST /api/usy/contact`

The endpoint accepts only confirmed contact requests. Normal chat messages use `POST /api/usy/chat` and do not send inquiries.

## Required Environment

- `USY_CONTACT_N8N_WEBHOOK_URL`: central n8n inbound webhook URL.
- `USY_CONTACT_N8N_WEBHOOK_SECRET`: bearer secret sent only from the server to n8n.

When either value is missing, the endpoint returns `503` with a truthful user-safe message. The browser never receives the webhook URL or secret.

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

- `202`: `{"ok":true,"message":"Your contact request has been submitted."}`
- `400`: invalid JSON or validation failure.
- `429`: rate limit exceeded.
- `502`: n8n rejects the handoff or cannot be reached.
- `503`: required handoff environment variables are missing.
