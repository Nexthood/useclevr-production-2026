import assert from "node:assert/strict"

import {
  dashboardMcpTools,
  getDemoDashboardDatasetInsights,
  listDemoDashboardDatasets,
} from "../../src/lib/payload/mcp-dashboard-tools"
import proxy from "../../src/proxy"
import { NextRequest } from "next/server"

process.env.PAYLOAD_MCP_TEST_API_KEY = "test-only-key"

async function main() {
  const response = proxy(
    new NextRequest("https://mcp-test.useclevr.com/api/mcp", {
      method: "POST",
      headers: { host: "mcp-test.useclevr.com" },
    }),
  )

  assert.equal(response.status, 200)
  assert.equal(response.headers.get("x-middleware-rewrite"), "https://mcp-test.useclevr.com/api/payload/mcp")

  assert.deepEqual(
    dashboardMcpTools.map((tool) => tool.name),
    ["listDashboardDatasets", "getDashboardDatasetInsights"],
  )

  const listing = await listDemoDashboardDatasets()
  assert.equal(listing.account, "UseClevr test account")
  assert.ok(Array.isArray(listing.datasets))

  for (const dataset of listing.datasets) {
    assert.equal("data" in dataset, false)
    assert.equal("precomputedMetrics" in dataset, false)
  }

  if (listing.datasets[0]) {
    const insights = await getDemoDashboardDatasetInsights(listing.datasets[0].id)
    assert.equal(insights.id, listing.datasets[0].id)
    assert.equal("data" in insights, false)
  }

  await assert.rejects(getDemoDashboardDatasetInsights("not-a-demo-dataset"), /Dataset not found/)

  console.log(`Payload dashboard MCP smoke test passed with ${listing.datasets.length} demo dataset(s).`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
