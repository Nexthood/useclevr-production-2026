# AI Interaction Status

Update this file after every completed AI interaction.

## Current Interaction

- **Date**: 2026-08-30
- **Goal**: Reproduce one production sign-up failure on `https://app.useclevr.com`, capture the exact server-side failure chain, and ship the smallest production fix without changing TEST service configuration.
- **Durable change**: Railway predeploy now applies the existing profile regional-preferences migration so production `Profile` inserts match the active application schema.
- **Verification**: controlled production sign-up reproduced `POST /login` returning the server-action error payload; local server-action replay captured PostgreSQL `42703` for missing `Profile.regionalPreferences`; applying predeploy added the column; production sign-up now reaches the 6-digit verification screen and Resend returns `200` with a message id.
- **Residual risk**: Existing superadmin login still requires the real password and received 6-digit code, which are not available in this local session.
- **Detailed record**: [Interactive log](../../project-logs/interactive-log.md)
- **Activity summary**: [Activity log](../../project-logs/activity-log.md)
