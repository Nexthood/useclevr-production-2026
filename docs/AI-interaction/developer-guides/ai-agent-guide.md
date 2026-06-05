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
- Write instruction text with super-precise language that sharpens wording from current-state and
  concise into naming the actor, the required action, and the target file or target outcome with no
  vagueness.
- Avoid past states, removed options, speculative possibilities, and future blockages.
- Mention past or future states only when the detail prevents a concrete risk.
- Keep user guides separate from developer guides.
- Keep prompt examples in the prompt collection, not scattered through product requirements.
- Keep reusable prompt files in `docs/AI-interaction/prompt-library/`.
- Update `AGENTS.md`, `.TODO/config.json`, and this folder when the user changes durable AI rules.
- Use compact status updates during long-running validation, deploy checks, and broad implementation work.
- Use [AI memory collection](../prompt-library/ai-memory-collection.md) when the user brings learning from another AI chat into this project.
- This AI agent must run [post-interaction memory capture](../prompt-library/ai-memory-collection-post-interaction.md) after each completed request/response cycle and keep only durable learning.
- This AI agent must treat `AGENTS.md`, `.kilo/agent/changelog.md`, `ai-chat-behavior.config.ts`, and `gemini-behavior.config.ts` as the instruction sources for post-interaction behavior.
- This AI agent must use [Post-interaction hook](post-interaction-hook.md) to choose the smallest matching destination files for persona, guides, FAQ, prompt files, TODOs, requirements, or changelog updates instead of one technical summary file.
- Prepare future developers by recording concise AI-collaboration lessons that explain correction patterns, expectations, and reusable working habits.
- Keep the post-interaction summary short enough that the correction pattern is obvious at a glance.
- When durable structure changes, record the split in the doc that owns the audience rather than repeating it everywhere.
- Read [dev-persona.md](dev-persona.md) before starting work with the project owner — follow their communication style and expectations.
- Follow the [AI memory collection guide](ai-memory-collection-guide.md) for the collection flow and classification rules.
- Run `pnpm lint:secrets` after docs, prompt-library, trace, deployment, or credential guidance changes.
- Keep real API keys, tokens, passwords, webhook secrets, and private keys out of docs, prompts, traces, TODOs, logs, and final summaries.

## Work Cycle

- Prefer current code patterns over copying old files directly from history.
- Keep changes scoped to the requested behavior.
- Verify with typecheck, lint, docs checks, and build when routes or shared UI change.
- Move completed tasks to `todo-done.md` only after the work is complete.
- Add new dashboard UI work to `.TODO/todo-next.md` only when a concrete current behavior is missing — keep resolved audit notes as current-state references.
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
- Check Railway deploy status with the project's own scripts at `scripts/server/railway/railway.cjs`,
  not by hand-crafting GraphQL queries. Use `pnpm railway:login` to verify auth,
  `pnpm railway:status` for project connectivity, and `railway deployment list` for recent
  deployment statuses. `pnpm railway:logs` falls through to the native binary for runtime logs.
  The API token is in `.env` as `RAILWAY_API_TOKEN`; the link file `.railway/project.json` is
  gitignored. See `docs/Developer_Guides/RAILWAY_DEPLOYMENT.md` and the Railway CLI section in
  `AGENTS.md`.
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
- Keep Business Profile and Company Setup context aligned with AI tracing guidance when setup data changes analysis confidence.

## Local AI And Mock Scope

- Local AI features use same-origin app routes and the local agent contract.
- The Hybrid AI Router (`src/lib/ai/ai-router.ts`) routes queries in priority order: Antigravity Server (local proxy) → Local AI (Ollama) → Cloud AI (Gemini Flash 2.5). Mock AI short-circuits before any real provider check.
- Local AI availability uses a `/api/local-ai-status` endpoint and Ollama health checks through `/api/ollama/tags` and `/api/ollama/test`.
- Local MCP work keeps real local AI active unless a development task explicitly enables mock mode.
- Mock AI mode uses `MOCK_AI_MODE=true` in non-production runtime to return local development responses. It short-circuits the router before real provider checks. Supported flows: chat (streaming and non-streaming), dataset analysis, local AI status, model list, model pull, and model verification.
- Mock AI mode is implemented in `src/lib/ai/mock-ai.ts`. Response delay is configurable via `MOCK_AI_RESPONSE_DELAY_MS` (default 250ms, max 5000ms).
- Mock AI mode records traces with provider `Mock AI` and model `mock-local-development`.
- Mock AI mode stays disabled in production runtime even when the environment variable is present. The guard is `process.env.NODE_ENV !== "production" && process.env.MOCK_AI_MODE === "true"`.
- Mock response templates, scenario storage, and a development UI toggle are future enhancements tracked in `todo-future.md`.
- Update trace guidance when mock mode changes provider names, prompt versions, or trace fields.
- The local AI bridge (`scripts/local-ai-bridge/server.js`) is a separate Node.js HTTP server that proxies requests to Ollama. It is not required when using cloud or mock modes. Default port 3210, configurable via `PORT` env var.
- Set `MOCK_AI_MODE=true` and `GEMINI_API_KEY` in `.env.local` for development without Ollama running.

## AI Interaction Tracing Scope

- Every user-AI interaction is logged to the `aiInteractionTraces` database table with provider name,
  model name, latency, token count, error status, and prompt version.
- Traces enable user-facing history, search, export, and feedback features.
- Superadmin analytics pages show aggregate usage, provider distribution, error rates, and top queries.
- The `aiInteractionTraces` table has a foreign key to the `User` table with cascade delete.
- Trace anonymization strips email addresses from stored prompts and responses.
- Trace examples and learning summaries use placeholders for credentials and omit provider tokens, webhook secrets, and environment values.
- Trace storage redacts credential-like values before prompts, answers, and errors are saved.
- Trace retention is configurable via superadmin UI; default is 90 days with auto-cleanup.
- The `createTrace` utility is fire-and-forget — it never blocks the response or throws.
- Prompt versions are tracked via a `PROMPT_VERSION` constant in `src/lib/ai/ai-trace.ts`.
- Update the prompt version constant when prompt templates change to correlate trace quality.
- Use [Interaction trace learning](../prompt-library/interaction-trace-learning.md) when a user asks the AI to leave useful traces, mark problems, educate the user, or collect learning suggestions.
