import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import { resolveDashboardAnalysisScope } from "../../src/lib/data/analysis-scope"
import {
  detectBusinessModelFromColumns,
  getBusinessModelKpiNames,
  getBusinessModelRedirect,
  resolveBusinessModel,
  shouldRenderWorldMapForBusinessModel,
} from "../../src/lib/data/business-model"

function main() {
  assert.equal(
    resolveBusinessModel({
      explicit: "ecommerce",
      uploadSource: "retail",
      datasetType: "retail",
      columns: ["sku", "stock"],
    }),
    "ecommerce",
    "explicit business model wins over upload module",
  )

  assert.equal(
    resolveBusinessModel({
      uploadSource: "retail_upload",
      datasetType: "retail",
      columns: ["country", "order_id", "shipping"],
    }),
    "local_retail",
    "retail upload module maps to local retail",
  )

  assert.equal(
    detectBusinessModelFromColumns(["store", "branch", "sku", "stock", "reorder_point", "sell_through_rate"], "Local shop inventory"),
    "local_retail",
  )
  assert.equal(
    detectBusinessModelFromColumns(["order_id", "country", "shipping_cost", "return_rate", "channel", "customer_id"], "Shopify export"),
    "ecommerce",
  )
  assert.equal(
    detectBusinessModelFromColumns(["mrr", "arr", "churn_rate", "cac", "ltv", "active_users"], "Subscription metrics"),
    "saas",
  )
  assert.equal(
    detectBusinessModelFromColumns(["runway", "burn_rate", "funding_round", "active_users", "cac"], "Startup board metrics"),
    "startup",
  )
  assert.equal(
    detectBusinessModelFromColumns(["portfolio_company", "sector", "stage", "invested_capital", "valuation", "ownership"], "Fund portfolio"),
    "investor",
  )
  assert.equal(
    detectBusinessModelFromColumns(["gmv", "take_rate", "seller_id", "buyer_id", "listing_id"], "Marketplace activity"),
    "marketplace",
  )

  assert.equal(
    getBusinessModelRedirect({ datasetType: "retail", businessModel: "local_retail", datasetId: "ds_1" }),
    "/app/retail?datasetId=ds_1",
  )
  assert.equal(
    getBusinessModelRedirect({ datasetType: "standard", businessModel: "ecommerce", datasetId: "ds_2" }),
    "/app/dashboard?datasetId=ds_2",
  )

  assert.ok(getBusinessModelKpiNames("local_retail").includes("Low Stock"))
  assert.ok(!getBusinessModelKpiNames("saas").includes("Low Stock"))
  assert.ok(getBusinessModelKpiNames("ecommerce").includes("Average Order Value"))
  assert.ok(getBusinessModelKpiNames("investor").includes("Portfolio Companies"))

  assert.equal(
    shouldRenderWorldMapForBusinessModel({
      businessModel: "local_retail",
      mappedLocations: [{ latitude: 52.37, longitude: 4.9 }],
    }),
    false,
    "single local retail location does not render a world map",
  )
  assert.equal(
    shouldRenderWorldMapForBusinessModel({
      businessModel: "local_retail",
      mappedLocations: [
        { latitude: 52.37, longitude: 4.9 },
        { latitude: 51.92, longitude: 4.48 },
      ],
    }),
    true,
    "multi-location local retail with real coordinates can render a map",
  )
  assert.equal(
    shouldRenderWorldMapForBusinessModel({
      businessModel: "ecommerce",
      mappedLocations: [{ latitude: 37.09, longitude: -95.71 }],
    }),
    true,
    "ecommerce can render a world map with valid geography",
  )
  assert.equal(
    shouldRenderWorldMapForBusinessModel({
      businessModel: "saas",
      mappedLocations: [{ latitude: 37.09, longitude: -95.71 }],
    }),
    false,
    "saas does not inherit geography by default",
  )
  assert.deepEqual(resolveDashboardAnalysisScope({ datasetId: "ds_2" }), { scope: "single_dataset", datasetId: "ds_2" })
  assert.deepEqual(resolveDashboardAnalysisScope({ groupId: "grp_1" }), { scope: "dataset_group", groupId: "grp_1" })
  assert.deepEqual(resolveDashboardAnalysisScope({ portfolioId: "pf_1" }), { scope: "portfolio", groupId: "pf_1" })
  assert.equal(resolveDashboardAnalysisScope({}), null)

  assertFixture("startup-saas.csv", [
    "date",
    "customer_id",
    "plan",
    "mrr",
    "arr",
    "churned",
    "new_customer",
    "cac",
    "ltv",
    "burn",
    "runway_months",
    "country",
  ], "saas")
  assertFixture("local-retail.csv", [
    "date",
    "store_id",
    "product_id",
    "category",
    "units_sold",
    "revenue",
    "cost",
    "stock_on_hand",
    "reorder_point",
    "supplier",
    "location",
  ], "local_retail")
  assertFixture("ecommerce.csv", [
    "order_id",
    "order_date",
    "customer_id",
    "country",
    "region",
    "product",
    "quantity",
    "revenue",
    "shipping_cost",
    "return_status",
    "channel",
  ], "ecommerce")
  assertFixture("investor-portfolio.csv", [
    "company_id",
    "company_name",
    "sector",
    "stage",
    "country",
    "invested_amount",
    "ownership_percent",
    "latest_valuation",
    "revenue",
    "growth_rate",
    "runway_months",
  ], "investor")
  assertFixture("business-consulting.csv", [
    "client_id",
    "project_id",
    "industry",
    "project_start",
    "project_end",
    "billable_hours",
    "hourly_rate",
    "revenue",
    "consultant_cost",
    "gross_margin",
    "status",
  ], "generic")

  console.log("Business model routing tests passed.")
}

function assertFixture(fileName: string, expectedColumns: string[], expectedModel: ReturnType<typeof detectBusinessModelFromColumns>) {
  const fixturePath = path.join(process.cwd(), "test-fixtures", "business-models", fileName)
  const header = fs.readFileSync(fixturePath, "utf8").split(/\r?\n/, 1)[0].split(",")
  assert.deepEqual(header, expectedColumns, `${fileName} columns match the template`)
  assert.equal(detectBusinessModelFromColumns(header, fileName), expectedModel, `${fileName} detects ${expectedModel}`)

  const xlsxPath = fixturePath.replace(/\.csv$/, ".xlsx")
  assert.ok(fs.existsSync(xlsxPath), `${path.basename(xlsxPath)} exists`)
}

main()
