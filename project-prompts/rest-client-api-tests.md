# REST Client API Tests Prompt

Use this prompt to add safe, Git-tracked REST Client request files for shared API testing in the UseClevr repository.

```text
Implement REST Client API test files for the UseClevr repo.

Goal:
Add reproducible, Git-tracked API request examples for multi-dev testing and timed debugging. REST Client is the official shared API testing approach. Thunder Client can remain personal and manual only.

Context:

- UseClevr is a Next.js SaaS app.
- Keep implementation minimal.
- Do not change existing API behavior.
- Do not add heavy testing frameworks.
- Do not commit secrets.
- Do not break Railway deploy.
- These files are for developer testing and documentation only.

Tasks:

1. Inspect current API routes.
   Check:
   - `src/app/api/**`
   - `src/pages/api/**` if present
   - existing auth and session routes
   - upload, analyze, billing, and health routes
   - Railway or runtime health endpoints

2. Create a REST Client folder:

   `docs/api-tests/`

3. Add `.http` files for important API areas.

   Suggested files:
   - `docs/api-tests/README.md`
   - `docs/api-tests/health.http`
   - `docs/api-tests/auth.http`
   - `docs/api-tests/upload.http`
   - `docs/api-tests/analyze.http`
   - `docs/api-tests/business-profile.http`
   - `docs/api-tests/billing.http`
   - `docs/api-tests/railway-smoke.http`

   Only add files that match real existing routes. Do not invent endpoints.

4. Use environment variables safely.

   Add or update:
   - `.vscode/settings.json`

   Add safe non-secret REST Client environment variables:

     ```json
   {
     "rest-client.environmentVariables": {
       "local": {
         "baseUrl": "http://localhost:3000"
       },
       "staging": {
         "baseUrl": "https://CHANGE_ME_STAGING_URL"
       },
       "production": {
         "baseUrl": "https://CHANGE_ME_PRODUCTION_URL"
       }
     }
   }
    ```

   Do not include tokens, cookies, API keys, session secrets, Stripe secrets, Gemini keys, OpenAI keys, or database URLs.

1. Use placeholders for sensitive values.

   Example:

    ```http
   @baseUrl = {{baseUrl}}

   ### Example protected request
   GET {{baseUrl}}/api/example
   Cookie: next-auth.session-token=<paste-local-session-cookie>
    ```

   Secrets stay as manual placeholders.

2. Add request examples for each available endpoint.

   Each `.http` file should include:
   - a short comment explaining what the request tests
   - local request
   - staging request if useful through `{{baseUrl}}`
   - expected status notes
   - placeholder body where required

   Example style:

    ```http
   ### Health check
   # Expected: 200 OK
   GET {{baseUrl}}/api/health
    ```

3. Add `docs/api-tests/README.md`.

   README should explain:
   - install the VS Code REST Client extension
   - select environment in VS Code
   - run requests from `.http` files
   - do not commit secrets
   - how to use local, staging, and production base URLs
   - how to test protected routes using a temporary local session cookie
   - difference between REST Client and Thunder Client

4. Optional but useful:
   Add a simple curl-based smoke script only if the repo already has a `scripts/smoke` or `scripts/health` pattern.

   Possible file:
   - `scripts/smoke/api-smoke.sh`

   Keep it minimal:
   - health check
   - one public endpoint
   - timestamped output
   - no secrets
   - fail on non-2xx where appropriate

   Do not add it if it would create unnecessary complexity.

5. Add a package script only if useful and safe:

   `"smoke:api": "bash scripts/smoke/api-smoke.sh"`

   Only add it if the script is created and works.

6. Update TODO only if needed.

   If the implementation creates follow-up work, add only practical tasks to `.TODO/todo-future.md`, not active TODO, unless the task is required immediately.

Expected output:

- files created and changed
- existing API routes discovered
- REST Client files added
- how to run requests in VS Code
- endpoints skipped because they require auth or secrets
- risks and manual steps
- no secrets committed

Important:
This work is for reproducibility and developer collaboration. Keep it plain text, Git-tracked, minimal, and safe.

```
