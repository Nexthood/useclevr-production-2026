# UseClevr Codex Guide

This file gives OpenAI Codex and other coding agents project-specific operating guidance.

## Agent Startup

Before making changes, agents should read:

- `AGENTS.md`
- `ai-chat-behavior.config.ts`
- `gemini-behavior.config.ts`
- `kilo.json` when running through Kilo

`ai-chat-behavior.config.ts` is the shared behavior preset for Codex, Kilo, and other AI chat/coding agents. Keep durable project behavior there so it survives moving to a new computer or reinstalling local agent tooling.

## Project Shape

- Next.js 16 app router, React 19, TypeScript 6, Tailwind CSS.
- Business intelligence app for uploaded CSV/business datasets.
- Cloud AI currently uses Gemini through the AI SDK.
- Local AI features go through same-origin app routes and the local agent contract.
- Database access uses Drizzle with Neon PostgreSQL.

## Commands

Use `pnpm`.

```bash
pnpm dev
pnpm build
pnpm start
pnpm db:push
pnpm db:studio
```

`pnpm build` is the preferred smoke test. `pnpm exec tsc --noEmit` may expose broader repo type debt that is unrelated to a narrow change.

## Editing Rules

- Keep changes focused on the requested behavior.
- Do not edit generated output in `.next/` or `dist/.next/` unless the task explicitly asks for production bundle artifacts.
- Do not revert unrelated worktree changes.
- Prefer existing components and patterns before adding new abstractions.
- Keep UI contrast accessible in both light and dark themes.
- Use `src/assets/` for static assets. `src/app/assets/` is only the route handler.

## AI Behavior Rules

- Deterministic TypeScript/query logic is the source of truth for numbers, metrics, filters, forecasts, and dataset-derived claims.
- AI should explain verified data. It must not invent metrics or silently assume columns.
- If required data is missing, say what is missing and offer a next step.
- Keep provider secrets server-side only.
- Browser code should call same-origin API routes for AI work.
- Log AI/provider failures enough to debug without leaking sensitive prompts or uploaded data.
- **DO NOT read `dist/`, `.git/`, or `.next/` folders to save input tokens.**
- Agents must respect rules defined in `.gitignore` and `.aiignore` to prevent unnecessary token consumption.

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
