import assert from "node:assert/strict";

import { buildDashboard } from "../../src/lib/data/dashboard-builder";
import { buildDatasetIntelligence, type DatasetRecord } from "../../src/lib/data/dataset-intelligence";
import { buildDatasetIntelligenceEngine, findSemanticColumn } from "../../src/lib/data/dataset-intelligence-engine";

const marketplaceRows: DatasetRecord[] = [
  {
    order_date: "2025-04-01",
    gross_merchandise_value: "$1,200.00",
    seller_payout: "$1,050.00",
    platform_fee: "$150.00",
    buyer_id: "buyer_1001",
    seller_id: "seller_2001",
    country: "US",
    category: "Accessories",
  },
  {
    order_date: "2025-04-02",
    gmv: "$900.00",
    gross_merchandise_value: "$900.00",
    seller_payout: "$765.00",
    platform_fee: "$135.00",
    buyer_id: "buyer_1002",
    seller_id: "seller_2001",
    country: "NL",
    category: "Home",
  },
  {
    order_date: "2025-04-03",
    gross_merchandise_value: "$450.00",
    seller_payout: "$390.00",
    platform_fee: "$60.00",
    buyer_id: "buyer_1003",
    seller_id: "seller_2002",
    country: "DE",
    category: "Accessories",
  },
];

const saasRows: DatasetRecord[] = [
  {
    date: "2025-04-01",
    sales_amount: 4998,
    startup_stage: "Seed",
    plan: "Pro",
    acquisition_channel: "Referral",
    region: "EMEA",
    customer_email: "buyer@example.com",
    active: true,
  },
  {
    date: "2025-04-02",
    sales_amount: 3822,
    startup_stage: "Series A",
    plan: "Enterprise",
    acquisition_channel: "Organic",
    region: "North America",
    customer_email: "owner@example.com",
    active: false,
  },
];

function main() {
  const die = buildDatasetIntelligenceEngine({
    rows: marketplaceRows,
    columns: Object.keys(marketplaceRows[0]),
    fileName: "marketplace-gmv.csv",
    rawText: "order_date,gross_merchandise_value,seller_payout,platform_fee\n",
    mimeType: "text/csv",
  });

  assert.equal(die.version, "die.v1");
  assert.equal(die.fileStructure.sourceType, "csv");
  assert.equal(die.fileStructure.delimiter, ",");
  assert.equal(die.fileStructure.headerRow, 1);
  assert.equal(die.fileStructure.dataStartRow, 2);

  assert.equal(findSemanticColumn(die, ["GMV"])?.columnName, "gross_merchandise_value");
  assert.equal(findSemanticColumn(die, ["Revenue"])?.columnName, "gross_merchandise_value");
  assert.equal(findSemanticColumn(die, ["Marketplace Revenue"])?.columnName, "platform_fee");
  assert.equal(findSemanticColumn(die, ["Commission"])?.columnName, "platform_fee");
  assert.equal(findSemanticColumn(die, ["Merchant Payout"])?.columnName, "seller_payout");
  assert.equal(findSemanticColumn(die, ["Customer"])?.columnName, "buyer_id");
  assert.equal(findSemanticColumn(die, ["Buyer"])?.columnName, "buyer_id");
  assert.equal(findSemanticColumn(die, ["Merchant"])?.columnName, "seller_id");
  assert.equal(findSemanticColumn(die, ["Seller"])?.columnName, "seller_id");
  assert.equal(findSemanticColumn(die, ["Geography"])?.columnName, "country");
  assert.equal(findSemanticColumn(die, ["Country"])?.columnName, "country");
  assert.equal(findSemanticColumn(die, ["Product Category"])?.columnName, "category");
  assert.ok((findSemanticColumn(die, ["Revenue"])?.confidence || 0) >= 0.7);
  assert.ok(die.columns.every((column) => column.explanation.length > 0));

  assert.equal(die.businessModel.model, "Marketplace");
  assert.ok(die.businessModel.confidence >= 0.7);
  assert.ok(die.relationships.some((relationship) => relationship.id === "gmv_from_seller_payout_platform_fee"));
  assert.ok(die.relationships.some((relationship) => relationship.id === "average_order_value"));
  assert.ok(die.kpis.some((kpi) => kpi.id === "total_gmv" && kpi.value === 2550));
  assert.ok(die.kpis.some((kpi) => kpi.id === "total_revenue" && kpi.value === 2550));
  assert.ok(die.kpis.some((kpi) => kpi.id === "marketplace_revenue" && kpi.value === 345));
  assert.ok(die.kpis.some((kpi) => kpi.id === "commission" && kpi.value === 345));
  assert.ok(die.kpis.some((kpi) => kpi.id === "merchant_payout" && kpi.value === 2205));
  assert.ok(die.kpis.some((kpi) => kpi.id === "take_rate" && kpi.value === 13.53));
  assert.ok(die.dashboard.widgets.some((widget) => widget.id === "revenue_over_time"));
  assert.equal(die.dashboard.generatedFrom, "semantic-dataset-intelligence-engine");
  assert.equal(die.aiContext.businessModel.model, "Marketplace");
  assert.ok(die.aiContext.semanticColumns.some((column) => column.columnName === "platform_fee" && column.canonicalRole === "Marketplace Revenue"));
  assert.equal(die.aiContext.governance.providerDisclosure, "No provider-generated values were used.");
  assert.equal(die.aiContext.governance.calculationSource, "deterministic_dataset_intelligence_engine");

  const saasDie = buildDatasetIntelligenceEngine({
    rows: saasRows,
    columns: Object.keys(saasRows[0]),
    fileName: "startup-saas-sales.csv",
  });
  assert.equal(findSemanticColumn(saasDie, ["Revenue"])?.columnName, "sales_amount");
  assert.equal(findSemanticColumn(saasDie, ["Email"])?.primaryValueType, "Email");
  assert.equal(findSemanticColumn(saasDie, ["Boolean"])?.primaryValueType, "Boolean");
  assert.ok(saasDie.businessModel.model === "SaaS" || saasDie.businessModel.model === "Finance");

  const legacy = buildDatasetIntelligence(marketplaceRows);
  assert.equal(legacy.semanticMetadata.businessModel.model, "Marketplace");
  assert.ok(legacy.metrics.numericColumns.includes("gross_merchandise_value"));
  assert.ok(legacy.dimensions.geographicColumns.includes("country"));

  const dashboard = buildDashboard("ds_marketplace", marketplaceRows);
  assert.ok(dashboard.kpis.some((kpi) => kpi.id === "total_revenue" && kpi.value === 2550));
  assert.equal(dashboard.metadata.businessModel, "Marketplace");
  assert.equal(dashboard.metadata.semanticDashboard.businessModel, "Marketplace");

  process.stdout.write("Dataset Intelligence Engine tests passed.\n");
}

main();
