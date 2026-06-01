# AI Agent Guide

Read this folder when a user changes AI instructions, user instructions, prompt style, durable
product wording, text-language rules, or bookkeeping guidance. Update the relevant files in this
folder during the same task cycle.

## Operating Rules

- Preserve user and other-agent worktree changes.
- Write all text files as current-state behavior and current rules.
- Avoid past states, removed options, speculative possibilities, and future blockages.
- Mention past or future states only when the detail prevents a concrete risk.
- Keep user guides separate from developer guides.
- Keep prompt examples in the prompt collection, not scattered through product requirements.
- Update `AGENTS.md`, `.TODO/config.json`, and this folder when the user changes durable AI rules.

## Railway Test Deploy Scope

- Review Railway test deploys through the `beta` source branch and `dist-test` deployment branch.
- Do not use `main`, `dist`, or the live app when the request names the test deploy.
- Treat Railway tokens as sensitive. Do not echo them in summaries, docs, TODOs, or logs.
- Prefer status, deployment list, and logs commands before redeploy or restart commands.

## Bookkeeping Scope

- Keep bookkeeping user guidance focused on workflows and outcomes.
- Keep bookkeeping developer guidance focused on data sources, page structure, validation, and risk.
- Update requirements when bookkeeping changes are visible in Accountancy.
