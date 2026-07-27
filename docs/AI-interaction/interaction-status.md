# AI Interaction Status

Update this file after every completed AI interaction.

## Current Interaction

- **Date**: 2026-07-27
- **Goal**: Fix Square OAuth so Sandbox test and Production application flows use isolated Square credentials, endpoints, callback URIs, and OAuth state.
- **Durable change**: Square OAuth now validates `SQUARE_ENVIRONMENT`, `SQUARE_APPLICATION_ID`, `SQUARE_REDIRECT_URI`, and the stored provider environment before authorization, callback consumption, token exchange, refresh, revoke, and API sync. Authorization URLs always include `redirect_uri`, and token exchange uses the identical callback URI.
- **Verification**: `pnpm test:retail-pos`, `pnpm exec tsc --noEmit --pretty false`, docs/security linters, callback route HTTP checks, and `git diff --check`.
- **Detailed record**: [Interactive log](../../project-logs/interactive-log.md)
- **Activity summary**: [Activity log](../../project-logs/activity-log.md)
