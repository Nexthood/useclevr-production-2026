# Bookkeeping Developer Guide

The canonical developer guide lives at [../../Developer_Guides/BOOKKEEPING.md](../../Developer_Guides/BOOKKEEPING.md).
Keep this AI interaction guide aligned with it when bookkeeping implementation instructions change.

## Current Structure

- Overview: `/app/accountancy`
- Reporting: `/app/accountancy/reporting`
- Tax: `/app/accountancy/tax`
- Compliance: `/app/accountancy/compliance`

## Data Sources

- Dataset counts come from uploaded datasets.
- Business readiness comes from business profile records.
- Tax and compliance context comes from the primary business profile.
- Empty accounts must render guidance instead of throwing on missing business details.

## Implementation Rules

- Use shared dashboard components for action rows, cards, and tables.
- Keep table rows title-first with a supporting open/edit link and row-end actions.
- Link bookkeeping uploads to dataset upload until dedicated bookkeeping storage exists.
- Keep user-facing copy direct and current-state.
- Update requirements and AI interaction docs when bookkeeping behavior changes.

## Risk Prevention

- Guard missing business profile data.
- Do not make tax estimates look final without location and industry context.
- Do not store uploaded raw financial data in documentation or AI prompts.
