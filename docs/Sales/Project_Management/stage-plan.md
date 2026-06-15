# UseClevr Stage Plan

This plan translates the product phases into commercial delivery gates.

## Phase 1: Usable MVP

### Outcome

A new user completes signup, CSV upload, verified analysis, dashboard review, a dataset-specific AI
question, report review, support access, and plan selection without developer intervention.

### Current Work

- Validate numeric, text, date, boolean, identifier, and mixed CSV columns.
- Verify KPI calculations, charts, trends, rankings, risks, opportunities, and missing-data
  explanations.
- Complete the lightweight privacy warning and optional anonymization flow.
- Verify responsive dashboard, loading, error, and empty states.
- Verify reports, support tickets, trial credits, Stripe checkout, billing portal, and upgrades.
- Deploy through beta and dist-test and run the complete smoke journey on Railway.

### Exit Gate

- TypeScript, lint, documentation, deployment config, and production build checks pass.
- `/api/health` passes on the Railway test host.
- The complete user journey works without developer intervention.

## Phase 2: Sales Validation

### Outcome

A prospect or investor understands and evaluates UseClevr without a technical walkthrough.

### Current Work

- Keep one founder and one SME demo dataset privacy-safe and representative.
- Capture current public, upload, dashboard, AI Assistant, report, support, pricing, and billing
  screenshots.
- Maintain one repeatable demo script and one short demo video.
- Keep one-pager, pricing, trial, objection handling, and support guidance aligned with current
  capability.
- Measure signup, first upload, first AI question, report review or download, checkout review, and
  support usage.

### Exit Gate

- The demo completes from current materials without live technical explanation.
- Sales claims match requirements and current product behavior.
- First-use and conversion signals are measurable.

## Phase 3: AI Differentiation

### Outcome

Representative datasets produce accurate KPIs, trends, anomalies, top performers, risks,
opportunities, executive summaries, recommendations, and useful follow-up questions.

### Activation Gate

Activate this phase after the Usable MVP journey and Railway test deployment are reliable.

## Phase 4: Platform Expansion

### Outcome

UseClevr expands through approved connectors, broader public APIs, private customer MCP access,
market intelligence, and Intelligence Cloud services.

### Activation Gate

Activate each expansion only when core workflows, authorization, operating reliability, retention,
and revenue justify its cost and risk.

## Scope Rules

- Payload MCP content tools and locked demo-account dataset summaries are active limited
  infrastructure.
- Private customer MCP access requires OAuth and customer-data authorization.
- Google Sheets, Snowflake, public API productization, market intelligence, and Intelligence Cloud
  remain future work.
- Insurance, financing, assets, payroll, inventory, risk scoring, PayPal, and broad Business Profile
  modules remain future work unless requirements explicitly activate them.
- Current sales copy must not present future work as available.
