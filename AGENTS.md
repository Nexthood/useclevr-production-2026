# Agent Guide

This guide gives AI agents project-specific operating instructions.

## Before Starting

Read these first:

- This file (AGENTS.md)
- `ai-chat-behavior.config.ts`
- `gemini-behavior.config.ts`
- `kilo.json` (when using Kilo)
- Keep `ai-chat-behavior.config.ts` updated for shared agent behavior

## Files to Ignore

Add files with raw prompts, keys, CSV data, or sensitive user data to `.aiignore` so they're never sent to AI.

Current entries:

```
.next/
dist/
.git/
node_modules/
pnpm-lock.yaml
package-lock.json
*.log
.env*
coverage/
.cache/
tmp/
out/
```

## What We Build

- Next.js 16 app router, React 19, TypeScript 6, Tailwind CSS
- Business intelligence for uploaded CSV/datasets
- Cloud AI: Gemini via AI SDK
- Local AI: same-origin app routes + local agent contract
- Database: Drizzle with Neon PostgreSQL

## Key Commands

```bash
pnpm dev              # start dev server
pnpm build            # build for production
pnpm start            # start production server
pnpm db:push          # push database changes
pnpm db:studio        # open database GUI
pnpm exec tsc --noEmit --pretty false   # type check only
pnpm validate         # full pre-PR check
pnpm health           # validate + tests + docs + audit
pnpm lint:staged      # staged ESLint autofix and Prettier formatting
```

## Editing Rules

- Focus on requested behavior only
- Never read `dist/`, `.git/`, `.next/`, or `node_modules/` (saves tokens)
- Never edit output in `.next/` or `dist/` unless making production bundle artifacts
- Never reverse another agent's worktree changes
- Use existing components/patterns before adding new abstractions
- Keep UI accessible in light and dark themes
- Use `src/assets/` for static assets; `src/app/assets/` is route handler
- Remove sensitive data from AI context before sending to openai/cloud vendors
- Use direct current-state language in all text files. Describe current behavior and current rules,
  not past states, removed options, speculative possibilities, or future blockages. Mention past or
  future states only when the detail prevents a concrete risk.
- Keep the deprecated `middleware.ts` packaging path temporarily when it is the only stable
  production dist build path. Revisit `middleware` to `proxy` after production build succeeds, dist
  packages correctly, Railway starts, and `/api/health` passes.

## Script Rules

- ESM for source-side maintenance scripts (package is `type: module`)
- CommonJS for runtime preload/start scripts, deployment helpers, tooling entry points (need `node -r`)
- Use `scripts/lib/app-config.js` from ESM scripts and `scripts/lib/app-config.cjs` from CommonJS (aligned path/package policy)

## Agent-Specific

### Kilo (this CLI)

- Use `kilo.json` at repo root for agent, command, permissions
- New commands: `.kilo/command/*.md`; new agents: `.kilo/agent/*.md`
- Loaded automatically on startup
- Ignores `.aiignore` (also reads `.codexignore` if present)
- Never reads `dist/`, `.git/`, `.next/`, or `node_modules/`

### OpenAI Codex / Other Coding Agents

- Follow `ai-chat-behavior.config.ts` for communication style and product voice
- Respect `.aiignore` for sensitive/ignored paths
- Respect `.gitignore` before reading source
- Never read `dist/`, `.git/`, `.next/`, or `node_modules/`
- Update `docs/AI-interaction/` after every durable AI instruction change, including user guidance,
  AI-agent guidance, prompt style, text-language rules, and bookkeeping guidance
- Use the single-developer workflow while active: pre-commit handles staged autofix and metadata
  checks; CI handles type validation, dist config, critical tests, build, and deployment packaging.

## Important Files

- `src/app/api/chat/route.ts`
- `src/app/api/query/route.ts`
- `src/app/api/upload/route.ts`
- `src/lib/llmAdapter.ts`
- `src/lib/ai/`
- `src/lib/data/`
- `src/lib/business/`
- `src/lib/queryEngine.ts`
- `src/lib/queryIntentPrompt.ts`
- `ai-chat-behavior.config.ts`
- `gemini-behavior.config.ts`
- This file (AGENTS.md)
- `.aiignore`
- `CHANGELOG.md`

## Changelog Rules

When editing `CHANGELOG.md`:

- Add new entries to top `## [Unreleased]` section (create if missing)
- Never add changes to already released versions; use `## [Unreleased]` or new version
- Never modify dated release section unless fixing release notes
- Every entry must describe an active change (added, fixed, changed, removed)
- Never write about what was kept/preserved
- Use present-action statements (e.g., "Add feature" not "Feature added")
- Prefer current-state product wording: "Show ticket creation on the Tickets page" instead of
  comparing against past page placement or removed forms
- Use plain user language: "Exports now include attachments" not "Attachment export support added"
- Describe user benefit and why it matters (not implementation)
- Never mention: function names, file names, internal IDs, routes, packages, env vars, CI files, source paths
- Skip developer-only text unless in `### Dev` section (then describe practical benefit)
- Use product language: "Support resolves dashboard tickets" not "Added ticket-store API route"
- Skip: documentation edits, README updates, planning notes
- `CI/test/tooling/refactor` with no user effect go under `### Dev` only
- Section headers per release: `### Added`, `### Changed`, `### Fixed`, `### Removed`, `### Dev` (use only if entries exist)
- One sentence per change max; no repeated info; no function/file/internal IDs

## Deployment

Railway serves `dist/` from `dist` branch `/dist`; Vercel serves source from `main` using `vercel.json` synced from `dist-root/server-config/vercel.json`.
Build: source check → generate Railway output.

Railway test deploy reviews use only `beta` and `dist-test`. Do not inspect or trigger `main`,
`dist`, or the live app when the task names the test deploy.

PR titles start with `PR:`; dist-publish commits use merged PR title (fallback if none).

`dist-root/server-config/` holds deployment configs copied to branch `/server-config`; host templates use `railway.json` and `vercel.json`; GitHub Actions in `.github/workflows/`.

### Build Steps

Local/CI → Railway (`dist` branch `/dist`)

```
pnpm prod:build
  → next build --webpack
  → create-dist.cjs
    → .next/standalone + static
    → start.sh → start-dist.cjs
    → dist/server.js
    → dist/package.json
    → dist/src/lib/db/ (schema)
    → server-config/railway.json
    → server-config/vercel.json
```

### Source-of-Truth

| File                                     | Purpose                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `dist-root/server-config/railway.json`   | Railway deploy target → `/server-config/railway.json` on dist branch                              |
| `dist-root/server-config/vercel.json`    | Vercel source deploy → `/server-config/vercel.json` on dist branch + root `vercel.json` on source |
| `scripts/package-dist/create-dist.cjs`   | Makes `dist/package.json`, copies schema/runtime/assets (only place)                              |
| `scripts/server/railway/sync-config.cjs` | Validates `dist-root/server-config/railway.json` (no host config copy)                            |
| `scripts/server/vercel/sync-config.cjs`  | Copies `dist-root/server-config/vercel.json` → `vercel.json` (not reverse)                        |

Database migrations stay in Railway `preDeployCommand`; deployment = single web service (add migration job only if background work/risk needs isolation).

### Validation Gate (CI)

```
pnpm validate:dist  →  Checks Railway/Vercel deploy config sync
```

Checks templates on source branches: Railway config under `dist-root/server-config/`; Vercel source `vercel.json` must match template.

**Do**:

- Edit `dist-root/server-config/railway.json` for Railway changes → run `node scripts/server/railway/sync-config.cjs --check`
- Edit `dist-root/server-config/vercel.json` for Vercel changes → run `node scripts/server/vercel/sync-config.cjs`
- Regenerate local `dist/` with `pnpm prod:build` after deploy-needed changes
- Keep packaging scripts in `scripts/package-dist/` (`scripts/dist/` blocked by `dist/` ignore)
- Publish `railway.json` and `vercel.json` only under `/server-config` on `dist` branch
- Keep Railway service root at `/dist`; config at `/server-config/railway.json`
- Keep server-specific helpers in `scripts/server/<host>/`; local/general in existing `scripts/` folders
- Keep Vercel source-branch config in root `vercel.json` (synced from template)

**Don't**:

- Run `pnpm build` inside `dist/` (build from repo root; `dist/` has no script/package.json)
- Publish `railway.json` or `vercel.json` at `dist` branch root or inside `/dist`
- Move `dist-root/` under build scripts (it stores host templates)
- Edit files in `dist/` (they're generated; regenerate instead)
- `git add dist/` when preparing PR (`.gitignore`ed on source; CI regenerates → publishes to deployment branch)

### Why `dist/` Changes Every Build

`next build --webpack` makes new hash each time; `create-dist.cjs` rewrites `dist/` from scratch (no hashing). Expected: both `dist/` and `.next/` are `.gitignore`ed and regenerated by CI on push. CI uses Corepack for pnpm (no third-party setup action needed).

## TODOs

AI agents keep regular `.TODO/` queue files synced:

- `.TODO/config.json`: owns metadata; read `nextTaskNumber` before adding; use `T-` prefix; increment after assigning
- `.TODO/todo-next.md`: **only active queue**; add confirmed work here before start; one `T-` task per bullet
- `.TODO/todo-done.md`: stores completed work; user-visible work must update `requirements.md`; release-facing changes update `CHANGELOG.md`
- `.TODO/todo-future.md`: holds valid deferred work
- `.TODO/todo-ignore.md`: holds deliberate no-fix decisions with rationale
- Dist/audit-specific TODO files retired; follow-ups/findings go to regular next/done/future/ignore
- Keep task numbers stable when moving work between active/retired
- Write task descriptions as direct present-action (not retrospective changelog)
- Write all text-file bullets as current-state behavior; mention past states, removed options,
  speculative possibilities, or future blockages only for risk prevention
- Fold temporary TODO files back to regular queues before considering migration/audit complete
- Run `pnpm lint:todos` after TODO metadata changes

## Commits

Uses conventional commits via commitlint/Husky. `PR:` and `PR-123:` also accepted for PR/dist-publish automation.

Format: `<type>(optional-scope): <subject>`

- Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`, `revert`
- Subject: lowercase, no period
- Never reference internal files/functions in subject unless explicitly asked for technical maintenance
- Breaking changes: add `!` after type; describe break in commit body

Examples:

- `feat: add customer ticket filters`
- `fix(api): handle empty upload responses`
- `docs: update deployment guide`
- `PR: improve dashboard onboarding`

### Commit Style (Dev)

- Tone: analytical yet concise (engineering discipline + product-first)
- Voice: active; minimize adjectives; cut boilerplate; every sentence adds concrete info (no praise/hedging/agendas)
- Order: subject-verb-object; state what's true and why (not what could/might occur)
- File/subsystem names: **bold** inline; avoid ASCII tags
- Prefer: **`server-config/railway.json`** over `server-config/railway.json` or `code/`
- Prefer: **`dist/`** over `dist/` or `code/`
- Prefer: direct words like "Yes", "gates deactivated", "commit" over inflated phrasing
