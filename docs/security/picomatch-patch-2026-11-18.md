# picomatch extglob ReDoS remediation — 18 November 2026

## Advisory snapshot

[GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) (CVE-2026-112366),
CWE-1333, severity high (CVSS v3.1 7.5, CVSS v4.0 8.7):

> Picomatch through 4.0.7 contains a regular expression denial of service vulnerability
> that allows attackers to block the event loop by supplying single-branch repeated
> extglob patterns. Attackers can provide globs like `+(*)` or `+(*a)`, which
> `analyzeRepeatedExtglob` in lib/parse.js skips, causing exponential backtracking
> against short crafted strings and denying service to Node.js applications.

- Published: 2026-10-19. Reviewed by GitHub, three independent analysts credited.
- Withdrawn by GitHub on 2026-11-18 at 15:38:56 UTC with the withdrawal note "because
  it is a security issue" linking [micromatch/picomatch#235](https://github.com/micromatch/picomatch/pull/235#issuecomment-6315749381).
- The withdrawn metadata lists **no patched version** (`first_patched_version: null`,
  vulnerable range `<=4.0.7`).
- npm audit still reports the finding today (2026-11-18, checked 16:30–17:15 UTC):
  `pnpm audit --json` returns the advisory with `patched_versions: >=4.0.8`.

## Phase 1 answers

1. **Which dependencies introduce picomatch.** Two installed lines. `picomatch@4.0.5`
   enters through `payload → json-schema-to-typescript → tinyglobby → picomatch` and
   `payload → json-schema-to-typescript → fdir → picomatch`; `@typescript-eslint`,
   `markdownlint-cli`, and Tailwind's `sucrase` also use `tinyglobby`. `picomatch@2.3.2`
   enters through `next/payload → sass → chokidar → anymatch/readdirp/micromatch → picomatch`,
   through Tailwind and Payload storage globbing via `micromatch`, and dev-only through
   `vscode-markdown-languageservice`. Evidence: `pnpm-lock.yaml` snapshot keys pre-patch and
   `node_modules/.pnpm` link inspection on 2026-11-18.
2. **Production or development.** The 4.x line is reachable from the installed production
   dependency tree (`payload`); the 2.x line is build/watch tooling (`sass`, `tailwind`)
   plus one dev dependency. The app never feeds request-controlled input into these
   matchers: all consumer globs are workspace-owned patterns (Tailwind content globs,
   file watchers, Payload schema/storage discovery), so the attack precondition
   (attacker-supplied glob) is not reachable from production request paths. Severity
   remains gated anyway because the audit policy is version-based, not reachability-based.
3. **Next.js bundled matcher.** `next@16.4.1` vendors a separate compiled copy at
   `next/dist/compiled/picomatch` (ncc bundle of an old 2.x snapshot). It is not tracked by
   `pnpm audit` and is not part of the reported finding. Measured on 2026-11-18 it shares
   the same flaw: `makeRe('+(*a)')` compiles to `^(?:(?=.)(?:[^/]*?a)+)$` and a
   29-character crafted input (`'a'.repeat(28) + 'b'`) takes ~31 s. It matches Next's own
   config globbing with workspace-owned patterns and never consumes request-controlled
   input, so it cannot be remediated by overrides (vendored code) and is recorded as
   build-time residual context pending an upstream Next.js release that refreshes the
   vendored module.
4. **Is npm audit using outdated advisory metadata?** Yes. The GitHub Advisory Database
   API returns `withdrawn_at: 2026-11-18T15:38:56Z`; the npm-audit data behind
   `pnpm audit` still returns the advisory without withdrawal metadata when queried at
   16:30–17:15 UTC on the same day. npm's audit service syncs from GitHub's advisory feed
   with lag; the two sources diverge during that window.
5. **Why the withdrawal remains active in npm audit.** npm audit serves publication-shaped
   advisory records; a withdrawal is an advisory mutability event, and the pnpm audit
   query reports only what npm's database contains. Measured on 2026-11-18: the advisory
   was still present in `pnpm audit --json` at 16:22–17:15 UTC, and the same query
   reported it absent (high count 0, no picomatch finding) at 17:45 UTC — roughly two
   hours after the 15:38:56Z withdrawal. Propagation lag is the cause, not a duplicate
   record and not a local cache: each `pnpm audit` invocation queries the live registry
   endpoint.
6. **Other high findings blocking CI.** None. The same audit reports 10 moderate and 1 low
   (Hono/@hono/node-server family, `qs`, `minimatch`, two Next.js advisories including
   [GHSA-vc7v-qv4w-wrv8](https://github.com/advisories/GHSA-vc7v-qv4w-wrv8)). The allowlist
   gate only fails on unapproved critical/high; the only blocker is the picomatch high.

## Why dependency updates alone cannot resolve it

- Registry state at 2026-11-18: latest `picomatch` dist-tag is `4.0.7` (published
  2026-08-24T14:36:23Z). The full version list has no release above 4.0.7; `>=4.0.8`
  has no installable release (verified with `pnpm view` against registry.npmjs.org).
- The advisory vulnerable range is `<=4.0.7`, so every currently published picomatch
  version is inside the vulnerable range. No compatible update of
  `tinyglobby`/`fdir`/`chokidar`/`micromatch` consumers can move the tree out of the range.
- Removing the affected dependencies would break `payload` (production) and the
  Tailwind/Sass build chain; a maintained-replacement swap would replace the canonical
  glob matcher for build tooling with a nonstandard fork. Both add more risk than the
  patch path.

## Implemented solution — Option D (reproducible security patch)

Maintained remover: none exists upstream yet. Upstream fix proposals reviewed:
[#194](https://github.com/micromatch/picomatch/pull/194),
[#237](https://github.com/micromatch/picomatch/pull/237) (master line),
[#238](https://github.com/micromatch/picomatch/pull/238),
[#246](https://github.com/micromatch/picomatch/pull/246) (v2 line, 73 additions/0 deletions
with maintainer-direction matching semantics). All are open and unmerged. This repository
applies the #237/#246 collapse approach as package-manager-managed patches for the two
installed versions using pnpm's supported patch mechanism.

Files changed:

- `patches/picomatch@4.0.5.patch` — adds `isSelfRepeatingStarBranch`, reports
  `{ risky: false, collapse: true }` for single-branch star extglobs, and rewrites the
  extglob close token (`+(P)` → `(?:P)`, `*(P)` → `(?:P)?`); capture mode keeps the
  existing risky-extglob literal fallback. `maxExtglobRecursion: false` opt-out preserved.
- `patches/picomatch@2.3.2.patch` — same fix adapted to the 2.x line (mirrors #246).
- `pnpm-workspace.yaml` — registers both `patchedDependencies` via `pnpm patch-commit`.
- `pnpm-lock.yaml` — records both patch hashes; every consumer resolves to the
  `_patch_hash` instances.
- `scripts/security/test-picomatch-patch.mjs` — regression tests (13 cases): patch
  presence in every installed instance, no nested unbounded quantifiers, matching
  semantics equivalence against the `maxExtglobRecursion: false` behavior on short
  inputs across default/dot/windows/bash options, capture-mode literal fallback,
  quoted/escaped/path/bracket regexes unchanged, subprocess-deadline ReDoS timing
  checks for both 40- and 200-character crafted inputs, and lockfile/patch registration
  coverage.
- `scripts/security/verify-picomatch-release-artifact.cjs` — scans every `picomatch`
  copy inside `dist/` (including the standalone-traced `node_modules` tree) and fails if
  any packed copy lacks the patch. Run as `pnpm test:security-artifact` after
  `pnpm prod:build` (`pnpm validate:artifact-patches` chains both).
- `package.json` — adds `test:security-patches` (wired into `test:all` after
  `test:security-dependencies`), `test:security-artifact`, and
  `validate:artifact-patches`.

Mechanism guarantees: no manual `node_modules` edits (pnpm patch flow only), the patch
ships in git, `pnpm install --frozen-lockfile` applies it to every fresh install including
CI, and `pnpm test:security-patches` fails closed if any unpatched picomatch instance
reappears in the graph.

## Audit-policy question — resolved by registry-feed sync, request on standby

`pnpm test:security-patches` cannot change the npm audit result because `pnpm audit`
reads registry advisory metadata, not installed patch state. While npm's advisory feed
still carried GHSA-fc5q-39xc-vjpf, `pnpm audit:allowlist` failed on it, and this
remediation deliberately did not add an allowlist entry — the standing decision requires
explicit owner approval before modifying audit policy. Standing order at that window:

1. **Preferred:** keep re-running the audit until npm's feed ingests the GitHub
   withdrawal; the install tree then carries the pnpm patch as defense in depth and
   `pnpm audit:allowlist` passes with no policy change.
2. **Narrow allowlist exception (requires owner approval):** if a future withdrawal has
   not propagated by the time CI must pass, adding the advisory ID to
   `APPROVED_RESIDUAL_IDS` in `scripts/security/audit-allowlist.cjs` together with a
   residual-risk-register entry requires the explicit owner approval documented in the
   register — never an automatic agent edit.
3. **Upstream release:** when upstream publishes a picomatch release at or above the
   audit's fix target, drop both patches, update the lockfile normally, and remove this
   document's exception request.

Resolution: the preferred path completed during this remediation. At 17:45 UTC the
registry feed had ingested the withdrawal; `pnpm audit --json` reports 0 high and no
picomatch advisory, and `pnpm audit:allowlist` passes with the allowlist unchanged —
no policy modification was ever made. The pnpm patches remain installed as
defense in depth: measured pre-patch, a short crafted input blocked the event loop for
over 120 s while the npm-side question was unresolved; the patch removes that exposure
regardless of any single advisory feed's state.

## Validation evidence on 18 November 2026

- Pre-patch reproduction: `picomatch.makeRe('+(*a)')` compiled
  `^(?:(?=.)(?:[^/]*?a)+)$` on both 4.0.5 and 2.3.2, and `'a'.repeat(200) + 'b'`
  exceeded a 120 s shell timeout — the event loop block the advisory describes.
- Post-patch: every generated regex for the covered shapes drops the nested quantifier;
  the same 200-character input completes in milliseconds; all 13 patch regression cases
  pass inside `pnpm test:all`.
- Validation matrix: `validate:types`, `validate:dist`, `lint:package`, the full
  `test:all` 47-suite chain (with `DATABASE_URL` on the disposable loopback fixture),
  the Next.js production build, `pnpm prod:build` packaging, partner integration (73
  checks, 26 native contract groups), the 22-group browser regression, the full lint
  (0 errors, 453 warnings at the documented baseline), and the focused secret scan all
  pass; `git diff --check` is clean.
- Audit: `pnpm audit --json` reports 0 critical, 0 high, 10 moderate, 1 low after the
  feed sync; `pnpm audit:allowlist` passes with no approved or self-added exception.
- Release artifact: `dist/` contains no installed picomatch package (the runtime bundle
  cannot reach the vulnerable matcher); the only picomatch copy found is Next.js's
  vendored `dist/compiled` snapshot, which the artifact verifier and the audit both
  exclude and which remains documented residual context above.
