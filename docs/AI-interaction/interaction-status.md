# AI Interaction Status

Update this file after every completed AI interaction.

## Current Interaction

- **Date**: 2026-08-12
- **Goal**: Rebrand the existing Ghost Mode private AI session feature as Eclipse Mode without changing privacy architecture.
- **Durable change**: The AI Assistant privacy control, first-use notice, history empty state, shared privacy warning, current Privacy Policy copy, and current changelog entry now present Eclipse Mode. The UI uses a custom partial-eclipse glyph, switch semantics, aria checked state, restrained motion, and reduced-motion support while retaining existing `ghostMode` storage, API, trace, billing, provider-routing, Local AI, Cloud AI, and dataset-isolation behavior.
- **Verification**: `pnpm test:ghost-mode` passes; `pnpm validate:types` passes.
- **Detailed record**: [Interactive log](../../project-logs/interactive-log.md)
- **Activity summary**: [Activity log](../../project-logs/activity-log.md)
