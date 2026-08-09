import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ANALYTICAL_INTENT_REGISTRY,
  availableAnalyticalSuggestions,
  executeAnalyticalIntent,
} from "../../src/lib/data/analytical-intents";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

function parseFixtureCsv(fileName: string) {
  const [headerLine, ...lines] = readFileSync(join(__dirname, "fixtures", fileName), "utf8").trim().split(/\r?\n/);
  const headers = headerLine?.split(",") ?? [];
  return lines.map((line) => {
    const values = line.split(",");
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

function execute(fileName: string, question = "What is the current gross margin?") {
  const rows = parseFixtureCsv(fileName);
  return executeAnalyticalIntent({
    question,
    datasetId: `fixture:${fileName}`,
    datasetType: "generic",
    columns: Object.keys(rows[0] ?? {}),
    rows,
  });
}

const expectedIntentIds = [
  "total_revenue",
  "total_cost",
  "gross_profit",
  "gross_margin",
  "net_profit",
  "net_margin",
  "expense_growth",
  "revenue_trend",
  "profit_trend",
  "cash_flow_risk",
  "category_cost_impact",
  "margin_pressure",
  "unusual_transactions",
  "monthly_operating_run_rate",
  "segment_decline",
  "revenue_concentration",
  "top_products",
  "top_customers",
  "average_order_value",
];
assert.deepEqual(
  ANALYTICAL_INTENT_REGISTRY.map((intent) => intent.id),
  expectedIntentIds,
  "analytical intent registry centralizes the required initial intents",
);

const revenueCogs = execute("generic_revenue_cogs_dataset.csv");
assert.equal(revenueCogs.status, "success", "gross margin calculates from revenue and COGS");
if (revenueCogs.status === "success") {
  assert.equal(revenueCogs.result.revenue, 125000);
  assert.equal(revenueCogs.result.cogs, 84500);
  assert.equal(revenueCogs.result.grossProfit, 40500);
  assert.equal(revenueCogs.result.grossMarginPercent, 32.4);
  assert.equal(revenueCogs.result.calculationMethod, "revenue_minus_cogs");
  assert.deepEqual(revenueCogs.result.sourceColumns, { revenue: "revenue", cogs: "cogs" });
}

const grossProfit = execute("startup_profitability_dataset.csv");
assert.equal(grossProfit.status, "success", "gross margin calculates from revenue and gross profit");
if (grossProfit.status === "success") {
  assert.equal(grossProfit.result.revenue, 150000);
  assert.equal(grossProfit.result.grossProfit, 60000);
  assert.equal(grossProfit.result.grossMarginPercent, 40);
  assert.equal(grossProfit.result.calculationMethod, "gross_profit_over_revenue");
}

const existingMargin = execute("existing_gross_margin_dataset.csv");
assert.equal(existingMargin.status, "success", "existing gross margin field is supported");
if (existingMargin.status === "success") {
  assert.equal(existingMargin.result.grossMarginPercent, 33);
  assert.equal(existingMargin.result.calculationMethod, "existing_gross_margin");
}

const opexOnly = execute("revenue_operating_expenses_dataset.csv");
assert.equal(opexOnly.status, "unsupported", "operating expenses are not treated as COGS");
if (opexOnly.status === "unsupported") {
  assert.equal(opexOnly.code, "missing_cogs_metric");
  assert.match(opexOnly.message, /operating expenses alone/);
}

const missingRevenue = execute("unsupported_financial_dataset.csv");
assert.equal(missingRevenue.status, "unsupported", "unsupported dataset without financial metrics is rejected precisely");
if (missingRevenue.status === "unsupported") assert.equal(missingRevenue.code, "missing_revenue_metric");

const zeroRevenue = executeAnalyticalIntent({
  question: "What is the current gross margin?",
  datasetId: "fixture:zero",
  datasetType: "generic",
  columns: ["revenue", "cogs"],
  rows: [{ revenue: "0", cogs: "10" }],
});
assert.equal(zeroRevenue.status, "unsupported", "zero revenue is rejected");
if (zeroRevenue.status === "unsupported") assert.equal(zeroRevenue.code, "zero_revenue");

const mixedCurrency = executeAnalyticalIntent({
  question: "What is the current gross margin?",
  datasetId: "fixture:mixed",
  datasetType: "generic",
  columns: ["revenue", "cogs", "currency"],
  rows: [
    { revenue: "100", cogs: "40", currency: "USD" },
    { revenue: "100", cogs: "40", currency: "EUR" },
  ],
});
assert.equal(mixedCurrency.status, "unsupported", "mixed currency datasets are rejected");
if (mixedCurrency.status === "unsupported") assert.equal(mixedCurrency.code, "mixed_currency_dataset");

const ambiguousCost = executeAnalyticalIntent({
  question: "What is the current gross margin?",
  datasetId: "fixture:ambiguous",
  datasetType: "generic",
  columns: ["revenue", "cost"],
  rows: [{ revenue: "100", cost: "40" }],
});
assert.equal(ambiguousCost.status, "unsupported", "generic cost is not automatically treated as COGS");
if (ambiguousCost.status === "unsupported") assert.equal(ambiguousCost.code, "missing_cogs_metric");

const cogsSuggestions = availableAnalyticalSuggestions({
  datasetId: "fixture:generic",
  datasetType: "generic",
  columns: ["date", "revenue", "cogs", "currency"],
  rows: [{ date: "2025-04-01", revenue: "100", cogs: "40", currency: "USD" }],
});
assert.ok(cogsSuggestions.includes("What is the current gross margin?"), "supported gross margin suggestion appears");

const opexSuggestions = availableAnalyticalSuggestions({
  datasetId: "fixture:opex",
  datasetType: "generic",
  columns: ["date", "revenue", "operating_expenses"],
  rows: [{ date: "2025-04-01", revenue: "100", operating_expenses: "40" }],
});
assert.ok(!opexSuggestions.includes("What is the current gross margin?"), "unsupported gross margin suggestion is filtered out");

const unusualTransactions = executeAnalyticalIntent({
  question: "Are there unusual transactions this period?",
  datasetId: "fixture:unusual-transactions",
  datasetType: "generic",
  columns: ["Date", "Description", "Amount", "Quantity", "Category"],
  rows: [
    ...[10, 11, 12, 12, 13, 14, 15, 16, 18].map((amount, index) => ({ Date: `2025-03-${String(index + 1).padStart(2, "0")}`, Description: `Regular ${index + 1}`, Amount: String(amount), Quantity: "50", Category: "Food" })),
    { Date: "2025-03-10", Description: "Protein Bar", Amount: "678.37", Quantity: "1", Category: "Food" },
  ],
});
assert.equal(unusualTransactions.status, "success", "unusual transaction intent uses deterministic anomaly analysis");
if (unusualTransactions.status === "success") {
  assert.equal(unusualTransactions.intent, "unusual_transactions");
  assert.match(unusualTransactions.answer, /statistically unusual/i);
  assert.match(unusualTransactions.answer, /Median transaction/i);
  assert.match(unusualTransactions.answer, /Upper outlier threshold/i);
  assert.equal(unusualTransactions.result.amountColumn, "Amount");
  assert.doesNotMatch(unusualTransactions.answer, /fraud|suspicious payment/i);
}

const datasetChatRoute = readFileSync(join(repoRoot, "src", "app", "api", "hybrid-ai", "dataset-chat", "route.ts"), "utf8");
assert.match(datasetChatRoute, /executeAnalyticalIntent/, "dataset-chat uses the generic analytical executor");
assert.match(datasetChatRoute, /providerName: "Not required"/, "direct analysis reports no provider requirement");
assert.match(datasetChatRoute, /and\(eq\(datasets\.id, parsed\.datasetId\), eq\(datasets\.userId, userId\)\)/, "dataset access is scoped to selected dataset ID and user");

const suggestionsRoute = readFileSync(join(repoRoot, "src", "app", "api", "suggestions", "generate", "route.ts"), "utf8");
assert.match(suggestionsRoute, /suggestions_dataset_v3_\$\{datasetId\}/, "suggestion cache key includes dataset ID and semantic version");
assert.match(suggestionsRoute, /availableAnalyticalSuggestions/, "suggestions are filtered by semantic metrics");

process.stdout.write("ok - analytical intent registry and gross margin fixtures\n");
