# Docs Subdomain Plan

Planning-only document. Use this when moving public documentation to a separate docs subdomain such as `docs.useclevr.com`.

## Goal

Serve product, user, sales, and public technical documentation from a dedicated docs subdomain while keeping implementation docs and sensitive project guidance protected in the repository.

## Target Outcomes

- Public docs are easy to discover and browse.
- Sales and user-facing docs can be shared without exposing internal implementation details.
- Developer/internal docs stay private unless explicitly approved for publication.
- The main app keeps its current routes and deployment shape.
- Documentation updates remain connected to the repository workflow.

## Current State

- Documentation lives under `docs/`.
- Main public site lives at `/`.
- Dashboard lives at `/app`.
- Sales project documents live under `docs/Sales/`.
- User guides live under `docs/User_Guides/`.
- Developer guides live under `docs/Developer_Guides/`.
- AI interaction guidance lives under `docs/AI-interaction/`.
- Active tasks and migration plans live under `.TODO/`.

## Proposed Public Subdomain

- Domain: `docs.useclevr.com`
- Audience: customers, prospects, sales contacts, partners, and approved technical readers.
- Content type: product guidance, user guides, sales-facing docs, public FAQs, onboarding guides, selected technical explainers.

## Content Publishing Scope

### Public

- `docs/User_Guides/product-overview.md`
- `docs/User_Guides/bookkeeping.md`
- `docs/User_Guides/mcp.md` after access wording is reviewed.
- `docs/Sales/README.md`
- `docs/Sales/Marketing/marketing-plan.md` if sales team approves public publication.
- Selected Sales project documents after roadmap and risk wording is reviewed.
- Public FAQ and support guidance if converted into docs pages.

### Internal Only

- `docs/Developer_Guides/`
- `docs/AI-interaction/`
- `.TODO/`
- Deployment guides with operational details.
- Risk, issue, and lessons registers unless explicitly approved.
- Any file mentioning tokens, host internals, auth internals, workflow internals, private routes, or security-sensitive operational details.

## Architecture Options

### Option A: Static Docs Site From Selected Files

Use a static documentation generator or Next.js route to publish only allowlisted docs.

Benefits:

- Clear public/private boundary.
- Small deploy surface.
- Easy SEO and navigation.

Controls:

- Maintain an allowlist.
- Generate public docs from selected Markdown files only.
- Block `.TODO/`, Developer Guides, AI Interaction governance, and environment files.

### Option B: Next.js Docs Route Behind Subdomain

Serve docs pages from the existing Next.js app and map `docs.useclevr.com` to a docs route.

Benefits:

- Reuses app styling and deployment.
- Easier shared navigation and analytics.

Controls:

- Add route guard or host-based routing.
- Keep docs route read-only.
- Prevent internal docs from being imported into public bundles.

### Option C: Separate Docs Repository

Move public docs to a separate repository.

Benefits:

- Strong separation.
- Easier public contribution workflow.

Controls:

- Requires sync workflow from source repo.
- Higher maintenance cost.

## Recommended Approach

Start with Option A.

Use an allowlisted static docs build that publishes selected user and sales docs to `docs.useclevr.com`. Keep developer, AI, deployment, TODO, and internal project-management documents private in the main repository.

## Suggested Folder Shape

```text
docs-public/
  README.md
  product/
  guides/
  support/
  sales/
```

`docs-public/` can be generated from allowlisted source docs, or maintained as curated public docs if public wording diverges from internal docs.

## Build Plan

1. Define a docs publishing allowlist.
2. Add a script that copies approved Markdown files into `docs-public/`.
3. Normalize links for public paths.
4. Add a docs build step.
5. Add a docs preview command.
6. Add CI checks for broken public links.
7. Add deployment config for `docs.useclevr.com`.
8. Add DNS and host routing after the generated docs build is stable.

## Access And Safety Rules

- Never publish `.env`, `.TODO/`, deployment secrets, tokens, API keys, or raw prompts with sensitive data.
- Never publish internal deployment troubleshooting details without review.
- Never publish customer data, sample private datasets, support tickets, AI traces, or operational logs.
- Keep pricing and roadmap wording aligned with `requirements.md`.
- Label roadmap content clearly.
- Keep tax, legal, insurance, and financing boundaries clear.

## SEO And Product Rules

- Use canonical docs URLs under `https://docs.useclevr.com`.
- Add sitemap for public docs only.
- Add robots rules for public docs.
- Keep public docs titles human-readable.
- Link public docs from homepage, FAQ, support, and dashboard help where useful.
- Keep dashboard-only support docs behind signed-in app routes unless they are safe for public docs.

## Deployment Notes

- Vercel can serve the docs subdomain if source deployment remains active.
- Railway should remain focused on the app unless docs are intentionally served from the same deployment.
- Static hosting is acceptable for public docs.
- Docs deployment should not require database, Stripe, Gemini, or auth secrets.

## Validation

- Public docs build succeeds.
- Public docs link check passes.
- Public docs do not include denied folders.
- Public docs do not include environment variables or secrets.
- Public docs sitemap contains only public pages.
- Public docs can be opened at the subdomain.
- Main app routes remain unchanged.

## Acceptance Criteria

- `docs.useclevr.com` serves approved public documentation only.
- Internal developer, AI, TODO, deployment, and project-control docs stay private.
- Public docs update through a repeatable script or workflow.
- Public docs have clear navigation and working links.
- Sales and user-facing docs stay aligned with current product requirements.

## AI Implementation Prompt

```text
Create a docs subdomain publishing path for UseClevr.

Use an allowlisted public docs build.
Keep internal docs private:
- .TODO
- Developer_Guides
- AI-interaction
- deployment docs
- operational logs
- environment files
- secrets

Publish only approved user, support, and sales docs to docs.useclevr.com.
Add docs-public generation, link checks, deployment notes, SEO sitemap rules, and safety checks.
Do not change app routes, dashboard routes, billing, deployment output, or product behavior unless explicitly requested.
```
