# API Test Files

Use these REST Client files as the shared API testing method for UseClevr.

## Install

Install the VS Code extension `REST Client` by Huachao Mao.

## Run Requests

1. Open any `.http` file in `docs/api-tests/`.
2. Select the environment from the REST Client status control in VS Code.
3. Run the request with `Send Request`.

## Environments

VS Code reads safe shared base URLs from [.vscode/settings.json](../../.vscode/settings.json):

- `local` -> `http://localhost:3000`
- `staging` -> `https://CHANGE_ME_STAGING_URL`
- `production` -> `https://CHANGE_ME_PRODUCTION_URL`

Update the staging and production URLs locally before use. Do not commit secrets.

## Auth and Secrets

- Keep cookies, bearer tokens, service tokens, admin tokens, API keys, Stripe secrets, database URLs, and webhook secrets out of Git.
- Paste temporary local session cookies directly into the request header placeholder when you need a protected route.
- Remove temporary secrets from the editor before you save the file.

Protected-route placeholder example:

```http
Cookie: authjs.session-token=<paste-local-session-cookie>
```

## Shared vs Personal Testing

- Use these `.http` files for shared, Git-tracked, reproducible API checks.
- Use Thunder Client only for personal manual experiments that do not need to live in the repo.

## Route Coverage

This folder covers the current important API areas that already exist in the app:

- health
- auth session and CSRF
- upload
- analyze
- business profile and setup
- billing and checkout
- Railway smoke checks
- MCP reachability and signed-in MCP calls

## MCP Testing

Use [mcp.http](mcp.http) for the current app-state MCP checks.

- Unsigned `GET /api/mcp` currently returns `401 Unauthorized`.
- Signed-in MCP requests require a real session cookie because the current proxy blocks unauthenticated `/api/*` requests before MCP token headers are evaluated.

## Manual Limits

The AI agent can create and verify these request files, but the AI agent cannot sign in through your live browser session or extract your live session cookie automatically. Reuse a temporary local session cookie only through your own browser or terminal session when you test protected routes.
