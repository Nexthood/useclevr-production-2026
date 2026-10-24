# ChatGPT Integration Commit Preparation

Local scope: record four approved source commits on integration/chatgpt-2026-10-20 in a separate worktree based on verified upstream 05816e35. Preserve the original main worktree and a private backup. No push, deployment, archive generation, or OpenAI submission occurs.

## Baseline and Preserved Work

Local `main` points to `eab70041`. Cached `origin/main` points to `05816e35`, five commits ahead. A read-only upstream fetch verifies that origin/main remains at 05816e35. Local main is not merged or rebased.

The existing ChatGPT integration is committed in `8d8d2209`, with token-resource compatibility in `4c512e06`, consent redirects in `50d83eea`, and private-key ignore protection in `2f6c94fa`.

The pending `src/proxy.ts` and `src/app/.well-known/openai-apps-challenge/route.ts` exactly match cached `origin/main`: domain exposure is committed in `f779f89a`, and the proof correction is committed in `7eda8504`. Keep both local files intact and exclude their duplicate implementation from the four groups. The dedicated integration worktree starts at that upstream baseline; the original worktree remains intact. Pulling over its untracked challenge route can conflict, so this task performs no branch synchronization there.

## Group 1 — OAuth Security and Disposable Integration Tests

Suggested title: `fix: validate chatgpt account linking with isolated integration tests`

Files:

- `src/lib/chatgpt/oauth.ts`
- `src/app/api/chatgpt/oauth/authorize/route.ts`
- `scripts/analysis/test-chatgpt-mcp-integration.ts`
- `scripts/analysis/test-chatgpt-oauth-flow.ts`
- `scripts/analysis/chatgpt-test-environment.mjs`
- `scripts/analysis/chatgpt-test-db.ts`
- `scripts/analysis/run-chatgpt-tests.mjs`
- `scripts/analysis/test-chatgpt-test-safety.mjs`
- `package.json`
- `.github/workflows/ci.yml`
- `docs/AI-interaction/developer-guides/chatgpt-integration-testing.md`

Shared-file hunks: T-1087 in `.TODO/todo-done.md`; reserve through T-1087 in `.TODO/config.json` with `nextTaskNumber: 1088`; the OAuth and isolated-test requirements in `requirements.md`; the ChatGPT security fix and disposable-test Dev entries in `CHANGELOG.md`; the matching OAuth/test paragraphs in all three interaction records.

The async authorization validator and its callers ship together. CI runs `pnpm test:chatgpt` explicitly before `pnpm test:all`; no existing general tests are replaced. This group changes no deployment configuration or unrelated feature modules.

## Group 2 — Publisher Identity and Submission Sources

Suggested title: `chore: reconcile useclevr submission publisher identity`

Files:

- `.gitignore`
- `openai-plugin-submission/plugin.json`
- `openai-plugin-submission/mcp.json`
- `openai-plugin-submission/listing-metadata.json`
- `openai-plugin-submission/assets/composer-icon.svg`
- `openai-plugin-submission/assets/logo.png`
- `openai-plugin-submission/review/review-test-cases.md`
- `openai-plugin-submission/security/security-review-checklist.md`
- `openai-plugin-submission/submission-instructions.md`

Shared-file hunks: the submission-source Dev entry in `CHANGELOG.md` and publisher/source-package paragraphs in all three interaction records. The validator belongs to group 3 so its consistency checks and diagnostic evidence have one review boundary.

UseClevr identifies the product. Atlas Mega Ventures identifies the package author and intended publisher. The operator confirms affiliation and the selected verified OpenAI identity; package metadata does not verify ownership.

## Group 3 — Submission Consistency and CIMD Evidence

Suggested title: `chore: validate openai submission metadata consistency`

Files:

- `openai-plugin-submission/validate-submission-package.mjs`
- `docs/AI-interaction/openai-cimd-portal-support-report.txt`

Shared-file hunks: the local submission-consistency Dev entry in `CHANGELOG.md`, the earlier CIMD portal investigation, and current consistency-validation paragraphs in all three interaction records.

The support report describes the exact historical 1.0.2 ZIP. The source validator checks publisher/listing/OAuth agreement. Neither establishes that the portal saves a CIMD connection. This group includes tooling so its Dev changelog entry describes an active validation behavior.

## Group 4 — Domain Requirements and Final Readiness Records

Suggested title: `docs: record chatgpt integration validation and domain requirements`

Files/hunks:

- `requirements.md`: domain-verification requirement.
- `CHANGELOG.md`: public-domain-verification Dev entry.
- `.TODO/todo-done.md`: T-1086 domain evidence and T-1088 finalization.
- `.TODO/config.json`: final `nextTaskNumber: 1089` allocation.
- `docs/AI-interaction/interaction-status.md`: final readiness summary and dated domain evidence.
- `project-logs/activity-log.md`: domain evidence and final commit-preparation summary.
- `project-logs/interactive-log.md`: domain evidence and final commit-preparation summary.
- `docs/AI-interaction/chatgpt-integration-commit-groups.md`: this exact plan and validation record.

The final active queue contains neither completed T-1087 nor completed T-1088. Both task descriptions move intact into the done queue. T-1086 cites the actual upstream proof-correction commit.

All four commits require matching `CHANGELOG.md`, `project-logs/interactive-log.md`, `project-logs/activity-log.md`, and `docs/AI-interaction/interaction-status.md` hunks because the existing pre-commit project-record check requires those four files for each nonempty commit. Stage shared files by the group-specific content listed above; whole-file staging combines groups. The four groups are staged and reviewed separately in the integration worktree; the original worktree remains unchanged.

## Files Outside Source Commits

- `useclevr-openai-plugin-1.0.1.zip`
- `useclevr-openai-plugin-1.0.2.zip`
- `useclevr-openai-plugin-1.0.1-validation.json`
- The duplicate domain route/proxy implementation identified above.

All three historical artifacts remain intact. `.gitignore` excludes the root archive/report patterns. No source commit includes database files, environment files, private keys, test credentials, generated build output, or container data.

## Local Validation

- `pnpm test:chatgpt`: 3 safety tests, 27 OAuth-to-MCP checks, and the existing MCP integration suite pass against separate databases in a fresh network-disabled PostgreSQL 17 container.
- `pnpm exec tsc --noEmit --pretty false --incremental false`: passes.
- `node openai-plugin-submission/validate-submission-package.mjs`: passes; operator-only identity/access/portal checks remain explicit.
- Focused ESLint on OAuth source, authorization route, and submission validator: zero errors; two console-output warnings in the maintenance validator.
- Secret, TODO, package, workflow, changelog, project-record, deployment-config consistency, and whitespace checks pass.
- Full application builds and the unrelated general test suite are outside this focused local validation. Hosted CI and live endpoints are not executed.

## Assessment

READY for the four reviewed local source commits on the dedicated integration branch. The branch starts at verified upstream 05816e35; the original main worktree stays unchanged. No local test/code blocker remains. Git history records each commit hash.

NOT READY for OpenAI submission: the operator must confirm the verified Atlas Mega Ventures identity/affiliation, reviewer email-proof access, demo visibility, privacy disclosures, production client/callback allowlists, file attachment behavior, tool annotations, portal CIMD saving, domain verification, and tool scanning. This task does not perform or authorize those external actions.
