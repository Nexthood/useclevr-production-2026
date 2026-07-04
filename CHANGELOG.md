## [Unreleased]

### Changed

- Remove app zoom controls completely and simplify theme toggle to a single sun/moon button.
- Add a global cookie consent banner with essential-only, accept-all, and preference-management choices for analytics and product-improvement cookies.
- Show Free at €0/month, Pro at €40/month, and Business at €420/month across subscription, billing, checkout, upgrade, pricing, FAQ, assistant, Stripe, and sales surfaces.
- Provide globally oriented Terms of Service and Privacy Policy pages with GDPR, UK GDPR, CCPA, CPRA, international user, cross-border processing, Stripe payment, AI processing, SEO, and working internal legal links.
- Replace the floating Help Chat with Usy, a premium UseClevr AI Business Intelligence Assistant that uses the assistant avatar, balanced header spacing, refined cyan-lilac motion, bright suggestion chips, Hybrid AI when available, and UseClevr-specific fallback answers.
- Extend admin and superadmin Usy into UseClevr Company Brain Lite for platform customers, plans, credits, uploads, errors, AI traces, billing settings, discount rules, MCP tokens, failed analyses, user issues, and platform status.
- Make Usy role-aware with route, plan, usage, intent-scored fallback answers, admin-safe guidance, and contextual follow-up chips for short natural messages.
- Refine the opened Usy assistant into a premium flex panel with a compact text header, centered avatar welcome card, visible suggestion chips, scroll-only conversation area, and compact fixed input.
- Keep Usy billing answers on current monthly pricing, showing Pro at €40/month and Business at €420/month without annual pricing guesses.
- Position the opened Usy desktop assistant panel lower below the top UI so it feels properly spaced from the browser and app header.
- Show contextual follow-up chips after each Usy response so users can continue with relevant next-step questions.
- Show Free plan dataset limits as an upgrade path on upload surfaces instead of a failed-upload error.
- Simplify MVP authentication to email-password, email verification, password reset, and demo access while removing Google and LinkedIn sign-in.
- Add Business Intelligence Engine Phase 1 so uploaded datasets automatically receive profiling, KPI detection, business health scoring, risk and opportunity detection, executive summaries, and prioritized recommended actions.
- Add centralized Hybrid AI feature gates so Lite includes private chat, CSV/Excel analysis, dashboard insights, provider management, provider health checks, Auto/Local/Cloud modes, AI Assistant integration, and dataset-aware chat, while MEGA enforces multiple providers, provider fallback, multi-document analysis, AI reports, audit logs, and roadmap actions.
- Add metadata-only AI privacy audit logging so users and superadmins can see which provider handled each AI request, whether data stayed local or went to cloud, and whether fallback routing was used.
- Route the existing AI Assistant through Hybrid AI provider routing so general and dataset-aware chat share the same BYOAI modes, summarized dataset context, fallback rules, and provider status display.
- Make Hybrid AI Chat dataset-aware so users can select a dataset, ask business questions, and receive answers from summarized context, KPI extracts, column profiles, sample rows, and provider routing status.
- Add a Hybrid AI Chat page so signed-in users can test configured AI providers through the universal adapter with provider, model, local/cloud route, fallback, and unavailable status shown in the chat.
- Add Hybrid AI provider health checks so users can validate enabled providers with reachability, latency, model confirmation, model discovery, classified errors, and offline-safe routing before analysis.
- Add Phase 1 Bring Your Own AI provider management so users can connect multiple encrypted AI providers, test latency and model availability, choose a default provider, and route analysis through automatic fallback.
- Add Hybrid AI mode switching so users can choose Auto, Offline local-only, or Cloud-only routing with provider health checks and visible routing status.
- Show a complete AI Providers settings page with provider list, add and edit dialog, connection results, detected models, explicit default and fallback selectors, and priority routing.
- Show Bring Your Own AI as the recommended Hybrid AI setup path and mark UseClevr Helper downloads as coming soon until signed binaries are available.
- Route AI Assistant answers through the selected AI provider with automatic fallback and show provider status on assistant responses.
- Route dataset summaries, predictive summaries, analyst narratives, investigation findings, comparison narratives, query explanations, and report chat through selected AI providers with automatic default-cloud fallback.
- Unlock Hybrid AI Lite and Hybrid AI MEGA modules from the same UseClevr Helper installation, with module access driven by the signed-in subscription.
- Add the UseClevr Helper local bridge for Hybrid AI, including protected desktop-helper downloads, branded private-analysis status, and an optional helper chat panel in the AI Assistant.
- Give Free accounts exactly two included analyst credits, then route upload, analysis, and report-download continuation through the existing Stripe upgrade path.
- Show superadmin, admin, and built-in testing accounts as unlimited for analyst usage without decrementing included credits or showing upgrade blocking.
- Show the authenticated dashboard as an executive report-style workspace with health scores, AI readiness, KPI cards, chart panels, risks, opportunities, recommendations, activity, and quick actions.
- Show the same self-running AI demo on the login page so visitors see the spreadsheet pain, AI analysis, discovered insights, and recommended action story before signing in.
- Show a premium self-running homepage hero demo that connects spreadsheet search pain to upload, AI analysis, discovered insights, and a recommended next action.
- Generate contextual AI Assistant suggestions automatically when a dataset is selected, with retail, inventory, sales, finance, SaaS, and fallback question sets.
- Remove setup progress and guided tour popups so onboarding stays focused on Business Profile, Accountancy, Dataset Upload, and Analysis.
- Use a single sun/moon button for theme switching in display controls.
- Show Business and Accountancy onboarding badges in the sidebar so users can see required setup steps, completion progress, and completed status before starting analysis.
- Redesign Account settings as a wider control center with Profile, Company, Subscription, Security, account status, completion indicators, and a Continue Setup action.
- Refine Business Profile setup with context-aware questions, smarter business-type examples, clearer validation, accessible focus states, and a more rewarding completion screen.
- Expand Business Profile setup into a professional multi-step wizard that collects tax, payroll, insurance, fixed-cost, margin, cash-reserve, and growth assumptions for more accurate uploaded-data analysis.
- Show Accountancy as a pre-bookkeeping center for new users with document upload, package generation, export, accountant email, and Business Profile context guidance instead of an unavailable state.
- Show Retail Inventory Analyst results in scrollable tables with every matching product row, SKU, stock, sales, profit, margin, last-sale, and owner action details so store owners can decide what to reorder, discount, bundle, or protect.
- Show the dashboard as a personalized AI retail business report with real-data KPIs, inventory health, product tables, supplier and category analysis, ABC classification, forecast notes, and prioritized recommendations.
- Require hashed email verification codes from the UseClevr email sender before email-password accounts open the dashboard, including signup verification, every-login verification, expiry, attempt limits, and resend cooldowns.
- Send verification emails through Resend only and log sanitized provider error details when delivery fails so production diagnostics show sender-domain and API rejections without exposing secrets.
- Log masked email-password auth milestones and provide Railway auth-flow diagnostics so production registration and login failures identify the exact broken step.
- Add a temporary env-gated superadmin fallback verification path so platform access survives email delivery failures without exposing the fallback code.
- Expose a guarded Resend status diagnostic endpoint and verification-send script for Railway troubleshooting.

### Fixed

- Prevent Downloads upgrade prompts and cards from rendering before usage, plan, and role state resolves so admin and superadmin sessions do not see Free-plan upgrade flashes.
- Fix dataset detail and forecast actions so dataset pages use the same signed-in access rules, analysis avoids broken dataset navigation, and forecast guidance names missing data requirements.
- Fix authenticated sidebar page spacing globally so page greetings and first headings start below the sticky top navigation without clipping.
- Fix dashboard report greeting spacing and Business Profile completion scoring so completed visible profile fields show 100%.
- Fix Dashboard 2.0 TypeScript build blockers so production builds complete.
- Remove hardcoded pricing text from the homepage preview so validation accepts the public landing page.
- Add consistent spacing below page headers on Downloads, Datasets, Business, Accountancy, and Retail pages so content cards do not crowd the top navigation.
- Show plan price and a secure checkout button in the Upgrade to Pro modal, then start Stripe Checkout directly with a visible error if payment setup fails.
- Center billing review panel to prevent sidebar squeezing on Account/Settings page
- Fix Retail Inventory Analyst build by using a browser-safe CSV parser in the client component
