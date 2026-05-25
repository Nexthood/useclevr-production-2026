# User-AI Communication Patterns

## S-1 Request Shape

- U-1 The user often gives compact prompts with multiple outcomes in one message.
- U-2 The user expects the agent to inspect files and history before deciding.
- U-3 The user values implementation, verification, TODO updates, and changelog updates in the same pass.

## S-2 Effective AI Response

- A-1 Start with repository context, then make focused changes.
- A-2 Keep status updates short during long commands.
- A-3 Preserve staged or unrelated work and avoid undoing prior agent changes.

## S-3 Risk Points

- F-1 Broad prompts need an explicit task split before edits start.
- F-2 Feature restoration requires checking route links, sidebar links, API support, and current UI patterns.
- F-3 TODO retirement must only happen after the work is implemented or deliberately deferred.
