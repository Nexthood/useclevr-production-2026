# AI Tracing Structure

## Table of Contents

- [Product Trace Structure](#product-trace-structure)
- [Instruction Structure](#instruction-structure)
- [Update Rules](#update-rules)

Use this guide when AI prompts, assistant routes, trace storage, feedback, export, or analytics change.

## Product Trace Structure

- AI Assistant requests create non-blocking interaction traces.
- Traces store user, prompt, answer, provider, model, prompt version, latency, token count, error state, and feedback when available.
- Trace storage redacts email-like values, provider keys, tokens, webhook secrets, and credential-like assignments before prompts, answers, and errors are persisted.
- Users can review, search, re-run, export, and rate their own AI history.
- Super-admins can review aggregate trace analytics, benchmarking, provider distribution, error rate, and top queries.
- Business Profile and Company Setup changes that alter AI context update trace guidance so future traces explain which business context shaped an answer.
- Dataset analysis prompts include confirmed Business Profile context and instruct the assistant to
  mark missing profile values as missing instead of assuming them.
- Dataset analysis prompts include the uploaded-data plus Business Profile calculation layer when
  available, including adjusted tax, payroll, insurance, fixed-cost, margin, warning, and conflict
  values that shape the answer.
- UseClevr dataset MCP tool invocations record traces to `aiInteractionTraces` via
  `recordMCPTrace` (fire-and-forget, non-blocking). Provider is `MCP`, model is
  `tool:{toolName}`. Payload News and FAQ MCP requests use Payload API-key controls and do not enter
  the UseClevr dataset trace path.
- MCP tool changes that alter AI context, prompt inputs, provider-visible metadata, audit logs, or trace fields update trace guidance.
- Local Mock AI traces use provider `Mock AI` and model `mock-local-development` so development responses stay distinguishable from Gemini, Antigravity, and local model traces.
- Local Mock AI status, model-list, pull, and verification routes are development-only helpers for localhost UI testing and do not create production provider traces.

## Instruction Structure

- Store user-facing trace guidance in `docs/AI-interaction/user-guides/`.
- Store agent and developer trace rules in `docs/AI-interaction/developer-guides/`.
- Store trace-learning and problem-marker rules in `docs/AI-interaction/learning-traces/`.
- Store reusable trace prompts in `project-prompts/`.
- Keep `AGENTS.md` aligned with durable trace behavior.

## Update Rules

- Update the prompt version when prompt templates change.
- Update requirements when trace behavior changes what users can see, search, export, or control.
- Update changelog when trace behavior changes user workflow, admin workflow, or developer workflow.
- Update Business Profile and bookkeeping guides when setup context changes AI analysis confidence.
- Update MCP and FAQ guidance when tool scope, FAQ source, public/private context boundaries, service-token access, audit logging, or rate limiting change AI-visible content.
- Keep raw datasets, secrets, tokens, webhook secrets, environment values, customer data, and private keys out of trace examples.
- Run `pnpm lint:secrets` after trace docs, prompt examples, deployment notes, or credential setup examples change.
- During broad audits, classify findings as lesson, issue, risk, decision, or improvement before updating TODO queues or project guides.
