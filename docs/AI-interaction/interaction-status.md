# AI Interaction Status

Update this file after every completed AI interaction.

## Current Interaction

- **Date**: 2026-09-10
- **Goal**: Investigate and fix the production routing issue where `www.useclevr.com` loads and `app.useclevr.com/` returns HTTP 500.
- **Durable change**: The proxy routes only `app.useclevr.com/` through the existing application entry flow: signed-out users go to `/login`, signed-in users go to `/app`, and the marketing host root remains unchanged.
- **Verification**: `pnpm test:auth` and `pnpm validate:types` pass.
- **Residual risk**: Production still needs deploy-time verification after this source change reaches Railway.
- **Detailed record**: [Interactive log](../../project-logs/interactive-log.md)
- **Activity summary**: [Activity log](../../project-logs/activity-log.md)
