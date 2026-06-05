# Founders Docs Root Plan

Planning-only document. Use this when preparing a dedicated founders documentation deployment that
stays separate from public docs and requires superadmin login.

## Goal

Serve founder-focused strategy, financial, research, and project-control documents from a dedicated
founders docs surface while keeping access restricted to superadmin users.

## Target Outcomes

- Founder materials live in one structured surface instead of scattered internal files.
- Founder docs use a deployment shape similar to the planned docs subdomain.
- Founder docs stay protected by superadmin login from the first release.
- Founder docs can reuse docs theming, navigation, and search patterns without exposing public docs
  or operator docs accidentally.
- Founder docs maintain their own deploy path and review path.

## Audience

- Superadmin users only.
- Founder reviewers.
- Internal strategic reviewers approved by the project owner.

Public visitors, signed-in regular users, and standard operator roles should not see this content.

## Proposed Branch And Deployment Shape

- Source branch for founders docs deploy: `founders-docs`
- Proposed host: `founders.useclevr.com`
- Proposed deployment scaffold: `founders-docs-root/`
- Proposed generated output path: `founders-docs-root/dist/`
- Proposed themed docs app source: `founders-docs/src/`

## Why This Shape

- `founders-docs-root/` mirrors the planned `docs-root/` deployment pattern.
- `founders-docs/src/` allows reuse of the docs UI, theming, and content-processing flow.
- A separate branch keeps founder material out of routine public docs publishing.
- A separate host avoids mixing founder navigation with customer-facing documentation.

## Content Scope

### Include

- Founder-specific product positioning
- Pricing and packaging strategy notes
- Revenue planning documents
- Cost and margin planning documents
- Founder-facing project controls
- Market research summaries approved for founder review
- Internal presentation source documents
- Decision logs that are safe for strategic review

### Exclude

- Raw secrets, API keys, or tokens
- Infrastructure recovery playbooks with sensitive detail
- Customer-identifiable data
- Private support tickets
- AI traces with private prompts or responses
- `.TODO/`
- AI-agent operating instructions
- Sensitive deployment configs

## Proposed Folder Shape

```text
founders-docs/
  src/
    app/
    components/
    lib/
    theme/
  content/
    founders/
founders-docs-root/
  server-config/
  dist/
```

## Access Model

- Require superadmin login before any founder-doc page content loads.
- Keep route-level protection and content-level protection together.
- Keep founder search, navigation, and direct URLs unavailable to non-superadmin users.
- Exclude founder pages from public sitemap, public robots rules, and public search indexes.

## Build Plan

1. Define the founder-doc content allowlist.
2. Add a content-copy or content-curation step into `founders-docs/content/founders/`.
3. Build a themed founders docs app in `founders-docs/src/`.
4. Add superadmin-only auth/session checks for the founders host.
5. Add a build step that outputs deployable files into `founders-docs-root/dist/`.
6. Add preview and link-check commands.
7. Add deploy config for the founders host from the `founders-docs` branch.
8. Add forbidden-file checks so internal secrets and non-founder docs cannot leak into the build.

## Search Plan

- Keep baseline navigation usable without external search.
- Reuse the future docs-search pattern only after access filtering is proven.
- Keep founder search separate from public docs search.
- Keep search results unavailable until superadmin auth succeeds.
- If external power search is added later, keep founder indexes separate from public and operator
  indexes.

## Safety Rules

- Never rely on hidden URLs as the only protection.
- Never publish founder docs into the public docs host by mistake.
- Never mix founder indexes with public indexes.
- Never expose strategic financial notes to regular signed-in users.
- Keep wording current-state and decision-useful.

## Validation

- Superadmin login gate succeeds.
- Non-superadmin access is denied for page load, search, and direct route access.
- Founder docs build succeeds.
- Founder docs link check passes.
- Founder docs do not expose denied folders or secrets.
- Founder docs deploy stays separate from public docs deploy and app deploy.

## Acceptance Criteria

- Founder docs deploy from their own branch and deploy path.
- Founder docs require superadmin login.
- Founder docs reuse docs UI patterns without sharing public visibility.
- Founder docs stay isolated from public docs content, app deploy output, and routine user help
  navigation.

## AI Implementation Prompt

```text
Prepare a founders documentation deployment path for UseClevr.

Use a separate founders-docs branch.
Use founders-docs/src for the themed founders docs app.
Use founders-docs-root/dist for generated deploy output.
Require superadmin login for all founder-doc pages, navigation, and search.
Keep founder docs separate from public docs, app deploy output, TODO files, AI instructions, and
sensitive operational documents.
Add content allowlist rules, forbidden-file checks, and search-isolation preparation.
Do not implement the deploy yet unless explicitly requested.
```
