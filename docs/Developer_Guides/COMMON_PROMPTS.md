# Common Development Prompts

## Focused Fix

```text
Find the regression, patch the smallest current-code fix, update changelog and requirements if user-visible, then run typecheck and lint.
```

## Feature Restore

```text
Check git history for the old feature, compare it with the current app shape, restore the behavior using current components and APIs, then verify the route works.
```

## Release Prep

```text
Review todo-next, move completed work to todo-done, update changelog and requirements, run validate, then summarize remaining risk.
```

## Deployment Debug

```text
Check source validation first, then inspect deploy config source-of-truth files, then review generated-output packaging only if the source checks pass.
```
