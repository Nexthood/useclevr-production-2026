
## Goal
Add Mock AI mode plan for development with fake AI responses

## Constraints & Preferences
- Follow existing .TODO/.PLAN conventions
- Keep files concise and actionable

## Progress
### Done
- Cleaned up .TODO/todo-next.md (removed duplicate Development Experience sections)
- Restored anchored chat summary in chat-summary.md
- Created .TODO/.PLAN/mock-ai-mode.md (all sections, style guide, deployment guide)

### In Progress
- Mock AI mode plan awaiting user review

### Blocked
- (none)

## Key Decisions
- Mock AI mode uses .env.mock + Node --env-file with root fallback
- Experimental toggle via temporary /api/ai-provider-debug handler
- Direct .env.mock writes discouraged; use --env-file overrides instead

## Next Steps
- (awaiting further direction)

## Critical Context
- chat-summary.md is the source of truth for conversation state
- TODO annotations corrected (T-606, T-616, T-665, T-704)
- All changes validated: lint, typecheck, deploy config

## Relevant Files
- .TODO/.PLAN/mock-ai-mode.md (Mock AI mode plan, all sections)
- .TODO/todo-next.md (T-667 onwards)
- .TODO/config.json (nextTaskNumber: 676)
