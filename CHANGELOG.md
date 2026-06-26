## [Unreleased]

### Changed

- Show the authenticated dashboard as an executive report-style workspace with health scores, AI readiness, KPI cards, chart panels, risks, opportunities, recommendations, activity, and quick actions.
- Show a professional display-settings icon across the public site, login page, and dashboard so theme and zoom controls feel consistent.
- Show the same self-running AI demo on the login page so visitors see the spreadsheet pain, AI analysis, discovered insights, and recommended action story before signing in.
- Show a premium self-running homepage hero demo that connects spreadsheet search pain to upload, AI analysis, discovered insights, and a recommended next action.
- Generate contextual AI Assistant suggestions automatically when a dataset is selected, with retail, inventory, sales, finance, SaaS, and fallback question sets.
- Remove setup progress and guided tour popups so onboarding stays focused on Business Profile, Accountancy, Dataset Upload, and Analysis.
- Simplify display controls to a compact Light Mode, Dark Mode, and zoom menu with dark mode as the default.
- Show Business and Accountancy onboarding badges in the sidebar so users can see required setup steps, completion progress, and completed status before starting analysis.
- Redesign Account settings as a wider control center with Profile, Company, Subscription, Security, account status, completion indicators, and a Continue Setup action.
- Expand Business Profile setup into a professional multi-step wizard that collects tax, payroll, insurance, fixed-cost, margin, cash-reserve, and growth assumptions for more accurate uploaded-data analysis.
- Show Accountancy as a pre-bookkeeping center for new users with document upload, package generation, export, accountant email, and Business Profile context guidance instead of an unavailable state.
- Show Retail Inventory Analyst results in scrollable tables with every matching product row, SKU, stock, sales, profit, margin, last-sale, and owner action details so store owners can decide what to reorder, discount, bundle, or protect.
- Require email verification before email-password accounts open the dashboard, with code entry and resend states during signup.

### Fixed

- Fix Google and LinkedIn sign-in so provider callbacks use the correct destination and failed sign-ins show a clear login-page message.
- Remove hardcoded pricing text from the homepage preview so validation accepts the public landing page.
- Add consistent spacing below page headers on Downloads, Datasets, Business, Accountancy, and Retail pages so content cards do not crowd the top navigation.
- Show plan price and a secure checkout button in the Upgrade to Pro modal, then start Stripe Checkout directly with a visible error if payment setup fails.
- Center billing review panel to prevent sidebar squeezing on Account/Settings page
- Fix Retail Inventory Analyst build by using a browser-safe CSV parser in the client component
