import assert from "node:assert/strict";

import { executeAnalyticalIntent } from "../../src/lib/data/analytical-intents";
import { answerDatasetQuestionDeterministically } from "../../src/lib/data/dataset-assistant-deterministic";
import { resolveQuestionMetric } from "../../src/lib/data/metric-resolver";
import { classifyQuestionIntent, type QuestionIntent } from "../../src/lib/data/question-intent-engine";

type Fixture = {
  datasetType: string;
  rows: Record<string, string | number>[];
};

const fixtures: Record<string, Fixture> = {
  retail: {
    datasetType: "retail",
    rows: [
      { order_date: "2025-01-03", order_id: "R-1", revenue: "1200", cogs: "720", customer_id: "Acme", product_name: "Widget Pro", category: "Hardware", country: "US", region: "North America", quantity: "4", currency: "USD" },
      { order_date: "2025-01-15", order_id: "R-2", revenue: "800", cogs: "500", customer_id: "Beta", product_name: "Widget Lite", category: "Hardware", country: "US", region: "North America", quantity: "5", currency: "USD" },
      { order_date: "2025-02-08", order_id: "R-3", revenue: "1600", cogs: "950", customer_id: "Acme", product_name: "Service Pack", category: "Services", country: "CA", region: "North America", quantity: "2", currency: "USD" },
      { order_date: "2025-02-18", order_id: "R-4", revenue: "700", cogs: "420", customer_id: "Delta", product_name: "Widget Lite", category: "Hardware", country: "GB", region: "Europe", quantity: "7", currency: "USD" },
    ],
  },
  marketplace: {
    datasetType: "marketplace",
    rows: [
      { date: "2025-01-05", transaction_id: "M-1", gmv: "2200", cogs: "1400", customer_id: "Buyer A", sku: "SKU-1", category: "Books", country: "NL", region: "Europe", qty: "11", currency: "EUR" },
      { date: "2025-01-20", transaction_id: "M-2", gmv: "900", cogs: "650", customer_id: "Buyer B", sku: "SKU-2", category: "Games", country: "DE", region: "Europe", qty: "3", currency: "EUR" },
      { date: "2025-02-04", transaction_id: "M-3", gmv: "500", cogs: "360", customer_id: "Buyer A", sku: "SKU-3", category: "Books", country: "BE", region: "Europe", qty: "2", currency: "EUR" },
    ],
  },
  accounting: {
    datasetType: "accounting",
    rows: [
      { date: "2025-01-31", invoice_number: "A-1", revenue: "5000", cogs: "3400", customer: "Client One", category: "Consulting", country: "US", quantity: "1", currency: "USD" },
      { date: "2025-02-28", invoice_number: "A-2", revenue: "4200", cogs: "3100", customer: "Client Two", category: "Support", country: "US", quantity: "1", currency: "USD" },
      { date: "2025-03-31", invoice_number: "A-3", revenue: "3900", cogs: "3200", customer: "Client One", category: "Support", country: "CA", quantity: "1", currency: "USD" },
    ],
  },
  restaurant: {
    datasetType: "restaurant",
    rows: [
      { date: "2025-01-01", receipt_id: "P-1", sales_amount: "240", cogs: "90", customer: "Table 1", product: "Dinner", category: "Food", country: "US", region: "West", quantity: "6", currency: "USD" },
      { date: "2025-01-02", receipt_id: "P-2", sales_amount: "180", cogs: "70", customer: "Table 2", product: "Lunch", category: "Food", country: "US", region: "West", quantity: "4", currency: "USD" },
      { date: "2025-02-01", receipt_id: "P-3", sales_amount: "120", cogs: "55", customer: "Table 3", product: "Drinks", category: "Bar", country: "US", region: "West", quantity: "8", currency: "USD" },
    ],
  },
  saas: {
    datasetType: "saas",
    rows: [
      { order_date: "2025-01-01", order_id: "S-1", revenue: "10000", cogs: "2000", customer_id: "Startup A", product_name: "Pro", category: "Subscription", country: "US", region: "North America", quantity: "10", currency: "USD" },
      { order_date: "2025-02-01", order_id: "S-2", revenue: "14000", cogs: "3500", customer_id: "Startup B", product_name: "Business", category: "Subscription", country: "GB", region: "Europe", quantity: "7", currency: "USD" },
      { order_date: "2025-03-01", order_id: "S-3", revenue: "9000", cogs: "2700", customer_id: "Startup A", product_name: "Pro", category: "Subscription", country: "US", region: "North America", quantity: "9", currency: "USD" },
    ],
  },
};

const questionCases: Array<{ dataset: keyof typeof fixtures; question: string; intent: QuestionIntent; answerPattern: RegExp }> = [
  { dataset: "retail", question: "What is total revenue?", intent: "metric.total_revenue", answerPattern: /Total revenue/i },
  { dataset: "marketplace", question: "How much revenue did we make?", intent: "metric.total_revenue", answerPattern: /Total revenue/i },
  { dataset: "accounting", question: "Revenue total please", intent: "metric.total_revenue", answerPattern: /Total revenue/i },
  { dataset: "restaurant", question: "Show total sales", intent: "metric.total_revenue", answerPattern: /Total revenue/i },
  { dataset: "retail", question: "What is the average order value?", intent: "metric.average_order_value", answerPattern: /Average Order Value/i },
  { dataset: "marketplace", question: "AOV?", intent: "metric.average_order_value", answerPattern: /Average Order Value/i },
  { dataset: "accounting", question: "Average order value by invoice?", intent: "metric.average_order_value", answerPattern: /Average Order Value/i },
  { dataset: "restaurant", question: "avg order value", intent: "metric.average_order_value", answerPattern: /Average Order Value/i },
  { dataset: "saas", question: "average order value for subscriptions", intent: "metric.average_order_value", answerPattern: /Average Order Value/i },
  { dataset: "retail", question: "What is average selling price?", intent: "metric.average_selling_price", answerPattern: /Average selling price/i },
  { dataset: "marketplace", question: "ASP?", intent: "metric.average_selling_price", answerPattern: /Average selling price/i },
  { dataset: "restaurant", question: "average price per item", intent: "metric.average_selling_price", answerPattern: /Average selling price/i },
  { dataset: "retail", question: "Total orders?", intent: "metric.total_orders", answerPattern: /Total orders/i },
  { dataset: "marketplace", question: "How many orders?", intent: "metric.total_orders", answerPattern: /Total orders/i },
  { dataset: "restaurant", question: "number of orders", intent: "metric.total_orders", answerPattern: /Total orders/i },
  { dataset: "retail", question: "Total customers?", intent: "metric.total_customers", answerPattern: /Total customers/i },
  { dataset: "accounting", question: "How many customers?", intent: "metric.total_customers", answerPattern: /Total customers/i },
  { dataset: "saas", question: "customer count", intent: "metric.total_customers", answerPattern: /Total customers/i },
  { dataset: "retail", question: "Revenue concentration", intent: "analysis.sales_concentration", answerPattern: /concentration/i },
  { dataset: "saas", question: "Are sales concentrated?", intent: "analysis.sales_concentration", answerPattern: /concentration/i },
  { dataset: "retail", question: "Revenue by country", intent: "analysis.revenue_by_country", answerPattern: /Revenue by Country/i },
  { dataset: "marketplace", question: "Sales by country", intent: "analysis.revenue_by_country", answerPattern: /Revenue by Country/i },
  { dataset: "accounting", question: "country revenue", intent: "analysis.revenue_by_country", answerPattern: /Revenue by Country/i },
  { dataset: "retail", question: "Revenue by category", intent: "analysis.revenue_by_category", answerPattern: /Revenue by Category/i },
  { dataset: "restaurant", question: "sales by category", intent: "analysis.revenue_by_category", answerPattern: /Revenue by Category/i },
  { dataset: "saas", question: "category revenue", intent: "analysis.revenue_by_category", answerPattern: /Revenue by Category/i },
  { dataset: "retail", question: "Who are the top customers?", intent: "ranking.top_customers", answerPattern: /Top customers/i },
  { dataset: "accounting", question: "best customers", intent: "ranking.top_customers", answerPattern: /Top customers/i },
  { dataset: "saas", question: "customers with most revenue", intent: "ranking.top_customers", answerPattern: /Top customers/i },
  { dataset: "marketplace", question: "who are top customer accounts?", intent: "ranking.top_customers", answerPattern: /Top customers/i },
  { dataset: "retail", question: "Top products", intent: "ranking.top_products", answerPattern: /Top products/i },
  { dataset: "marketplace", question: "best products", intent: "ranking.top_products", answerPattern: /Top products/i },
  { dataset: "restaurant", question: "product performance", intent: "ranking.top_products", answerPattern: /Top products/i },
  { dataset: "retail", question: "Top regions", intent: "ranking.top_regions", answerPattern: /Top regions/i },
  { dataset: "accounting", question: "best countries", intent: "ranking.top_regions", answerPattern: /Top regions/i },
  { dataset: "saas", question: "regions with most revenue", intent: "ranking.top_regions", answerPattern: /Top regions/i },
  { dataset: "retail", question: "What are the biggest revenue risks?", intent: "risk.revenue", answerPattern: /revenue risk/i },
  { dataset: "marketplace", question: "sales risk", intent: "risk.revenue", answerPattern: /revenue risk|No major revenue risk/i },
  { dataset: "restaurant", question: "risk in revenue", intent: "risk.revenue", answerPattern: /revenue risk/i },
  { dataset: "saas", question: "weak revenue areas", intent: "risk.revenue", answerPattern: /revenue risk|No major revenue risk/i },
  { dataset: "retail", question: "customer concentration risk", intent: "risk.customer_concentration", answerPattern: /Customer concentration/i },
  { dataset: "saas", question: "customer concentration", intent: "risk.customer_concentration", answerPattern: /Customer concentration/i },
  { dataset: "retail", question: "Monthly revenue trend", intent: "trend.monthly_revenue", answerPattern: /monthly revenue/i },
  { dataset: "accounting", question: "revenue over time", intent: "trend.monthly_revenue", answerPattern: /monthly revenue/i },
  { dataset: "restaurant", question: "sales trend", intent: "trend.monthly_revenue", answerPattern: /monthly revenue/i },
  { dataset: "retail", question: "customer growth", intent: "trend.customer_growth", answerPattern: /Customer growth/i },
  { dataset: "saas", question: "customers over time", intent: "trend.customer_growth", answerPattern: /Customer growth/i },
  { dataset: "retail", question: "Revenue forecast", intent: "forecast.revenue", answerPattern: /baseline/i },
  { dataset: "saas", question: "forecast revenue", intent: "forecast.revenue", answerPattern: /baseline/i },
  { dataset: "retail", question: "compare segment performance", intent: "comparison.segment", answerPattern: /Revenue by|leads with/i },
  { dataset: "restaurant", question: "category compare", intent: "comparison.segment", answerPattern: /Revenue by|leads with/i },
  { dataset: "saas", question: "plan compare", intent: "comparison.segment", answerPattern: /Revenue by|leads with/i },
  { dataset: "retail", question: "compare region", intent: "comparison.region", answerPattern: /Revenue by|leads with/i },
  { dataset: "marketplace", question: "country compare", intent: "comparison.region", answerPattern: /Revenue by|leads with/i },
  { dataset: "retail", question: "compare month periods", intent: "comparison.period", answerPattern: /monthly revenue/i },
  { dataset: "accounting", question: "period compare", intent: "comparison.period", answerPattern: /monthly revenue/i },
  { dataset: "saas", question: "quarter compare", intent: "comparison.period", answerPattern: /monthly revenue/i },
  { dataset: "retail", question: "Which customers have the highest margin?", intent: "analysis.margin", answerPattern: /Highest margin/i },
  { dataset: "marketplace", question: "What has the highest margin?", intent: "analysis.margin", answerPattern: /Highest margin/i },
  { dataset: "restaurant", question: "product margin by category", intent: "analysis.margin", answerPattern: /Highest margin/i },
];

const failedQuestions: string[] = [];

for (const testCase of questionCases) {
  const fixture = fixtures[testCase.dataset];
  const columns = Object.keys(fixture.rows[0] ?? {});
  const classification = classifyQuestionIntent(testCase.question);
  try {
    assert.equal(classification.intent, testCase.intent, `${testCase.question} classified as requested intent`);
    const result = resolveQuestionMetric({
      question: testCase.question,
      datasetId: `fixture:${testCase.dataset}`,
      datasetType: fixture.datasetType,
      columns,
      rows: fixture.rows,
    });
    assert.equal(result.status, "success", `${testCase.question} resolves deterministically`);
    if (result.status === "success") {
      assert.equal(result.intent, testCase.intent, `${testCase.question} keeps requested intent through resolver`);
      assert.match(result.answer, testCase.answerPattern, `${testCase.question} references the calculated metric`);
      assert.doesNotMatch(result.answer, /^The selected dataset contains/i, `${testCase.question} does not fall back to a generic dataset summary`);
    }
  } catch (error) {
    failedQuestions.push(`${testCase.question}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

assert.equal(questionCases.length >= 50, true, "at least 50 business questions are covered");
assert.deepEqual(failedQuestions, [], "all business questions match the requested intent and metric answer");

const retailColumns = Object.keys(fixtures.retail.rows[0] ?? {});
const assistantAov = answerDatasetQuestionDeterministically({
  question: "What is the average order value?",
  datasetId: "fixture:retail",
  datasetType: "retail",
  columns: retailColumns,
  rows: fixtures.retail.rows,
});
assert.ok(assistantAov, "Dataset assistant answers AOV deterministically");
assert.match(assistantAov.answer, /Average Order Value/i, "Dataset assistant returns AOV instead of revenue summary");
assert.doesNotMatch(assistantAov.answer, /^The selected dataset contains/i, "Dataset assistant does not use generic summary for AOV");

const assistantMissingMargin = answerDatasetQuestionDeterministically({
  question: "What has the highest margin?",
  datasetId: "fixture:missing-margin",
  datasetType: "retail",
  columns: ["order_date", "order_id", "revenue", "customer_id"],
  rows: [{ order_date: "2025-01-01", order_id: "1", revenue: "100", customer_id: "Acme" }],
});
assert.ok(assistantMissingMargin, "Dataset assistant returns a missing-data explanation for uncalculable margin");
assert.match(assistantMissingMargin.answer, /missing/i, "missing margin answer explains required data is missing");
assert.doesNotMatch(assistantMissingMargin.answer, /^The selected dataset contains/i, "missing margin answer does not use generic summary");

const analyticalAov = executeAnalyticalIntent({
  question: "What is the average order value?",
  datasetId: "fixture:retail",
  datasetType: "retail",
  columns: retailColumns,
  rows: fixtures.retail.rows,
});
assert.equal(analyticalAov.status, "success", "legacy analytical registry delegates AOV to the metric resolver");
if (analyticalAov.status === "success") {
  assert.equal(analyticalAov.intent, "average_order_value");
  assert.equal(analyticalAov.result.intent, "metric.average_order_value");
}

process.stdout.write(`ok - Question Intent Engine and Metric Resolver covered ${questionCases.length} business questions with 0 failed questions\n`);
