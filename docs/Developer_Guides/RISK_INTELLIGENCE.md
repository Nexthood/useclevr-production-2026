# Risk Intelligence

Risk Intelligence is a Hybrid AI Lite dashboard module that calculates deterministic business-risk signals for one selected dataset at a time. The first version supports standard, retail, profitability, accountancy, and pre-bookkeeping datasets.

## Architecture

- The server calculates all scores through the centralized Risk Intelligence engine.
- The React page renders calculated results and does not calculate severity, score, limits, or rule thresholds.
- The engine reuses existing business-column detection and KPI aggregation helpers, then derives conservative risk metrics from the selected dataset rows.
- The first version stores no Risk Intelligence table; every page load and API request recalculates from existing dataset records and row data.
- Unsupported metrics stay unavailable and do not reduce category or overall scores.
- AI explanation is optional; deterministic results remain complete when no AI provider is available.

## Categories

- Inventory Risk
- Financial Risk
- Profitability Risk
- Cash Flow Risk
- Revenue Concentration Risk
- Data Quality Risk

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

Category scores use applicable rules in that category only. Overall scores use all applicable rules for the selected dataset. A metric is applicable only when the dataset contains the required source fields.

## Rule Thresholds

- Inventory dead-stock ratio: Medium at 10%, High at 20%, Critical at 35%.
- Financial revenue decline: Medium at -5%, High at -10%, Critical at -20%.
- Profitability risk: declining gross margin, negative net margin, multiple unprofitable products, and cost growth above revenue growth.
- Cash-flow risk: known expenses or costs above revenue, framed as business-intelligence context rather than insolvency guidance.
- Revenue concentration: top product, category, or customer share at Medium 35%, High 50%, Critical 70%.
- Data quality: missing detected business fields, invalid numeric values, invalid dates, duplicates, inconsistent currency labels, insufficient comparable history, and low calculation readiness.

## API

- `GET /api/risk-intelligence/datasets` returns supported dataset metadata for the signed-in user.
- `GET /api/risk-intelligence?datasetId=<id>` recalculates Risk Intelligence for one owned dataset.
- `POST /api/risk-intelligence` accepts `{ "datasetId": "<id>" }` and recalculates the same result.

All routes require authentication, Hybrid AI Lite dashboard-insights entitlement, and dataset ownership. Admin and superadmin access follows the existing centralized authorization helper. Responses do not include raw dataset rows.
