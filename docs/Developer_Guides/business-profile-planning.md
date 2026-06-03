# Business Profile Planning

This guide records the product planning split for the expanded Business Profile scope. The active task queue owns implementation; this guide explains how the retired Sales TODO source maps into the current product plan.

## Implemented Baseline

- Business Profile lives in the top-level Business workspace.
- Business overview shows business records, profile summary, review readiness, and subpage links.
- Business subpages cover profile, locations, tax, financial settings, and review.
- Setup progress includes business profile fields and business page visits.
- Business records support multi-business listing, archive and restore state, subscription-tier limits, entity details, and cached country tax context.

## Active Planning Scope

- Expand Business Profile from the current baseline fields into a structured pre-accounting foundation.
- Keep the first implementation slice practical: company identity, business type, revenue streams, cost structure, tax context, and review output.
- Use conditional questions by business type.
- Use save-and-continue behavior so users can complete the profile gradually.
- Keep critical fields required and advanced fields optional.
- Show examples and short explanations for fields that affect calculations.
- Validate numeric currency fields, dates, percentages, net/VAT/gross separation, payment frequency, duplicate costs, and missing payment dates.

## Deferred Modules

- Insurance policies, coverage gaps, renewal reminders, and insurance cost ratios are deferred product modules.
- Loans, leasing, debt service, financing risk, and repayment schedules are deferred product modules.
- Assets, equipment, depreciation context, maintenance costs, and asset coverage are deferred product modules.
- Employees, payroll, contractor costs, hiring plans, and staff cost ratios are deferred product modules.
- Cash-flow, payment terms, inventory, marketing spend, compliance, risk scoring, goals, and forecast scenarios are deferred product modules.
- Example output reports and scenario-based KPI packs are deferred until the structured data model is in place.

## Product Boundaries

- UseClevr provides business intelligence, estimates, and decision-support context.
- UseClevr does not replace accountants, tax advisors, lawyers, insurance brokers, or regulated financial advisors.
- Tax, legal, insurance, and financing outputs are labelled as estimate, user-provided value, or professional verification required.
- The Business Profile stays lightweight and SME-friendly; it does not become an ERP, accounting ledger, payroll system, policy-management system, or lending platform.

## Queue Mapping

- Active implementation work lives in `.TODO/todo-next.md`.
- Deferred roadmap work lives in `.TODO/todo-future.md`.
- Deliberate boundary decisions live in `.TODO/todo-ignore.md`.
- Completed baseline work remains in `.TODO/todo-done.md`.
