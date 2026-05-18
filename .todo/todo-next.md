# Active — leading edge work. Description and issue type in one line.

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
10. Super-admin credit rule settings: referral credit rules (5 referrals for 1 credit) are configurable in Credit Rules — product
11. Super-admin customer dashboard: totals, customer list, plan status, signup date, and dataset count at /app/admin/customers — product
12. Editable customer levels: 5 levels with interaction goals, page visits, uploads, credit use, login goals, and credit rewards at /app/admin/levels — product
13. Discount management: free, percentage, referral, and stacking discount rules at /app/admin/discounts — product
14. Free trial route: "Start free trial" on pricing page now links to /signup — product
15. Hybrid AI popup: converted from ad-hoc createPortal overlay to shared Modal component — product

## In Progress 🔄

- Plan and checkout settings: prices read from super-admin store; checkout totals still client-side — product
- Tickets, referral events, billing settings, and support notes from temp file storage to database — risk
- Referral signup and paid event idempotency (prevent duplicate credit awards) — risk
- Self-referral / abuse prevention before credits are issued — risk
- Payment provider event reconciliation after downtime — risk

## Blocked 🚧

- Checkout edge cases: abandonment behaviour, proration, refunds, expired cards — risk

## Product Risk

- Decide credit expiry rules, backfill behaviour, and post-refund credit reversal — product
- Privacy rules for referred-user lists — product

## Data Risk

- Test empty uploads, huge CSV files, malformed rows, missing headers, unusual currencies, mixed time zones — data

## AI Risk

- Keep AI answers tied to uploaded data; handle unanswerable questions clearly — ai

## Access Risk

- Verify every super-admin page redirects regular users; tickets cannot be opened by other users — access

## Deployment Risk

- Keep production bundle, hosting config, healthcheck, runtime, and environment setup aligned — deployment

## Accessibility Risk

- Check keyboard focus, modal focus traps, color contrast, small screens, sidebar/topbar overflow — a11y

## CMS Idea

- Consider a lightweight Next.js CMS path so public pages, pricing copy, FAQs, plan descriptions, and marketing sections can be edited from admin instead of code — cms
