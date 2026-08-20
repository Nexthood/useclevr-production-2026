# AI Interaction Status

Update this file after every completed AI interaction.

## Current Interaction

- **Date**: 2026-08-20
- **Goal**: Fix Generic Business generated-report canonical resolution so `08_generic_business` recognizes `invoice_id`, exact `cost`, and explicit `profit` before PDF rendering.
- **Durable change**: The report builder routes the strict generic-business financial schema to the generic report profile, uses reliable `invoice_id` values for transaction counts and AOV only on generic reports, maps exact `cost` to generic cost totals, maps explicit `profit` to source-backed profit and margin, and keeps generic `profit` out of Net Profit.
- **Verification**: `pnpm test:generic-business-canonical-resolution` passes and prints `resolvedReportType: generic`, `resolvedModel: generic_business`, `revenue: 344429.41`, `transactionIdentifierSource: invoice_id`, `transactionCount: 180`, `cost: 202990.21`, `profit: 141439.2`, `profitMargin: 41.06`, `customers: 89`, `units: 1169`, and `products: 6`; the generated PDF at `/tmp/useclevr-reports/pdfs/08_generic_business_xlsx_report_832d88e6.pdf` contains Orders 180, AOV `$1.9K`, COGS `$203.0K`, Gross Profit `$141.4K`, and Gross Margin `41.1%`, and excludes the false missing order and COGS claims. `pnpm exec tsc --noEmit --pretty false`, `pnpm lint:todos`, and `pnpm lint:package` pass before record updates.
- **Detailed record**: [Interactive log](../../project-logs/interactive-log.md)
- **Activity summary**: [Activity log](../../project-logs/activity-log.md)
