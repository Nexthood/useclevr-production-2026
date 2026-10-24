# Agent Trust Passport release blocker verification

The `fix/passport-proxy-origin` branch contains the reviewed Passport proxy-origin
fix and separate release prerequisite commits. Publish this branch without
pushing `beta`, `main`, `dist-test`, or `dist`; opening a release PR or dispatching
a release workflow requires a separate deployment instruction.

## Compatible dependency updates

The 2026-10-24 audit reports 3 critical, 8 high, 6 moderate, and 4 low findings
before remediation. Compatible updates reduce the result to 0 critical, 2 high,
0 moderate, and 0 low findings: 19 reported findings are resolved. The remaining
Zod advisory also loses its application Zod 4 dependency paths.

| Dependency | Compatible patched requirement |
| --- | --- |
| Next.js | 16.4.1 |
| DOMPurify | 3.4.17 |
| Application Zod | 4.6.6 or later within major 4; installed 4.6.7 |
| Body Parser | 2.4.0 or later within major 2 |
| Markdown-it | 14.3.3 or later within major 14 |
| Undici | 6.29.1 or later within major 6; 7.30.1 or later within major 7 |
| Fast URI | 3.1.9 |
| IP Address | 10.7.4 or later within major 10 |

The package manifest and pnpm workspace overrides select compatible releases;
pnpm regenerates the lockfile. Keep the Payload package family at 3.90.2. Do not
force every Undici consumer onto a different major version.

## Remaining release blockers

- [Zod GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5):
  `@payloadcms/plugin-mcp` requires Zod 3, and its peer dependency context retains
  Zod 3.25.76 for the MCP SDK and JSON-schema converter. The advisory lists 4.6.6
  as patched. The current published Payload MCP plugin still requires Zod 3.
  Obtain explicit major-migration approval and verify MCP schema conversion
  before changing that contract. The application's Zod 4 dependency is patched.
- [Happy DOM GHSA-834v-8h66-3h79](https://github.com/advisories/GHSA-834v-8h66-3h79):
  the Payload Lexical headless dependency retains Happy DOM 20.11.6. The published
  fix requires 21.0.4; the parent dependency specifies major 20. Obtain explicit
  major-migration approval and test headless rich-text behavior before overriding
  that contract.

The existing audit allowlist remains unchanged. `pnpm audit` and
`pnpm audit:allowlist` return nonzero for these two high findings. A successful
feature-branch push does not establish release eligibility. Do not merge or
deploy while the required security gate fails.

## Verification

The updated graph passes all 13 Passport boundary/database groups, 27 ChatGPT
OAuth checks, ChatGPT MCP integration, three fixture-safety checks, 38 historical
unlock checks, auth redirects, customer-data owner scope, Eclipse Mode, Hybrid AI
feature gates, upload security, CSV edge cases, AI transparency, and TypeScript.
The dependency graph has no peer dependency issues. PostgreSQL tests use fresh
network-disabled containers and exclude external credentials.

The billing correction changes one comment line; actual product prices and
billing behavior are unchanged. Typed lint explicitly includes well-known
application routes; it does not exclude the public verification route. The
normal pre-push hook must run TypeScript, deployment-config validation, full lint,
and production packaging before publication. No production data or runtime
configuration is used for these checks.
