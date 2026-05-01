# AI Integration

Checklist for changing Gemini, AI SDK, local AI bridge, prompts, or verified computation.

## Current Stack

Gemini via AI SDK for cloud AI. Local AI through same-origin app routes that communicate with the local agent contract.

## Checklist

| Area | Check |
| --- | --- |
| Provider config | `GEMINI_API_KEY` server-side only, never exposed to browser |
| Prompt behavior | Prompts describe task clearly, avoid asking model to invent metrics |
| Verified computation | Numeric answers from deterministic/query logic before AI explains |
| Error handling | AI failures return useful errors or safe fallbacks |
| Timeouts/rate limits | Long AI calls bounded and logged |
| Local AI | Browser code calls same-origin API routes, not `127.0.0.1` directly |
| Logging | Logs help debug provider failures without leaking prompts with sensitive data |

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
