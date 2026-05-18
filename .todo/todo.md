# Task Queue — Active Work

> Items in this file are the leading edge of work. When all marks a task done,
> move it here as completed, then refresh `todo-next.md`. Never reopen a completed
> item without a new requirement.

## Completed ✅

- **Super-admin credit rule settings** — `ReferralConfig` added to `BillingSettings` (`/tmp/useclevr-billing`); `referralsPerCredit` (default 5) and `enabled` flag editable in `CreditRulesSettingsPage` via `BillingSettingsForm`; `GET /api/admin/billing-settings` and `POST /api/admin/billing-settings` handle save and read (all super-admin gated).
- **Super-admin customer dashboard** — `GET /api/admin/customers` (super-admin gated) returns customer list from `profiles` table (`id`, `fullName`, `email`, `subscriptionTier`, `stripeStatus`, `createdAt`); page at `/app/admin/customers` shows totals row (total, Pro/Business, free, active-30d) and a sortable customer table with plan badge, signup date, referral source, login count, and dataset count.
- **Editable customer levels** — 5-level system (Explorer → Champion) stored in `BillingSettings.levels`; each level has `minInteractions`, `minPageVisits`, `minUploads`, `minCreditsUsed`, `minLogins`, and `creditReward`; editable admin UI at `/app/admin/levels`; POST `/api/admin/levels` persists to billing settings store.
- **Discount management** — 4 discount types (free, percentage, referral, stacking) stored in `BillingSettings.discountRules`; each has `name`, `code`, `percent`, `description`, `enabled`; admin UI at `/app/admin/discounts`; POST `/api/admin/discounts` persists to store; default rules include "Pro Annual Discount" (17 %) and "Referral Reward".
- **Free trial route fix** — Pricing page "Start free trial →" button (Pro tier) now links to `/signup` instead of routing through the paid checkout flow.
- **Hybrid AI popup fix** — Replaced ad-hoc `createPortal` overlay in `HybridAiButton` with shared `Modal` component; single `modal-portal-root` stacking context; Escape key, body scroll lock, and click-outside-to-close all delegated to `Modal`.
- **Home/affiliate design rollout** — Dashboard home (`AppDashboard`) upgraded with `h-12 rounded-xl` tinted icon boxes, 3-card quick-action grid including Downloads, and `bg-gradient-primary` upload CTA; billing and credits settings pages upgraded with `h-10 w-10 rounded-xl` gradient icon boxes and tinted card sections (`bg-primary/5`, `border-primary/20`); subscription settings upgraded with pill badge section header.
- **Sidebar navigation** — Super-admin sidebar extended with Customers, Customer Levels, and Discount Rules links (icons: `Users`, `Award`, `Tag`).

## In Progress 🔄

- Plan and checkout total prices still use client-side defaults for some settings
- Production risk items: tickets to DB migration, referral idempotency, self-referral / abuse blocking, payment-provider event reconciliation, checkout edge cases (abandonment / proration / refunds / expired cards)

## Blocked 🚧
