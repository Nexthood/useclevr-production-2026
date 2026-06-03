# UseClevr PRINCE2 Project Description

This document describes UseClevr in a PRINCE2-style format for sales, marketing, stakeholder communication, and project control. It reflects the current product state and separates active product capability from roadmap work.

## Project Name

UseClevr business intelligence workspace.

## Project Purpose

UseClevr helps small and growing businesses turn uploaded business data into understandable dashboards, AI-supported analysis, and downloadable reports. The product gives founders, operators, consultants, agencies, and SME teams a structured way to review data, ask questions, track business context, and prepare decision-support outputs.

## Project Mandate

Businesses often hold useful information in CSV files, spreadsheets, accounting exports, bank statements, sales reports, and operational datasets. UseClevr provides a guided workspace that turns those files into business summaries, KPI views, AI explanations, supportable reports, and business profile context without requiring SQL, analytics engineering, or enterprise BI setup.

## Business Case

### Problem

- SMEs and startups often rely on spreadsheet exports without a clear analysis workflow.
- Founders and operators need fast answers from data before they can justify deeper accounting, BI, or advisory work.
- Business context such as industry, location, tax context, and company profile often sits outside analysis tools.
- Data-driven decisions are slowed by unclear KPIs, scattered files, and limited reporting time.

### Value

- Users upload business datasets and review structured outputs in one workspace.
- Users ask AI questions against dataset context and receive structured answers.
- Users keep Business Profile context connected to analysis and setup progress.
- Users download reports for review, sharing, and follow-up work.
- Super-admins manage support, customers, billing settings, customer levels, and discount rules from a controlled dashboard.

### Commercial Rationale

- Free users can test upload, analysis, and support flows.
- Pro and Business plans unlock stronger analysis and report workflows.
- Hybrid AI options create a clear upgrade path.
- Referral and discount management support customer acquisition and retention.
- Business Profile and Accountancy features position UseClevr as a practical SME decision-support layer.

## Project Objectives

- Provide a clear public product path from homepage to signup, upload, analysis, FAQ, and checkout.
- Provide a dashboard workspace for datasets, AI Assistant, downloads, Business Profile, Accountancy, referrals, settings, and tickets.
- Keep user data scoped to the signed-in user and super-admin views scoped to platform operations.
- Keep Stripe as the active payment provider and subscription source of truth.
- Keep Railway generated-output deployment stable through the dist branch.
- Keep documentation, TODO queues, changelog, and requirements aligned with product state.
- Keep AI interaction traces useful for user learning, problem markers, and product improvement.

## Current Product Scope

### Public Experience

- Homepage explains the product offer and routes users to signup, demo, FAQ, pricing, contact, and legal pages.
- FAQ answers public questions and supports public help chat.
- Pricing presents the current plan structure and routes checkout through a review step.
- Contact and waitlist flows support demo, sales, and product update requests.

### Dashboard Experience

- Dashboard provides topbar search, Help, setup progress, notices, display controls, profile settings, sign-out, and Hybrid AI access.
- Sidebar focuses on primary app areas and extends for super-admin users.
- Dataset pages show uploaded data in shared table patterns.
- AI Assistant keeps dataset selection, suggestions, messages, and chat input usable in one workspace.
- Downloads show generated reports and protect private report access.
- Tickets provide a table-first support queue with new and edit pages.

### Business And Accountancy

- Business opens as a top-level workspace with businesses listed first.
- Business subpages cover profile, locations, tax, financial settings, and review.
- Business Profile provides SME business-intelligence and pre-accounting context.
- Accountancy shows bookkeeping actions, monthly close readiness, tax context, reporting, and compliance sections.

### Platform Operations

- Super-admins manage customers, levels, discounts, billing settings, AI trace analytics, AI benchmarking, tickets, and operator FAQ content.
- Search, FAQ, MCP resources, reports, and help chat respect user and super-admin access scope.

## Out Of Scope

- UseClevr does not replace accountants, tax advisors, lawyers, insurance brokers, or regulated financial advisors.
- UseClevr does not store full card numbers or own payment credentials.
- UseClevr does not act as an ERP, payroll system, lending platform, or insurance policy-management system.
- Payload CMS integration is a future editable-content layer, not a replacement for the current app, billing, datasets, tickets, AI traces, reports, workspaces, or business records.
- PayPal is deferred until a second checkout provider is required.

## Deliverables

| Deliverable | Current Output |
| --- | --- |
| Public site | Homepage, pricing, FAQ, contact, legal, signup, login, affiliate pages. |
| Dashboard workspace | Datasets, Assistant, Downloads, Business, Accountancy, Referral, Settings, Tickets. |
| Business Profile | Company identity, contact, operations, location, tax, financial settings, review readiness. |
| AI analysis | Dataset-aware answers, suggestions, provider indicators, feedback, history, search, and export. |
| Reports | Downloadable generated reports with private access controls. |
| Support | FAQ, help chat, tickets, notices, and super-admin support controls. |
| Billing | Stripe checkout, checkout review, billing portal access, subscription status sync. |
| Operations | Customer management, levels, discounts, billing settings, AI trace analytics, MCP access scope. |
| Deployment | Generated Railway output through dist branch and Vercel source configuration. |
| Documentation | Requirements, changelog, TODO queues, developer/user/sales guides, prompt library, learning controls. |

## Stakeholders

| Stakeholder | Interest |
| --- | --- |
| Founders and business owners | Fast understanding of business data and practical reports. |
| SME operators | Upload, review, ask questions, and track business context. |
| Consultants and agencies | Prepare client insights and decision-support reports. |
| Accountancy-focused users | Review bookkeeping readiness, tax context, reporting, and compliance signals. |
| Super-admin operators | Manage customers, support, billing settings, discounts, and operational FAQ. |
| Sales and marketing team | Communicate current value, demos, and roadmap boundaries clearly. |
| Developers and AI agents | Maintain implementation, deployment, docs, TODOs, and trace learning. |

## Governance

### Project Controls

- Requirements describe current product behavior.
- Changelog records release-facing user and developer changes.
- TODO queues own active, completed, future, and ignored work.
- AI interaction governance captures lessons, risks, issues, decisions, and reusable prompt patterns.
- Sales documents describe current product state and label roadmap items clearly.

### Change Control

- Product behavior changes update requirements and changelog.
- Implementation tasks move through `.TODO/todo-next.md`, `.TODO/todo-done.md`, `.TODO/todo-future.md`, or `.TODO/todo-ignore.md`.
- Durable AI instruction changes update `AGENTS.md`, `.TODO/config.json`, and AI-interaction docs.
- Deployment changes update Railway, Vercel, GitHub workflow, and package-dist guidance.

### Quality Control

- TypeScript validation checks source correctness.
- Dist validation checks Railway and Vercel config sync.
- Linting checks source, package metadata, workflow metadata, changelog wording, and TODO management.
- Production packaging validates generated output.
- Docs link checks validate local documentation links.

## Key Risks

| Risk | Control |
| --- | --- |
| Railway deploy returns runtime 502 | Use healthcheck review, logs, generated output validation, and dist branch packaging checks. |
| User data leaks across accounts | Keep reports, MCP, search, FAQ, datasets, and dashboard routes scoped by user role. |
| AI answer overstates certainty | Use provider indicators, feedback, history, error transparency, and trace learning. |
| Tax, legal, insurance, or financing wording sounds advisory | Label outputs as estimates, user-provided values, or professional-verification items. |
| Sales materials overpromise roadmap work | Keep sales docs aligned with requirements and mark roadmap items clearly. |
| CMS migration replaces core app data | Keep Payload limited to future editable content only. |

## Acceptance Criteria

- Public users understand the product offer and can reach signup, pricing, FAQ, contact, and legal pages.
- Signed-in users can upload datasets, review tables, ask AI questions, download reports, manage business profile, and open tickets.
- Super-admin users can manage platform operations without exposing operator content to regular users.
- Billing uses Stripe as the active source of truth.
- Private reports and dataset resources stay scoped to the owning user.
- Help chat responds with the correct FAQ scope for public, dashboard, and super-admin contexts.
- Deployment packaging succeeds before release.
- Sales and project documents match current product behavior and avoid hidden implementation TODO lists.

## Stage View

| Stage | Focus | Control Point |
| --- | --- | --- |
| Product baseline | Stable dashboard, upload, AI, reports, billing, support, business profile. | Requirements and changelog stay current. |
| Sales readiness | Clear value proposition, demo flow, objections, ICP, and assets. | Sales docs align with current product. |
| Operational readiness | Deployment, support, billing, customer management, and trace analytics. | Validation and health checks pass. |
| Roadmap preparation | Business Profile expansion, Payload content layer, PayPal, broader tests. | Future TODOs stay separate from current claims. |

## Success Measures

- Visitors reach signup, contact, or pricing from public pages.
- New users complete signup, upload a dataset, and ask a first AI question.
- Users complete Business Profile enough to improve report confidence.
- Users download reports and return to the dashboard for follow-up questions.
- Support tickets identify issues with enough context to resolve.
- Sales materials communicate current product value without roadmap confusion.
