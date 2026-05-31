# Project Testing Guide

Use this guide to test UseClevr from local setup through high-value product flows.

## 1. Static Checks

```bash
pnpm validate
pnpm lint
pnpm build
```

For deployment-specific checks, also run:

```bash
pnpm validate:dist
```

## 2. Local App Smoke Test

```bash
pnpm dev
```

- Open the dashboard and confirm `/app` routes to the dataset workflow.
- Confirm public pages load: home, pricing, FAQ, contact, security, privacy, terms, login, and signup.
- Confirm dashboard sidebar, topbar, help menu, theme toggle, and sign out controls render.

## 3. Dataset Flow

- Upload a valid CSV.
- Confirm the dataset library renders as a table with Select, ID, Status, Title, File, View table,
  Analyze, and Report columns.
- Ask a natural-language question about the dataset.
- Confirm the answer uses available columns and deterministic values.
- Generate and download a report.

## 4. Download Flow

- Confirm downloads render as a table with separate Download and Delete action columns.
- Confirm Pro, Business, and super-admin accounts can download without free-limit blocking.
- Confirm free users see the upgrade flow after hitting the configured limit.
- Confirm filenames download safely on the target browser and operating system.

## 5. Hybrid AI Flow

- Open Hybrid AI from the dashboard topbar.
- Confirm Free users see Pro and Business plan review buttons.
- Confirm Pro users see Lite access.
- Confirm Business and super-admin users see the correct local AI access.
- Confirm plan buttons route through checkout review.

## 6. Billing Flow

- Open Subscription, Billing, Payment, Credit Rules, and Checkout review pages.
- Confirm checkout review requires terms acceptance before continuing.
- Confirm missing payment-provider settings fail gracefully instead of crashing.
- In staging, run a real checkout and verify webhook-driven subscription updates.

## 7. Admin Flow

- Sign in as super-admin.
- Open Customers, Customer Levels, Discount Rules, Tickets, Activity, and FAQ.
- Confirm customers, levels, and discounts are read-first tables.
- Edit one row through `/app/admin/edit?type=...&id=...`.
- Confirm non-admin users cannot access admin pages directly.

## 8. Support And FAQ

- Open dashboard FAQ.
- Confirm answers use native expandable rows.
- Confirm super-admins can filter operator notes from the same FAQ page.
- Submit a compact support ticket from the FAQ or support page.

## 9. Deployment Smoke Test

- Run the production build.
- Start the generated server locally when deployment preview is needed.
- Confirm `/api/health` responds quickly.
- Confirm Railway deploys generated `/dist` output and uses `/server-config` host templates.
