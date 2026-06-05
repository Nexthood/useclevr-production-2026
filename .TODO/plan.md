# Monorepo Migration Plan

This plan adapts the requested monorepo prompt to the current UseClevr repository and keeps the existing Railway deployment flow intact.

## Current Fit

- The repository is currently a single Next.js app rooted at the project root.
- The existing deployment path is built around the generated `dist` and `dist-test` branches.
- The current package manager is `pnpm` and the workspace config is minimal.
- The safest path is a small, staged migration rather than a large architectural rewrite.

## Recommended Scope

Keep the existing SaaS dashboard app as the primary web app and add a separate documentation app under `apps/docs`.

Use this minimal structure:

```text
/apps
  /web
  /docs
/packages
  /ui
/config
```
/apps
  /web
  /docs
/packages
  /ui  # UI and project design branding planned for future update post-payload migration
/config
```

## Minimal Safe Migration Path

1. Keep the existing root app as the current source of truth for the dashboard during the first pass.
2. Add the smallest possible `apps/` layout only after the current root build and Railway deploy path are verified.
3. Create `apps/docs` first as a separate Fumadocs app with built-in search, without touching the existing dashboard runtime.
4. Treat `apps/web` as the future dashboard path only after the docs app and root scripts are stable.
5. Add root scripts only for commands that are actually supported by the current package manager and repo layout.
6. Do not change the generated `dist` / `dist-test` publish flow during the migration until the new layout is verified.

## Practical Delivery Steps

### Phase 1: Repo and config audit

- Confirm the current Next.js config and deployment scripts.
- Confirm the current Railway config and generated output path.
- Keep the current root app in place for the first pass unless a small, verified move is clearly safe.
- Record the exact current service-root assumptions before any Railway change.

### Phase 2: Web app path

- Create or adapt `apps/web` as the dashboard app.
- Keep Payload CMS integration and current dashboard functionality in this path.
- Preserve the existing Railway web deployment settings.

### Phase 3: Docs app path

- Create `apps/docs` as the public docs site.
- Use Fumadocs with MDX pages and built-in search.
- Add the requested docs pages:
  - Introduction
  - Getting Started
  - Upload CSV
  - Business Profile Setup
  - AI Analysis
  - Dashboard
  - Billing
  - FAQ

### Phase 4: Root scripts and local runs

Add only the scripts that are verified to work with the current package manager and repository layout:

- `dev:web`
- `dev:docs`
- `build:web`
- `build:docs`
- `lint:web`
- `lint:docs`

If a command cannot be validated in this repo, do not force it into the root `package.json`.

### Phase 5: Railway deployment

- Keep the production deployment branch flow as-is.
- Configure the Railway service roots so the web service points to `apps/web` and the docs service points to `apps/docs`.
- Keep the existing `dist` and `dist-test` branch behavior unchanged unless the deployment plan explicitly requires a small adjustment.

## Non-goals

- No Meilisearch, Typesense, Algolia, or external search integration now.
- No large rewrite of current dashboard logic.
- No complex CI changes unless the new app layout breaks the current publish flow.
- No mixed docs/dashboard build path.

## Risk Notes

## Post-Payload Migration Steps and Tasks

After the initial monorepo migration and payload CMS upgrade are complete, the following steps should be undertaken:

### Phase 6: Post-Payload UI and Design Branding

1. **Design System Establishment**
   - Create shared UI component library in `/packages/ui`
   - Implement design tokens and theme system
   - Establish component documentation and storytelling

2. **Project Design Branding Update**
   - Update visual identity across all applications
   - Implement consistent styling and branding guidelines
   - Update logo, color schemes, and typography

3. **Component Migration**
   - Migrate existing UI components to the shared package
   - Refactor components to follow design system patterns
   - Ensure backward compatibility during transition

4. **Quality Assurance**
   - Implement visual regression testing
   - Add component testing with storybook
   - Perform cross-browser and accessibility testing

### Post-Payload Tasks to Add to TODO:

- T-XXX. Create shared UI component library in `/packages/ui` with design tokens and theme system
- T-XXX. Implement design system documentation and component storytelling
- T-XXX. Update visual identity and branding across all applications
- T-XXX. Migrate existing UI components to shared package with refactoring
- T-XXX. Add visual regression testing and component testing suite
- T-XXX. Implement consistent styling and branding guidelines
- T-XXX. Update logo, color schemes, and typography per brand guidelines
- T-XXX. Perform cross-browser and accessibility testing for UI components

## Post-Payload Migration Steps and Tasks

After the initial monorepo migration and payload CMS upgrade are complete, the following steps should be undertaken:

### Phase 6: Post-Payload UI and Design Branding

1. **Design System Establishment**
   - Create shared UI component library in `/packages/ui`
   - Implement design tokens and theme system
   - Establish component documentation and storytelling

2. **Project Design Branding Update**
   - Update visual identity across all applications
   - Implement consistent styling and branding guidelines
   - Update logo, color schemes, and typography

3. **Component Migration**
   - Migrate existing UI components to the shared package
   - Refactor components to follow design system patterns
   - Ensure backward compatibility during transition

4. **Quality Assurance**
   - Implement visual regression testing
   - Add component testing with storybook
   - Perform cross-browser and accessibility testing

### Post-Payload Tasks to Add to TODO:

- T-XXX. Create shared UI component library in `/packages/ui` with design tokens and theme system
- T-XXX. Implement design system documentation and component storytelling
- T-XXX. Update visual identity and branding across all applications
- T-XXX. Migrate existing UI components to shared package with refactoring
- T-XXX. Add visual regression testing and component testing suite
- T-XXX. Implement consistent styling and branding guidelines
- T-XXX. Update logo, color schemes, and typography per brand guidelines
- T-XXX. Perform cross-browser and accessibility testing for UI components
