# Active TODO Queue

This file is the only active queue. Add confirmed implementation work here before it starts.

Get the T-number from `.TODO/config.json` before adding new tasks. Keep task numbers stable when
moving work between states.

## Links

- [TODO-next.md](todo-next.md)
- [TODO-done.md](todo-done.md)
- [TODO-ignore.md](todo-ignore.md)
- [TODO-future.md](todo-future.md)
- [.TODO/config.json](config.json)

## Label: mcp

- T-807. Configure DNS CNAME records: `mcp.useclevr.com` → Railway production hostname, `mcp-test.useclevr.com` → Railway test hostname; verify subdomain routing to `/api/mcp` endpoint. (labels: mcp, deployment, docs)
- T-822. Test MCP endpoint accessibility on `mcp-test.useclevr.com` after DNS configuration. (labels: mcp, testing, deployment)
- T-823. Run end-to-end MCP token auth and tool invocation tests via REST Client files in `docs/api-tests/mcp.http`. (labels: mcp, testing, security)
- T-824. Add "What types of questions can I ask?" example to the MCP FAQ collection showing dataset column queries, aggregation requests, and chart suggestions. (labels: mcp, faq, docs)
- T-841. Create a Payload MCP key with only the two dashboard read tools, set `PAYLOAD_MCP_TEST_API_KEY` on the Railway test service, deploy `beta` to `dist-test`, verify JSON-RPC discovery and calls, and create the ChatGPT developer-mode draft app. (labels: mcp, deployment, testing, security)

## Deferred

## Suggestions

## Suggestions
