# Production recovery and native reseller release — 17 November 2026

Decision: **NO-GO**. Security and hosted evidence remain blocking. This review authorizes no
merge, Railway deployment, production migration, live signing or commercial activation.

## Runtime evidence and changes

| Symptom | Confirmed evidence | Required next evidence / action |
| --- | --- | --- |
| Function serialization, digest 1975185665 | Flight reproduces the failure mechanism. Candidate loading routes serialize successfully. A focused source boundary scan identifies no additional confirmed function-prop defect. | Obtain the failing request, deployed source SHA and sanitized stack. A digest or synthetic positive control does not identify the production call site. |
| ECONNRESET | Application pools contain idle-error listeners; active query failures propagate without write retries. | Correlate socket stacks, request/deployment IDs and DB/provider events. Database, HTTP and provider resets require different remedies. |
| Container restarts | Source config uses ON_FAILURE and an HTTP health check. App GET health reports DB degradation in JSON while remaining a liveness response. | Inspect actual Railway deployment lifecycle, exit/OOM reasons, configured port, probes and restart timeline before classifying crashes. |
| Payload email warning | Payload config has no email adapter; Payload documents this as an expected warning when email is unconfigured. Partner invitations, codes and completion copies use the separate Resend mail implementation. | Review CMS account recovery requirements and verified delivery privately; do not suppress the warning or invent an adapter. |
| Payload missing tables | Payload disables automatic schema push; the application predeploy is not proof of the complete Payload schema. | Obtain exact table names and verify the intended database/schema and owned migrations with read-only queries. Do not enable automatic push or run predeploy for discovery. |

No new application fix is claimed without incident evidence. The branch adds a bounded read-only
migration-0045 prerequisite checker and tests, and documents safe use. It does not import the
application, register templates, execute migrations, retry transactions or alter runtime policy.
The administration GET is unsuitable for strict read-only inspection because it registers the catalog.

Railway access is unavailable: the wrapper reports no token and no linked project. No deployed
revision, production migration state, secret presence, signer authority or approval row is certified.

## Security gate

Current audit totals: 0 critical, 1 high, 10 moderate, 1 low. The unchanged audit gate fails.
`picomatch@2.3.2` and `4.0.5` are affected by GHSA-fc5q-39xc-vjpf. Public npm lists 4.0.7
as latest and rejects 4.0.8. Upstream PRs 237, 238 and 246 remain unmerged at inspection.
No reviewed, installable compatible remediation is established. No dependency or allowlist changes occur.

Production dependency paths include Payload → json-schema-to-typescript → tinyglobby/fdir →
picomatch 4.0.5; Next/Payload Sass → chokidar → anymatch/readdirp → picomatch 2.3.2; and
Payload cloud-storage discovery → find-node-modules → findup-sync → micromatch → picomatch 2.3.2.
Developer tools introduce additional paths. These are not exclusively development dependencies.
Production packaging copies the standalone runtime and retains the root production dependencies.
The isolated artifact inventory finds Next's vendored implementation at
`next/dist/compiled/picomatch/index.js`. A bounded subprocess compiles the repeated-extglob
pattern, completes the short-input control in 46 ms, and exceeds a 2-second limit on the
29-character adversarial input; the subprocess is terminated. This demonstrates problematic
matcher code in shipped server dependencies, not attacker reachability through an application route.
The standalone named Payload matcher packages are not resolved inside this artifact; resolution
outside the artifact is rejected as evidence. Root dependency overrides do not rewrite Next's
vendored module. The published Next 16.4.6 matcher also exceeds the same limit; its npm tarball
module matches the inspected official release-tag file. Payload 3.94.0 still depends on
json-schema-to-typescript 15.0.3. Neither inspected upstream path establishes a safe complete fix.

The advisory's patch target does not prove release availability. Replacing the entire glob stack or
using an unreviewed fork is not a verified minimal remedy. The release stops while the high finding remains.

| Package | Severity | Advisory | Audit patch target |
| --- | --- | --- | --- |
| @hono/node-server | moderate | [GHSA-rmxm-3fg6-px4f](https://github.com/advisories/GHSA-rmxm-3fg6-px4f) | `>=2.1.3` |
| qs | moderate | [GHSA-6pq8-jhm2-2vcw](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw) | `>=6.16.1` |
| minimatch | moderate | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) | `>=11.0.1` |
| @hono/node-server | moderate | [GHSA-jpvv-r467-5p4w](https://github.com/advisories/GHSA-jpvv-r467-5p4w) | `>=1.19.18` |
| hono | moderate | [GHSA-4m76-xfj5-7975](https://github.com/advisories/GHSA-4m76-xfj5-7975) | `>=4.13.16` |
| hono | moderate | [GHSA-h7mg-cq63-vhpq](https://github.com/advisories/GHSA-h7mg-cq63-vhpq) | `>=4.13.16` |
| hono | low | [GHSA-3gg2-335m-rxc6](https://github.com/advisories/GHSA-3gg2-335m-rxc6) | `>=4.13.16` |
| hono | moderate | [GHSA-46wx-v44x-9hh2](https://github.com/advisories/GHSA-46wx-v44x-9hh2) | `>=4.13.16` |
| hono | moderate | [GHSA-4h7h-rv7c-7m2v](https://github.com/advisories/GHSA-4h7h-rv7c-7m2v) | `>=4.13.16` |
| next | moderate | [GHSA-mfr8-8qww-v76h](https://github.com/advisories/GHSA-mfr8-8qww-v76h) | `>=16.4.5` |
| picomatch | high | [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) | `>=4.0.8` |
| next | moderate | [GHSA-vc7v-qv4w-wrv8](https://github.com/advisories/GHSA-vc7v-qv4w-wrv8) | `>=16.4.5` |

## Native reseller candidate

- Base: beta 58fb7c030d54686b03a145ba583247c3e456a096 contains PR #426 merge a13fe7cede10c755d0ccfc19561c6c5db95aa99a.
- Migration 0045_native_partner_signatures.sql and native signing routes are present in source and included in the existing packaging path. Hosted application of migration 0045 remains unverified.
- The [native guide](PARTNER_NATIVE_SIGNING.md) lists the environment requirements and owner-controlled release order. The native reseller template is authorized_reseller:2.0.0; source presence or a draft is not legal approval.
- Verify the exact template checksum, non-revoked template/schedule approvals, reviewed identity, owner-approved company signer reference and email, and current runtime fingerprint approval in the intended database.
- Preserve platform-attestation and encryption key history, backups, recovery and verified sender configuration. Controlled two-mailbox acceptance requires separate authorization and records real signing intent.
- Live signing, unattended processing, commercial activation and commissions are not enabled by this branch. Hosted gate states remain unverified. Explicit audited activation remains separate from signing.

## Validation

Types, full lint (0 errors, 453 warnings), production compilation/packaging, packaged route regressions,
43 partner database checks, 26 contract integration groups and 22 browser groups pass. All 46 regular
suites pass after a separate Passport rerun with a short TMPDIR; its initial isolated-snapshot run
exceeds the Unix socket path limit. The combined runner retains that initial failure exit status.
Four current schema-checker safety tests and actual read-only catalog SQL against the disposable
local fixture pass. The fixture reports missing prerequisites and is not production migration evidence.
The bounded artifact matcher reproduction and unchanged security audit fail their security criteria.
No production migrations, hosted email/signing or commercial activation occur. Passing non-security
checks does not authorize release.

Reference: [Payload email defaults](https://payloadcms.com/docs/email/overview).

## Minimum release prerequisites

1. Restore authorized read-only Railway and DB access; correlate revision, lifecycle, health probes and incident stacks.
2. Resolve the verified high security finding through an installable reviewed remediation and pass the unchanged audit gate.
3. Review the exact release candidate and hosted schema/approvals/configuration; obtain separate deployment and migration authorization if changes are required.
4. Complete owner/legal/security approval, backup/key restoration, real email and sequential-signing acceptance under separate authorization. Keep commercial activation independent.
