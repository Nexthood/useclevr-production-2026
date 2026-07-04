# UseClevr Project Product Description

## Product Purpose

UseClevr provides a usable business intelligence workspace for users who need answers from business data without building dashboards, SQL queries, or enterprise data pipelines.

## Delivery Phase

UseClevr is completing the Usable MVP and Sales Validation gates. Current delivery proves the full
journey from signup and CSV upload through verified analysis, dataset-specific AI answers, report
review, support, trial access, billing, and Railway test operation. AI Differentiation follows next;
connectors, broader public APIs, private customer MCP, market intelligence, and Intelligence Cloud
remain Platform Expansion work.

## Product Composition

### Public Product Surface

- Homepage.
- FAQ.
- Pricing.
- Contact.
- Signup and login.
- Affiliate page.
- Legal and security pages.

### Dashboard Product Surface

- Dashboard overview.
- Upload.
- Datasets.
- AI Assistant.
- Lightweight privacy shield warnings and anonymization before AI analysis.
- Reports and downloads.
- Business workspace.
- Accountancy workspace.
- Referral center.
- Settings.
- Tickets.

### Super-Admin Product Surface

- Customer management.
- Customer levels.
- Discount rules.
- Billing settings.
- AI trace analytics.
- AI benchmarking.
- Operator FAQ and support controls.
- Payload operator admin for public content, business profiles, support issues, and owner-assigned
  dataset uploads.

### Support Product Surface

- Public FAQ.
- Dashboard FAQ.
- Operator FAQ.
- Help chat.
- Tickets.
- Notices and activity.

### Payment Product Surface

- Free, Pro, and Business monthly plans.
- Checkout review.
- Stripe checkout.
- Billing portal access.
- Credits and Hybrid AI upgrade paths.

## Product Quality Expectations

- Pages use clear current-state copy.
- Tables use shared row patterns with title links and row-end actions.
- AI answers stay tied to uploaded dataset context.
- Sensitive dataset columns trigger a lightweight warning before AI analysis.
- Anonymization replaces sensitive values with stable placeholders when the user enables it.
- Private reports, datasets, MCP resources, and search results stay scoped to the signed-in user.
- Super-admin users access operational views without exposing operator-only content to regular users.
- Help chat uses the correct FAQ scope for public, dashboard, and super-admin users.
- Deployment packaging succeeds before release.

## Product Acceptance Criteria

- Public users can understand the product and reach signup, contact, pricing, and FAQ.
- Signed-in users can upload datasets, see sensitive-data warnings when needed, anonymize sensitive values before AI analysis, ask AI questions, and download reports.
- Signed-in users can manage Business Profile and Accountancy readiness.
- Users can open tickets and receive support guidance.
- Super-admin users can manage customers, billing settings, discounts, levels, support, and AI traces.
- Checkout uses Stripe and verifies successful sessions against the signed-in user.
- Railway generated-output deployment starts and serves `/api/health`.

## Product Boundaries

- UseClevr provides estimates and decision-support context.
- UseClevr does not replace professional advice.
- UseClevr does not become an ERP, payroll system, policy-management system, lending platform, or tax filing system.
- Payload manages public content and support issues, and supplies superadmin operator views for
  owner-scoped business profiles and dataset uploads.
- PayPal remains deferred until a second payment provider is needed.
- Payload MCP supports approved content tools and locked demo-account dataset summaries. Activate
  private customer MCP access, broader public APIs, data connectors, market intelligence, and
  Intelligence Cloud only after reliability, authorization, retention, and revenue gates pass.
