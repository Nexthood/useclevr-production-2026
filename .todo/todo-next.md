# Active — leading edge work. Description and issue type in one line; belaboured
# context belongs in requirements.md (product) or a code comment (developer).

## Done ✅

1. Keep the public brand spelling as UseClevr everywhere — brand dev
2. Use the current local runtime target and package manager in local setup, CI, and production install scripts — dev
3. Show the main dashboard settings pages, including profile, preferences, business, subscription, checkout, billing, credits, and payment setup — product
4. Show business-profile progress in the dashboard topbar — product
5. Show Hybrid AI Lite for Pro and Hybrid AI MEGA for Business in the plan prompts — product
6. Keep Kilo project settings in the repo and allow workspace commands through the project configuration — dev
7. Add dashboard support tickets, customer FAQ, super-admin FAQ, and public billing FAQ — product
8. Improve contrast on the signup page and common dashboard buttons; run a final visual pass across login, signup, pricing, checkout, settings, and dashboard in light and dark themes — product
9. Connect referrals to real account signup and paid subscription events — product

## In Progress 🔄

- Partial: Referral rewards are visible as counters; add settings page for admin to define credit rules (5 referrals for 1 credit) — product
- Partial: Plan and checkout settings exist; make public plan prices, plan copy, discounts, and checkout totals read from super-admin settings — product
- Production risk: Move tickets, referral events, billing settings, and support notes from temporary file storage into the database — risk

## Blocked 🚧

- Production risk: Make referral signup and paid events idempotent so refreshes, retries, or replayed payment events cannot grant duplicate rewards — risk
- Production risk: Block self-referrals, repeated referral abuse, fake signups, and paid-event fraud before issuing credits — risk
- Production risk: Reconcile payment-provider events after downtime so access, invoices, failed payments, and plan changes stay correct — risk
- Production risk: Add clear behavior for checkout abandonment, downgrade timing, plan proration, refunds, and expired cards — risk

## Not Done

- Add a super-admin customer dashboard with totals, customer list, signup date, last login, referral source, plan status, login count, and customer activity — product
- Add editable customer levels with five levels, interaction goals, page visits, uploads, credit use, login goals, and credit rewards — product
- Add discount management for free discounts, 10 percent discounts, referral discounts, and clear stacking rules — product

## Product Risk

- Decide how credits expire, how level rewards are backfilled, and whether credits can be removed after refunds or cancellations — product
- Add privacy rules for referred-user lists so customers only see safe referral details — product

## Data Risk

- Test empty uploads, huge CSV files, malformed rows, missing headers, unusual currencies, and mixed time zones — data

## AI Risk

- Keep AI answers tied to uploaded data and clearly handle cases where the dataset cannot answer the question — ai

## Access Risk

- Verify every super-admin page redirects regular users and that user tickets cannot be opened by other users — access

## Deployment Risk

- Keep the generated production bundle, hosting config, healthcheck, runtime version, and environment setup aligned — deployment

## Accessibility Risk

- Check keyboard focus, modal focus traps, color contrast, long labels, small screens, and sidebar/topbar overflow — a11y

## CMS Idea

- Consider a lightweight Next.js CMS path so public pages, pricing copy, FAQs, plan descriptions, and marketing sections can be edited from admin instead of code — cms

## CMS Migration Suggestion

- Start with a database-backed content table and admin editor for FAQs and plan copy, then add preview, publish history, role-based editing, and cached public rendering — cms
