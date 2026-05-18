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

- Every entry must describe an **active change** — something added, fixed, changed, or removed in that release. Never write entries that only describe what was retained, preserved, or left unchanged.
- Use plain, user-facing language. Active voice: "Exports now include attachments" not "Attachment export support has been added".
- Describe what the user observes or benefits from. Do not mention internal identifiers, environment variable names, or file paths.
- Documentation-only edits, README updates, and planning notes do not belong in the changelog.
- CI, test tooling, and refactor changes with no user-visible effect belong under `### Dev` only.
- Section headers per release: `### Added`, `### Changed`, `### Fixed`, `### Removed`, `### Dev`. Include only sections with entries.
- Keep each entry as short as possible — one sentence per change. Do not repeat information across entries. Avoid mentioning function names, file names, or internal identifiers.
