# Business Profile Planning

This guide records the product planning split for the expanded Business Profile scope. The active task queue owns implementation; this guide explains how the retired Sales TODO source maps into the current product plan.

## Implemented Baseline

- Business Profile lives in the top-level Business workspace.
- Business overview shows business records, profile summary, review readiness, and subpage links.
- Business subpages cover profile, locations, tax, financial settings, and review.
- Setup progress includes business profile fields and business page visits.
- Business records support multi-business listing, archive and restore state, subscription-tier limits, entity details, and cached country tax context.
- Company setup data saves through the business setup API and can be loaded back into the setup wizard.
- Company setup review flags appear on the Business overview when setup data is incomplete or uncertain.
- Company Calculation Context converts setup data into adjusted KPI, profit, tax, cash-flow, and confidence outputs.

## Architecture Principle

- Business Profile is the identity and configuration layer.
- Tax intelligence is a separate cached service layer.
- AI analysis is a separate analytics layer.
- Accountancy is a separate financial-readiness layer.
- Modules stay separated and composable so Business Profile does not become a large business-management system.

## Active Planning Scope

- Expand Business Profile from the current baseline fields into a structured pre-accounting foundation.
- Keep the first implementation slice practical: company identity, business type, revenue streams, cost structure, tax context, and review output.
- Use conditional questions by business type.
- Use save-and-continue behavior so users can complete the profile gradually.
- Keep critical fields required and advanced fields optional.
- Show examples and short explanations for fields that affect calculations.
- Validate numeric currency fields, dates, percentages, net/VAT/gross separation, payment frequency, duplicate costs, and missing payment dates.

## Canonical User Flow

1. Open Business from the dashboard sidebar or topbar.
2. Review the businesses listing table on `/app/business`.
3. Open a business row or setup action.
4. Complete Business subpages for profile, locations, tax, financial settings, and review.
5. Use company setup data to improve deterministic analysis, confidence labels, and AI narrative context.

Compatibility redirects can send old settings-based business URLs into the Business workspace, but
the canonical product flow starts from `/app/business`.

## Company Setup Scope

- Company setup collects company, tax, currency, revenue, expense, insurance, loan, leasing, and review information.
- Difficult questions include a `Not sure` option.
- `Not sure` keeps the user moving and lowers confidence or adds a review flag.
- The review step shows setup accuracy, completed sections, missing fields, accountant review flags, and a collapsible payload preview.
- The setup payload remains manual input only; OCR, document scanning, bank integrations, and external accounting integrations stay out of scope.

## Company Setup Payload

- `companyInfo`: company name, registration country, tax residence, legal structure, industry, and accounting method.
- `taxSettings`: tax registration, tax type, tax rate, gross/net revenue handling, gross/net expense handling, and tax-estimate preference.
- `currencySettings`: primary currency, reporting currency, and other currencies used.
- `revenueRules`: revenue sources, customer type, invoice/payment timing, payment providers, refunds, and chargebacks.
- `expenseRules`: expense categories, mixed business/private costs, receipt availability, and recurring expenses.
- `insuranceSettings`: business insurance, insurance types, premium amount, payment frequency, and business-use percentage.
- `loanLeasingSettings`: loans, leasing, credit cards, overdraft, monthly debt payment, known interest, and known principal/interest split.
- `setupStatus`: setup accuracy, completed sections, missing fields, and accountant review flags.

## Calculation Context Rules

- Company setup feeds `CompanyCalculationContext`.
- Deterministic calculations apply company context before AI narrative and reports.
- Confidence labels show high, medium, or low based on setup completeness and missing inputs.
- AI explanations use estimated or needs-review language when setup data is incomplete.
- Loan principal repayment is not a normal expense.
- Loan interest is an expense.
- Credit card repayments do not double-count underlying expenses.
- Leasing, insurance splits, mixed gross/net tax treatment, and unknown accounting method create accountant review flags.

## Deferred Modules

- Insurance policies, coverage gaps, renewal reminders, and insurance cost ratios are deferred product modules.
- Loans, leasing, debt service, financing risk, and repayment schedules are deferred product modules.
- Assets, equipment, depreciation context, maintenance costs, and asset coverage are deferred product modules.
- Employees, payroll, contractor costs, hiring plans, and staff cost ratios are deferred product modules.
- Cash-flow, payment terms, inventory, marketing spend, compliance, risk scoring, goals, and forecast scenarios are deferred product modules.
- Example output reports and scenario-based KPI packs are deferred until the structured data model is in place.
- Business profile import/export, templates, version history, custom fields, team sharing, audit log, third-party API, notifications, search, and advanced privacy controls are deferred product modules.

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
