# MCP and FAQ Prompt Plan

Status: planning only. Do not create branches, publish generated output, or change routing until explicitly approved.

---

# Goal

Create an MCP (Model Context Protocol) prompt interface on `mcp.useclevr.com` and make FAQ accessible at the beginning of the app for better user onboarding.

---

# Current State

- FAQ exists at `/app/faq` and `/faq` (public)
- Dashboard FAQ at `/app/faq` requires login
- No MCP endpoint exists
- No dedicated MCP domain routing configured

---

# Required Changes

## MCP Endpoint

Add API route `/api/mcp/[tool]/route.ts` to serve:

- Dataset analysis tools
- Business metrics tools
- CSV processing tools
- Query explanation tools

## MCP Domain

Configure `mcp.useclevr.com` to:

- Route to MCP API endpoints
- Serve documentation at root
- Show tool catalog with descriptions
- Support prompt templates

## FAQ Accessibility

Make FAQ reachable at beginning:

- Add FAQ link to public landing page
- Add "Getting Started" FAQ section in app root
- Include FAQ quick links before dashboard access
- Keep FAQ accessible without auth for public questions

---

# MCP Architecture

```text
mcp.useclevr.com/
├── /                    (tool catalog + documentation)
├── /api/analyze         (dataset analysis tool)
├── /api/query           (query builder tool)
├── /api/forecast        (forecasting tool)
└── /docs                (API documentation)
```

---

# Implementation Steps

1. Create `src/app/api/mcp/[tool]/route.ts` handler
2. Add MCP tool definitions in `src/lib/mcp/tools.ts`
3. Configure domain routing in Railway/Vercel
4. Add public FAQ links to landing page
5. Add getting-started FAQ section
6. Test MCP endpoint responses

---

# Safety Rules

- MCP endpoints must validate dataset ownership
- FAQ content must not expose private data
- Public FAQ must be read-only
- MCP responses must be deterministic