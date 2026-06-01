# Requirements — UseClevr

This file describes what users can do with UseClevr, written from the user perspective.

## Infrastructure
- All application data is persisted in Neon PostgreSQL (external, cloud-hosted database)
- Local and CI development use ephemeral PostgreSQL containers for build validation; production and preview deployments connect to the same Neon instance
- Database schema is managed via Drizzle ORM with migrations; schema changes push directly to Neon

## Upload & Analysis
- Upload CSV or Excel files and get instant AI analysis
- View uploaded datasets in a structured table with row counts
- Ask AI questions about your data and get structured answers
- Use the AI Assistant from the sidebar to analyze datasets
- AI analysis stays within your data scope using a two-step process
- Business KPIs correctly map columns (e.g., country values aren't counted as quantities)
- Pro users get Hybrid AI Lite for crowd-level questions
- Business users get Hybrid AI MEGA for large-scale queries
- Hybrid AI explanations clarify what's included in each plan

## Downloads & Reports
- Pro and Business users can generate PDF reports from analysis
- Downloads are tracked per dataset and entry
- PDF exports combine charts and tables in one file

## Subscriptions & Billing
- View and upgrade between Free, Pro Monthly, Pro Annual, and Business Monthly plans
- Two-step checkout: review plan → accept terms → payment
- Terms acceptance starts secure payment flow with clear error messages
- Successful Stripe checkout verifies payment belongs to the signed-in user
- Annual Pro subscriptions get automatic discount at checkout
- Subscription status syncs with payment provider for immediate updates
- Access hosted billing portal from account billing with linked Stripe customer
- Manage subscription, view usage, and downgrade/cancel without leaving the app
- Free tier includes limited analyst credits; prompts to subscribe when exhausted
- Mistyped dashboard settings links redirect to Profile settings

## Business Profile
- Onboarding uses account data to show setup progress
- Automatically reopens onboarding when below 25% completion
- Setup progress guides users to relevant setup or workflow pages
- Tracks completed profile fields, business fields, first upload/analysis, and key dashboard visits
- Open setup progress panel from topbar to start guided tour
- Includes business profile, location, tax, financial, and business overview visits
- Business workspace shows businesses listing table before editing details
- Business overview displays review readiness panels in main workspace
- Shows saved profile details when dedicated business records aren't ready
- Users fill in company name, industry, location, website, and description
- Business Profile shows identity, contact, and operations sections
- Review flags explain which missing details lower AI confidence
- Topbar shows live completion percentage for business profile
- Incomplete fields appear in topbar with direct link to Business Profile
- Switch between English, German, Hungarian, and Romanian in topbar language selector
- Language preference persists across sessions and page reloads

## Support
- Social login/register creates usable local account before dashboard access
- Login page combines sign-in/sign-up in tabs with demo account and Google/LinkedIn options
- Login/sign-out redirects keep users on active local or live app host
- Access mobile app badges, social links, account controls, and Terms from global dashboard
- See logo, Hybrid AI, search, setup progress, help, credits, display controls, profile settings, sign-out, and notices in global topbar
- Display controls support light, dark, system, high-contrast, and larger-text modes
- Topbar actions use full-height hover and click targets for easier navigation
- Account pages use horizontal subpage bar for profile, preferences, subscription, billing, activity
- Dataset and downloads pages use shared table layouts with separated row actions
- Search covers app pages, datasets, reports, and FAQ answers (operator-only results for super-admins)
- Chat uses same search index to help users find dashboard pages or FAQ answers
- Collapse desktop sidebar while keeping primary navigation available
- See Terms, Privacy, copyright, social links, and coming-soon app badges in global footer
- App badges use App Store and Google Play icons; social links open in new tab
- Notices appear in topbar inbox with persistent count for review when ready
- Notices describe failed page script, background request, or API request directly
- Notices and activity feed show high-value account, billing, dataset events (no routine changes/clicks/login noise)
- Activity tracks saved product actions: profile, business, upload, analysis, deletion, registration, subscription
- Submit and track support tickets from Tickets page
- Tickets use row-first table with separate pages for creating and editing tickets
- Ticket rows support selection and bulk resolution from table action bar
- Ticket rows use subject as edit link, show edit link under subject, keep row action at end
- Tables use consistent bordered shell, header area, and row styling across previews, admin lists, business lists, support queues
- Public visitors can request demo or contact team from Contact page without signing in
- Super-admins have ticket queue for reviewing customer issues, adding support notes, marking resolved
- Support tickets, notes, billing settings, and referral events persist in database with production access
- Built-in FAQ answers account, billing, datasets, reports, credits, and Hybrid AI questions
- Protected operator FAQ covers support operations, payments, billing recovery, security, incident handling
- Search FAQ answers from floating help chat, then send support request when no match
- Floating help chat stays clear of footer with high-contrast message bubbles
- Dashboard FAQ uses expandable answers with one-line actions for feedback, chat support, ticket creation
- Separates user help from operator help with section bar for authorised operators
- Super-admins filter operator notes from dashboard FAQ instead of opening separate page
- Product-update waitlist signup works during local development without production database

## Payment Provider Setup
- Platform operators confirm payment provider connection before customers reach checkout
- Payment provider configuration limited to super-admin role only
- Payment setup page shows current status of secret key and webhook secret

## Credit Rules & Referrals
- Super-admins configure referrals needed for one analyst credit and toggle referral credits
- Referral rewards prevent self-referrals and are idempotent
- Manage referral rules, customer levels, and discount rules from super-admin sidebar

## Customer Management
- Review last 100 account, subscription, dataset activity events from Settings
- Super-admins review recent product activity across all users
- View full customer list with plan, signup date, last login, referral source, login count, dataset count
- Super-admins queue invites from customer list for existing customer rows
- Always see built-in demo and super-admin accounts at top of customer list
- Totals cards show total customers, Pro/Business count, free tier count, active-in-last-30-days count
- Review customers in read-first table with focused edit pages for individual rows

## Customer Levels & Discount Rules
- Super-admins define five customer tiers (Explorer through Champion) with independent thresholds for interactions, page visits, uploads, credits used, logins, each rewarding configurable credits
- Create, edit, enable, disable discount rules for free-plan discounts, percentage discounts, referral rewards, stacking behaviour
- Review customer levels and discount rules in read-first tables before focused edit pages

## Hybrid AI
- Hybrid AI popup uses shared modal for consistent body scroll lock, Escape handling, backdrop
- Opens reliably from dashboard topbar
- Free tier users see Pro and Business plan options guiding to checkout review