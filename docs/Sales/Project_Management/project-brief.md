# UseClevr Project Brief

## Project Definition

UseClevr is a business intelligence workspace that helps SMEs, startups, freelancers, consultants, agencies, and operators upload business datasets, ask AI-supported questions, review structured insights, and download reports.

## Background

Many small and growing businesses work from spreadsheets, CSV exports, accounting files, bank reports, sales reports, and operational datasets. These files often contain useful business signals, but users need a clearer workflow to convert them into decisions. UseClevr provides that workflow through dataset upload, AI Assistant, Business Profile context, Accountancy readiness, report downloads, support, and guided setup.

## Project Objectives

- Help users turn uploaded business data into useful dashboards, AI answers, and reports.
- Keep analysis connected to business context through Business Profile.
- Support bookkeeping and accountancy readiness from uploaded datasets and business profile details.
- Keep support visible through FAQ, help chat, tickets, and notices.
- Support paid conversion through Stripe checkout, subscription settings, Hybrid AI options, credits, and referral/discount tools.
- Keep platform operations manageable through super-admin customers, tickets, billing settings, AI trace analytics, customer levels, and discount rules.

## Project Scope

### In Scope

- Public site, pricing, FAQ, contact, signup, login, affiliate, and legal pages.
- Dashboard workspace under `/app`.
- Dataset upload, dataset tables, AI Assistant, downloads, reports, Business Profile, Accountancy, referrals, settings, and tickets.
- Super-admin operational pages under `/app/admin`.
- Stripe payment flow and billing portal access.
- Help chat with public, dashboard, and operator FAQ scopes.
- AI trace history, feedback, export, search, analytics, benchmarking, and learning guidance.
- Railway generated-output deployment through `dist` branch `/dist`.

### Out Of Scope

- Replacing accounting, tax advisory, legal advisory, insurance brokerage, lending, payroll, or ERP systems.
- Storing full payment card details.
- Migrating core application data to Payload CMS.
- Adding PayPal until a second payment provider is required.
- Treating roadmap Business Profile modules as implemented.

## Project Approach

- Keep the current app architecture and deployment path stable.
- Build dashboard and public features using existing component patterns.
- Use Drizzle and Neon PostgreSQL for application data.
- Use Stripe as payment source of truth.
- Use AI traces to improve user learning, support, and product quality.
- Keep documentation aligned through requirements, changelog, TODO queues, AI-interaction guides, and Sales documents.

## Business Options

| Option                          | Description                                                                     | Decision                                                      |
| ------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Do nothing                      | Users keep manual spreadsheet analysis.                                         | Rejected because it does not create product value.            |
| Build enterprise BI             | Create a broad BI platform with deep setup.                                     | Rejected because the product targets practical SME workflows. |
| Build UseClevr SME BI workspace | Provide upload, AI, reports, profile context, support, billing, and operations. | Selected.                                                     |
| Replace app with CMS            | Use Payload or another CMS as core app.                                         | Rejected; CMS remains future editable-content layer only.     |

## Constraints

- Current routes stay stable: public site at `/`, dashboard at `/app`, super-admin tools at `/app/admin`.
- Railway packaging stays compatible with generated `dist/` output.
- Sensitive data stays out of docs, prompts, logs, and public assets.
- Sales copy stays aligned with current product state.

## Key Risks

- Railway deploy instability blocks customer access.
- AI answers can lose trust if confidence and data scope are unclear.
- Business Profile copy can sound like regulated advice if not labelled carefully.
- Sales assets can overpromise roadmap features.
- User data access controls can break trust if private reports or datasets leak.

## Success Criteria

- A user can sign up, upload a dataset, ask an AI question, and download a report.
- A user can complete Business Profile context enough to improve setup progress.
- A user can open support from FAQ, help chat, or tickets.
- A paid user can reach checkout and subscription settings.
- A super-admin can review customers, tickets, billing settings, AI traces, levels, and discounts.
- Sales materials describe current capability and roadmap boundaries clearly.
