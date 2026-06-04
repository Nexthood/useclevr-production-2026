Structure future

# UseClevr Future Structure and Work

## Purpose

This document describes the future architecture direction for UseClevr after the current SaaS core is stable.

The future structure should support:

- Main SaaS dashboard
- Documentation site
- Possible Payload CMS integration
- Possible MCP external endpoint
- Better separation of app, docs, shared UI, and config

This is future planning only. Do not migrate until the current Railway deployment and SaaS core are stable.

---

## Future Target Structure

Potential future structure:

```txt
/apps
  /web
    Main UseClevr SaaS dashboard
    Payload CMS integration if needed
    Auth
    Billing
    Business Profile
    CSV upload
    AI analysis
    Dashboard
    Admin

  /docs
    UseClevr documentation site
    Fumadocs
    MDX docs pages
    Sidebar/navigation
    Built-in search

/packages
  /ui
    Shared UI components

  /config
    Shared config for eslint, tsconfig, tailwind, constants
```

This structure should only be introduced when it brings clear value.

---

## Future Founder Docs Branch

UseClevr may later keep founder-focused project documents on a separate branch when those files need a distinct audience, release cadence, or review path from the main sales and product docs.

Possible branch split:

```txt
main
  current app, product, docs, and sales sources

founders
  founder project documents, founder planning, and founder-facing narrative
```

This split should stay future-only until the current documentation flow and branch workflow are stable.

---

## Future Subdomain Structure

Recommended future subdomains:

```txt
useclevr.com          = marketing / main public site
app.useclevr.com      = SaaS dashboard
docs.useclevr.com     = documentation
api.useclevr.com      = backend API only if separated later
mcp.useclevr.com      = external MCP service only if needed later
```

Current MCP should remain internal until there is a clear need for external access.

---

## Future Payload Role

Payload may be used later for:

- Admin content management
- FAQ editing
- Homepage copy
- Pricing copy
- Blog/content
- Internal admin collections
- Possibly business/customer admin views

Payload should not replace the current SaaS core too early.

Before adding Payload:

1. Map current database tables/models.
2. Decide which content truly needs CMS editing.
3. Avoid duplicating existing app data.
4. Confirm Railway deployment remains stable.
5. Confirm auth/session compatibility.
6. Add Payload only to `apps/web` if the monorepo migration has already happened.

Payload is not required for the first stable UseClevr launch.

---

## Future Docs Role

Fumadocs may be used later for:

- Product documentation
- Getting started guide
- CSV upload guide
- Business Profile guide
- AI Analysis guide
- Dashboard guide
- Billing guide
- FAQ
- Developer/API docs later

Preferred future docs app:

```txt
/apps/docs
```

Preferred docs subdomain:

```txt
docs.useclevr.com
```

Search:

- Use Fumadocs built-in search first.
- Do not add Meilisearch unless the docs become large enough to justify external search.

---

## Future MCP Role

MCP may become a separate service later.

Current rule:

```txt
MCP stays internal under the SaaS API.
```

Future external endpoint:

```txt
mcp.useclevr.com
```

Only use this when:

- External tools/agents connect directly
- Customers receive MCP endpoint access
- Separate MCP auth is required
- Separate rate limits are required
- Separate logs/monitoring are required
- MCP runs as a separate Railway service

Future MCP must include:

- Strong authentication
- Rate limiting
- User/workspace access checks
- Audit logging
- Dataset permission checks
- No public access to private uploads
- Clear separation between internal and external tools

---

## Future Railway Services

Possible future Railway service layout:

```txt
Production Web
- branch: dist
- root: apps/web

Production Docs
- branch: dist
- root: apps/docs

Staging Web
- branch: dist-test
- root: apps/web

Staging Docs
- branch: dist-test
- root: apps/docs
```

Do not create this structure until the current deployment flow is stable and the monorepo migration is approved.

---

## Future Work Phases

### Phase 1: Current SaaS Stability

- Railway deploy stable
- Business Profile expanded
- Dataset-aware AI reliable
- Upload flow hardened
- Billing config centralized
- Basic launch/demo flow prepared

### Phase 2: Product Readiness

- Business Profile completion engine
- Missing data report
- Financial health score
- Better KPI dashboard
- Forecast scenarios
- Exportable reports
- Beta feedback flow
- Public demo script

### Phase 3: Architecture Preparation

- Map current app to future `/apps/web`
- Map docs content to future `/apps/docs`
- Decide whether Payload is needed
- Decide whether Fumadocs is needed
- Decide whether MCP needs a public endpoint
- Prepare migration notes only

### Phase 4: Monorepo Migration

Only after approval:

- Move SaaS app to `/apps/web`
- Add `/apps/docs`
- Add shared packages only if required
- Update scripts
- Update Railway root directories
- Verify `dist` and `dist-test`
- Keep rollback path

### Phase 5: External Integrations

Only after core product stability:

- Public MCP endpoint if needed
- External docs search if needed
- Advanced billing provider abstraction if needed
- Multi-workspace support if needed
- More automation and tests

---

## Future Rules

- Do not migrate for theoretical cleanliness.
- Migrate only when it reduces real product friction.
- Keep user-facing SaaS value higher priority than architecture.
- Keep deploy stability higher priority than new tooling.
- Keep the app simple enough to maintain quickly.
- Avoid adding systems that require separate hosting unless they are clearly necessary.
