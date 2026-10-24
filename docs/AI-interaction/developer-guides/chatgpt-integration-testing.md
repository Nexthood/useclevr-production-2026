# Isolated ChatGPT Integration Testing

Run `pnpm test:chatgpt` from the repository root with Node.js 26 and pnpm. The command runs database-safety checks, OAuth account linking, and MCP authentication/tenant isolation. Run `pnpm test:chatgpt-oauth-flow` or `pnpm test:chatgpt-mcp` for one suite through the same disposable runner.

The runner requires an unprivileged Linux user and either PostgreSQL server binaries (`initdb` and `pg_ctl`) under `/usr/lib/postgresql/<version>/bin` or on `PATH`, or access to the local Docker daemon at `/var/run/docker.sock`. Docker uses `postgres:17-bookworm` and can download that public image. The CI source-validation command runs `pnpm test:chatgpt` before the existing general test suite.

## Database Boundary

The runner creates a directory under the system temporary directory with mode 0700. It starts a new PostgreSQL cluster with no TCP listener and a private Unix socket. The Docker fallback disables container networking, publishes no ports, runs as the invoking user's UID/GID, and mounts only the newly created temporary directory. No existing database, Docker volume, or remote Docker context is selected.

The runner creates separate empty databases for OAuth and MCP. Child processes receive an explicit environment allowlist plus runner-generated test configuration. The runner excludes inherited database URLs, PostgreSQL options, provider credentials, Docker context, and Node preload options. It does not load repository environment files.

Both test entrypoints verify the private directory, runner marker, suite, exact Unix-socket connection URL, and database mode before creating a client or importing application modules. Direct execution without the runner fails closed. The database-safety checks exercise remote URL rejection, query-parameter overrides, wrong suites, missing markers, and non-private directories.

The bootstrap creates only the seven exercised application tables from the current Drizzle definitions, including defaults, nullability, primary/unique constraints, indexes, and foreign keys. It requires an empty database and does not run deployment migrations. The runner stops its own cluster/container and removes its own temporary directory after success, failure, timeout, or a handled interrupt. A failed shutdown retains the directory and fails the command.

## Coverage and Limits

The OAuth suite exercises real password/email-proof authentication and Auth.js sessions, consent approval/cancellation, state and issuer binding, CIMD validation, PKCE, token exchange, expiration, replay rejection, concurrent code consumption, and tenant isolation through MCP. The MCP suite checks discovery, bearer challenges, scopes, token validation, callback redirect semantics, and tenant isolation.

CIMD responses use synthetic fixtures. Unexpected outbound fetches fail; the MCP redirect check permits only its own loopback HTTP server. Tests generate signing keys and authentication secrets in memory. Fixtures contain synthetic data only. Tests do not send email, call OpenAI, inspect live databases, or submit files to a portal.

Local success establishes application behavior against disposable PostgreSQL. The operator separately verifies publisher identity, reviewer login access, demo recording access, production configuration, portal connection saving, domain verification, and tool scanning under an authorized submission task.

## Historical Upload Artifacts

Git ignores root `useclevr-openai-plugin-*.zip` and `useclevr-openai-plugin-*-validation.json` files. Keep these local artifacts intact. Commit `openai-plugin-submission/` sources; source changes do not rebuild or certify an existing ZIP.
