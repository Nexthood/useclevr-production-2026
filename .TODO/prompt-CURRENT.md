You are working on the UseClevr SaaS repository.

Important project rule:
UseClevr is cost/time-sensitive. Do not overengineer. Do not introduce large architecture changes unless explicitly requested. Prefer minimal, practical, working implementation.

Current repository context:

- Main repository: Nexthood/useclevr-production-2026
- Current app is a Next.js SaaS application.
- Railway uses deployment branches:
  - `dist` = production deployment branch
  - `dist-test` = staging/test deployment branch

- The current active TODO queue is `.TODO/todo-next.md`.
- Future/deferred work is stored in `.TODO/todo-future.md`.
- Get the next task number from `.TODO/config.json` before adding new TODO tasks.
- Keep one stable T-number per task.
- Do not duplicate tasks already in TODO files.

Current priority:

1. Stabilize Railway production and dist-test deploy flow (T-557).
2. Expand the current Business Profile into a practical pre-accounting/business setup (T-558).
3. Connect Business Profile data to deterministic KPI, profit, cash-flow, and forecast calculations (T-559).
4. Improve dataset-aware AI answers so uploaded CSV data is used correctly (T-560).
5. Harden upload/security basics (T-561).
6. Centralize billing configuration before real payment collection (T-562).
7. Review Sales registers after next Railway test deploy (T-544).

Do not implement now:

- Do not migrate to Payload yet.
- Do not create a monorepo yet.
- Do not add Fumadocs yet.
- Do not add Meilisearch yet.
- Do not move MCP to a separate subdomain yet.
- Do not add unnecessary CI/CD complexity.
- Do not force tests if the project baseline is not stable.
- Do not add enterprise-style abstractions.

Current MCP rule:
Use Payload MCP as the documented connector.

- `/api/payload/mcp`
- `mcp.useclevr.com/api/payload/mcp`
- `mcp-test.useclevr.com/api/payload/mcp`

Do not document a separate dashboard MCP connector. Payload MCP API keys control tool access, and the test connector exposes only locked demo-account metadata and stored insights.

Current Business Profile rule:
The Business Profile must become the core identity/configuration layer for accurate analysis. It must collect enough data for:

- business type,
- revenue streams,
- fixed costs,
- variable costs,
- tax/VAT basics,
- insurance,
- loans/leasing,
- employees/payroll,
- assets,
- cash-flow timing,
- inventory where relevant,
- marketing spend,
- risk profile,
- goals/forecast inputs,
- missing data warnings.

The Business Profile must not become a full ERP. Keep it simple, but complete enough for reliable SME/startup business intelligence.

Calculation rule:
All outputs must match collected data. The system must:

- separate net, VAT, and gross values,
- normalize monthly/quarterly/yearly values,
- avoid double-counting taxes, payroll, loans, insurance, and depreciation,
- separate operating costs from financing costs,
- mark tax/legal/insurance outputs as estimates or requiring professional verification,
- show low-confidence labels when required data is missing.

Dataset AI rule:
When the user uploads a CSV, the AI must use dataset context first. It must not answer generically if relevant uploaded data exists. If the dataset is missing, weak, or ambiguous, say so clearly and ask for the missing data only if needed.

Railway rule:
Do not break the current Railway deployment flow. Before any architecture change:

- verify current build command,
- verify start command,
- verify env usage,
- verify dist package generation,
- verify production and dist-test behavior.

Future architecture direction:
The future target may become:

/apps
/web
Main UseClevr SaaS dashboard
Payload CMS later if needed

/docs
UseClevr documentation site
Fumadocs later if needed

/packages
/ui
Shared UI components only when actually needed

/config
Shared config only when actually needed

Future subdomains:

- `useclevr.com` = marketing/main
- `app.useclevr.com` = SaaS app/dashboard
- `docs.useclevr.com` = documentation
- `api.useclevr.com` = backend API only if separated later
- `mcp.useclevr.com` = future only, not now

Expected behavior:
For every task:

1. Inspect existing files first.
2. Reuse existing structure where possible.
3. Make the smallest useful change.
4. Avoid broad refactors.
5. Explain exactly what changed.
6. Provide exact commands to test.
7. Mention risks or manual steps.
8. Keep TODO files clean and stable.
