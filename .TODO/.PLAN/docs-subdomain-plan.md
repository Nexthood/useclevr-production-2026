# Docs Subdomain Plan

Planning-only document. Use this when moving documentation to a separate docs subdomain such as
`docs.useclevr.com`, deployed from a dedicated `docs` branch.

## Goal

Serve product, user, sales, and selected operator documentation from a dedicated docs subdomain
while keeping implementation docs and sensitive project guidance protected in the repository.

## Target Outcomes

- Public docs are easy to discover and browse.
- Sales and user-facing docs can be shared without exposing internal implementation details.
- Public and superadmin docs can share one docs experience with clear access boundaries.
- Developer/internal docs stay private unless explicitly approved for publication.
- The main app keeps its current routes and deployment shape.
- Documentation updates remain connected to the repository workflow.
- The docs deploy can reuse the current docs theme and documentation structure.

## Current State

- Documentation lives under `docs/`.
- Docs theming and doc content already exist in the repository and should be reused where possible.
- Main public site lives at `/`.
- Dashboard lives at `/app`.
- Sales project documents live under `docs/Sales/`.
- User guides live under `docs/User_Guides/`.
- Developer guides live under `docs/Developer_Guides/`.
- AI interaction guidance lives under `docs/AI-interaction/`.
- Active tasks and migration plans live under `.TODO/`.

## Proposed Docs Subdomain

- Domain: `docs.useclevr.com`
- Audience: customers, prospects, sales contacts, partners, signed-in operators, and superadmin
  reviewers.
- Content type: product guidance, user guides, sales-facing docs, public FAQs, onboarding guides,
  selected technical explainers, and operator docs shown only after superadmin login.

## Branch And Deployment Shape

- Source branch for docs deploy: `docs`
- Production docs host: `docs.useclevr.com`
- Proposed deployment scaffold: `docs-root/`
- Proposed generated output path on docs branch: `docs-root/dist/`
- Proposed themed docs app source: `docs/src/`

### Why This Shape

- `docs-root/` mirrors the role of `dist-root/` without mixing app deploy output and docs deploy
  output.
- `docs/src/` keeps the docs app close to the repo docs content and allows reuse of current docs
  theming.
- `docs-root/dist/` keeps deployment packaging separate from source markdown and source app code.
- The `docs` branch can act as the single deploy source for the docs host without changing the app
  deployment branches.

## Content Publishing Scope

### Public

- `docs/User_Guides/product-overview.md`
- `docs/User_Guides/bookkeeping.md`
- `docs/User_Guides/mcp.md` after access wording is reviewed.
- `docs/Sales/README.md`
- `docs/Sales/Marketing/marketing-plan.md` if sales team approves public publication.
- Selected Sales project documents after roadmap and risk wording is reviewed.
- Public FAQ and support guidance if converted into docs pages.

### Superadmin Only On Docs Subdomain

- Operator FAQ and operator workflows that help support and moderation work.
- Selected deployment-safe operational guides that do not expose secrets, private infrastructure, or
  internal-only recovery steps.
- Search/admin documentation that is useful in the docs UI but should remain hidden from public
  visitors.

### Internal Only

- `docs/Developer_Guides/`
- `docs/AI-interaction/`
- `.TODO/`
- Deployment guides with operational details.
- Risk, issue, and lessons registers unless explicitly approved.
- Any file mentioning tokens, host internals, auth internals, workflow internals, private routes, or security-sensitive operational details.

## Architecture Options

### Option A: Docs App With Public And Superadmin Sections

Use a dedicated docs app that reads allowlisted content and supports authenticated superadmin-only
sections in the same UI.

Benefits:

- Keeps one docs surface and one docs theme.
- Supports public navigation and protected operator navigation in one place.
- Keeps docs deploy isolated from the product app deploy.

Controls:

- Maintain a public allowlist and a protected operator allowlist.
- Generate docs from selected Markdown files only.
- Require superadmin auth before loading protected operator content.
- Block `.TODO/`, Developer Guides, AI Interaction governance, and environment files.

### Option B: Static Public Docs Plus Separate Protected Operator Docs App

Serve public docs statically and load operator docs through a separate authenticated docs surface.

Benefits:

- Stronger separation between public and protected docs.
- Smaller public bundle.

Controls:

- Keep the operator app behind session auth.
- Keep operator docs out of the public build.

### Option C: Next.js Docs Route Inside Main App

Serve docs pages from the existing product app and map `docs.useclevr.com` by host routing.

Benefits:

- Reuses existing auth/session handling.
- Reuses current component system.

Controls:

- Keep docs route read-only.
- Prevent internal docs from entering public bundles.
- Avoid coupling docs deploy stability to product app deploy stability.

## Recommended Approach

Start with Option A.

Use a dedicated docs app under `docs/src` plus a docs deploy scaffold under `docs-root/`. Publish
public docs openly on `docs.useclevr.com` and gate operator docs behind superadmin login in the
same docs UI. Keep developer, AI, deployment, TODO, and internal project-management documents
private in the main repository unless a later review explicitly promotes them.

## Suggested Folder Shape

```text
docs/
  src/
    app/
    components/
    lib/
    theme/
  content/
    public/
    operator/
docs-root/
  server-config/
  dist/
```

- `docs/src/` owns the themed docs application.
- `docs/content/public/` stores publishable content sources or generated copies from approved docs.
- `docs/content/operator/` stores superadmin-only docs content approved for the docs subdomain.
- `docs-root/` owns docs deployment config and generated deployment output.

## Build Plan

1. Define a public docs allowlist and an operator docs allowlist.
2. Add a script that copies approved Markdown files into `docs/content/public/` and
   `docs/content/operator/`.
3. Build a themed docs app in `docs/src/`.
4. Add host-aware auth rules so public docs stay open and operator docs require superadmin login.
5. Normalize links for public paths and protected operator paths.
6. Add a docs build step that outputs deployable files into `docs-root/dist/`.
7. Add a docs preview command.
8. Add CI checks for broken public links and forbidden-file leakage.
9. Add deployment config for `docs.useclevr.com` from the `docs` branch.
10. Add DNS and host routing after the generated docs build is stable.

## Access And Safety Rules

- Never publish `.env`, `.TODO/`, deployment secrets, tokens, API keys, or raw prompts with sensitive data.
- Never publish internal deployment troubleshooting details without review.
- Never publish customer data, sample private datasets, support tickets, AI traces, or operational logs.
- Keep pricing and roadmap wording aligned with `requirements.md`.
- Label roadmap content clearly.
- Keep tax, legal, insurance, and financing boundaries clear.
- Keep operator docs free from secrets even when they are protected behind superadmin login.
- Keep login/session checks on the docs host separate from product app navigation concerns.

## SEO And Product Rules

- Use canonical docs URLs under `https://docs.useclevr.com`.
- Add sitemap for public docs only.
- Add robots rules for public docs.
- Keep public docs titles human-readable.
- Link public docs from homepage, FAQ, support, and dashboard help where useful.
- Keep dashboard-only support docs behind signed-in app routes unless they are safe for public docs.
- Exclude protected operator pages from the public sitemap.

## Deployment Notes

- Vercel can serve the docs subdomain if the docs app uses source deployment from the `docs` branch.
- Railway should remain focused on the app unless the docs host later needs its own runtime service.
- Public docs should stay buildable without database, Stripe, or Gemini dependencies.
- Protected operator docs may require auth/session config, but they should still avoid app-business
  dependencies where possible.

## Validation

- Public docs build succeeds.
- Protected docs auth gate succeeds for superadmin users.
- Public docs link check passes.
- Public docs do not include denied folders.
- Public docs do not include environment variables or secrets.
- Public docs sitemap contains only public pages.
- Public docs can be opened at the subdomain.
- Main app routes remain unchanged.
- Operator docs stay unavailable to public visitors and non-superadmin users.
- Docs branch deploy stays independent from app deploy output.

## Acceptance Criteria

- `docs.useclevr.com` serves approved public documentation and protected superadmin operator docs.
- Internal developer, AI, TODO, deployment, and project-control docs stay private.
- Public and operator docs update through a repeatable script or workflow.
- Public docs have clear navigation and working links.
- Sales and user-facing docs stay aligned with current product requirements.
- Operator docs keep access boundaries and avoid secret exposure.

## External Power Search Plan

The docs subdomain should reserve space for a future external search layer.

- Search should cover public docs immediately.
- Search should support operator docs only after auth-aware filtering is proven.
- Meilisearch is the current preferred external power-search candidate.
- Search indexing must separate public and protected documents.
- Public search results must never leak operator-only titles, snippets, or routes.
- Operator search results must require superadmin auth before query execution or result rendering.

### Search Integration Shape

```text
docs/src
  -> docs search adapter
  -> public docs index
  -> protected operator docs index
  -> external search provider when enabled
```

### Search Activation Rules

- Keep baseline docs navigation usable without external search.
- Add power search only after docs content structure and access rules are stable.
- Keep provider keys server-side.
- Keep search indexing scripts separate from app search indexing scripts unless shared access rules
  become proven and simple.

## AI Implementation Prompt

```text
Create a docs subdomain publishing path for UseClevr.

Use a dedicated docs branch and a docs deployment scaffold.
Use a themed docs app under docs/src.
Publish public docs openly on docs.useclevr.com.
Protect operator docs behind superadmin login in the same docs surface.
Keep internal docs private:
- .TODO
- Developer_Guides
- AI-interaction
- deployment docs
- operational logs
- environment files
- secrets

Publish only approved user, support, sales, and reviewed operator docs to docs.useclevr.com.
Add docs content copying, link checks, deployment notes, SEO sitemap rules, auth boundaries, and
power-search preparation.
Do not change app routes, dashboard routes, billing, deployment output, or product behavior unless explicitly requested.
```
