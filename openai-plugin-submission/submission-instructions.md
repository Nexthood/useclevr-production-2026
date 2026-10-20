# UseClevr OpenAI Plugin Directory Submission Instructions

## Package Contents

- `plugin.json`: portable plugin manifest with OpenAI listing metadata and review test cases.
- `mcp.json`: remote MCP server declaration and OAuth configuration.
- `listing-metadata.json`: human-readable listing and OAuth summary.
- `assets/logo.png`: existing UseClevr logo copied from the application assets.
- `assets/composer-icon.svg`: existing UseClevr icon copied from `public/6.svg`.
- `review/review-test-cases.md`: reviewer-facing test cases.
- `security/security-review-checklist.md`: security and readiness checklist.
- `submission-instructions.md`: this file.
- `validate-submission-package.mjs`: local source-package checks; this validator does not certify portal readiness.

## Product and Publisher Identity

- UseClevr is the product name, package identifier, display name, and brand shown in the logo and starter prompts.
- Atlas Mega Ventures is the intended publisher and package author. `plugin.json` sets `author.name` and `extensions.com.openai.interface.developerName` to Atlas Mega Ventures; `listing-metadata.json` uses the same developer name.
- The operator selects the verified Atlas Mega Ventures developer identity in the owning OpenAI organization and project. The directory publisher follows that verified identity; editing package text does not verify business ownership.
- This repository does not establish Atlas Mega Ventures verification status or legal affiliation. The operator confirms both in the portal before submission.

OpenAI documents publisher identity and package fields in [Upload and submit your plugin](https://developers.openai.com/plugins/deploy/submission).

## Official Requirements Used

- This remote MCP package keeps `plugin.json`, `mcp.json`, and `assets/` at the plugin root. It includes no skills.
- MCP servers in `mcp.json` use `type: "streamable-http"` and a remote HTTPS URL.
- OAuth configuration belongs under the server entry at `extensions.com.openai.auth`.
- The package must not include secrets, client secrets, reviewer credentials, or private reviewer instructions.
- Initial MCP app review requires exactly five positive and three negative test cases.
- The reviewer demo recording URL and reviewer credentials are required before final submission; credentials must be entered in the OpenAI dashboard, not committed to this package.

## Portal Steps

1. Select the owning organization/project and confirm its verified Atlas Mega Ventures developer identity; keep UseClevr as the product display name.
2. Use an OpenAI project with global data residency.
3. Ensure the user has Apps Management Write and Read permissions.
4. Upload the final ZIP in the OpenAI plugin submission portal.
5. Select the MCP server declared in `mcp.json` and run Scan Tools.
6. Confirm the scanned tools are:
   - `useclevr_list_datasets`
   - `useclevr_analyze_dataset`
   - `useclevr_upload_dataset`
7. Confirm scanned tool annotations and security schemes match the source implementation.
8. Enter reviewer credentials securely in the dashboard.
9. Verify that the demo recording URL in `plugin.json` opens for reviewers without an access request and demonstrates the declared tools. Its accessibility is not established by local validation.
10. Complete domain verification if prompted by the portal.
11. Submit for review only after every item in `security/security-review-checklist.md` is resolved or explicitly accepted.

## Required Reviewer Account

Create a dedicated UseClevr reviewer account with:

- At least one sample retail dataset.
- At least one dataset suitable for a question/answer test.
- Permission to upload one small CSV/XLSX dataset.
- A reviewer-accessible login that completes the application's required email proof without operator intervention. UseClevr requires email proof for password login; the operator must verify an approved reviewer login arrangement without disabling application authentication.

Do not store this account's username or password in the ZIP or repository.

## Local Validation and Submission Gate

Run `node openai-plugin-submission/validate-submission-package.mjs` to check the source package. Run `pnpm test:chatgpt` for isolated OAuth/MCP verification; see `docs/AI-interaction/developer-guides/chatgpt-integration-testing.md`. Local tests do not contact the production MCP endpoint or OpenAI.

The operator completes these checks before final submission:

- Verify the selected Atlas Mega Ventures publisher identity and reviewer access to the existing demo recording.
- Enter reviewer credentials securely in the dashboard and verify the required email-proof login.
- Complete the unchecked items in `security/security-review-checklist.md`, including privacy disclosures, tool annotations, attachment handling, and production client/callback allowlists.
- Resolve the reported CIMD/predefined-client-ID save mismatch using the redacted support report; a local OAuth test does not establish that the portal saves a connection.
- Run the portal tool scan and domain verification against the authorized deployment, then test the complete reviewer flow.

The root 1.0.1 and 1.0.2 ZIPs and 1.0.1 validation JSON are historical upload artifacts. They remain local and ignored by Git. Source edits do not update those archives; neither archive certifies the current source package. Artifact generation, upload, deployment, and submission require a separate authorized task.
