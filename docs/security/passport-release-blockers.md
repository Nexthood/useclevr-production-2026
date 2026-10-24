# Agent Trust Passport release security verification

The `fix/passport-proxy-origin` branch contains the Passport proxy-origin fix and
validated dependency updates. Publish only this branch and use the review pull
request targeting `beta`. The agent must not merge, enable auto-merge, dispatch a
release workflow, authenticate Railway, or modify production data.

## Patched dependency graph

| Dependency | Locked release | Enforced requirement |
| --- | --- | --- |
| Zod | 4.6.7 | At least 4.6.6, within major 4 |
| Happy DOM | 21.0.4 | At least 21.0.4, within major 21 |

Workspace overrides apply these requirements to transitive dependencies, including
Payload MCP, the MCP SDK, and Lexical headless. Application MCP tool schemas import
Zod 4. Payload packages stay aligned at 3.90.2. The pnpm-generated lockfile contains
one Zod release and one Happy DOM release.

The patched thresholds address [the Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
and [the Happy DOM advisory](https://github.com/advisories/GHSA-834v-8h66-3h79).
`pnpm audit --audit-level=low` reports zero known vulnerabilities.
`pnpm audit:allowlist` passes with zero approved residual advisories and zero
unapproved advisories. The audit allowlist and required security checks are unchanged.

## Compatibility verification

`pnpm test:security-dependencies` exercises real Payload MCP tool registration and
SDK discovery through in-memory transports. It verifies required fields, invalid
argument rejection, synthetic collection reads and creation, and access-control
options. Lexical uses its supported DOM wrapper with patched Happy DOM to import
formatted HTML, serialize and restore editor state, and export formatted HTML.
These checks run in `test:all` and require no application database or private keys.

The full `test:all` suite passes against disposable PostgreSQL.
All 13 Passport boundary/database groups, 27 OAuth checks, MCP integration, three
fixture-safety checks, TypeScript, auth redirects, customer-data owner scope,
Eclipse Mode, and upload security pass. Database integration fixtures use fresh
network-disabled containers and exclude external credentials. The normal pre-push
hook requires TypeScript, deployment-config validation, full lint, and production
packaging. Packaging builds local artifacts; publication does not deploy them.

## Worktree preservation

The agent publishes tracked changes from the separate Passport worktree. A private
SHA-256 manifest covers all 111 existing local files in the original worktree.
Keep these files, temporary fixtures, and caches intact and outside the PR. Stage
only explicit release-worktree paths. Production runtime and schema verification
remain outside this publication task.
