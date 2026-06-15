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

- T-849. Keep current product work focused on launch-critical upload, analysis, dashboard, demo, login, and docs before MCP, API, and market-intelligence expansion. (labels: workflow, docs)
- T-850. Implement lightweight privacy shield for CSV and Excel AI analysis with sensitive-column detection, anonymization checkbox, anonymized AI input, and privacy report persistence. (labels: ai, data, security, upload)
- T-851. Convert project phases into active TODO tasks and future TODO tasks with current-step and deferred roadmap boundaries. (labels: workflow, docs)
- T-852. Update sales and developer docs to separate current MVP capability, sales-readiness work, roadmap preparation, and long-term intelligence. (labels: docs, sales, workflow)

## Deferred

## Missing task numbers

Reuse inactive number ranges for new non-sequential work when a shorter active ID is clearer:
- 1 through 806
- 808 through 821
- 825 through 840
- 853 through 856

## Suggestions
