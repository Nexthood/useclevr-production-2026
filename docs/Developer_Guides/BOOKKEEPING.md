# Bookkeeping

Bookkeeping features live in the dashboard Accountancy workspace.

## Current Structure

- Overview: `/app/accountancy`
- Reporting: `/app/accountancy/reporting`
- Tax: `/app/accountancy/tax`
- Compliance: `/app/accountancy/compliance`

## Data Sources

- Dataset counts come from uploaded datasets.
- Business readiness comes from business profile records.
- Tax and compliance context comes from the primary business profile.
- Empty accounts render guidance instead of throwing on missing business details.

## Implementation Rules

- Use shared dashboard components for action rows, cards, and tables.
- Keep table rows title-first with a supporting open/edit link and row-end actions.
- Link bookkeeping uploads to dataset upload until dedicated bookkeeping storage exists.
- Keep user-facing copy direct and current-state.
- Update requirements and AI interaction docs when bookkeeping behavior changes.

## Risk Prevention

- Guard missing business profile data.
- Keep tax estimates contextual until location and industry data exist.
- Keep uploaded raw financial data out of documentation and AI prompts.
