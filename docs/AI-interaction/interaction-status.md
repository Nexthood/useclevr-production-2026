# AI Interaction Status

Update this file after every completed AI interaction.

## Current Interaction

- **Date**: 2026-06-12
- **Goal**: Fix Railway test deployment — Payload routes return 500 due to missing `@aws-crypto/crc32c` module stripped by over-broad `.gitignore` patterns.
- **Durable change**: `dist-root/.gitignore` patterns `build/` and `out/` prefixed with `/` so they only match at root level — restores compiled JS in pnpm store entries for all AWS SDK transitive deps.
- **Detailed record**: [Interactive log](../../project-logs/interactive-log.md)
- **Activity summary**: [Activity log](../../project-logs/activity-log.md)
