# Long Running Commands

## Local Pattern

- Start with the narrowest validation command that proves the change.
- Let production builds finish when route generation or TypeScript has already started.
- Report the current phase when a command runs longer than expected.
- Keep the command output available until the process exits.

## Common Commands

```bash
pnpm validate:types
pnpm lint
pnpm build
pnpm prod:build
```

## Timeout Handling

- If a command stalls before producing useful output, stop and rerun the narrower check.
- If a command reaches compilation or static generation, wait for completion unless the user asks to stop.
- If a command fails from port conflicts, retry on the next available local port.
