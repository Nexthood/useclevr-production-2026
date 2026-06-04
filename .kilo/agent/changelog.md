# Kilo Agent Behavior

## Changelog Rules

When adding changelog entries:

1. **Always add under `## [Unreleased]`** - Never add entries under an existing released version section
2. The `## [Unreleased]` section is for changes not yet in a released version
3. Once a version is released, move its entries from Unreleased to the new version section
4. Use the appropriate subsection: `### Added`, `### Changed`, `### Fixed`, `### Dev`, etc.

## AI Interaction Rules

1. Use compact progress updates for long-running validation, deploy checks, and git workflow steps.
2. Run `docs/AI-interaction/prompt-library/ai-memory-collection-post-interaction.md` after each completed request/response cycle and keep only durable learning.
3. Use `docs/AI-interaction/prompt-library/ai-memory-collection.md` when collecting learning from another AI chat.
4. Preserve staged and unstaged changes from users and other agents before editing.

## Example

**Correct:**
```markdown
## [Unreleased]

### Dev
- New feature for next release
```

**Incorrect:**
```markdown
## [7.2.0] - 2026-05-20

### Dev
- Fix for already released version  <- WRONG
```
