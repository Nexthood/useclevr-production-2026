# AI Interaction Status

Update this file after every completed AI interaction.

## Current Interaction

- **Date**: 2026-08-03
- **Goal**: Fix the Pre-bookkeeping export pipeline row-count mismatch.
- **Durable change**: Pre-bookkeeping CSV and Excel exports require an explicit export scope for current filtered rows, reviewed transactions, or all transactions; filtered exports send row indexes to the backend, Excel files contain Transactions, Summary, and VAT Summary sheets, and unsupported accountant-package exports show Coming soon.
- **Verification**: Accountancy upload/export regression script, TypeScript, focused ESLint, and diff whitespace checks passed.
- **Detailed record**: [Interactive log](../../project-logs/interactive-log.md)
- **Activity summary**: [Activity log](../../project-logs/activity-log.md)
