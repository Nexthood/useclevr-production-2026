# AI Interaction Status

Update this file after every completed AI interaction.

## Current Interaction

- **Date**: 2026-08-20
- **Goal**: Fix only Accountancy Ledger generated PDF routing so `10_accountancy_ledger` enters the ledger branch and does not render debit as Operating Profit.
- **Durable change**: The PDF generator resolves ledger routing from `reportType` and report profile metadata, logs `resolvedReportType`, `resolvedModel`, `operatingProfit`, `totalDebits`, and `totalCredits` before rendering, asserts accountancy ledger PDFs keep Operating Profit null and debit/credit totals finite, preserves raw KPI values for PDF rendering, and renders ledger KPIs from raw or formatted KPI values.
- **Verification**: `pnpm exec tsc --noEmit --pretty false` passes. A focused generated `10_accountancy_ledger` PDF at `/tmp/useclevr-ledger-routing-check/pdfs/10_accountancy_ledger_report_ledger-routing-check.pdf` contains `Total Debits $407.4K`, `Total Credits $414.9K`, and `Net Movement -$7.5K`, and does not contain `Operating Profit $407.4K` or `Directly from source field: debit`. `pnpm lint:todos` passes. The broad `scripts/analysis/test-dataset-aware-report-profiles.ts` script stops on an unrelated local-retail Results Summary assertion before reaching this ledger case.
- **Detailed record**: [Interactive log](../../project-logs/interactive-log.md)
- **Activity summary**: [Activity log](../../project-logs/activity-log.md)
