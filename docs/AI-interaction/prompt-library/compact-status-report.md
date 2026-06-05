# Compact Status Report Prompt

Use this prompt when an AI assistant is running validation, deploy checks, git workflow steps, or a broad implementation pass.

```text
Give compact status updates while working.

For each update, write one line with:
- current phase
- command or action
- current result
- next action

Keep updates short.
Use direct success/failure words.
Avoid long explanations unless a blocker appears.
Preserve staged and unstaged work from other agents or the user.
```

## Report Shape

```text
Phase: validation. Command: pnpm exec tsc --noEmit --pretty false. Result: running. Next: fix compiler errors or continue docs checks.
```
