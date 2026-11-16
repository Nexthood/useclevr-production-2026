# Production runtime review — 16 November 2026

## React serialization

The loading routes for Accountancy, Admin, Assistant, Datasets, Settings and Tickets and their
shared `LoadingScreen` render on the server. They need no hooks or browser APIs. Server rendering
keeps Lucide icon constructors within the server render tree and retains the icon, animation and text.

The reported “Functions cannot be passed directly to Client Components” message is reproducible
when a server passes a forwardRef icon through a client component boundary. The source reviewed
at task resumption marks both the loading routes and the shared component as client components;
that client-to-client path does not establish the reported server-to-client boundary. The positive
control demonstrates the failure mechanism, while the route tests verify the server-only rendering
contract. Neither identifies the request associated with the production digest.

Run `pnpm test:runtime`. The Flight regression reproduces the rejected boundary as a positive
control and serializes all six real loading modules successfully with fixture icons. Database
regressions exercise both runtime pool branches and verify that active query errors still propagate.

The Railway CLI returns `Unauthorized` for the requested production log window. The specific
request associated with digest `1975185665`, its deployed revision and the reset stacks therefore
require a sanitized owner-provided excerpt or restored read-only log access. A digest alone does
not identify a source line.

## Connection resets

React serialization does not open PostgreSQL connections. An aborted response can coincide with
a reset, but timestamps and socket stacks are required to establish that relationship. Distinguish
incoming HTTP disconnects, PostgreSQL sockets and outgoing provider requests before changing policy.

Both runtime pools register an idle-client `error` listener. PostgreSQL discards failed idle
connections; the listener prevents an otherwise unhandled EventEmitter error from terminating Node.
The log contains fixed text only. Query failures retain their existing error path and no write or
signing action is automatically replayed. This contains one confirmed failure mode; it does not
establish the cause of the reported resets or repair an upstream network fault.

Reference: [node-postgres pool error events](https://node-postgres.com/apis/pool).

## PostgreSQL TLS

The application and Payload pools receive `DATABASE_URL`, falling back to `DIRECT_URL`; the
predeploy client prefers `DIRECT_URL`. The owner must review both endpoints privately, without
copying URLs or credentials into tickets or logs.

The connection-string compatibility warning for `prefer`, `require` and `verify-ca` concerns
their current aliasing to `verify-full` and a future semantics change. For a public endpoint whose
certificate chain and hostname validate, an owner-authorized switch to explicit
`sslmode=verify-full` retains strict verification. Supply the provider's CA if it is not publicly
trusted. Confirm the actual warning before applying this diagnosis to production.

Do not use `rejectUnauthorized: false`, `NODE_TLS_REJECT_UNAUTHORIZED=0` or libpq compatibility
as a warning workaround. URL SSL parameters can replace an explicit `ssl` object, including CA
options. The predeploy client contains an existing certificate-verification bypass fallback;
its effective behavior depends on the URL options. The owner must confirm the endpoint's CA and
hostname before a separate reviewed correction. This change modifies no connection URL, TLS
policy, migration command, Railway variable or deployment pipeline.

References: [node-postgres TLS configuration](https://node-postgres.com/features/ssl),
[connection-string parser](https://github.com/brianc/node-postgres/blob/master/packages/pg-connection-string/index.js).

## Payload email

`payload.config.ts` defines no email adapter. Payload can serve CMS requests but its email path
cannot deliver password resets or custom `payload.sendEmail` messages. CMS local authentication
is enabled alongside dashboard-session authentication; CMS account recovery therefore has a real
operational limitation. Verification emails also require an adapter if verification is enabled.

Partner invitations, verification codes and agreement copies use the separate Resend HTTP mail
implementation with `RESEND_API_KEY` and `EMAIL_FROM`. Dashboard authentication email also uses
its own delivery path. The CMS warning does not disable these paths or establish that they are
working in production. Confirm actual delivery during owner-authorized hosted acceptance.

Do not suppress the warning with a no-op adapter. CMS email delivery requires a reviewed real
adapter, a verified sender and a mailbox delivery test.

Reference: [Payload email configuration and default warning](https://payloadcms.com/docs/email/overview).

## Owner verification

1. Obtain sanitized Railway error context and confirm the deployed revision and affected routes.
2. Review this fix and its checks; authorize release separately. After an approved release, visit
   all six protected loading routes with an authorized account and inspect logs for serialization errors.
3. Verify Global Partner Program application, invitation, login and private contract access on the
   hosted service. Use existing signing readiness procedures for real email/signature acceptance;
   commercial activation remains a separate owner-controlled decision.
4. Inspect reset socket stacks and database restart/connection metrics; review both TLS endpoints
   and CMS account-recovery requirements before authorizing any configuration or adapter change.
