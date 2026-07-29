# Requirements — UseClevr

This file states the current product requirements in direct, present-state language.

Text rules for this file:

- Name the current actor, current behavior, and current outcome directly.
- Use required-action wording when the requirement defines a rule or boundary.
- Avoid vague phrases that hide the actor or the required action.
- Avoid past-state comparison unless it prevents a concrete risk.

## Infrastructure

- Store application data in Neon PostgreSQL.
- Store Payload content and administrator-authentication tables in the same PostgreSQL database.
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
- Apply the Retail POS integration schema during deployment before Retail pages or integration APIs query POS connection tables.

## Upload & Analysis

- Upload CSV files for AI analysis.
- Show Free plan dataset-limit responses as an informational upgrade state, not as an upload failure.
- Disable upload drag-and-drop after the Free plan dataset limit is reached until the user upgrades.
- Show Pro and Business upgrade actions from the Free plan dataset-limit upload state.
- Compare Free, Pro, and Business upload benefits in the dataset-limit upload state.
- Show uploaded datasets in structured tables with row counts.
- Store dataset category metadata for standard, retail, profitability, accountancy, and pre-bookkeeping uploads.
- Scan uploaded datasets with the Dataset Intelligence Engine to detect file structure, semantic column meanings, value types, business model, relationships, KPI candidates, dashboard metadata, confidence scores, and explainability.
- Keep the Dataset Intelligence Engine modular with detector registries for current CSV and Excel-style tables and future PDF, image OCR, SQL, Snowflake, and API sources.
- Run Enterprise Dataset Intelligence scanners through a central orchestration foundation with registry-based scanner discovery, ordered execution, immutable shared context, progress reporting, structured logs, failure recovery, retry, resume, cancellation, and execution reports.
- Profile uploaded CSV and Excel physical structure with the Enterprise Dataset Intelligence structure scanner, including file metadata, encoding, delimiter, separators, language, timezone, worksheet layout, duplicate headers and rows, hidden and merged worksheet elements, data regions, footer rows, column data types, missing ratios, unique ratios, health scores, recommendations, fingerprints, confidence scores, and scanner step logs.
- Keep the Enterprise Dataset Intelligence structure scanner free of business meaning, KPI, dashboard, relationship, and AI interpretation decisions.
- Profile uploaded dataset columns with the Enterprise Dataset Intelligence semantic scanner by using configurable multilingual aliases, header similarity, sample values, detected data types, neighboring columns, statistical signals, confidence scoring, evidence, alternative matches, unknown-field review flags, semantic coverage, quality scoring, and cached deterministic profiles.
- Keep the Enterprise Dataset Intelligence semantic scanner free of business model classification, relationship inference, KPI generation, dashboard rendering, automatic learning, and user-data training decisions.
- Profile uploaded dataset business objects with the Enterprise Dataset Intelligence entity scanner by using semantic columns, sample value patterns, neighboring columns, dataset context, business vocabulary, dictionary matches, statistical analysis, cross-column validation, duplicate-candidate detection, entity statistics, confidence scoring, evidence, warnings, quality scoring, and scanner logs.
- Keep the Enterprise Dataset Intelligence entity scanner free of knowledge-graph writing, relationship inference, cross-dataset entity resolution, OCR extraction, connector extraction, vector search, active learning, and human-review workflow execution until those EDIE phases explicitly add those responsibilities.
- Profile relationships between detected dataset entities with the Enterprise Dataset Intelligence relationship engine by using entity profiles, semantic columns, column position, key evidence, value distributions, dataset structure, business vocabulary, cross-validation, confidence scoring, cardinality detection, graph output, relationship statistics, warnings, quality scoring, and scanner logs.
- Keep the Enterprise Dataset Intelligence relationship engine free of knowledge-graph persistence, AI reasoning execution, automatic KPI generation, root-cause analysis, recommendation generation, forecasting, industry detection, graph-database writes, cross-dataset relationships, streaming graph updates, active learning, human validation, semantic memory, vector search, and embedding-provider execution until those EDIE phases explicitly add those responsibilities.
- Provide Dataset Intelligence Engine semantic metadata to dataset analysis, dynamic dashboard generation, and Dataset AI Assistant provider prompts.
- Generate dashboard KPI and chart candidates from detected semantic roles instead of fixed header-only assumptions.
- Route Standard Upload datasets to the generic dataset analysis route.
- Show one Standard Upload success panel with Dataset type, Rows processed, Columns detected, Analysis status, Open in Dashboard, View Dataset, and Upload Another File actions after a standard dataset upload completes.
- Route Profitability Upload datasets to the Profitability workspace.
- Route Accountancy Upload datasets to the Accountancy workspace.
- Route Invoice, Receipt, Bank Export, and Pre-bookkeeping Upload datasets to the Pre-bookkeeping workspace.
- Route Retail uploads to the Retail workspace.
- Keep the main Dashboard free of retail-specific report sections and retail-only KPIs.
- Show retail-specific reports, inventory metrics, low-stock items, dead-stock items, products, and SKU details only inside the Retail workspace.
- Show dataset library rows with dataset type, upload source, destination module, and analysis status.
- Route dataset library clicks to the matching workspace for retail, profitability, accountancy, and pre-bookkeeping datasets.
- Delete selected Dataset Library rows only after user confirmation.
- Delete only datasets the signed-in user owns or an admin/superadmin is allowed to manage.
- Delete selected datasets together with dataset rows, AI request metadata, cost and audit references, activity references, generated reports, and stored upload files where available.
- Keep storage cleanup non-blocking and log missing or failed storage object cleanup server-side.
- Show deleted Dataset Library rows, overview counters, selected IDs, and sidebar usage from the latest successful delete result.
- Keep failed Dataset Library delete selections visible and selected when a bulk delete partially succeeds.
- Render Executive Dashboard Overview, Financial, Inventory, Geography, and AI & Activity tabs as in-place content panels under the tab bar without automatic scrolling, route navigation, page reloads, or duplicate stacked sections.
- Use title links, open/edit links, and row-end actions in dataset rows.
- Load dataset detail and dataset analysis pages through the same signed-in dataset access rules, with superadmin access across datasets.
- Redirect dataset detail to dataset analysis when detail-row loading cannot complete, without showing the datasets error page.
- Ask AI questions about uploaded datasets and receive structured answers.
- Route supported dataset-aware AI Assistant KPI questions through a central analytical intent registry before provider routing.
- Answer selected-dataset AI Assistant questions from normalized dataset rows before provider routing when deterministic revenue, segment, risk, trend, best-segment, forecast-baseline, or summary answers are available.
- Interpret short dataset questions such as plan, segment, growth, forecast, risk, and best-segment prompts against the selected dataset context without requiring perfect wording.
- Send selected-dataset AI Assistant provider-backed questions to configured Gemini or Antigravity cloud AI when saved provider settings fail to load or no saved provider handles the request.
- Pass the configured Gemini provider key directly into the Dataset AI Assistant cloud fallback request so production does not depend on implicit SDK environment variable names.
- Return selected dataset context with Dataset AI Assistant cloud-provider failure responses so retryable production failures remain tied to the chosen dataset.
- Keep Dataset AI Assistant state, selected dataset routing, retry behavior, and dataset-grounded conversation separate from the Usy floating product assistant.
- Show classified Dataset AI Assistant failure states for no dataset selected, missing dataset, unauthorized request, empty dataset, provider unavailable, provider timeout, missing provider configuration, invalid provider response, network interruption, and internal failure.
- Preserve the failed Dataset AI Assistant question and show one retry action for the corresponding response state.
- Log Dataset AI Assistant request diagnostics with request ID, dataset ID, dataset type, tenant, user ID, provider, model, processing stage, duration, HTTP status, and sanitized error only.
- Map uploaded dataset columns to canonical business fields with normalized names, confidence values, original column references, ambiguity handling, and dataset-scoped schema state.
- Calculate gross margin deterministically from revenue plus COGS, revenue plus validated gross profit, or validated gross margin fields.
- Never calculate gross margin from operating expenses alone and never infer COGS from an ambiguous generic cost field.
- Return structured unsupported analysis messages for missing revenue, missing COGS, ambiguous cost mapping, zero revenue, mixed currency, invalid numeric values, unavailable dataset context, unsupported dataset type, and insufficient data.
- Filter AI Assistant suggested questions by selected-dataset semantic capabilities before showing financial KPI prompts.
- Show deterministic KPI results with Direct data analysis status and Last provider: Not required when no AI provider is needed.
- Answer declining sales segment questions from validated dataset rows by detecting a time column, sales or revenue metric, and segment-like dimensions before provider routing.
- Compare declining sales segment results across the two latest complete periods and exclude sparse trailing periods from period-over-period comparisons.
- Return direct calculated declining sales segment findings when the AI provider is unavailable or not needed for the numeric answer.
- Present declining sales segment findings in grouped AI Assistant sections for Startup Stage, Acquisition Channel, Plan, and Geography.
- Show the largest declining segment first within each group, limit each group to three visible rows by default, and let users expand groups with additional rows.
- Show declining sales segment result tables inside contained horizontal-scroll panels with readable headers and important columns first.
- Return structured dataset-schema errors for missing segment dimensions, missing time dimensions, missing sales metrics, and insufficient complete periods.
- Show AI Assistant provider status as Direct data analysis or Failed before provider execution when deterministic dataset handling completes or blocks before provider routing.
- Require a signed-in user for dataset upload, analysis, query, dashboard, prediction, investigation, and suggestion operations.
- Scope every persisted dataset read and calculation to the owning user.
- Never substitute another account's datasets when the current request has no signed-in owner.
- Keep each analysis request isolated from dataset state used by other requests.
- Open the AI Assistant from the dashboard sidebar.
- Keep dataset selection, suggested questions, and chat input visible in the AI Assistant.
- Generate at least 10 contextual AI Assistant suggestions automatically after dataset selection by detecting retail, inventory, sales, finance, SaaS, or generic data from the dataset columns.
- Cache AI Assistant suggestions per selected dataset and show fallback suggestions when generation fails.
- Keep AI answers within the uploaded dataset scope.
- Show geographic dataset visualizations only when uploaded rows contain country, city, region, market, location, state, province, territory, area, or zone columns.
- Show a professional dark BI world map with detected location nodes, restrained flow lines, compact metric cards, hover tooltips, and top-location summaries when geographic columns are available.
- Show "No geographic data detected." and "Upload data with country, city, region, or location columns to generate a map." when no geographic columns are available.
- Never render fake geographic locations for datasets that do not contain geographic columns.
- Classify date, numeric, text, boolean, identifier, and mixed CSV columns from representative values.
- Calculate profit, margin, ROAS, net profit, and LTV only when the dataset contains the required source columns.
- Name missing calculation columns instead of substituting proxy costs, lifespans, benchmarks, or values.
- Show forecast guidance when time columns, numeric business columns, or enough rows are missing instead of a generic forecast failure.
- Show Retail Inventory Analyst results as owner-readable inventory cards and scrollable tables.
- Show every Retail Inventory Analyst result row in the relevant table without hiding remaining products behind summary-only overflow text.
- Show SKU, product name, category, current stock, reorder point, units sold, revenue, cost, gross profit, margin percentage, last sale date, and order number in Retail Inventory Analyst rows when the uploaded dataset provides those fields.
- Explain each Retail Inventory Analyst low-stock alert with current stock, reorder point, recent units sold, and a reorder recommendation.
- Explain each Retail Inventory Analyst dead-stock row with recent sales level, days since last sale, stock value stuck, and a suggested discount, bundle, or stop-reorder action.
- Deduplicate Retail Inventory Analyst top-profit rows by product, SKU, and order number while preserving distinct SKU or order records.
- Show Retail POS Connections at the top of the Retail workspace before CSV and Excel upload, with Square connection status, connect action, merchant name, locations, products, last sync, manual sync, disconnect action, imported record counts, sync history, last webhook time, and connection errors.
- Show the Retail POS Connections empty state as Not Connected when the signed-in user has no POS connection.
- Let authenticated retail users start Square OAuth from the Retail workspace through a server-created state value tied to the current primary business organization.
- Require `SQUARE_ENVIRONMENT` to equal `production` or `sandbox` exactly before Square OAuth, token exchange, webhook verification, or API sync requests run.
- Use the Square production OAuth authorization, token, revoke, and API endpoints only when `SQUARE_ENVIRONMENT=production`.
- Use the Square sandbox OAuth authorization, token, revoke, and API endpoints only when `SQUARE_ENVIRONMENT=sandbox`.
- Store Square OAuth access tokens and refresh tokens only as encrypted server-side values.
- Keep Square integration scopes read-only for merchant profile, catalog items, inventory, orders, and payments.
- Store Square merchant, location, product, variant, inventory, order, order-item, sync-run, webhook-event, and AI-insight records as organization-scoped retail data.
- Keep POS-connected retail data separate from standard, profitability, accountancy, and pre-bookkeeping datasets.
- Preserve CSV and Excel retail uploads as a supported retail data source alongside Square-connected data.
- Queue Square initial and manual sync runs without exposing provider tokens to the browser.
- Build Square OAuth authorization and token-exchange requests from one canonical server-side callback URL at `/api/integrations/retail/square/callback`.
- Resolve Railway test Square OAuth with `SQUARE_ENVIRONMENT=sandbox`, Square sandbox endpoints, and `https://test.useclevr.com/api/integrations/retail/square/callback`.
- Resolve production Square OAuth with `SQUARE_ENVIRONMENT=production`, Square production endpoints, and `https://useclevr.com/api/integrations/retail/square/callback`.
- Reject Square OAuth when the Square environment, application ID, callback URI, or stored OAuth state environment do not match the current deployment configuration.
- Allow the Square OAuth callback route through API proxy authentication so Square can return authorization results to the application.
- Complete Square OAuth callbacks from the stored server-side state record that binds provider, provider environment, organization, creator, expiration, and nonce.
- Redirect Square OAuth success and failure results to the Retail Integrations page with safe status and reason codes.
- Verify Square webhooks against the raw request body and configured notification URL before storing sanitized webhook metadata.
- Mark duplicate Square webhooks without processing the same provider event twice.
- Disconnect Square without deleting imported analytics data.
- Store AI answer feedback on the saved answer history item.
- Explain efficient AI usage for public users, dashboard users, and operators.
- Complete the usable-MVP and sales-validation exit gates before activating AI-differentiation or
  platform-expansion work.
- Keep Payload MCP limited to approved content tools and locked demo-account dataset summaries.
- Treat private customer MCP access, broader public APIs, data connectors, market intelligence, and
  Intelligence Cloud as future work until customer workflows, authorization, operating reliability,
  retention, and revenue justify expansion.
- Use AI interaction records to speed future development by preserving concise correction patterns, user expectations, and reusable lessons for developers working with multiple AI agents.
- Redact credential-like values before AI interaction traces are stored or exported.
- Map business KPI columns by explicit meaning, including quantity, product, country or region, and revenue.
- Generate Business Intelligence Engine Phase 1 output automatically after CSV or Excel upload.
- Profile uploaded datasets by columns, data types, missing values, duplicate rows, and invalid values.
- Detect business KPI columns for revenue, profit, cost, margin, inventory, customers, orders, products, and time.
- Calculate a 0-100 Business Health Score from data quality, KPI completeness, trend stability, and business risk signals.
- Detect business risks including declining revenue, falling margins, low stock, customer concentration, seasonal or trend anomalies, and outliers.
- Detect business opportunities including high-performing products, growth opportunities, upselling opportunities, inventory optimization, and cost savings.
- Show a concise executive summary and prioritized High, Medium, and Low recommended actions with reason, expected business impact, and confidence.
- Show Risk Intelligence as an authenticated dashboard module for supported standard, retail, profitability, accountancy, and pre-bookkeeping datasets.
- Calculate Risk Intelligence on the server from existing KPI outputs, uploaded dataset rows, and centralized versioned rules.
- Score Risk Intelligence from 0 to 100 where higher scores mean greater risk, with Low at 0-24, Medium at 25-49, High at 50-74, and Critical at 75-100.
- Calculate category and overall Risk Intelligence scores from applicable rule weights only, without penalizing datasets for unsupported metrics.
- Keep Risk Intelligence isolated to one selected dataset or module scope at a time.
- Show Risk Intelligence summary cards, severity counts, last calculated time, dataset scope, prioritized findings, recommendations, and source links.
- Show "No supported business data is available yet. Upload or connect a dataset to generate risk intelligence." when supported data is unavailable.
- Require the Hybrid AI Lite dashboard-insights entitlement before Risk Intelligence page and API calculations run, while the official superadmin account keeps unrestricted access.
- Reject direct Risk Intelligence API requests from normal Free accounts and from users who do not own the requested dataset.
- Store Accuracy Engine retrieval documents by authenticated dataset owner, dataset ID, dataset type, source type, source record ID, content, metadata, embedding metadata, content hash, language, and ingestion timestamps.
- Detect Accuracy Engine database retrieval mode as `lakebase_hybrid`, `pgvector_fts`, or `fts_only` without crashing when Lakebase or pgvector extensions are unavailable.
- Keep Accuracy Engine retrieval separate from deterministic KPI calculations; SQL calculates exact KPI values and retrieval supplies context for explanation.
- Ingest only retrieval-relevant dataset summaries, column descriptions, product identities, supplier identities, invoice or receipt text, report explanations, controlled summaries, and document chunks.
- Require authenticated dataset ownership or admin/superadmin access before Accuracy Engine ingestion or retrieval runs.
- Require dataset ID and tenant-scoped filtering for every Accuracy Engine dataset-context search.
- Combine semantic and keyword Accuracy Engine results with Reciprocal Rank Fusion, deduplicate by retrieval document ID, and return bounded context only.
- Route Business Intelligence Engine narrative generation through the Universal AI Adapter while keeping deterministic calculations in the backend.
- Offer Hybrid AI Lite to Pro users.
- Offer Hybrid AI MEGA to Business users.
- Give the official superadmin account unrestricted Hybrid AI Lite, BYOK, Local AI download, Local AI setup, all AI modes, and unlimited AI provider access without requiring a paid subscription.
- Explain Hybrid AI plan access in customer-facing plan copy.
- Use UseClevr Helper as the desktop bridge for Hybrid AI private analysis.
- Keep normal Hybrid AI UI branded as UseClevr Hybrid AI, Private AI Analysis, Local AI Engine, Secure runtime connected, and Files stay on your device.
- Keep technical runtime names, internal engine names, and model names out of normal customer UI.
- Register every Hybrid AI capability in a centralized feature gate with a required Lite or MEGA tier and upgrade explanation.
- Enforce Hybrid AI feature access on backend routes and server actions before local-provider chat, dataset-aware Hybrid AI chat, AI provider testing, provider health checks, provider saves, provider routing, and mode changes run.
- Resolve Hybrid AI and BYOK page access from the same centralized superadmin-aware entitlement object that drives global subscription status.
- Preserve `null` as the unlimited AI provider limit and display it as Unlimited.
- Show the AI provider database migration warning only when provider settings or mode storage cannot load.
- Include Hybrid AI Modal, Private Chat, CSV/Excel Analysis, Dashboard Insights, AI Provider Management, Provider Health Checks, Auto Mode, Local Mode, Cloud Mode, AI Assistant integration, and Dataset-aware chat in Hybrid AI Lite.
- Include Multiple AI Providers, Provider Fallback, Multi-document Analysis, AI Reports, Audit Logs, Workflow Automation roadmap, and UseClevr Helper roadmap in Hybrid AI MEGA.
- Mark AI Agents, Deep Research, Background Tasks, Business Assistants, Team AI, and Local Knowledge Base as coming soon MEGA modules.
- Limit Hybrid AI Lite users to one configured AI provider and route only that provider through BYOAI execution.
- Let Hybrid AI MEGA users configure multiple providers and fallback routing.
- Show upgrade dialogs when users try to use a Hybrid AI feature that their active plan does not include.
- Log blocked Hybrid AI feature attempts server-side with user ID, role, subscription tier, feature ID, required tier, source, and safe message.
- Test Hybrid AI feature gates for Lite users, MEGA users, expired subscriptions, trial accounts, and superadmin access.
- Show an AI Providers settings page.
- Let signed-in users configure Ollama, LM Studio, OpenAI-compatible, OpenAI, Anthropic, Google Gemini, and Azure OpenAI providers with provider name, type, base URL, optional encrypted API key, model, enabled state, default-provider state, fallback-provider state, and priority.
- Store AI provider API keys encrypted on the server and never return saved keys to the browser.
- Test AI provider connections through a signed-in server endpoint and show connection status, latency, model confirmation, available models, and clear failure messages.
- Check every enabled AI provider through a signed-in server endpoint and store reachability, latency, available models, last checked timestamp, classified error status, and last error message.
- Show AI provider status badges for Healthy, Unreachable, Auth failed, Model missing, Fallback ready, and Offline mode active.
- Show a Hybrid AI Chat page in the AI Analyst area for signed-in users to test configured providers through the universal AI adapter before running business analysis.
- Route Hybrid AI Chat messages through `/api/hybrid-ai/chat` with OpenAI-compatible message input, server-side provider execution, no browser-exposed API keys, and visible provider name, model, local/cloud route, fallback, and unavailable states.
- Let users select a dataset inside Hybrid AI Chat and ask questions through `/api/hybrid-ai/dataset-chat`.
- Build Hybrid AI dataset-chat context from dataset metadata, schema, row count, detected columns, backend KPI extracts, column profiles, grouped summaries, and bounded sample rows instead of sending full large datasets to the model.
- Show Hybrid AI dataset-chat status for selected dataset, provider used, local/cloud route, summarized context size, and cloud fallback privacy warnings.
- Let users choose Auto, Local only / Offline mode, or Cloud only routing from the AI Providers settings page.
- Route AI analysis and assistant chat through the universal AI adapter before using the default cloud fallback.
- Route dataset executive summaries, predictive summaries, analyst narratives, investigation findings, comparison narratives, query explanations, and report chat through the universal AI adapter before using the default cloud fallback.
- Support OpenAI, Anthropic, Google Gemini, OpenAI-compatible, Ollama, and managed UseClevr Cloud provider routes.
- Store user-owned provider API keys only as server-side AES-256-GCM encrypted values with versioned encryption metadata.
- Require `AI_PROVIDER_ENCRYPTION_KEY` before saving or using provider API keys.
- Never send decrypted provider keys to the browser, AI traces, audit logs, analytics, provider status payloads, or error responses.
- Reject custom provider base URLs that use unsupported schemes, embedded credentials, metadata hosts, private network ranges, loopback addresses, link-local addresses, localhost aliases, or DNS targets that resolve to private ranges.
- Allow localhost only for the explicit Ollama/local provider flow through the local connector path.
- Use Automatic mode to apply privacy, task complexity, local availability, BYOK priority, and the user's UseClevr Cloud fallback setting.
- Use Local mode to route through Ollama/local AI and show a clear local-runtime-unavailable error when the local runtime cannot answer.
- Use BYOK mode to try the default enabled user provider first, then other enabled BYOK providers by priority.
- Use UseClevr Cloud mode to route directly to managed UseClevr Cloud AI.
- Use the user's UseClevr Cloud fallback setting before default cloud AI handles a failed or missing BYOK route.
- Let users choose default provider status and priority from the AI Providers settings page.
- Check provider health with a non-customer prompt before sending analysis data to a configured provider.
- Classify provider connection tests as connected, invalid key, model unavailable, endpoint unreachable, rate limited, provider error, or configuration error.
- Show the AI Assistant provider state for each response, including Local AI active, Cloud fallback active, Offline mode active, local provider unavailable, and provider unavailable.
- Route existing AI Assistant chat through the same Hybrid AI provider routing, dataset-aware context builder, fallback rules, Local only cloud blocking, and provider status display as Hybrid AI Chat.
- Allow AI Assistant users to ask general questions without a selected dataset and use summarized dataset context automatically when a dataset is selected.
- Let Usy answer spontaneous UseClevr questions in English, German, Dutch, Spanish, Hungarian, and Romanian, replying in the detected user language when possible.
- Show a compact Usy header badge that cycles through supported languages and explains that Usy replies in the language the user writes.
- Give Usy UseClevr-aware fallback answers for uploads, datasets, AI credits, plan limits, Retail analysis, Accountancy analysis, invoice processing, receipt processing, reports, downloads, billing, subscriptions, Business Profile, troubleshooting, and upgrade flow when no live AI provider answers.
- Keep Usy focused on UseClevr business-data workflows and answer unrelated general-chat topics with a polite same-language redirect to UseClevr uploads, credits, reports, billing, and analytics.
- Show an AI Privacy Status panel in the AI Assistant with the latest provider, local or cloud route, offline mode state, and fallback status.
- Store metadata-only AI request audit entries for chat, dataset analysis, report generation, and recommendation requests, including provider, model, request timestamp, mode, local or cloud execution location, routing reason, latency, token counts when available, fallback use, success state, dataset ID when available, and safe failure reason.
- Keep AI privacy audit logs free of raw prompts, model responses, API keys, and sensitive dataset content by default.
- Show AI Activity under Settings so normal users see only their own AI provider usage and superadmins see provider usage across workspaces.
- Keep BYOAI setup independent from Hybrid AI installers, helper downloads, and auto-detection.
- Show Bring Your Own AI as the recommended Hybrid AI modal path.
- Link Hybrid AI setup calls to the AI Providers settings page.
- Present UseClevr Helper as Phase 2 advanced automation until signed helper binaries exist.
- Keep UseClevr Helper download controls disabled while binaries are unavailable.

## Privacy Shield

- Detect sensitive dataset columns before AI analysis by column name and simple regex patterns.
- Treat name, email, phone, address, customer_id, iban, tax_id, birthdate, location, salary, and similar identifiers as sensitive fields.
- Show a small warning before AI analysis when sensitive fields are detected.
- Offer a checkbox labeled "Anonymize sensitive data before AI analysis".
- Replace sensitive values with stable placeholders when anonymization is enabled.
- Use placeholder families such as Customer_001, Email_001, Phone_001, Address_001, IBAN_001, TaxID_001, Birthdate_001, Location_001, and Salary_001.
- Continue AI analysis only with the anonymized dataset when anonymization is enabled.
- Save a simple privacy report containing file name, detected sensitive fields, anonymization true or false, and timestamp.
- Keep the privacy shield lightweight and avoid enterprise DLP, blockchain, or complex permission flows.

## Downloads & Reports

- Generate PDF reports from analysis results for Pro and Business users.
- Track downloads by dataset and report entry.
- Combine charts and table details in PDF exports.
- Use separated row actions for viewing, downloading, and deleting report rows.
- Keep private report search, listing, deletion, and downloads scoped to the owning user.
- Let super-admins search and manage report entries across users.

## Subscriptions & Billing

- Show Free at €0/month, Pro at €40/month, and Business at €420/month.
- Use the Free plan with limited AI credits as the only free UseClevr entry point, and do not advertise separate trial periods on public landing or pricing surfaces.
- Use shared monthly billing plan pricing as the canonical source for subscription cards, billing settings, checkout, upgrade prompts, public pricing, FAQ answers, assistant answers, Stripe checkout labels, and sales-facing product copy.
- Show customer-facing plan feature lists from the shared billing plan source, limiting Free to CSV and Excel upload, 50 AI credits, 2 datasets, basic AI insights, retail dashboard, and community support; limiting Pro to 500 AI credits, 25 datasets, AI business analysis, revenue analysis, margin analysis, stock detection, reports, exports, and priority support; and limiting Business to Pro benefits, 5000 AI credits, 250 datasets, larger file uploads, Accounting AI, invoice processing, receipt processing, and dedicated support.
- Keep future enterprise features hidden from pricing and upgrade surfaces until their customer workflow is production-ready.
- Show Account settings as a professional control center with centered wide content, Profile,
  Company, Subscription, and Security sections, visible completion indicators, a Continue Setup
  action, and a right-side Setup Progress and Account Status rail instead of generic quick tips.
- Keep Account settings plan cards, plan text, and plan buttons fully visible by giving the main
  settings content enough horizontal space beside supporting sidebars.
- Show selected-plan review and terms panels as readable centered Account settings panels with
  enough width for plan details, terms, and action buttons.
- Show selected-plan terms and payment confirmation in a compact two-column desktop layout with
  terms beside accept/payment actions.
- Accept `plan=pro`, `plan=pro_monthly`, `plan=business`, and `plan=business_monthly` in checkout, show Pro and Business as switchable paid packages, and send only the canonical plan, monthly interval, and market to checkout APIs.
- Resolve Stripe price IDs on the server from the selected paid plan and market, using Pro `USECLEVR_PRO_PRICE_EUR`, `USECLEVR_PRO_PRICE_GBP`, `USECLEVR_PRO_PRICE_USD`, and `USECLEVR_PRO_PRICE_CAD` values or their `STRIPE_PRO_PRICE_ID_*` aliases.
- Resolve Business EUR checkout with `STRIPE_BUSINESS_PRICE_ID_EUR`, `STRIPE_PRICE_BUSINESS_MONTHLY`, or `STRIPE_PRICE_ID_BUSINESS_MONTHLY`, and keep Business UK, US, and Canada markets unavailable until approved prices and matching Stripe Price IDs exist.
- Show paid checkout as available only after the server confirms the selected paid plan and market have an approved monthly amount and a configured Stripe price ID.
- Use Subscription as the single customer-facing entry point for subscription management, with Overview, Billing, AI Usage & Credits, and Terms & Conditions tabs.
- Redirect legacy Billing and Credit Rules settings routes to the matching Subscription Management tabs.
- Show upgrade modals with the selected plan name, monthly price, and a visible secure-checkout button.
- Route upgrade prompts for paid plans to the checkout review page so users choose a market and accept terms before Stripe Checkout opens.
- Redirect successful paid-plan checkout session creation to the Stripe-hosted checkout page.
- Show a visible checkout error in the upgrade modal when Stripe Checkout session creation fails.
- Use a checkout review step before terms acceptance and payment.
- Start the secure payment flow after terms acceptance.
- Verify successful checkout sessions against the signed-in user.
- Verify checkout redirects with signed, time-limited server tokens.
- Sync subscription status from the payment provider.
- Give newly registered Free accounts exactly two included analyst credits.
- Limit Demo mode to the same Free plan rule source: 50 AI credits, 2 datasets, 5,000 rows per dataset, CSV and Excel upload, and Basic AI Insights.
- Show sidebar Analyst Credits for limited accounts from the current dataset count and dataset
  limit, with the progress bar full when the Free plan reaches 2 of 2 datasets.
- Block upload, analysis, and report-download continuation for Free users after both included analyst credits are used, and show a Stripe upgrade path.
- Let superadmin and admin accounts use unlimited analyst credits without decrementing included credits or showing upgrade blocking.
- Let Stripe webhook requests reach signature verification without requiring a browser session.
- Return an unavailable-checkout error when a paid plan has no configured payment price instead of reporting an unpersisted checkout success.
- Open the hosted billing portal for users with linked payment customers.
- Let users manage subscription, usage, downgrade, and cancellation from account billing.
- Limit free analyst credits and prompt upgrades when credits run out.
- Route mistyped dashboard settings links to Profile settings.

## Business Profile

- Use Business Profile as the SME business-intelligence and pre-accounting context layer.
- Store Business Profile setup exactly once in `business_profile`, keyed by `organization_id`.
- Upsert Business Profile wizard saves into the existing organization profile record instead of inserting duplicate setup records.
- Read Business Profile context for Business, Accountancy, Tax, Compliance, Reporting, and AI from the same organization-scoped profile record.
- Revalidate Business, Accountancy, Tax, Compliance, Reporting, Pre-bookkeeping, and Profitability after successful Business Profile saves.
- Show missing Business Profile values as "Not configured".
- Show a one-step-at-a-time global Business Profile wizard with progress, save-and-continue,
  optional-section skipping, review/edit controls, and a green completion state.
- Open Business Profile setup in a compact centered modal that shows one clear question, one answer
  area, Back, Next, Skip optional question, Save progress, final review, and completion checkmark
  controls.
- Adapt Business Profile question wording, examples, and placeholder recommendations to the selected
  business model where context is available, including SaaS, retail, manufacturing, and services.
- Validate filled Business Profile values before step changes, show clear inline feedback for
  invalid percentages, negative amounts, unrealistic values, and incomplete required setup fields,
  and keep skipped optional fields from breaking calculations.
- Show 100% Business Profile completion when the visible required profile fields are filled, and do
  not count hidden tax, payroll, insurance, fixed-cost, or internal setup fields against that badge.
- Move keyboard focus through Business Profile steps, announce save and validation states, and keep
  selectable answer controls accessible through keyboard navigation and visible focus states.
- Show only the Business Profile Setup launcher before onboarding starts, then show the saved
  profile summary after completion.
- Keep Business Profile setup out of long-form database-admin layouts.
- Collect at least 25 owner-answerable Business Profile questions covering company identity,
  country, state or region, legal structure, industry, business model, currency, fiscal year,
  VAT or sales-tax registration, VAT or sales-tax rate, corporate or income tax rate, local or
  state or trade tax, tax payment frequency, employee count, payroll salary, employer
  contributions, health insurance, pension or retirement, unemployment insurance, workers
  compensation, business insurance, fixed costs, debt or leasing payments, inventory or material
  cost percentage, payment processing fees, return or refund rate, gross margin target, net margin
  target, cash reserve target, and growth target.
- Skip payroll salary and employer-contribution questions when employee count is 0, skip the VAT
  or sales-tax rate question when the business is not tax registered, show USA state and
  sales/payroll tax fields for USA businesses, and show VAT plus corporate or income tax fields for
  EU businesses.
- Collect company information, editable country tax suggestions, unlimited tax entries, employer
  contributions, insurance, fixed costs, revenue model, cost structure, and business goals.
- Keep Business Profile global across countries and require users to confirm or edit every
  suggested value before analysis treats it as business context.
- Attach confirmed Business Profile context to future CSV analysis, dashboard analysis,
  profitability, KPI, margin, tax, cash-flow, risk, forecast, and recommendation prompts.
- Combine uploaded financial rows with confirmed Business Profile values before producing
  profitability, tax, payroll, fixed-cost, margin, forecast, cash-flow, risk, and recommendation
  outputs.
- Show warnings when uploaded data is missing tax, insurance, payroll, fixed-cost, currency, fiscal
  year, target margin, growth goal, or risk-tolerance context that affects analysis confidence.
- Show a conflict warning and ask the user which value to use when uploaded data disagrees with
  confirmed Business Profile currency or tax assumptions.
- Never invent missing Business Profile values; show missing values as missing and lower confidence
  when the profile is incomplete.
- Keep onboarding focused on Business Profile, Accountancy, Dataset Upload, and Analysis.
- Show lightweight Business completion and Accountancy completion percentages.
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
- Show the same owner-selected overview, reporting, tax, and compliance context in Payload for
  superadmin operators.
- Show the Accountancy empty state as "Pre-bookkeeping center" for users with no accountancy data.
- Show upload and bookkeeping-package actions from the Accountancy empty state instead of treating missing accountancy data as an error.
- Show a real Accountancy error only when server data loading fails.
- Show Accountancy workflow steps for Business Profile setup, accounting-document upload, data extraction, pre-bookkeeping summary, PDF/Excel/CSV export, and accountant email handoff.
- Collect accountant email, company name, tax period, and notes or message in the Accountancy bookkeeping-package form.
- Use saved Business Profile context for Accountancy tax country, currency, fiscal year, VAT or sales tax, payroll, and fixed-cost assumptions.
- Show bookkeeping actions for bank reconciliation, expense coding, monthly close, and tax preparation.
- Show a bookkeeping queue with current status and direct action links.
- Show monthly close readiness for business profile, financial dataset, and tax context.
- Link accounting uploads to dataset upload.
- Show reporting metrics from connected datasets.
- Show tax region and business activity from the primary business profile.
- Show compliance checks for business profile, operating location, and industry context.

## Support

- Create usable local accounts during social login and registration.
- Personalize the authenticated dashboard greeting from profile first name, full name, session name, email username, or a safe fallback.
- Show the latest uploaded retail dataset as a premium AI business report with executive KPIs, summary insights, revenue and profit analytics, inventory intelligence, product performance, supplier and category analysis, ABC classification, forecast notes, recommendations, and report footer.
- Gracefully skip optional report sections when supplier, category, date, or financial columns are missing.
- Keep long report tables scrollable so large product lists remain usable.
- Create the user and profile as one successful account setup outcome, and remove the user record when profile creation fails.
- Require email-password registrations to verify the registered email with a 6-digit hashed, single-use confirmation code before sign-in opens the dashboard.
- Require email-password sign-ins to complete a fresh 6-digit hashed, single-use confirmation code before each dashboard session starts.
- Store email verification records with user or email, hashed code, purpose, 10-minute expiry, used timestamp, attempts, and created timestamp.
- Limit verification to five wrong attempts and keep resend-code actions on a 60-second cooldown.
- Send verification codes through a server-only Resend integration using `RESEND_API_KEY` and a verified `EMAIL_FROM` sender.
- Expose a guarded Resend status endpoint and diagnostic send command for Railway email delivery checks.
- Log verification email Resend failures on the server with sanitized provider settings and API response details while keeping secrets and verification codes out of logs and returning safe client-facing errors.
- Log email-password signup, verification, proof consumption, and credentials sign-in outcomes on the server with masked email addresses and without logging passwords or verification codes.
- Allow a temporary superadmin-only fallback verification code when `ADMIN_AUTH_BYPASS_ENABLED=true`, matching only `ADMIN_AUTH_BYPASS_EMAIL`, checking `ADMIN_AUTH_BYPASS_CODE` on the server, and keeping the bypass code out of client logs and server logs.
- Combine sign-in and sign-up in tabs on the login page.
- Offer email-password sign-in, email-password sign-up, email verification, password reset, and the built-in demo account as the MVP authentication paths.
- Keep Google and LinkedIn social sign-in unavailable in the MVP authentication surface.
- Keep the login page free of social sign-in provider buttons, social sign-in dividers, and social sign-in configuration alerts.
- Show built-in base-role and superadmin demo credentials on the login page for app and admin testing.
- Authenticate the built-in superadmin account with the `superadmin` session role and allow protected administrator pages.
- Keep built-in base, demo, and superadmin identities locked to fixed IDs, emails, roles, and credentials.
- Persist built-in account dashboard preferences, onboarding, business setup, and uploaded datasets in the database.
- Give built-in accounts unrestricted dataset upload and analysis access for product testing.
- Use compact inner labels in login fields.
- Require strong signup passwords with length, character variety, and personal-information checks.
- Keep login and sign-out redirects on the active app host.
- Keep Auth.js configured with credentials and demo providers only.
- Keep Google and LinkedIn social sign-in environment variables unnecessary for MVP authentication.
- Keep generated app links on a safe public app origin, never on the internal server bind host.
- Convert local development redirects from `0.0.0.0` to `localhost` before sending them to the browser.
- Accept authentication redirects only for the current origin, local development origins, or HTTPS UseClevr origins.
- Redirect signed-out dashboard requests before nested layouts or pages access session-owned data.
- Use a compact default text scale across public and dashboard pages.
- Show the current UseClevr logo as the browser tab favicon from the single `/6.svg` asset.
- Show logo, Hybrid AI, search, help, credits, display controls, profile settings, sign-out, and notices in the global topbar.
- Start authenticated sidebar page content below the sticky top navigation with consistent spacing so the first greeting, heading, or report title stays fully visible.
- Show Business, Accountancy, and Retail sidebar badges from the latest saved Business Profile
  status; keep Required only for missing or incomplete profiles, switch to a green completed
  check at 100%, and route incomplete Business clicks directly to Business Profile setup.
- Keep topbar items on one line with consistent icon color and compact hover targets.
- Show a host-specific keyboard shortcut in the dashboard search trigger.
- Show a simple sun/moon theme toggle in the global topbar.
- Use full-height hover and click targets in the dashboard topbar.
- Use a horizontal subpage bar for account profile, preferences, subscription, billing, and activity pages.
- Search app pages, datasets, reports, and FAQ answers from the dashboard search overlay.
- Limit operator-only search results to super-admin users.
- Use dashboard search context in chat support.
- Collapse and expand the desktop sidebar from the compact control beside Dashboard.
- Show Terms, Privacy, copyright, social links, and coming-soon app badges in the global footer.
- Serve globally oriented Terms of Service and Privacy Policy pages at `/terms` and `/privacy` that cover GDPR, UK GDPR, CCPA, CPRA, international users, cross-border processing, Stripe payment processing, AI processing, and worldwide SaaS subscription terms.
- Link Terms and Privacy pages to each other and keep legal links internal across public, authenticated, and checkout surfaces.
- Show a global cookie consent banner only until the user chooses Accept all, Essential only, or saved preferences; store choices under `useclevr_cookie_consent` with essential cookies always enabled and analytics plus product-improvement cookies optional.
- Let optional analytics and product-improvement scripts check reusable cookie-consent helpers before loading.
- Render upgrade prompts and paid-plan cards only after authenticated usage, plan, and role state resolves; never treat unresolved admin or superadmin sessions as Free users during app-page loading.
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
- Show Usy as the official UseClevr AI Business Intelligence Assistant in the floating assistant panel.
- Use the female Usy avatar in a premium circular frame with bright cyan, electric cyan, lilac, and soft-purple glow.
- Keep the Usy assistant header compact with title, subtitle, online badge, and close button aligned without overlap or clipping.
- Center the main Usy avatar inside the welcome card with generous whitespace.
- Animate the Usy avatar with a reduced-motion-safe compact breathing pulse, close soft outer glow, and subtle floating motion.
- Let Usy answer public, dashboard, and operator FAQ scope according to the current audience.
- Let Usy use the Hybrid AI chat endpoint when available with current route, page module, user role, plan, and usage context.
- Let Usy fall back to intent-scored UseClevr guidance when AI is unavailable.
- Match short natural Usy messages such as price pro, business price, upload not working, forecast failed, and credits to the correct topic.
- Keep Usy guidance role-aware for public visitors, normal users, admins, and superadmins.
- Let admin and superadmin Usy act as UseClevr Company Brain Lite for platform customers, plans, credits, uploads, errors, AI traces, billing settings, discount rules, MCP tokens, failed analyses, user issues, and platform status.
- Let admin and superadmin Usy help answer which customer has problems, why upload or forecast failed, which users reached limits, which plan is active, where billing issues are, what happened in AI traces, and what to check next.
- Do not let Usy expose platform-brain or admin guidance to normal users.
- Keep Usy billing answers on current monthly prices: Pro is €40/month and Business is €420/month.
- Do not let Usy mention annual pricing unless the current prompt provides an official annual price.
- Keep Usy clear of the footer on public pages and aligned to the right when the assistant panel is open.
- Open Usy as a desktop floating panel and a mobile bottom sheet.
- Position the opened Usy desktop panel below the top browser and app header with visible breathing room.
- Structure the opened Usy panel as fixed header, welcome or conversation content, and fixed compact input so only the content area scrolls.
- Use a prompt-style message box, bright cyan-lilac clickable suggestion chips, and high-contrast message bubbles in Usy.
- Keep starter suggestion chips on the Usy welcome screen.
- Show up to five contextual follow-up suggestion chips directly below the latest Usy answer.
- Let users click any Usy follow-up chip to send that question immediately.
- Keep Usy focused on AI companion guidance and do not show an embedded support request form inside the assistant panel.
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
- Use Payload admin as the operator workspace for CMS content, dashboard business profiles,
  accountancy review, support issues, and administrator dataset uploads.
- Combine Payload operator sign-in and sign-up in tabs on the same login page.
- Create self-registered Payload operator accounts with the base role.
- Keep Payload operator authentication on email and password only.
- Preserve the built-in superadmin role when its dashboard session authenticates through Payload.
- Match Payload admin typography, colors, control radius, navigation surfaces, and light/dark
  backgrounds to the dashboard design system.
- Structure Payload admin with a left main-menu rail, topbar, compact page header, body subheader,
  focused center workspace, and responsive right information panels.
- Link Payload admin navigation directly back to the signed-in dashboard.
- Require a Payload superadmin session for business-profile changes, support-issue updates, and
  administrator dataset uploads.
- Hide product-operation navigation and AI actions from non-superadmin CMS users, and show a clear
  permission message when a non-superadmin opens an operation URL directly.
- Require the operator to select the owning dashboard user before creating a business profile or
  uploading a dataset.
- Keep business and dataset records in their existing owner-scoped Drizzle tables when operators
  manage them through Payload.
- Let Payload superadmins edit business identity, location, legal structure, accounting method,
  tax registration, tax type, tax rate, and reporting currencies in the existing company setup
  record.
- Store support issues in the Payload Issues collection and use the same records for dashboard
  ticket creation, customer status updates, and operator review.
- Open the dataset-aware AI Assistant from a Payload modal into the dashboard user session so
  dataset ownership and AI trace attribution remain enforced.
- Open Hybrid AI controls from the Payload topbar through the shared modal workflow.
- Allow only Payload superadmins to edit public content.

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
- Show Windows, macOS, and Linux UseClevr Helper download cards with platform-specific installer names marked coming soon until signed binaries exist.
- Use UseClevr Helper localhost health, status, and private-analysis chat checks only in local development sessions.
- Keep production browser health checks same-origin and report UseClevr Helper as unavailable without calling localhost.
- Expose Hybrid AI module feature flags from the UseClevr Helper status response.
- Unlock Hybrid AI Lite and Hybrid AI MEGA modules in the web app from the authenticated subscription, using one shared helper installation.
- Include Hybrid AI Modal, Private Chat, CSV/Excel Analysis, Dashboard Insights, AI Provider Management, Provider Health Checks, Auto Mode, Local Mode, Cloud Mode, AI Assistant integration, and Dataset-aware chat in Hybrid AI Lite.
- Include Multiple AI Providers, Provider Fallback, Multi-document Analysis, AI Reports, Audit Logs, Workflow Automation roadmap, and UseClevr Helper roadmap in Hybrid AI MEGA.
- Mark AI Agents, Deep Research, Background task execution, Business assistants, Team AI, and Local Knowledge Base as coming soon MEGA modules.
- Keep future Hybrid AI modules modular so new module flags extend the helper contract without creating another desktop app.
- Show UseClevr Helper offline, setup-needed, and secure-runtime-connected states in branded wording.
- Keep Hybrid AI optional and keep cloud analysis workflows available when the helper is offline.
- Show Hybrid AI Lite to Pro users and Hybrid AI MEGA to Business users.

## Sales Planning

- Use stage gates for sales readiness milestones: materials draft, demo readiness, early adopter release, general availability.
- Review sales materials against `requirements.md` and `CHANGELOG.md` after every release.
- Log sales objection patterns, competitor positioning gaps, and pricing blockers in the lessons log.
- Track sales material accuracy as part of the release process.
- Manage sales artefacts (one-pager, demo scripts, demo datasets, objection handling) as project products with defined quality criteria and stage gate approvals.

## Payload MCP

- Expose MCP tools through Payload MCP with per-key tool permissions.
- Keep authenticated Payload MCP under `/api/payload/mcp`.
- Route `mcp-test.useclevr.com/api/payload/mcp` to Payload Streamable HTTP MCP with a server-held API key.
- Expose only locked demo-account dataset metadata and stored analysis through the public test
  connector; never expose uploaded rows or customer-owned datasets.
- Require a customer-data authorization flow before the ChatGPT MCP app accesses private customer datasets.
