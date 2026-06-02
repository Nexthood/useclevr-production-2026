# User Behaviour Guide

Use this guide for user-facing collaboration requests.

## Request Style

- Describe the current product state you want.
- Name the page, workflow, branch, or deployment target first.
- Include verification expectations when the work affects build, deploy, login, upload, billing, or AI.
- Ask for requirements, changelog, TODO, and AI-interaction docs updates when the instruction changes durable behavior.

## Text Style

- Use direct current-state language.
- Prefer product outcomes over implementation details.
- Mention older behavior only when it prevents a concrete regression.
- Keep examples in the prompt collection.

## Deployment Requests

- Scope test deploy requests to `beta` and `dist-test`.
- Scope production deploy requests to `main` and `dist`.
- Ask for `/api/health`, page response, and host routing checks when deployment is part of the task.
