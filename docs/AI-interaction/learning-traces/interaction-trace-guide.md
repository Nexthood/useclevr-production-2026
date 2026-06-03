# Interaction Trace Guide

Use this guide when reviewing or writing AI interaction traces for user education and project learning.

## Good Trace Content

- User goal in one sentence.
- AI action in one sentence.
- Current outcome in one sentence.
- Concrete problem markers with severity.
- User learning in plain language.
- AI-agent learning for future improvement.
- Short suggested next actions.
- Tags for feature area, page, provider, data source, issue type, and user intent when known.

## Problem Markers

- `blocker`: The task cannot complete until this is fixed.
- `risk`: The issue can cause regression, security exposure, deployment failure, or wrong user outcome.
- `improvement`: The issue does not block work but improves quality, clarity, speed, or confidence.
- `observation`: The trace records useful context without requiring action.

## Learning Outputs

- Move active implementation findings to `.TODO/todo-next.md`.
- Move deferred risk-prevention work to `.TODO/todo-future.md`.
- Move deliberate no-fix decisions to `.TODO/todo-ignore.md`.
- Update requirements and changelog when the trace changes product behavior.
- Update prompt files when the trace shows a better reusable prompt pattern.
