# UseClevr Agent Guide

This file gives AI agents (Codex, Kilo, OpenAI, Gemini, etc.) project-specific operating guidance.
It is intentionally brief — expand each section only when a consistent rule is needed.

## Agent Startup

Before making changes, agents should read:

- `AGENTS.md` (this file)
- `ai-chat-behavior.config.ts`
- `gemini-behavior.config.ts`
- `kilo.json` when running through Kilo
- `ai-chat-behavior.config.ts` is the shared behavior preset for Codex, Kilo, and other AI
  chat/coding agents. Keep durable project behavior there so it survives moving to a new computer or
  reinstalling local agent tooling.

## Files to Add to `.aiignore`

Add any file or directory that contains raw prompt text, provider keys, uploaded CSVs, or sensitive
user data so it is never sent to an AI context.

Current `.aiignore` entries (already present):

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

## Project Shape

- Next.js 16 app router, React 19, TypeScript 6, Tailwind CSS.
- Business intelligence app for uploaded CSV/business datasets.
- Cloud AI uses Gemini through the AI SDK.
- Local AI features use same-origin app routes and the local agent contract.
- Database access uses Drizzle with Neon PostgreSQL.

## Commands

```bash
pnpm dev
pnpm build
pnpm start
pnpm db:push
pnpm db:studio
pnpm exec tsc --noEmit --pretty false   # type-check only
pnpm validate                           # full pre-PR gate
pnpm health                             # validate + tests + docs + audit
```

## Editing Rules

- Keep changes focused on the requested behavior.
- **Do not read `dist/`, `.git/`, `.next/`, or `node_modules/`** to save tokens.
- Do not edit generated output in `.next/` or `dist/` unless the task explicitly asks for production
  bundle artifacts.
- Do not reverse worktree changes from another agent or commit.
- Prefer existing components and patterns before adding new abstractions.
- Keep UI contrast accessible in both light and dark themes.
- Use `src/assets/` for static assets. `src/app/assets/` is the route handler.

Strip sensitive data from AI context helpers before sending responses to openai/cloud vendors.

## AI Kilo / Other AI Instructions

### Kilo (this CLI)

- Use the `kilo.json` config at the repository root for agent, command, and permission settings.
- New commands go in `.kilo/command/*.md`. New agents go in `.kilo/agent/*.md`.
- Commands and agents are loaded automatically from those folders on startup.
- Kilo ignores `.aiignore` entries (also reads `.codexignore` when present).
- Kilo does **not** read `dist/`, `.git/`, `.next/`, or `node_modules/`.

### OpenAI Codex / Other Coding Agents

- Respect `ai-chat-behavior.config.ts` for the shared communication style and product voice.
- Respect `.aiignore` for sensitive/ignored paths.
- Respect `.gitignore` before reading source.
- Do not read `dist/`, `.git/`, `.next/`, or `node_modules/`.

## Key Files

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
- `AGENTS.md` (this file)
- `.aiignore`
- `CHANGELOG.md`

## Changelog rules (AI agents must follow these)

When writing or editing `CHANGELOG.md`:

- Never add new changes to a version that has already been committed or released. Put follow-up work
  in `## [Unreleased]` or create a new version section.
- Every entry must describe an **active change** — something added, fixed, changed, or removed in that release. Never write entries that only describe what was retained, preserved, or left unchanged.
- Use plain, user-facing language. Active voice: "Exports now include attachments" not "Attachment export support has been added".
- Describe what the user observes or benefits from. Explain why the change matters, not how the code is implemented.
- Do not mention function names, file names, internal identifiers, route handler names, package names, environment variable names, CI filenames, or source paths.
- Avoid developer-only wording unless the section is `### Dev`; even there, describe the practical maintenance or deployment benefit.
- Use product and business language: "Support can resolve customer tickets from the dashboard" instead of "Added ticket-store API route".
- Documentation-only edits, README updates, and planning notes do not belong in the changelog.
- CI, test tooling, and refactor changes with no user-visible effect belong under `### Dev` only.
- Section headers per release: `### Added`, `### Changed`, `### Fixed`, `### Removed`, `### Dev`. Include only sections with entries.
- Keep each entry as short as possible — one sentence per change. Do not repeat information across entries. Avoid mentioning function names, file names, or internal identifiers.

## CI / Railway dist files

Railway deploys `dist/` as the project root. Build is a two-phase pipeline with only one failing-cross-check — the `fast` CI validates it without touching `.next`.

### Build pipeline

```
CI / local (repo root)              Railway (dist container)
─────────────────                   ──────────────────────
pnpm prod:build                     (build phase — one-shot)
  └ next build --webpack            pnpm build
  └ create-dist.cjs                 pnpm exec drizzle-kit push
     → .next/standalone + static     node server.js
     → dist/server.js
     → dist/package.json             (no scripts build here)
     → dist/railway.json
     → dist/src/lib/db/ (schema)
```

### Source-of-truth files

| File | Role |
|---|---|
| `ci-settings/railway.dist.json` | Source-of-truth for CI + build config. Copy. Don't edit `dist/railway.json` directly. |
| `scripts/dist/create-dist.cjs` | Generates `dist/package.json`, copies schema, `railway.json`, assets. Only place dist is assembled. |
| `scripts/ci/sync-railway-config.cjs` | Copies `ci-settings/railway.dist.json` → `dist/railway.json`. Run it — not the opposite direction. |

### dist validation gate (runs in CI `fast` job)

```
pnpm validate:dist   →  node scripts/ci/sync-railway-config.cjs --check
```

Fails if `dist/railway.json` ≠ `ci-settings/railway.dist.json`.

### Do / Do not

- **Do** edit `ci-settings/railway.dist.json` for CI config changes, then run `node scripts/ci/sync-railway-config.cjs`.
- **Do** regenerate `dist/` with `pnpm prod:build` after any change that needs a deploy preview.
- **Do not** run `pnpm build` from inside `dist/`. The build command (`pnpm prod:build`) runs from the repo root — `dist/` has no `build` script and no parent `package.json`.
- **Do not** hand-edit files in `dist/`. They are generated. Regenerate them.
- **Do not** `git add dist/` when preparing a PR. `dist/` is `.gitignore`-ed; CI regenerates it.

### Why `dist/` changes on every build regardless of source

`next build --webpack` always produces a new compilation hash. `create-dist.cjs` wipes and rewrites `dist/` from scratch with no content hashing. This is expected; both `dist/` and `.next/` are `.gitignore`-ed and regenerated by CI on every push. CI is fast because `pnpm/action-setup@v5` caches the pnpm store — the actual `pnpm install` step rarely re-downloads dependencies.

## Todo pipeline

AI agents must keep `.todo/todo.md` and `.todo/todo-next.md` in sync with active work:

- `.todo/todo.md` — tracks the **leading edge** of work (everything that is currently in progress). When all
  tasks in this file are marked done, refresh it from `.todo/todo-next.md`.
- `.todo/todo-next.md` — holds the **backlog** (confirmed work not yet started, plus blocked items).
  Copy items to `todo.md` when you start them, then remove them here.
- `.todo/todo.md` → **Completed ✅** — When a task is fully done, write a short entry in the Completed
  section of `todo.md`. Items in Completed must drive two destination files:
  - **`requirements.md`** — Convert every completed item into a product-facing requirement entry using
    the user's perspective. Describe the behaviour the user sees or the need that was addressed, not
    how it was implemented.
  - **`CHANGELOG.md`** — If the change is user-observable, add a changelog entry under `## [Unreleased]`
    in the appropriate section (`Added`, `Changed`, `Fixed`, …). Developer-only or infra-only changes go
    under `### Dev`.
- Any newly identified work (bug reports, suggestions, new features) goes straight into `todo-next.md`
  so it is never lost.
- Never leave `todo.md` with stale In-Progress items. When a subsection is empty, remove it. Every
  completed task must have a destination in `requirements.md` and `CHANGELOG.md`.

### Per-dev commit messaging style

<!-- Apply only to formalised output. Re-verify conciseness for each sentence. -->
<!-- Source: captured working notes from the session, distilled 2026-05-18. -->

- Keep the tone **analytical yet concise**, grounded in **engineering discipline and product-first thinking**.  
- Use **active voice**, minimise adjectives, and remove all boilerplate filler. Every sentence must contribute concrete information — no praise, no hedging, and no agendas beyond what’s on the page.  
- Follow standard **subject–verb–object** order wherever possible; state **what is true and why** rather than **what could or might occur**.  
- When naming files or subsystems, use **bold** formatting inline and avoid ASCII tagging:  

  | Prefer | Avoid |
  ||---|---|
  | **`dist/railway.json`** | `dist/railway.json`, ``code/`` |
  | **`dist/`** | \`dist/\`, `code/` |
  | Yes | absolutely, truly, rapidly |
  | gates deactivated | louvers disengaged |
  | commit | unlock / release |
