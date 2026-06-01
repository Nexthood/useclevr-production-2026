# Prompt Collection

Use these prompts as starting points. Adjust names, branches, and pages to the current task.

## Current-State Product Text

```text
Rewrite this product text as current-state requirements and current rules.
Use direct verbs such as Show, Use, Route, Keep, Open, Support, and Prevent.
Avoid past states, removed options, speculative possibilities, and future blockages.
Mention past or future states only when the detail prevents a concrete risk.
Keep each bullet short and user-observable.
```

## AI Instruction Update

```text
Update durable AI instructions.
Apply the instruction in AGENTS.md, .TODO/config.json, and docs/AI-interaction.
Update user guidance, AI-agent guidance, and prompt examples when the instruction changes how agents
or users should write, request, verify, or document work.
Use current-state language in every text file.
```

## Dashboard Feature Work

```text
Review the current dashboard implementation, preserve existing worktree changes, implement the
requested page behavior, update requirements and changelog, retire the TODO task, and run focused
validation.
```

## Railway Deploy Review

```text
Review Railway deploy for the given source and deployment branch pair.
For test: beta source, dist-test deployment.
For production: main source, dist deployment.
Check generated deployment config (railpack.json, railway.json), node_modules presence in dist,
Railpack provider format (singular "node", not array), symlink preservation (cp -a vs fs.cpSync),
and deployment logs.
```

## Railway Deploy Troubleshooting

```text
Diagnose Railway deploy failure.
Check whether the build phase or runtime phase fails.
For build: check railpack.json provider format, node_modules/ in source, lockfile detection.
For runtime (502): check startup logs, database connectivity (SSL), cold-start timeout,
missing env vars (DATABASE_URL, AUTH_SECRET), and healthcheck response.
```

## Bookkeeping Feature Work

```text
Add bookkeeping behavior to Accountancy.
Show bank reconciliation, expense coding, receipt tracking, monthly close, tax preparation, and
compliance readiness as current dashboard features.
Separate user guidance from developer guidance and update requirements.
```
