# Requirements — UseClevr

This file states the current product requirements in direct, present-state language.

Text rules for this file:

- Name the current actor, current behavior, and current outcome directly.
- Use required-action wording when the requirement defines a rule or boundary.
- Avoid vague phrases that hide the actor or the required action.
- Avoid past-state comparison unless it prevents a concrete risk.

## Infrastructure

- Store application data in Neon PostgreSQL.
- Store Payload Phase 0 content tables in the same PostgreSQL database.
- Use ephemeral PostgreSQL containers for local and CI validation.
- Manage database schema with Drizzle ORM migrations.
- Manage Payload schema with Payload migrations and generated types.
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
- Require a signed-in user for dataset upload, analysis, query, dashboard, prediction, investigation, and suggestion operations.
- Scope every persisted dataset read and calculation to the owning user.
- Never substitute another account's datasets when the current request has no signed-in owner.
- Keep each analysis request isolated from dataset state used by other requests.
- Open the AI Assistant from the dashboard sidebar.
- Keep dataset selection, suggested questions, and chat input visible in the AI Assistant.
- Keep AI answers within the uploaded dataset scope.
- Classify date, numeric, text, boolean, identifier, and mixed CSV columns from representative values.
- Calculate profit, margin, ROAS, net profit, and LTV only when the dataset contains the required source columns.
- Name missing calculation columns instead of substituting proxy costs, lifespans, benchmarks, or values.
- Store AI answer feedback on the saved answer history item.
- Explain efficient AI usage for public users, dashboard users, and operators.
- Use AI interaction records to speed future development by preserving concise correction patterns, user expectations, and reusable lessons for developers working with multiple AI agents.
- Redact credential-like values before AI interaction traces are stored or exported.
- Map business KPI columns by explicit meaning, including quantity, product, country or region, and revenue.
- Offer Hybrid AI Lite to Pro users.
- Offer Hybrid AI MEGA to Business users.
- Explain Hybrid AI plan access in customer-facing plan copy.

## Downloads & Reports

- Generate PDF reports from analysis results for Pro and Business users.
- Track downloads by dataset and report entry.
- Combine charts and table details in PDF exports.
- Use separated row actions for viewing, downloading, and deleting report rows.
- Keep private report search, listing, deletion, and downloads scoped to the owning user.
- Let super-admins search and manage report entries across users.

## Subscriptions & Billing

- Show Free, Pro Monthly, Pro Annual, and Business Monthly plans.
- Use a checkout review step before terms acceptance and payment.
- Start the secure payment flow after terms acceptance.
- Verify successful checkout sessions against the signed-in user.
- Verify checkout redirects with signed, time-limited server tokens.
- Apply the annual Pro discount at checkout.
- Sync subscription status from the payment provider.
- Give new Free accounts 14 days of unlimited analyst access from account creation without consuming their two post-trial free credits.
- Let Stripe webhook requests reach signature verification without requiring a browser session.
- Return an unavailable-checkout error when a paid plan has no configured payment price instead of reporting an unpersisted checkout success.
- Open the hosted billing portal for users with linked payment customers.
- Let users manage subscription, usage, downgrade, and cancellation from account billing.
- Limit free analyst credits and prompt upgrades when credits run out.
- Route mistyped dashboard settings links to Profile settings.

## Business Profile

- Use Business Profile as the SME business-intelligence and pre-accounting context layer.
- Show onboarding progress from account, business, upload, analysis, and dashboard visit data.
- Reopen onboarding for accounts below the minimum completion threshold.
- Link each setup progress item to its relevant page.
- Start a guided setup tour from the topbar progress panel.
- Include business profile, location, tax, financial, and overview visits in setup progress.
- Open Business as a top-level workspace with the businesses listing first.
- Create and update owned business profiles, archive and restore secondary profiles, and permanently
  delete an owned secondary profile only after it is archived.
- Show profile, location, tax, financial, and review subpages inside the Business workspace.
- Open business row edit links on the matching business profile.
- Open new business creation as a blank business profile.
- Show business review readiness inside the Business overview.
- Show saved business profile details when dedicated business records are unavailable.
- Support subscription-tier business limits, primary business storage, archive and restore states, operating entities, and cached country tax context.
- Collect company name, industry, location, website, and description.
- Show identity, contact, and operations sections in Business Profile.
- Collect baseline company identity, operating location, industry, contact, currency, and tax context.
- Separate user-entered values, estimates, and professional-verification items in tax-sensitive outputs.
- Keep tax, legal, insurance, and financing outputs framed as business-intelligence estimates or user-provided context, not professional advice.
- Keep Business Profile lightweight enough for SMEs, startups, freelancers, agencies, e-commerce companies, local services, restaurants, logistics, construction, real estate, and small manufacturers.
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
- Create the user and profile as one successful account setup outcome, and remove the user record when profile creation fails.
- Sign users in and open the dashboard immediately after successful email registration.
- Combine sign-in and sign-up in tabs on the login page.
- Offer the built-in demo account and configured Google or LinkedIn sign-in options.
- Show built-in base-role and superadmin demo credentials on the login page for app and admin testing.
- Authenticate the built-in superadmin account with the `superadmin` session role and allow protected administrator pages.
- Keep built-in base, demo, and superadmin identities locked to fixed IDs, emails, roles, and credentials.
- Persist built-in account dashboard preferences, onboarding, business setup, and uploaded datasets in the database.
- Give built-in accounts unrestricted dataset upload and analysis access for product testing.
- Use compact inner labels in login fields.
- Require strong signup passwords with length, character variety, and personal-information checks.
- Keep login and sign-out redirects on the active app host.
- Accept authentication redirects only for the current origin, local development origins, or HTTPS UseClevr origins.
- Redirect signed-out dashboard requests before nested layouts or pages access session-owned data.
- Use a compact default text scale across public and dashboard pages.
- Show logo, Hybrid AI, search, setup progress, help, credits, display controls, profile settings, sign-out, and notices in the global topbar.
- Keep topbar items on one line with consistent icon color and compact hover targets.
- Show a host-specific keyboard shortcut in the dashboard search trigger.
- Separate Light, Dark, and System theme selection from accessibility controls.
- Provide icon-only state controls for text size, page zoom, and contrast with accessible labels and pressed states.
- Use full-height hover and click targets in the dashboard topbar.
- Use a horizontal subpage bar for account profile, preferences, subscription, billing, and activity pages.
- Search app pages, datasets, reports, and FAQ answers from the dashboard search overlay.
- Limit operator-only search results to super-admin users.
- Use dashboard search context in chat support.
- Collapse and expand the desktop sidebar from the compact control beside Dashboard.
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
- Start management table rows with selection controls and place bulk and create, upload, or refresh actions in the table header.
- Keep page titles, breadcrumbs, and subpage navigation separate from the page body.
- Use optional body sidebars for supporting information while the center workspace remains focused on primary data and forms.
- Let public visitors request a demo or contact the team from the Contact page.
- Give super-admins a ticket queue with support notes and resolution controls.
- Persist support tickets, support notes, billing settings, and referral events in the database when database access is configured.
- Answer account, billing, dataset, report, credit, and Hybrid AI questions in the dashboard FAQ.
- Show protected operator FAQ content for authorised platform staff.
- Search FAQ answers from floating help chat.
- Answer public FAQ in the public help chat.
- Answer public and dashboard FAQ in the dashboard help chat.
- Answer public, dashboard, and operator FAQ in the super-admin help chat.
- Keep floating help chat clear of the footer.
- Keep the floating help chat launcher aligned to the right when the chat panel is open.
- Use a larger message input in floating help chat.
- Use high-contrast message bubbles in floating help chat.
- Show expandable FAQ answers.
- Show feedback, chat support, and ticket links above the dashboard FAQ list.
- Answer display, contrast, and text-size questions in public and dashboard FAQ.
- Show ticket creation on the Tickets page.
- Separate user help and operator help with a section bar.
- Filter operator notes from the dashboard FAQ for super-admins.
- Keep product-update waitlist signup usable during local development.

## AI Interaction Learning

- Record concise correction patterns, user expectations, and reusable lessons after each completed request/response cycle.
- Route durable learning into the smallest matching files for the audience instead of storing one large summary.
- Use the post-interaction hook to prepare future developers for repeated AI collaboration work.
- Use super-precise instruction language in AI guidance, TODO rules, changelog rules, and docs so
  the active AI agent can see who must act, what must change, and where the change belongs with no
  vagueness.
- Keep founder-facing project documents, sales planning, and project-control references separated from the current product docs when that split improves clarity.

## Public Content

- Keep the existing homepage, privacy, and terms routes available.
- Show public news at `/news` with individual news detail pages.
- Seed five starter news entries for first-use admin testing.
- Serve homepage, privacy, and terms copy from Payload when CMS content exists, and keep fallback copy available.
- Open Payload admin at `/admin`.
- Keep Payload admin focused on minimal content editing for CMS users, news, homepage, privacy, and terms.
- Match Payload admin typography, colors, control radius, navigation surfaces, and light/dark
  backgrounds to the dashboard design system.
- Structure Payload admin with a left main-menu rail, topbar, compact page header, body subheader,
  focused center workspace, and responsive right information panels.
- Link Payload admin navigation directly back to the signed-in dashboard.
- Allow only superadmin CMS users to edit Phase 0 public content.

## Payment Provider Setup

- Show payment provider connection status before customers reach checkout.
- Restrict payment provider configuration to super-admins.
- Show secret key and webhook secret readiness on the payment setup page.
- Keep Stripe as the active payment provider.
- Load the Stripe plugin in Payload when Stripe server credentials are configured.
- Add PayPal only when a second checkout provider is required.

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
- Support localhost Mock AI testing for Hybrid AI status, model list, pull, verification, chat, and analysis flows.
- Guard Mock AI mode from production runtime: only activate when `NODE_ENV !== "production"` and `MOCK_AI_MODE=true`.
- Route local AI queries in priority order: Antigravity Server → Local AI (Ollama) → Cloud AI (Gemini Flash 2.5). Mock AI short-circuits before any real provider check.

## Sales Planning

- Use stage gates for sales readiness milestones: materials draft, demo readiness, early adopter release, general availability.
- Review sales materials against `requirements.md` and `CHANGELOG.md` after every release.
- Log sales objection patterns, competitor positioning gaps, and pricing blockers in the lessons log.
- Track sales material accuracy as part of the release process.
- Manage sales artefacts (one-pager, demo scripts, demo datasets, objection handling) as project products with defined quality criteria and stage gate approvals.

## MCP

- Expose MCP tools only to signed-in users.
- Scope MCP dataset resources and tool calls to the signed-in user's datasets.
- Let super-admins access MCP resources and tools across platform datasets.
- Keep UseClevr MCP limited to product datasets and analysis tools.
- Expose Payload News and FAQ through Payload-native MCP with per-key tool permissions.
- Keep authenticated Payload MCP under `/api/payload/mcp`.
- Route `mcp-test.useclevr.com/api/mcp` to Payload Streamable HTTP MCP with a server-held API key.
- Expose only locked demo-account dataset metadata and stored analysis through the public test
  connector; never expose uploaded rows or customer-owned datasets.
- Require OAuth before the ChatGPT MCP app accesses private customer datasets.
