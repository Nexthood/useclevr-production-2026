import { debugError, debugLog } from "../../src/lib/utils/debug";

// Test script for CSV analyzer
import { analyzeCSV, DatasetRecord } from "../../src/lib/data/csv-analyzer";

// Sample test data
const testData: DatasetRecord[] = [
  {
    order_date: "2025-01-01",
    product: "Widget X",
    revenue: 150.0,
    quantity: 2,
    country: "DE",
    customer_id: "1001",
    is_return: false,
  },
  {
    order_date: "2025-01-02",
    product: "Widget Y",
    revenue: 89.99,
    quantity: 1,
    country: "US",
    customer_id: "1002",
    is_return: true,
  },
  {
    order_date: "2025-01-03",
    product: "Widget X",
    revenue: 150.0,
    quantity: 3,
    country: "DE",
    customer_id: "1001",
    is_return: false,
  },
  {
    order_date: "2025-01-04",
    product: "Phone Case",
    revenue: 29.99,
    quantity: 5,
    country: "FR",
    customer_id: "1003",
    is_return: false,
  },
];

// Run analysis (async for FX rate fetching)
async function runTest() {
  debugLog("Running CSV analysis...\n");
  const result = await analyzeCSV(testData);

  const expectedTypes = {
    order_date: "date",
    product: "text",
    revenue: "numeric",
    quantity: "numeric",
    country: "text",
    customer_id: "numeric",
    is_return: "boolean",
  };

  for (const [column, expectedType] of Object.entries(expectedTypes)) {
    if (result.column_types[column] !== expectedType) {
      throw new Error(
        `${column}: expected ${expectedType}, got ${result.column_types[column]}`,
      );
    }
  }

  const customerIdSemantic = result.dataset_summary?.columnSemantics.find(
    (column) => column.columnName === "customer_id",
  );
  if (customerIdSemantic?.dataRole !== "identifier") {
    throw new Error("customer_id: expected identifier semantic role");
  }

  if (
    result.business_kpis.gross_profit !== undefined ||
    result.business_kpis.margin_pct !== undefined
  ) {
    throw new Error("profit KPIs must remain unavailable when the dataset has no cost or profit column");
  }

  if (
    result.financial_metrics.net_profit_estimate !== null ||
    result.financial_metrics.ltv_to_cac_ratio !== null
  ) {
    throw new Error("financial metrics must not invent operating costs or customer lifespan");
  }

  // Output result as formatted JSON
  debugLog(JSON.stringify(result, null, 2));
}

runTest().catch(debugError);
