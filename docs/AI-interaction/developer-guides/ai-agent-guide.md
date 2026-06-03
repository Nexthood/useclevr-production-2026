# AI Agent Guide

Read this folder when a user changes AI instructions, user instructions, prompt style, durable
product wording, text-language rules, or bookkeeping guidance. Update the relevant files in this
folder during the same task cycle.

## Operating Rules

- Preserve user and other-agent worktree changes.
- Read project instructions and inspect current worktree status before editing.
- Identify whether changes are user-visible, developer-only, deployment-only, sales-only, or documentation-only.
- Add a TODO task before confirmed implementation work starts when the work is active implementation.
- Write all text files as current-state behavior and current rules.
- Avoid past states, removed options, speculative possibilities, and future blockages.
- Mention past or future states only when the detail prevents a concrete risk.
- Keep user guides separate from developer guides.
- Keep prompt examples in the prompt collection, not scattered through product requirements.
- Keep reusable prompt files in `docs/AI-interaction/prompt-library/`.
- Update `AGENTS.md`, `.TODO/config.json`, and this folder when the user changes durable AI rules.
- Use compact status updates during long-running validation, deploy checks, and broad implementation work.
- Use [AI memory collection](../prompt-library/ai-memory-collection.md) when the user brings learning from another AI chat into this project.

## Work Cycle

- Prefer current code patterns over copying old files directly from history.
- Keep changes scoped to the requested behavior.
- Verify with typecheck, lint, docs checks, and build when routes or shared UI change.
- Move completed tasks to `todo-done.md` only after the work is complete.
- Update requirements for user-observable product behavior.
- Update changelog with active, release-facing language.
- Report remaining risks or deferred work without marking it complete.
- Prefer a concise final summary with changed areas, validation, and remaining risks.

## Railway Deploy Scope

- Review Railway test deploys through the `beta` source branch and `dist-test` deployment branch.
- Review Railway production deploys through the `main` source branch and `dist` deployment branch.
- Do not use `main`, `dist`, or the live app when the request names the test deploy.
- Treat Railway tokens as sensitive. Do not echo them in summaries, docs, TODOs, or logs.
- Prefer status, deployment list, and logs commands before redeploy or restart commands.
- The `dist` branch includes `dist/node_modules/` (33MB pnpm symlink structure) — Railpack requires
  it for build graph checksums. The publish workflow never removes `node_modules/` from output.
- `railpack.json` at the `dist` branch root uses `"provider": "node"` (singular string) with no custom
  install/build steps — custom steps prevent Node.js runtime setup.
- `cp -a` (shell) preserves relative symlinks in `node_modules/.pnpm/`; `fs.cpSync` (Node.js)
  resolves them to absolute paths and breaks the pnpm structure on Railway.
- If the main Railway deploy fails with `"/app/node_modules": not found`, the `dist` branch is
  outdated — it needs a fresh publish with `node_modules/` committed.
- If the deploy fails with `node: command not found`, the `railpack.json` has custom steps that
  skip Node.js runtime setup. Remove custom steps, keep only `{ "provider": "node" }`.

## Bookkeeping Scope

- Keep bookkeeping user guidance focused on workflows and outcomes.
- Keep bookkeeping developer guidance focused on data sources, page structure, validation, and risk.
- Update requirements when bookkeeping changes are visible in Accountancy.

## AI Interaction Tracing Scope

- Every user-AI interaction is logged to the `aiInteractionTraces` database table with provider name,
  model name, latency, token count, error status, and prompt version.
- Traces enable user-facing history, search, export, and feedback features.
- Superadmin analytics pages show aggregate usage, provider distribution, error rates, and top queries.
- The `aiInteractionTraces` table has a foreign key to the `User` table with cascade delete.
- Trace anonymization strips email addresses from stored prompts and responses.
- Trace retention is configurable via superadmin UI; default is 90 days with auto-cleanup.
- The `createTrace` utility is fire-and-forget — it never blocks the response or throws.
- Prompt versions are tracked via a `PROMPT_VERSION` constant in `src/lib/ai/ai-trace.ts`.
- Update the prompt version constant when prompt templates change to correlate trace quality.
- Use [Interaction trace learning](../prompt-library/interaction-trace-learning.md) when a user asks the AI to leave useful traces, mark problems, educate the user, or collect learning suggestions.
