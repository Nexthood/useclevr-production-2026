# AI Integration Skill

Use this checklist when changing Gemini, AI SDK, local AI bridge, prompt behavior, or verified computation paths.

## Current AI Model

Gemini via AI SDK is the active cloud AI provider. Local AI is supported through same-origin app routes that communicate with the local agent contract.

## Review Checklist

| Area | What To Check |
| --- | --- |
| Provider config | `GEMINI_API_KEY` is required only on the server side and is never exposed to browser code. |
| Prompt behavior | Prompts describe the task clearly and avoid asking the model to invent unsupported metrics. |
| Verified computation | Numeric answers should come from deterministic/query logic before the AI explains them. |
| Error handling | AI failures return useful errors or safe fallbacks instead of crashing the route. |
| Timeouts and rate limits | Long AI calls are bounded and logged enough for troubleshooting. |
| Local AI | Browser code calls same-origin API routes, not `127.0.0.1` directly. |
| Logging | Logs help debug provider failures without leaking prompts containing sensitive user data. |

## Common Files

- `app/api/chat/route.ts`
- `app/api/query/route.ts`
- `app/api/local-ai-status/route.ts`
- `app/api/local-ai-install/route.ts`
- `lib/llmAdapter.ts`
- `lib/ai-*`
- `lib/queryEngine.ts`
- `lib/queryIntentPrompt.ts`
- `lib/local-agent.ts`

## Environment

```env
GEMINI_API_KEY=...
```
