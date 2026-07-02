import assert from "node:assert/strict"

import { generateBusinessIntelligence } from "../../src/lib/business/business-intelligence-engine"

const salesRows = [
  { date: "2026-01-01", product: "Alpha", customer_id: "C1", order_id: "O1", revenue: 1200, cost: 600, profit: 600, margin: 50 },
  { date: "2026-02-01", product: "Alpha", customer_id: "C1", order_id: "O2", revenue: 1000, cost: 620, profit: 380, margin: 38 },
  { date: "2026-03-01", product: "Beta", customer_id: "C2", order_id: "O3", revenue: 700, cost: 560, profit: 140, margin: 20 },
  { date: "2026-04-01", product: "Beta", customer_id: "C3", order_id: "O4", revenue: 400, cost: 380, profit: 20, margin: 5 },
  { date: "2026-04-01", product: "Beta", customer_id: "C3", order_id: "O4", revenue: 400, cost: 380, profit: 20, margin: 5 },
]

const inventoryRows = [
  { sku: "A-1", product: "Widget", stock: 2, revenue: 500, cost: 250, date: "2026-01-01" },
  { sku: "A-2", product: "Widget", stock: 1, revenue: 700, cost: 300, date: "2026-02-01" },
  { sku: "B-1", product: "Gadget", stock: 40, revenue: 1200, cost: 500, date: "2026-03-01" },
  { sku: "B-2", product: "Gadget", stock: 60, revenue: 1500, cost: 650, date: "2026-04-01" },
]

async function main() {
  const sales = await generateBusinessIntelligence({
    rows: salesRows,
    columns: Object.keys(salesRows[0]),
    datasetName: "Sales test",
    enableAi: false,
  })

  assert.equal(sales.detectedKpis.revenue, "revenue")
  assert.equal(sales.detectedKpis.profit, "profit")
  assert.equal(sales.detectedKpis.cost, "cost")
  assert.equal(sales.detectedKpis.margin, "margin")
  assert.equal(sales.detectedKpis.products, "product")
  assert.equal(sales.detectedKpis.customers, "customer_id")
  assert.equal(sales.detectedKpis.orders, "order_id")
  assert.equal(sales.detectedKpis.time, "date")
  assert.equal(sales.profile.duplicateRows, 1)
  assert.ok(sales.healthScore.overall >= 0 && sales.healthScore.overall <= 100)
  assert.ok(sales.risks.some((risk) => risk.title === "Declining revenue" || risk.title === "Falling margins"))
  assert.ok(sales.opportunities.some((opportunity) => opportunity.title === "High-performing product"))
  assert.ok(sales.recommendedActions.length > 0)

  const inventory = await generateBusinessIntelligence({
    rows: inventoryRows,
    columns: Object.keys(inventoryRows[0]),
    datasetName: "Inventory test",
    enableAi: false,
  })

  assert.equal(inventory.detectedKpis.inventory, "stock")
  assert.ok(inventory.risks.some((risk) => risk.title === "Low stock exposure"))
  assert.ok(inventory.opportunities.some((opportunity) => opportunity.title === "Inventory optimization"))
  assert.ok(inventory.executiveSummary.includes("/100"))

  console.log("Business Intelligence Engine tests passed.")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
