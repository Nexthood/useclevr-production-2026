# UseClevr Project Phases

UseClevr prioritizes launch-critical product value before advanced integrations. The current phase keeps the team focused on upload, analysis, dashboard insights, demo flow, sales readiness, payments, and docs.

## Current Phase Map

| Phase | Current status | Focus | Defer until |
| ----- | -------------- | ----- | ----------- |
| Launch-critical MVP | Active | CSV and Excel upload, analysis, KPI extraction, chart generation, AI summary, recommendations, results page, demo flow, login, docs, and lightweight privacy shield | Advanced integrations |
| Sales and investor readiness | Active support work | Demo account, demo dataset, demo video, pitch materials, pricing, trial flow, sales docs, and repeatable onboarding | Large roadmap expansion |
| AI differentiation | Planned improvement | Stronger KPI detection, trend detection, anomaly detection, executive summaries, and recommendation quality | Data connectors and public API expansion |
| Data connectors | Future | Google Sheets and Snowflake first, then other sources | Core product, demo, sales, and payments are stable |
| UseClevr API | Future | `/api/analyze`, `/api/chat`, `/api/report` for partner and SaaS use | Customer workflows and revenue are validated |
| MCP | Future | Payload MCP for content and locked demo-account reads | Public APIs and customer workflows are stable |
| Market intelligence | Future | Competitor analysis, industry trends, company enrichment, startup intelligence | BI workflows and revenue are stable |
| UseClevr Intelligence Cloud | Long-term | Customer data, financial data, market data, and AI reasoning | Earlier phases are validated |

## Active Work Boundaries

- Keep launch-critical work in `.TODO/todo-next.md`.
- Keep deferred roadmap items in `.TODO/todo-future.md`.
- Keep sales copy aligned with current capability and label future items as roadmap.
- Keep product docs focused on current behavior, not speculative features.
- Keep privacy shield lightweight: detect sensitive columns, warn users, anonymize with stable placeholders, continue AI analysis with anonymized data, and save a simple privacy report.

## Success Metric

A random SME owner uploads a CSV or Excel file, sees a clear sensitive-data warning when needed, gets useful analysis and AI answers in under 60 seconds, and can follow a demo or sales path without a live walkthrough.
