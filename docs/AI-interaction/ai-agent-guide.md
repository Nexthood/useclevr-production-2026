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

## Railway Deploy Scope

- Review Railway test deploys through the `beta` source branch and `dist-test` deployment branch.
- Review Railway production deploys through the `main` source branch and `dist` deployment branch.
- Do not use `main`, `dist`, or the live app when the request names the test deploy.
- Treat Railway tokens as sensitive. Do not echo them in summaries, docs, TODOs, or logs.
- Prefer status, deployment list, and logs commands before redeploy or restart commands.
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
