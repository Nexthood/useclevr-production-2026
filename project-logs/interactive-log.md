- Simplified the Appearance menu to a compact Light Mode, Dark Mode, and zoom-level dropdown, removed text-size and contrast controls from the menu, and set dark mode as the default.
- Added Business and Accountancy sidebar onboarding badges with Required, percentage, and completed states, and routed incomplete Business navigation directly to the Business Profile setup flow.
- Redesigned Account settings into a wider SaaS control center with live setup progress, account status, Profile, Company, Subscription, and Security sections, completion indicators, and Continue Setup actions.
- Fixed Upgrade to Pro checkout flow by showing the selected Pro plan, monthly price, secure checkout button, direct Stripe Checkout redirect, and visible modal error handling when checkout creation fails.
- Expanded Business Profile setup into a professional one-question-per-step wizard with conditional country, tax, payroll, insurance, fixed-cost, debt, margin, cash-reserve, and growth questions, and routed the Business overview page to the shared persisted wizard instead of the short local-only flow.
- Fixed Accountancy new-user workflow by showing a Pre-bookkeeping center empty state, upload and package-generation actions, Business Profile accounting context, export options, and accountant handoff fields instead of treating missing accountancy data as unavailable.
- Changed Retail Inventory Analyst result tables to show every low-stock, dead-stock, and top-profit row in scrollable tables with sticky headers instead of hiding remaining rows behind "+ more" summaries.
- Improved Retail Inventory Analyst result cards so low stock, dead stock, and top profit rows show product, SKU, category, stock, reorder point, units sold, revenue, cost, gross profit, margin, last sale, order details, and owner-friendly next actions.
- Added Retail & Inventory Analysis module (sidebar integration and dedicated Retail page with upload functionality, AI summary, and analytics cards)
- Fixed Account settings layout width by narrowing the right info rail and relaxing subscription
  plan grid columns so plan cards, text, and buttons stay visible without changing billing logic.
- Centered and widened the Account settings checkout review and terms panels so selected-plan
  details, terms, and payment actions stay readable without changing checkout logic.
- Reworked the Account settings checkout terms/payment step into a wider compact two-column desktop
  layout with terms on the left and accept/payment actions on the right.
- Fixed Reports & Downloads page vertical spacing by adding `mt-4` to the main content area
- Fixed Retail Inventory Analyst build by creating browser-safe CSV parser module and using it in the client component
