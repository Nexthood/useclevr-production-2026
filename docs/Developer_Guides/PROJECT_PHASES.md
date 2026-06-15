# Project Phases

UseClevr keeps the roadmap focused on current product value before broader integrations. The
current phase prioritizes CSV upload, analysis, dashboard insights, demo flow, sales readiness,
payments, documentation, and lightweight privacy controls.

## Phase Summary

| Phase                        | Status                | Purpose                                                                                                                                       |
| ---------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Launch-critical MVP          | Active                | CSV upload, analysis, KPI extraction, chart generation, AI summary, recommendations, results page, demo flow, login, docs, and privacy shield |
| Sales and investor readiness | Active support work   | Demo account, demo dataset, demo video, pitch materials, pricing, trial flow, sales docs, and repeatable onboarding                           |
| AI differentiation           | Planned improvement   | Stronger KPI detection, trend detection, anomaly detection, executive summaries, and recommendation quality                                   |
| Data connectors              | Future                | Google Sheets and Snowflake first, then other sources after core product stability                                                            |
| UseClevr API                 | Future                | `/api/analyze`, `/api/chat`, and `/api/report` after customer workflows and revenue are validated                                             |
| Payload MCP                  | Active infrastructure | Approved content tools and locked demo-account dataset summaries; private customer access requires OAuth                                      |
| Market intelligence          | Future                | Competitor analysis, industry trends, company enrichment, and startup intelligence after BI workflows and revenue validation                  |
| UseClevr Intelligence Cloud  | Long-term             | Customer data, financial data, market data, and AI reasoning after earlier phases are validated                                               |

## Current Active Focus

- Stabilize upload, analysis, dashboard, AI Assistant, reports, demo access, and docs.
- Add lightweight privacy shield before AI analysis of uploaded CSV files.
- Keep sales materials aligned with current capability.
- Keep roadmap items clearly separated from current capability.
- Keep future work in `.TODO/todo-future.md` until it is ready to start.

## Lightweight Privacy Shield

The privacy shield stays simple:

1. Detect sensitive columns by column name and simple regex patterns.
2. Show a small warning before AI analysis when sensitive fields are found.
3. Offer an "Anonymize sensitive data before AI analysis" checkbox.
4. Replace sensitive values with stable placeholders such as Customer_001, Email_001, Phone_001, and Address_001.
5. Continue AI analysis only with the anonymized dataset when anonymization is enabled.
6. Save a privacy report with file name, detected sensitive fields, anonymization true or false, and timestamp.

## Roadmap Boundary

Maintain the existing Payload MCP surface without expanding it ahead of launch-critical product
work. Keep private customer MCP access, broader public APIs, data connectors, and market
intelligence behind reliable BI, a testable demo, and a validated revenue path.
