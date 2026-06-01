# Requirements — UseClevr

This file states the current product requirements in direct, present-state language.

## Infrastructure

- Store application data in Neon PostgreSQL.
- Use ephemeral PostgreSQL containers for local and CI validation.
- Manage database schema with Drizzle ORM migrations.
- Keep production and preview deployments connected to the configured Neon database.
- Return liveness health checks even while database readiness is reported as unavailable or degraded.
- Keep Railway authentication on the active request host unless a strict fixed auth URL is enabled.
- Start generated Railway output through a portable shell entrypoint.
- Keep edge route guards free of Node-only authentication and database modules.
- Normalize generated Edge route guard manifests during production packaging.
- Clean generated build output before production packaging.

## Upload & Analysis

- Upload CSV and Excel files for AI analysis.
- Show uploaded datasets in structured tables with row counts.
- Use title links, open/edit links, and row-end actions in dataset rows.
- Ask AI questions about uploaded datasets and receive structured answers.
- Open the AI Assistant from the dashboard sidebar.
- Keep dataset selection, suggested questions, and chat input visible in the AI Assistant.
- Keep AI answers within the uploaded dataset scope.
- Map business KPI columns by explicit meaning, including quantity, product, country or region, and revenue.
- Offer Hybrid AI Lite to Pro users.
- Offer Hybrid AI MEGA to Business users.
- Explain Hybrid AI plan access in customer-facing plan copy.

## Downloads & Reports

- Generate PDF reports from analysis results for Pro and Business users.
- Track downloads by dataset and report entry.
- Combine charts and table details in PDF exports.
- Use separated row actions for viewing, downloading, and deleting report rows.

## Subscriptions & Billing

- Show Free, Pro Monthly, Pro Annual, and Business Monthly plans.
- Use a checkout review step before terms acceptance and payment.
- Start the secure payment flow after terms acceptance.
- Verify successful checkout sessions against the signed-in user.
- Apply the annual Pro discount at checkout.
- Sync subscription status from the payment provider.
- Open the hosted billing portal for users with linked payment customers.
- Let users manage subscription, usage, downgrade, and cancellation from account billing.
- Limit free analyst credits and prompt upgrades when credits run out.
- Route mistyped dashboard settings links to Profile settings.

## Business Profile

- Show onboarding progress from account, business, upload, analysis, and dashboard visit data.
- Reopen onboarding for accounts below the minimum completion threshold.
- Link each setup progress item to its relevant page.
- Start a guided setup tour from the topbar progress panel.
- Include business profile, location, tax, financial, and overview visits in setup progress.
- Open Business as a top-level workspace with the businesses listing first.
- Show profile, location, tax, financial, and review subpages inside the Business workspace.
- Show business review readiness inside the Business overview.
- Show saved business profile details when dedicated business records are unavailable.
- Support subscription-tier business limits, primary business storage, archive and restore states, operating entities, and cached country tax context.
- Collect company name, industry, location, website, and description.
- Show identity, contact, and operations sections in Business Profile.
- Show review flags for missing details that lower AI confidence.
- Show business completion in the topbar.
- Link incomplete business fields to Business Profile.
- Offer English, German, Hungarian, and Romanian from the dashboard language selector.
- Persist language preference across sessions.

## Accountancy

- Show Accountancy as a dashboard workspace with overview, reporting, tax, and compliance sections.
- Show bookkeeping actions for bank reconciliation, expense coding, monthly close, and tax preparation.
- Show a bookkeeping queue with current status and direct action links.
- Show monthly close readiness for business profile, financial dataset, and tax context.
- Link accounting uploads to dataset upload.
- Show reporting metrics from connected datasets.
- Show tax region and business activity from the primary business profile.
- Show compliance checks for business profile, operating location, and industry context.

## Support

- Create usable local accounts during social login and registration.
- Combine sign-in and sign-up in tabs on the login page.
- Offer the built-in demo account and configured Google or LinkedIn sign-in options.
- Keep login and sign-out redirects on the active app host.
- Show logo, Hybrid AI, search, setup progress, help, credits, display controls, profile settings, sign-out, and notices in the global topbar.
- Support light, dark, system, high-contrast, and larger-text display modes.
- Use full-height hover and click targets in the dashboard topbar.
- Use a horizontal subpage bar for account profile, preferences, subscription, billing, and activity pages.
- Search app pages, datasets, reports, and FAQ answers from the dashboard search overlay.
- Limit operator-only search results to super-admin users.
- Use dashboard search context in chat support.
- Collapse and expand the desktop sidebar.
- Show Terms, Privacy, copyright, social links, and coming-soon app badges in the global footer.
- Open social links in a new page.
- Show App Store and Google Play coming-soon badges.
- Show notices in the topbar inbox with a persistent count.
- Describe failed page scripts, background requests, and API requests directly in notices.
- Show high-value account, billing, dataset, profile, business, upload, analysis, registration, and subscription activity.
- Create and track support tickets from the Tickets page.
- Use a table-first ticket queue with dedicated new and edit pages.
- Support ticket row selection and bulk resolution.
- Use the ticket subject as the edit link, show an edit link below it, and keep row actions at the end.
- Use a consistent bordered table shell across dataset previews, admin lists, business lists, downloads, and support queues.
- Let public visitors request a demo or contact the team from the Contact page.
- Give super-admins a ticket queue with support notes and resolution controls.
- Persist support tickets, support notes, billing settings, and referral events in the database when database access is configured.
- Answer account, billing, dataset, report, credit, and Hybrid AI questions in the dashboard FAQ.
- Show protected operator FAQ content for authorised platform staff.
- Search FAQ answers from floating help chat.
- Keep floating help chat clear of the footer.
- Use high-contrast message bubbles in floating help chat.
- Show expandable FAQ answers.
- Show feedback, chat support, and ticket links above the dashboard FAQ list.
- Show ticket creation on the Tickets page.
- Separate user help and operator help with a section bar.
- Filter operator notes from the dashboard FAQ for super-admins.
- Keep product-update waitlist signup usable during local development.

## Payment Provider Setup

- Show payment provider connection status before customers reach checkout.
- Restrict payment provider configuration to super-admins.
- Show secret key and webhook secret readiness on the payment setup page.

## Credit Rules & Referrals

- Configure referrals needed for one analyst credit.
- Toggle referral credits on or off.
- Prevent self-referral rewards.
- Make referral rewards idempotent.
- Manage referral rules, customer levels, and discount rules from the super-admin sidebar.

## Customer Management

- Show the last 100 account, subscription, and dataset activity events in Settings.
- Show recent product activity across users for super-admins.
- Show customers with plan, signup date, last login, referral source, login count, and dataset count.
- Queue customer invites from the customer list.
- Show built-in demo and super-admin accounts at the top of the customer list.
- Show customer total, Pro and Business count, free count, and active-in-last-30-days count.
- Use read-first customer tables with focused edit pages.

## Customer Levels & Discount Rules

- Define five customer tiers from Explorer through Champion.
- Configure tier thresholds for interactions, page visits, uploads, credits used, and logins.
- Reward configurable analyst credits from customer tiers.
- Create, edit, enable, and disable discount rules.
- Support free-plan discounts, percentage discounts, referral rewards, and stacking behaviour.
- Use read-first tables before focused edit pages for customer levels and discount rules.

## Hybrid AI

- Use the shared modal pattern for the Hybrid AI popup.
- Open the Hybrid AI popup from the dashboard topbar.
- Show Pro and Business plan options to free users inside the Hybrid AI popup.
