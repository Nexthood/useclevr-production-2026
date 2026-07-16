import assert from "node:assert/strict"

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
    "/app/datasets/ds_2/analyze?businessModel=ecommerce",
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

  console.log("Business model routing tests passed.")
}

main()
