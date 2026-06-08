# AI Interaction Status

Update this file after every completed AI interaction.

## Current Interaction

- **Date**: 2026-06-08
- **Goal**: Complete remaining TODO tasks — fix auth 500 on Railway, add Docker HEALTHCHECK,
  SIGTERM handler, Payload seed guard, FAQ seed + MCP Payload query, hotfix docs, dist branch
  README, and MCP token management UI.
- **Durable change**: AUTH_SECRET/NEXTAUTH_SECRET fallback, HEALTHCHECK in Dockerfile, graceful
  shutdown handler, Payload table-existence guard, FAQ seed data (25 items, 5 categories),
  getFaqsFromPayload with static fallback, hotfix/rollback docs, dist branch README, superadmin
  MCP token management UI with create/revoke/list, middleware blocking non-MCP routes on MCP
  subdomains, Dockerfile pnpm install for pg.
- **Detailed record**: [Interactive log](../../project-logs/interactive-log.md)
- **Activity summary**: [Activity log](../../project-logs/activity-log.md)
