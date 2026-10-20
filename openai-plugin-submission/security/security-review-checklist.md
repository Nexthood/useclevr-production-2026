# Security Review Checklist

Checked implementation items describe repository behavior and local test expectations. They do not certify the current deployment or a successful OpenAI portal connection. The operator verifies every live submission prerequisite separately.

## Publisher and Review Access

- [x] UseClevr is the product display name; Atlas Mega Ventures is the package author and intended publisher in the manifest and listing metadata.
- [ ] The operator confirms affiliation and selects the verified Atlas Mega Ventures developer identity in the owning OpenAI organization/project.
- [ ] The operator verifies reviewer access to the existing demo recording URL without an access request.

## Production Endpoint

- [x] MCP endpoint is remote HTTPS: `https://app.useclevr.com/api/chatgpt/mcp`.
- [x] Unauthenticated requests return `401` with `WWW-Authenticate` and protected-resource metadata.
- [x] OAuth metadata is published at `https://app.useclevr.com/.well-known/oauth-authorization-server`.
- [x] JWKS is published at `https://app.useclevr.com/api/chatgpt/oauth/jwks`.
- [x] MCP response headers include `MCP-Protocol-Version: 2025-06-18`.
- [x] CORS exposes `WWW-Authenticate` and `MCP-Protocol-Version` for OpenAI origins.

## OAuth

- [x] Authorization-code flow with PKCE S256 is implemented.
- [x] Access tokens are bearer JWTs signed with RS256.
- [x] Token verification checks issuer, audience, resource, expiration, subject, and scopes.
- [x] Authorization codes are hashed before storage and marked used after token exchange.
- [x] Token endpoint uses public-client auth method `none`; no client secret belongs in the package.
- [ ] Confirm production `CHATGPT_MCP_ALLOWED_CLIENT_IDS` includes the exact ChatGPT CIMD client id expected by the OpenAI portal.
- [ ] Confirm production `CHATGPT_MCP_ALLOWED_REDIRECT_URIS` includes the exact callback URI shown by the OpenAI portal.

## Tool Authorization

- [x] `useclevr_list_datasets` requires `dataset:read`.
- [x] `useclevr_analyze_dataset` requires `dataset:read`.
- [x] `useclevr_upload_dataset` requires `dataset:read` and `dataset:write`.
- [x] Dataset reads use owner-scoped lookup by `datasets.userId`.
- [x] Upload runs under the authenticated user context.
- [x] Upload size is limited by existing `MAX_UPLOAD_BYTES`.

## Data Disclosure Review

- [ ] Privacy policy must explicitly cover all user-related fields returned by the MCP tools: dataset id, dataset name, file name, row count, column count, dataset type, business model, analysis status, created date, dashboard URL, KPI values, insights, risks, opportunities, recommended actions, semantic mappings, warnings, diagnostics, preview headers/rows, upload usage, and question results.
- [ ] Review sample account must use synthetic or consented sample data only.
- [ ] The operator verifies reviewer login through the application's required email-proof flow without operator intervention; no application authentication bypass is introduced.

## Known Review Risks

- [ ] The operator reviews the read-only tool annotations and their justifications against the portal scan. List/analyze calls record security audit events; document that side effect accurately without disabling security auditing solely to satisfy an unverified review interpretation.
- [ ] `useclevr_upload_dataset` currently accepts `fileBase64`; verify ChatGPT file attachment behavior during portal testing and provide a small hosted sample CSV in the review details if needed.
- [ ] The operator evaluates client-authentication requirements for the deployment and records any mTLS decision; local OAuth tests do not certify deployment transport controls.

## Package Hygiene

- [x] No credentials, tokens, private keys, test passwords, or reviewer instructions are included in this package.
- [x] Package references existing static logo/icon assets only.
- [x] No lifecycle hooks are included.
- [x] No `.app.json` registered app mapping is included; public submission uses `mcp.json`.
