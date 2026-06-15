# Active TODO Queue

This file is the only active queue. Add confirmed implementation work here before it starts.

Get the T-number from `.TODO/config.json` before adding new tasks. Keep task numbers stable when
moving work between states.

## Label: mcp

- T-807. Configure DNS CNAME records: `mcp.useclevr.com` → Railway production hostname, `mcp-test.useclevr.com` → Railway test hostname; verify subdomain routing to the Payload MCP endpoint. (labels: mcp, deployment, docs)
- T-822. Test Payload MCP endpoint accessibility on `mcp-test.useclevr.com` after DNS configuration. (labels: mcp, testing, deployment)
- T-823. Run end-to-end Payload MCP API-key auth and tool invocation tests via REST Client files in `docs/api-tests/mcp.http`. (labels: mcp, testing, security)
- T-824. Add "What types of questions can I ask?" example to the MCP FAQ collection showing dataset column queries, aggregation requests, and chart suggestions. (labels: mcp, faq, docs)
- T-841. Create a Payload MCP key with only the two locked demo-account read tools, set `PAYLOAD_MCP_TEST_API_KEY` on the Railway test service, deploy `beta` to `dist-test`, verify JSON-RPC discovery and calls, and create the ChatGPT developer-mode draft app. (labels: mcp, deployment, testing, security)
- T-845. Replace dashboard MCP references in markdown docs with Payload MCP migration wording and remove `/api/mcp` dashboard connector examples. (labels: mcp, docs, api)
- T-846. Update MCP REST Client examples to call Payload Streamable HTTP MCP with Bearer API-key auth and JSON-RPC discovery. (labels: mcp, testing, docs)
- T-847. Verify production and test MCP subdomains route only to Payload MCP, not dashboard MCP. (labels: mcp, deployment, testing)
- T-848. Document ChatGPT developer-mode setup for Payload MCP and remove dashboard MCP setup instructions. (labels: mcp, docs, deployment)

## Label: workflow

- T-849. Run the complete new-user acceptance journey through signup, CSV upload, verified KPIs and charts, dataset-specific AI answers, report review, support, and plan selection; fix every blocker that requires developer intervention. (labels: workflow, testing, upload, ai, dashboard)
- T-850. Implement the lightweight CSV privacy shield with sensitive-column detection, a clear warning, optional stable-placeholder anonymization, anonymized AI input, and a compact privacy report. (labels: ai, data, security, upload)
- T-853. Complete the sales-validation kit with current screenshots, privacy-safe founder and SME demo datasets, a repeatable demo script, pricing and trial guidance, and a short demo video. (labels: sales, docs, testing)
- T-854. Verify activation measurement for signup, first upload, first AI question, report review or download, checkout review, and support usage. (labels: metrics, sales, dashboard, testing)
- T-855. Verify trial, analyst credits, Stripe checkout, subscription state, billing portal, and upgrade prompts across Free, Pro, and Business plans. (labels: billing, payment, testing)
- T-856. Deploy the release candidate through beta and dist-test, verify Railway predeploy and startup, test `/api/health`, and run the usable-MVP smoke journey on the test host. (labels: deployment, testing, stability)
- T-857. Stabilize Excel upload parity with CSV parsing, preview, row counts, ownership, and clear error messages. (labels: data, upload, testing)
- T-858. Add privacy shield acceptance coverage for sensitive-column detection, warning, anonymization checkbox, anonymized AI input, and privacy report. (labels: ai, data, security, testing)
- T-859. Verify analysis response time and output quality on representative founder, SME, and e-commerce datasets. (labels: ai, data, quality, testing)
- T-860. After privacy shield implementation and acceptance pass, update product, developer, and sales docs with the verified user behavior and screenshots. (labels: docs, sales, workflow)
- T-861. Review Payload admin login and operator UI against the dashboard login and admin shell before release candidate. (labels: ui, auth, dashboard, testing)
- T-862. Prepare the release-candidate checklist for beta and dist-test: health, smoke journey, docs, TODO, changelog, and secret scan. (labels: deployment, testing, workflow)

## Deferred

## Missing task numbers

Reuse inactive number ranges for new non-sequential work when a shorter active ID is clearer:

- 1 through 806
- 808 through 821
- 825 through 840

## Suggestions
