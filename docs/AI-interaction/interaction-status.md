# AI Interaction Status

Update this file after every completed AI interaction.

## Current Interaction

- **Date**: 2026-09-10
- **Goal**: Fix Accountancy and Pre-bookkeeping upload reliability for Excel dates, machine-readable PDF invoices, bank-fee categorization, and visible upload format choices.
- **Durable change**: Accountancy uploads normalize spreadsheet dates safely, extract invoice fields from machine-readable PDFs, protect bank-fee categorization from bad learned Equity rules, and show CSV, Excel, and PDF / Scan as the visible upload formats while preserving existing Pre-bookkeeping persistence, review, and export flow.
- **Verification**: `node -r tsx/esm scripts/accountancy/test-accountancy-upload-system.ts`, `pnpm validate:types`, and `git diff --check` pass.
- **Residual risk**: Scanned/image-only PDF extraction still requires a separate OCR/document-vision integration decision because no existing repository capability performs document OCR.
- **Detailed record**: [Interactive log](../../project-logs/interactive-log.md)
- **Activity summary**: [Activity log](../../project-logs/activity-log.md)
