# Kilo Agent Behavior

## Changelog Rules

When adding changelog entries:

1. **Always add under `## [Unreleased]`** - Never add entries under an existing released version section
2. The `## [Unreleased]` section is for changes not yet in a released version
3. Once a version is released, move its entries from Unreleased to the new version section
4. Use the appropriate subsection: `### Added`, `### Changed`, `### Fixed`, `### Dev`, etc.

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