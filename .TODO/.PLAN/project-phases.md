# UseClevr Project Phases

UseClevr ships the smallest reliable business-intelligence product before expanding integrations or
platform scope.

## Phase Map

| Phase                 | Status | Required outcome                                                                                                                                                             | Exit gate                                                                                            |
| --------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1. Usable MVP         | Active | A new user signs up, uploads CSV data, receives accurate KPIs, charts, dataset-specific AI answers, and a report without developer help.                                     | The complete user journey passes locally and on the Railway test deployment.                         |
| 2. Sales Validation   | Active | A prospect or investor can understand, test, and evaluate UseClevr through current screenshots, demo data, a repeatable script, pricing, trial access, and support guidance. | The demo runs without a live technical walkthrough and activation signals are measurable.            |
| 3. AI Differentiation | Next   | Deterministic analysis identifies KPIs, trends, anomalies, top performers, risks, opportunities, and clear executive actions from the uploaded dataset.                      | Representative datasets produce accurate, useful results with traceable calculations.                |
| 4. Platform Expansion | Future | UseClevr adds approved connectors, public APIs, private customer MCP access, market intelligence, and broader intelligence services.                                         | Core workflows, retention, revenue, authorization, and operating reliability justify each expansion. |

## Current Boundaries

- Support CSV upload as the current file-ingestion format.
- Keep Payload MCP limited to approved content tools and locked demo-account dataset summaries.
- Keep private customer MCP access behind OAuth and customer-data authorization.
- Keep business profiles and datasets in owner-scoped application storage.
- Keep support issues in Payload and expose the same records through dashboard tickets.
- Keep the privacy shield lightweight: detect sensitive columns, warn the user, optionally
  anonymize stable placeholders, analyze the resulting data, and save a compact privacy report.
- Keep roadmap claims out of current product and sales descriptions.

## Current Execution

- `.TODO/todo-next.md` contains Phase 1 and Phase 2 implementation and validation work.
- `.TODO/todo-future.md` contains Phase 3 and Phase 4 work until an exit gate activates it.
- `docs/Developer_Guides/PROJECT_PHASES.md` is the concise developer phase reference.
- `docs/Sales/Project_Management/stage-plan.md` translates phases into sales and activation gates.

## Success Measure

An SME owner completes signup, CSV upload, analysis, a dataset-specific AI question, and report
review in under 60 seconds per processing step, understands the result, and reaches support or plan
selection without developer intervention.
