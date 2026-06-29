## [Unreleased]

### Changed

- Unlock Hybrid AI Lite and Hybrid AI MEGA modules from the same UseClevr Helper installation, with module access driven by the signed-in subscription.
- Add the UseClevr Helper local bridge for Hybrid AI, including protected desktop-helper downloads, branded private-analysis status, and an optional helper chat panel in the AI Assistant.
- Give Free accounts exactly two included analyst credits, then route upload, analysis, and report-download continuation through the existing Stripe upgrade path.
- Show superadmin, admin, and built-in testing accounts as unlimited for analyst usage without decrementing included credits or showing upgrade blocking.
- Show the authenticated dashboard as an executive report-style workspace with health scores, AI readiness, KPI cards, chart panels, risks, opportunities, recommendations, activity, and quick actions.
- Show a professional display-settings icon across the public site, login page, and dashboard so theme and zoom controls feel consistent.
- Show the same self-running AI demo on the login page so visitors see the spreadsheet pain, AI analysis, discovered insights, and recommended action story before signing in.
- Show a premium self-running homepage hero demo that connects spreadsheet search pain to upload, AI analysis, discovered insights, and a recommended next action.
- Generate contextual AI Assistant suggestions automatically when a dataset is selected, with retail, inventory, sales, finance, SaaS, and fallback question sets.
- Remove setup progress and guided tour popups so onboarding stays focused on Business Profile, Accountancy, Dataset Upload, and Analysis.
- Simplify display controls to a compact Light Mode, Dark Mode, and zoom menu with dark mode as the default.
- Show Business and Accountancy onboarding badges in the sidebar so users can see required setup steps, completion progress, and completed status before starting analysis.
- Redesign Account settings as a wider control center with Profile, Company, Subscription, Security, account status, completion indicators, and a Continue Setup action.
- Refine Business Profile setup with context-aware questions, smarter business-type examples, clearer validation, accessible focus states, and a more rewarding completion screen.
- Expand Business Profile setup into a professional multi-step wizard that collects tax, payroll, insurance, fixed-cost, margin, cash-reserve, and growth assumptions for more accurate uploaded-data analysis.
- Show Accountancy as a pre-bookkeeping center for new users with document upload, package generation, export, accountant email, and Business Profile context guidance instead of an unavailable state.
- Show Retail Inventory Analyst results in scrollable tables with every matching product row, SKU, stock, sales, profit, margin, last-sale, and owner action details so store owners can decide what to reorder, discount, bundle, or protect.
- Show the dashboard as a personalized AI retail business report with real-data KPIs, inventory health, product tables, supplier and category analysis, ABC classification, forecast notes, and prioritized recommendations.
- Require hashed email verification codes from the UseClevr email sender before email-password accounts open the dashboard, including signup verification, every-login verification, expiry, attempt limits, and resend cooldowns.
- Log sanitized SMTP settings and provider error details when verification email delivery fails so production diagnostics show the exact mail-server rejection without exposing passwords.
- Log masked email-password auth milestones and provide Railway auth-flow diagnostics so production registration and login failures identify the exact broken step.
- Add a temporary env-gated superadmin fallback verification path so platform access survives SMTP delivery failures without exposing the fallback code.
- Verify SpaceMail STARTTLS and SMTP authentication before sending verification emails, and expose a temporary SMTP status diagnostic endpoint for Railway troubleshooting.

### Fixed

- Fix authenticated sidebar page spacing globally so page greetings and first headings start below the sticky top navigation without clipping.
- Fix dashboard report greeting spacing and Business Profile completion scoring so completed visible profile fields show 100%.
- Fix Dashboard 2.0 TypeScript build blockers so production builds complete.
- Fix Google and LinkedIn sign-in so provider callbacks use the correct destination and failed sign-ins show a clear login-page message.
- Remove hardcoded pricing text from the homepage preview so validation accepts the public landing page.
- Add consistent spacing below page headers on Downloads, Datasets, Business, Accountancy, and Retail pages so content cards do not crowd the top navigation.
- Show plan price and a secure checkout button in the Upgrade to Pro modal, then start Stripe Checkout directly with a visible error if payment setup fails.
- Center billing review panel to prevent sidebar squeezing on Account/Settings page
- Fix Retail Inventory Analyst build by using a browser-safe CSV parser in the client component
