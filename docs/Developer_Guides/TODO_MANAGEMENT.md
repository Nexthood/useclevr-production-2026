# TODO Management

## Table Of Contents

- [Flow](#flow)
- [Files](#files)
- [How To Add Work](#how-to-add-work)
- [Completion Rules](#completion-rules)
- [Dist Planning](#dist-planning)

This repository tracks active work in `.TODO/` files using the lowercase filenames documented in
`AGENTS.md`.

## Flow

```mermaid
flowchart TD
  Backlog[.TODO/todo-next.md] --> Active[.TODO/todo.md]
  Active --> Done[.TODO/todo-done.md]
  Done --> Requirements[requirements.md]
  Done --> Changelog[CHANGELOG.md]
  Backlog --> Future[.TODO/todo-future.md]
```

## Files

| File                        | Purpose                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| `.TODO/todo.md`             | Current leading-edge work and completed items waiting to be moved. |
| `.TODO/todo-next.md`        | Confirmed backlog that is ready to start.                          |
| `.TODO/todo-done.md`        | Durable completed work history.                                    |
| `.TODO/todo-future.md`      | Valid work that should wait.                                       |
| `.TODO/todo-dist.md`        | Active dist and deployment planning.                               |
| `.TODO/todo-dist-future.md` | Future dist and deployment ideas.                                  |
| `.TODO/todo-dist-done.md`   | Completed dist and deployment work.                                |
| `.TODO/todo-dist-no-fix.md` | Deliberate no-fix decisions with rationale.                        |

## How To Add Work

Add newly identified work to `.TODO/todo-next.md` unless the user asks to start it immediately. Keep
each item short, actionable, and tied to one outcome.

When work starts, move the active item into `.TODO/todo.md`. Do not leave stale in-progress entries
after the change is complete.

## Completion Rules

Completed items must update `.TODO/todo-done.md`. User-observable changes also update
`requirements.md`; user-visible release changes update `CHANGELOG.md` under `## [Unreleased]`.

Developer-only changes belong in the changelog `### Dev` section.

## Dist Planning

Dist and deployment planning stays in the dedicated dist TODO files. Do not duplicate those items in
the general TODO queue.
