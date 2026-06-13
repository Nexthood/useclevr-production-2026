docs/PROJECT_STRUCTURE_CURRENT.md

# UseClevr Current Project Structure and Work

## Purpose

This document describes the current UseClevr project structure and the work that should be prioritized before larger architecture changes.

UseClevr is currently a practical SaaS project focused on AI-assisted business intelligence for SMEs, startups, freelancers, consultants, and small companies.

The current priority is not a large architecture migration. The current priority is to make the SaaS core reliable, useful, and deploy-stable.

---

## Current Repository

Repository:

```txt
Nexthood/useclevr-production-2026
```

Current app type:

```txt
Next.js SaaS application
```

Current deployment flow:

```txt
dist       = Railway production deployment branch
dist-test  = Railway staging/test deployment branch
main       = development/source branch
```

The `dist` and `dist-test` branches must stay stable because Railway depends on them.

---

## Current Priority Order

### 1. Railway Stability

Before adding new architecture, confirm:

- Production deploy works from `dist`
- Test deploy works from `dist-test`
- Build command works
- Start command works
- Required runtime files are included in dist output
- Environment variables are correct
- Deprecated middleware/proxy workaround stays if it is currently required for stable packaging

Do not change the deployment strategy unless required.

---

### 2. Business Profile Expansion

The current Business Profile must evolve from simple company details into a practical pre-accounting and business intelligence setup.

It should collect:

- Company identity
- Legal form
- Country and operating location
- Business type
- Revenue streams
- Fixed costs
- Variable costs
- VAT/tax basics
- Insurance policies
- Loans and leasing
- Payroll and employee costs
- Assets
- Cash-flow dates
- Inventory, if relevant
- Marketing spend
- Risk profile
- Forecast goals
- Missing data warnings

This must stay user-friendly. It should not become a full ERP.

---

### 3. Calculation Context

Business Profile data must feed into a calculation context.

Required concept:

```txt
Business Profile
+
Uploaded CSV / parsed rows
=
Company Calculation Context
```

The calculation context should support:

- KPI generation
- Profit/loss calculation
- Cash-flow analysis
- Forecast scenarios
- Tax reserve estimates
- Insurance cost overview
- Debt pressure overview
- Missing-data confidence warnings

All calculated outputs must clearly show assumptions.

---

### 4. Dataset-Aware AI Answers

The AI assistant must use uploaded dataset context before giving generic answers.

Required behavior:

- Use uploaded CSV data where available
- Detect columns and likely KPI meaning
- Generate chart suggestions from actual data
- Summarize real dataset trends
- Ask for missing information only when required
- Mark weak or incomplete analysis clearly

Avoid generic AI answers when dataset context exists.

---

### 5. Upload and Security Hardening

Current upload and analysis flow should be hardened before launch.

Required basics:

- File size limits
- Dirty CSV handling
- Clear parsing errors
- Column detection
- Safe preview generation
- Upload rate limits
- Admin route review
- Uploaded files must not leak into public/static paths
- Prompt text and generated exports must be handled safely
- Basic GDPR/privacy notes should be prepared

---

### 6. Billing Configuration

Before real payment collection, billing values must be centralized.

Create one shared billing config for:

- Plan names
- Prices
- Stripe Price IDs
- Billing intervals
- Plan descriptions
- Feature limits
- Trial/free/lifetime rules if used

Remove hardcoded pricing from UI where possible.

---

## Current TODO Management

Active queue:

```txt
.TODO/todo-next.md
```

Future/deferred queue:

```txt
.TODO/todo-future.md
```

Config:

```txt
.TODO/config.json
```

Rules:

- Get the next T-number from `.TODO/config.json`
- Keep task numbers stable
- Keep one task per bullet
- Do not duplicate existing TODOs
- Keep `todo-next.md` focused only on active work
- Move deferred work to `todo-future.md`
- Move completed work to `todo-done.md`

---

## Current MCP Rule

Payload MCP is the documented connector.

Preferred current path:

```txt
/api/payload/mcp
mcp.useclevr.com/api/payload/mcp
mcp-test.useclevr.com/api/payload/mcp
```

Do not document a separate dashboard MCP connector. Payload MCP API keys control tool access, and the test connector exposes only locked demo-account metadata and stored insights.

---

## Do Not Do Yet

Do not implement the following yet:

- Payload migration
- Fumadocs app
- Meilisearch
- Separate MCP subdomain
- Monorepo migration
- Large CI/CD redesign
- Complex test framework setup
- Multi-workspace architecture
- Second payment provider architecture
- Full ERP/accounting system

These can be planned, but not implemented until the SaaS core and Railway deploy are stable.
