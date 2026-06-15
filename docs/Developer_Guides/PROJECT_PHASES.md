# Project Phases

UseClevr uses four gated phases. Active work stays limited to the current phase outcomes.

| Phase              | Status | Exit gate                                                                                                                                                                          |
| ------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Usable MVP         | Active | Signup, CSV upload, verified analysis, responsive charts, dataset-specific AI answers, reports, support, billing, and Railway test deployment work without developer intervention. |
| Sales Validation   | Active | Current demo data, screenshots, script, pricing, trial, and support guidance let a prospect evaluate the product without a technical walkthrough.                                  |
| AI Differentiation | Next   | Representative datasets produce accurate KPIs, trends, anomalies, rankings, risks, opportunities, and executive actions with traceable calculations.                               |
| Platform Expansion | Future | Retention, revenue, authorization, and operating reliability justify connectors, public APIs, private customer MCP, market intelligence, or Intelligence Cloud work.               |

## Current Active Tasks

- Complete the new-user acceptance journey from signup through upload, analysis, AI answers, reports, support, and plan selection.
- Add the lightweight privacy shield for sensitive columns, warning, anonymization, anonymized AI input, and privacy report.
- Complete sales validation assets: screenshots, demo datasets, demo script, pricing and trial guidance, and demo video.
- Verify activation, trial, credits, checkout, billing, and upgrade prompts.
- Stabilize Excel upload parity with CSV parsing, preview, row counts, ownership, and clear errors.
- Verify analysis speed and output quality on representative founder, SME, and e-commerce datasets.
- Review Payload admin login and operator UI against the dashboard login and admin shell.
- Prepare the beta and dist-test release-candidate checklist for health, smoke journey, docs, TODO, changelog, and secret scan.

## Execution Rules

- Keep Phase 1 and Phase 2 work in `.TODO/todo-next.md`.
- Keep Phase 3 and Phase 4 work in `.TODO/todo-future.md` until the preceding exit gate passes.
- Treat Payload MCP as active limited infrastructure for approved content and locked demo-account
  summaries, not as private customer-data access.
- Support CSV as the current upload format.
- Keep sales and product descriptions limited to implemented behavior.

## Current Measure

A new user completes signup, CSV upload, analysis, a dataset-specific AI question, and report review
without developer intervention.
