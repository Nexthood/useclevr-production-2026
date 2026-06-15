# Payload Migration Prompt

Use this prompt for Payload CMS work. Keep this aligned with `.TODO/todo-migration-payload.md`.

```text
Integrate Payload CMS into the current UseClevr Next.js app as an editable content layer only.

Preserve current routes:
- `/` remains the public homepage.
- `/app` remains the dashboard workspace.
- `/app/admin` remains the super-admin product area.

Keep Payload admin at `/admin`, Payload REST at `/api/payload`, and Payload MCP at
`/api/payload/mcp`.

Do not replace existing application data models. Keep auth, profiles, businesses, datasets, dataset rows, tickets, referrals, billing, Stripe webhooks, AI interaction traces, workspaces, reports, uploads, and app settings in the current Drizzle/PostgreSQL application layer.

Payload owns editable public content:
- news posts
- FAQ entries
- homepage, Privacy, and Terms content
- durable News cover media

Keep Stripe as the payment source of truth. Payload may display billing-related copy but must not own prices, checkout state, subscriptions, webhook events, invoices, or customer payment records.

Keep Railway generated-output deployment working from the dist branch `/dist` root.
Use S3-compatible durable object storage for CMS media and block media mutations when storage is
not configured.
Use `/api/payload/mcp` for Payload News, FAQ, and locked demo-account dataset read tools. Do not document a separate dashboard MCP connector.

Implement in small phases:
1. Confirm the requested content belongs in Payload.
2. Keep every Payload package on the same release.
3. Add or update the smallest matching collection or global.
4. Generate and review the Payload PostgreSQL migration.
5. Update Payload MCP permissions only when an authorised client needs the content.
6. Keep public routes and product-data ownership stable.
7. Document environment variables, access rules, deployment behavior, and rollback steps.

Validate with TypeScript, dist config checks, linting, production packaging, and route smoke checks.
```
