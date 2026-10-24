# Agent Trust Passport write authorization and schema checks

Passport creation and editing require a session with a user ID. Creation assigns
ownership from that session. Each account manages one Clevr AI Analyst passport;
edits require the passport's owner ID to match the session's user ID. Superadmins
can inspect other accounts' metadata and trace references but cannot edit their
passports.

## Origin validation

Cookie-authenticated POST and PATCH requests reject cross-site browser metadata
and origins that differ from the application origin. A TLS-terminating proxy can
give the server an internal HTTP request URL while the browser sends the public
HTTPS Origin. For this case, the API accepts an exact configured public origin
only when `Sec-Fetch-Site` is `same-origin`.

The server selects the first configured value in this order: `AUTH_URL`,
`NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`. The value must be a valid HTTPS URL, or an
HTTP loopback URL for local development, without embedded credentials. The API
compares the full origin, including scheme and port. Forwarded headers do not
establish a trusted origin. A matching origin never replaces session validation
or owner-scoped database operations.

The plain JSON `Forbidden` response with HTTP 403 comes from this origin guard.
A missing session returns HTTP 401; database errors return HTTP 503. Changing an
account's role or applying a database migration does not fix an origin rejection.

## Read-only migration verification

Run the catalog check from the reviewed source checkout with the affected
service's database environment supplied by the operator. The generated deployment
bundle contains runtime helpers only; it does not include this source-side
diagnostic script:

```bash
node scripts/ai-governance/check-agent-passport-schema.mjs
```

For the local configured database, load environment files without printing them:

```bash
node -r ./scripts/runtime/load-env.cjs scripts/ai-governance/check-agent-passport-schema.mjs
```

The checker uses `DATABASE_URL`, falling back to `DIRECT_URL`, matching the app's
database selection. The connection and transaction enforce read-only mode. It
queries only schema catalogs for migration 0037's columns, nullability,
constraints, and indexes. It prints missing object names and an overall result;
it does not read account, passport, or trace rows. This establishes schema-object
presence, not a migration-journal entry or equality of historical trace content.

`schemaObjectsPresent: true` and an empty `missing` array confirm the expected
objects are present. A nonzero exit means missing objects or a connection/query
failure. PostgreSQL error `28P01` means the configured connection credentials are
rejected; an operator must verify the intended environment and credentials before
the deployment's schema status can be confirmed.

## Deployment procedure

1. The operator confirms the affected service's public application URL and its
   highest-priority configured auth URL agree, including scheme and port. The
   operator keeps secrets out of tickets and logs.
2. The operator runs the read-only checker in that service's environment and
   records its result. Local disposable-database tests do not establish the
   deployed database's schema status.
3. The operator publishes the reviewed fix through the project's authorized
   release process. Existing predeploy processing includes
   `0037_agent_trust_passport.sql`; packaging includes the migration source.
   This fix requires no new migration or Railway configuration change. Schema
   application requires separate operational authorization.
4. After deployment, an authenticated test account creates its own passport and
   reloads the form to verify persistence, then edits it. Another test account
   must receive HTTP 404 when requesting or editing that passport. Requests from
   another origin must receive HTTP 403; requests without a session must receive
   HTTP 401. Use isolated test data for these write checks.

## Investigation evidence — 2026-10-24

An internal HTTP request URL with a public HTTPS browser Origin reproduces the
origin guard's 403. The affected deployment's request headers are unavailable in
this session, so its exact proxy mismatch remains unconfirmed. The configured
database rejects the read-only connection with `28P01`; live migration status
remains unverified. No production data or deployment configuration changes occur.

## Production investigation scope — 2026-10-24

The operator identifies `https://app.useclevr.com`, Railway PRODUCTION, service
`useclevr app` as the affected target. The local environment loader supplies no
Railway API token; the native CLI reports an unauthenticated session. Production
variables, deployed version, request headers, account state, and schema catalogs
are therefore unverified. The local read-only checker reproduces `28P01` after
network access is approved; this does not establish a production credential fault.

Runtime queries prefer `DATABASE_URL` over `DIRECT_URL`. Predeploy selects
`DIRECT_URL` before `DATABASE_URL`. The operator verifies both connections target
the intended database and authenticate successfully; differing connection strings
can legitimately represent pooled and direct endpoints. The runtime config schema
requires `DATABASE_URL`. Authentication resolves a secret of at least 32 characters
from `AUTH_SECRET`, falling back to `NEXTAUTH_SECRET`; retain the existing valid
secret. The deployment startup sets trusted-host behavior and public auth URLs.
The operator verifies the effective `AUTH_URL` and `NEXTAUTH_URL` use
`https://app.useclevr.com`; a configured `NEXT_PUBLIC_APP_URL` must agree.

The Passport guard accepts the configured public origin with same-origin browser
metadata when Request.url carries an internal proxy origin. The operator verifies
the deployed version and request headers before naming a proxy origin mismatch
as the confirmed production incident cause. Database authentication and missing schema objects return
HTTP 503 through this route; they do not explain its explicit HTTP 403 origin
rejection. No role elevation or ownership change is required for creation.
