# Risk Intelligence

Risk Intelligence is a Hybrid AI Lite dashboard module that calculates deterministic business-risk signals for one selected dataset at a time. The engine supports standard, retail, ecommerce (retail domain), SaaS, profitability, accountancy, marketplace, investor portfolio, and pre-bookkeeping datasets.

## Architecture

- The server calculates all scores through the centralized Risk Intelligence engine.
- The React page renders calculated results and does not calculate severity, score, limits, or rule thresholds.
- The engine builds the authoritative business semantic profile (`buildBusinessSemanticProfile`) from dataset columns, rows, dataset type, and business model, then derives every risk metric from semantically confirmed concepts only.
- A rule executes only when (1) the semantic dataset type is in the rule's supported types, (2) every required semantic concept maps to a confirmed column, and (3) the rule metric is available from those concepts. Unsupported rules are reported in `notApplicableRules` with the exact reason and contribute nothing to any score.
- Monetary investor fields (invested amount, entry/latest valuation, ownership) and portfolio annual revenue never map to generic revenue; investor portfolios use dedicated portfolio concentration and runway rules instead.
- Trend rules require a validated revenue-or-sales series column, a validated period dimension (reporting date; investment dates never serve as reporting periods), at least two comparable periods, and values from the same single semantic series.
- Date parsing uses one canonical parser (`src/lib/data/canonical-date.ts`) shared by the data cleaner, business semantics, and the risk engine; a value cannot be valid in one module and invalid in another.
- The first version stores no Risk Intelligence table; every page load and API request recalculates from existing dataset records and row data.
- Unsupported metrics stay unavailable, are listed in `missingMetrics`, and do not reduce category or overall scores.
- AI explanation is optional; deterministic results remain complete when no AI provider is available.

## Categories

- Inventory Risk
- Financial Risk
- Profitability Risk
- Cash Flow Risk
- Revenue Concentration Risk
- Data Quality Risk

Category cards render only categories with at least one applicable rule. Rules that cannot execute appear in `notApplicableRules` instead of contributing scores.

Risk Intelligence excludes enterprise GRC, audit, compliance, legal, vendor, approval, insurance, regulatory, notification, and scenario-planning workflows.

## Scoring

Scores range from 0 to 100 where higher values mean greater risk.

| Score | Severity |
| ----: | :------- |
|  0-24 | Low      |
| 25-49 | Medium   |
| 50-74 | High     |
| 75-100 | Critical |

Rule scoring uses:

```text
sum(triggeredRuleScore * ruleWeight) / sum(applicableRuleWeights)
```

Category scores use applicable rules in that category only. Overall scores use all applicable rules for the selected dataset. A rule contributes a weight only when it evaluated with an available metric; unavailable rules are excluded from the numerator and denominator and reported as not applicable. Results are deterministic: identical inputs produce identical scores.

## Rule Thresholds

- Inventory dead-stock ratio (standard, retail): Medium at 10%, High at 20%, Critical at 35%.
- Financial revenue decline (standard, retail, profitability, SaaS; requires validated revenue/sales series plus period dimension): Medium at -5%, High at -10%, Critical at -20%.
- Profitability risk (standard, retail, profitability, SaaS): declining gross margin, negative net margin, multiple unprofitable products, and cost growth above revenue growth.
- Cash-flow risk: known expenses or costs above revenue; SaaS cash runway from confirmed cash balance and burn (Medium at 12 months, High at 6, Critical at 3).
- Investor portfolio risks (investor portfolios only): largest portfolio company share of combined portfolio annual revenue and share of portfolio companies with runway below 6 months (Medium 10%, High 25%, Critical 40%).
- Revenue concentration: top product, category, or customer share at Medium 35%, High 50%, Critical 70%; investor portfolios use portfolio-company concentration on the same thresholds.
- Data quality: missing mapped business fields, invalid numeric values, invalid dates, duplicates, inconsistent currency labels, insufficient comparable history, and low semantic mapping readiness. Invalid-date evaluation validates confirmed date columns (including investment dates) with the canonical parser.
- Unsupported claims: investor portfolios never claim operating revenue decline, margin, expense, or inventory risks; ledgers never claim revenue or profitability risks; MRR/ARR are never treated as operating revenue for decline claims.

## Dataset-Type Eligibility

The engine classifies each dataset through the business semantic profile into standard, retail, profitability, accountancy, prebookkeeping, marketplace, saas, or investor. Rules execute only for their listed semantic types and confirmed concepts. Investor portfolio classification uses the strong investor schema (company identity, investment event date, capital/ownership, valuation) and overrides stale standard or SaaS metadata.

## API

- `GET /api/risk-intelligence/datasets` returns supported dataset metadata for the signed-in user.
- `GET /api/risk-intelligence?datasetId=<id>` recalculates Risk Intelligence for one owned dataset.
- `POST /api/risk-intelligence` accepts `{ "datasetId": "<id>" }` and recalculates the same result.

All routes require authentication, Hybrid AI Lite dashboard-insights entitlement, and dataset ownership. Admin and superadmin access follows the existing centralized authorization helper. Responses do not include raw dataset rows.
