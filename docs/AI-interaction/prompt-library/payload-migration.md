# Payload Migration Prompt

Use this prompt when activating future Payload CMS work. Keep this aligned with `.TODO/todo-migration-payload.md`.

```text
Integrate Payload CMS into the current UseClevr Next.js app as an editable content layer only.

Preserve current routes:
- `/` remains the public homepage.
- `/app` remains the dashboard workspace.
- `/app/admin` remains the super-admin product area.

Add Payload under a distinct CMS route such as `/cms` or `/payload-admin`, with API routes under `/api/payload`.

Do not replace existing application data models. Keep auth, profiles, businesses, datasets, dataset rows, tickets, referrals, billing, Stripe webhooks, AI interaction traces, workspaces, reports, uploads, and app settings in the current Drizzle/PostgreSQL application layer.

Migrate editable content first:
- public FAQ
- dashboard/operator FAQ
- homepage sections
- legal pages
- sales one-pager/source content
- optional blog/resource posts

Keep Stripe as the payment source of truth. Payload may display billing-related copy but must not own prices, checkout state, subscriptions, webhook events, invoices, or customer payment records.

Keep Railway generated-output deployment working from the dist branch `/dist` root.
Do not introduce runtime filesystem storage for CMS media.
Use durable object storage for uploads if media support is enabled.

Implement in small phases:
1. Confirm package compatibility.
2. Add dependencies and configuration.
3. Add CMS route and API route.
4. Add content collections without changing public pages.
5. Add read adapters with fallback to existing static content.
6. Switch one content surface at a time.
7. Document env vars, access rules, deployment behavior, and rollback steps.

Validate with TypeScript, dist config checks, linting, production packaging, and route smoke checks.
```
