import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { answerDatasetQuestionDeterministically } from "../../src/lib/data/dataset-assistant-deterministic";
import { answerPrebookkeepingQuestionDeterministically } from "../../src/lib/accountancy/prebookkeeping-ai-assistant";
import type { PrebookkeepingCategorization } from "../../src/lib/accountancy/prebookkeeping-categorization";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

const rows = parseFixtureCsv("startup_saas_sales_dataset.csv");
const columns = Object.keys(rows[0] ?? {});

const proAnswer = answerDatasetQuestionDeterministically({
  question: "plan Pro?",
  datasetId: "fixture:startup-saas",
  datasetType: "standard",
  columns,
  rows,
});

assert.ok(proAnswer, "short plan question receives a deterministic dataset answer");
assert.match(proAnswer.answer, /Pro/, "answer references the requested Pro segment");
assert.match(proAnswer.answer, /8,821/, "answer includes the full grounded Pro revenue total");
assert.doesNotMatch(proAnswer.answer, /\$8,821/, "answer does not assume a currency when the dataset has none");
assert.doesNotMatch(proAnswer.answer, /2025-05/, "answer excludes sparse trailing May 2025 from comparable trend text");

const riskAnswer = answerDatasetQuestionDeterministically({
  question: "What are the biggest revenue risks?",
  datasetId: "fixture:startup-saas",
  datasetType: "standard",
  columns,
  rows,
});

assert.ok(riskAnswer, "revenue risk question receives a deterministic dataset answer");
assert.match(riskAnswer.answer, /2025-03 to 2025-04/, "risk answer compares complete March and April periods");
assert.doesNotMatch(riskAnswer.answer, /2025-05/, "risk answer excludes incomplete May period");
assert.equal(riskAnswer.result.intent, "risk.revenue");
assert.ok(riskAnswer.data.length > 0, "risk answer includes grounded preview rows");

const generalAnswer = answerDatasetQuestionDeterministically({
  question: "revenue growth?",
  datasetId: "fixture:startup-saas",
  datasetType: "standard",
  columns,
  rows,
});

assert.ok(generalAnswer, "short growth question receives a grounded response");
assert.match(generalAnswer.answer, /Revenue/, "growth answer summarizes revenue trend");

const datasetAssistantSource = readFileSync(join(repoRoot, "src", "components", "chat", "ai-assistant-workspace.tsx"), "utf8");
assert.match(datasetAssistantSource, /\/api\/hybrid-ai\/dataset-chat/, "Dataset AI frontend uses the dataset-chat API when a dataset is selected");
assert.match(datasetAssistantSource, /retryQuestion/, "Dataset AI preserves failed questions for retry");
assert.match(datasetAssistantSource, /Retry/, "Dataset AI renders a retry action");
assert.match(datasetAssistantSource, /Dataset assistant issue/, "Dataset AI renders a specific error title");
assert.match(datasetAssistantSource, /PROVIDER_TIMEOUT/, "Dataset AI classifies timeout errors");
assert.match(datasetAssistantSource, /PROVIDER_MISSING/, "Dataset AI classifies missing provider errors");
assert.match(datasetAssistantSource, /INVALID_PROVIDER_RESPONSE/, "Dataset AI classifies invalid provider responses");
assert.doesNotMatch(datasetAssistantSource, />\s*Analysis error\s*</, "Dataset AI does not render the old generic analysis error title");

const datasetRouteSource = readFileSync(join(repoRoot, "src", "app", "api", "hybrid-ai", "dataset-chat", "route.ts"), "utf8");
assert.match(datasetRouteSource, /answerDatasetQuestionDeterministically/, "Dataset AI route uses deterministic dataset answers before provider routing");
assert.match(datasetRouteSource, /datasetType: true/, "Dataset AI route loads the stored dataset type");
assert.match(datasetRouteSource, /DATASET_NOT_FOUND/, "Dataset AI route classifies missing or unauthorized datasets");
assert.match(datasetRouteSource, /EMPTY_DATASET/, "Dataset AI route classifies empty datasets");
assert.match(datasetRouteSource, /resolveDatasetAiProviderSettings/, "Dataset AI route wraps provider mode settings lookup");
assert.match(datasetRouteSource, /listDatasetAiProviders/, "Dataset AI route wraps saved provider lookup");
assert.match(datasetRouteSource, /generateDefaultCloudDatasetAnswer/, "Dataset AI route falls back to default cloud AI for provider-backed selected-dataset questions");
assert.match(datasetRouteSource, /createGoogleGenerativeAI\(\{ apiKey: geminiApiKey \}\)/, "Dataset AI default cloud fallback sends the resolved Gemini key explicitly");
assert.match(datasetRouteSource, /normalizeProviderSecret/, "Dataset AI normalizes quoted or padded provider keys before provider requests");
assert.match(datasetRouteSource, /google\("gemini-2\.5-flash"\)/, "Dataset AI default cloud fallback sends a Gemini provider request");
assert.match(datasetRouteSource, /generateAntigravityCompletion/, "Dataset AI default cloud fallback uses the established Antigravity cloud provider path when direct Gemini env is absent");
assert.match(datasetRouteSource, /datasetId: input\.datasetId/, "Dataset AI default cloud audit preserves the selected dataset id");
assert.match(datasetRouteSource, /contextForClient\(input\.context\)/, "Dataset AI default cloud response returns selected dataset context");
assert.match(datasetRouteSource, /providerName: "Gemini Cloud"[\s\S]*route: "none"/, "Dataset AI reports default cloud provider failures without dropping selected dataset context");
assert.match(datasetRouteSource, /providerErrorDiagnostic/, "Dataset AI reports sanitized cloud provider diagnostics");
assert.ok(
  datasetRouteSource.indexOf("const prebookkeepingCategorization = readPrebookkeepingCategorization") <
    datasetRouteSource.indexOf("const analyticalResult = executeAnalyticalIntent"),
  "Dataset AI routes pre-bookkeeping questions before generic analytical dispatch",
);

const usySource = readFileSync(join(repoRoot, "src", "components", "ui", "help-chatbox.tsx"), "utf8");
assert.match(usySource, /fetch\("\/api\/hybrid-ai\/chat"/, "Usy Bot keeps its separate chat API");
assert.doesNotMatch(usySource, /dataset-chat/, "Usy Bot does not route through the Dataset AI API");

const retailSalesOnlyRows = [
  { order_date: "2025-01-01", product: "Tea", category: "Drinks", sales_amount: "100", quantity: "2" },
  { order_date: "2025-01-02", product: "Coffee", category: "Drinks", sales_amount: "250", quantity: "5" },
];
const retailSalesOnlyExpense = answerDatasetQuestionDeterministically({
  question: "What are my largest expenses?",
  datasetId: "fixture:retail-sales-only",
  datasetType: "retail",
  columns: Object.keys(retailSalesOnlyRows[0] ?? {}),
  rows: retailSalesOnlyRows,
});
assert.ok(retailSalesOnlyExpense, "sales-only retail expense question receives a deterministic refusal");
assert.match(retailSalesOnlyExpense.answer, /No expense or cost data was detected/i, "sales-only answer refuses expense calculation");
assert.doesNotMatch(retailSalesOnlyExpense.answer, /250|350|expenses are|Expenses exceed income/i, "sales-only answer does not fabricate expense totals");
assert.match(retailSalesOnlyExpense.answer, /largest revenue categories|top-selling products|sales trends/i, "sales-only answer offers supported revenue alternatives");

const genericAmountRows = [
  { Date: "2025-01-01", Description: "Opening balance", Amount: "100" },
  { Date: "2025-01-02", Description: "Transfer", Amount: "200" },
];
const genericAmountExpense = answerDatasetQuestionDeterministically({
  question: "Show my biggest costs",
  datasetId: "fixture:generic-amount",
  datasetType: "generic",
  columns: Object.keys(genericAmountRows[0] ?? {}),
  rows: genericAmountRows,
});
assert.ok(genericAmountExpense, "generic amount expense question receives a deterministic refusal");
assert.match(genericAmountExpense.answer, /generic monetary fields.*ambiguous/i, "generic amount answer explains amount is ambiguous");
assert.doesNotMatch(genericAmountExpense.answer, /300|biggest detected expense/i, "generic amount answer does not classify Amount as expense");

const cogsRows = [
  { order_date: "2025-01-01", product: "Tea", revenue: "200", cogs: "80", category: "Drinks" },
  { order_date: "2025-01-02", product: "Coffee", revenue: "300", cogs: "150", category: "Drinks" },
];
const cogsExpense = answerDatasetQuestionDeterministically({
  question: "What are my largest expenses?",
  datasetId: "fixture:cogs",
  datasetType: "retail",
  columns: Object.keys(cogsRows[0] ?? {}),
  rows: cogsRows,
});
assert.ok(cogsExpense, "COGS expense question receives a deterministic answer");
assert.match(cogsExpense.answer, /largest detected expense\/cost/i, "COGS answer calculates cost analysis");
assert.match(cogsExpense.answer, /Cost\/COGS field "cogs"/i, "COGS answer cites cost evidence");

const unitCostRows = [
  { order_date: "2025-01-01", product: "Tea", revenue: "200", unit_cost: "10", quantity: "4" },
  { order_date: "2025-01-02", product: "Coffee", revenue: "300", unit_cost: "20", quantity: "5" },
];
const unitCostExpense = answerDatasetQuestionDeterministically({
  question: "Which category costs the most?",
  datasetId: "fixture:unit-cost",
  datasetType: "retail",
  columns: Object.keys(unitCostRows[0] ?? {}),
  rows: unitCostRows,
});
assert.ok(unitCostExpense, "Unit Cost expense question receives a deterministic answer");
assert.match(unitCostExpense.answer, /100/, "Unit Cost answer multiplies validated unit cost by quantity for the top ranked row");

const typedExpenseRows = [
  { Date: "2025-01-01", Description: "Client invoice", Type: "Income", Category: "Consulting", Amount: "500" },
  { Date: "2025-01-02", Description: "Hosting", Type: "Expense", Category: "Software", Amount: "120" },
  { Date: "2025-01-03", Description: "Ads", Type: "Expense", Category: "Marketing", Amount: "300" },
];
const typedExpense = answerDatasetQuestionDeterministically({
  question: "What am I spending most on?",
  datasetId: "fixture:typed-expense",
  datasetType: "accounting",
  columns: Object.keys(typedExpenseRows[0] ?? {}),
  rows: typedExpenseRows,
});
assert.ok(typedExpense, "transaction type expense question receives a deterministic answer");
assert.match(typedExpense.answer, /Marketing.*300|300.*Marketing/i, "typed expense answer uses Type = Expense rows");
assert.match(typedExpense.answer, /Classifier field "Type"/i, "typed expense answer cites classifier evidence");

const prebookkeepingGenericExpense = answerPrebookkeepingQuestionDeterministically({
  question: "What are my largest expenses?",
  categorization: prebookkeepingFixture([
    { rowIndex: 0, description: "Transfer", amount: -100, category: "operating_expenses", reasons: ["negative amount"] },
    { rowIndex: 1, description: "Transfer 2", amount: -200, category: "operating_expenses", reasons: ["negative amount"] },
  ]),
});
assert.match(prebookkeepingGenericExpense.answer, /No expense or cost data was detected/i, "pre-bookkeeping generic negative amounts do not become expenses");
assert.doesNotMatch(prebookkeepingGenericExpense.answer, /300|Expenses exceed income/i, "pre-bookkeeping generic answer does not fabricate expense totals");

const prebookkeepingTypedExpense = answerPrebookkeepingQuestionDeterministically({
  question: "What are my largest expenses?",
  categorization: prebookkeepingFixture([
    { rowIndex: 0, description: "Client invoice", amount: 500, category: "revenue", sourceCategory: "Income", reasons: ["revenue keyword"] },
    { rowIndex: 1, description: "Hosting", amount: -120, debit: 120, category: "operating_expenses", sourceCategory: "Expense", reasons: ["operating expense keyword"] },
  ]),
});
assert.match(prebookkeepingTypedExpense.answer, /Operating Expenses.*120/i, "pre-bookkeeping explicit expense category still works");

const largestTransactionRows = [
  { Date: "2025-02-01", Description: "Coffee", Amount: "12", Quantity: "20" },
  { Date: "2025-02-02", Description: "Protein Bar", Amount: "678.37", Quantity: "1" },
  { Date: "2025-02-03", Description: "Tea", Amount: "9", Quantity: "30" },
];
const largestTransaction = answerDatasetQuestionDeterministically({
  question: "What is the largest transaction?",
  datasetId: "fixture:largest-transaction",
  datasetType: "generic",
  columns: Object.keys(largestTransactionRows[0] ?? {}),
  rows: largestTransactionRows,
});
assert.ok(largestTransaction, "largest transaction question receives a deterministic ranking");
assert.equal(largestTransaction.result.intent, "largest_transactions");
assert.match(largestTransaction.answer, /largest transaction.*Protein Bar/i, "largest transaction answer names the largest row");
assert.doesNotMatch(largestTransaction.answer, /statistically unusual|outlier candidate|suspicious|fraud/i, "largest transaction answer does not use anomaly or fraud language");

const anomalyRows = [
  ...[10, 11, 12, 12, 13, 14, 15, 16, 18].map((amount, index) => ({ Date: `2025-03-${String(index + 1).padStart(2, "0")}`, Description: `Regular ${index + 1}`, Amount: String(amount), Quantity: "50" })),
  { Date: "2025-03-10", Description: "Protein Bar", Amount: "678.37", Quantity: "1", Category: "Food" },
  { Date: "2025-03-11", Description: "Malformed row", Amount: "not available", Quantity: "99", Category: "Food" },
];
const unusualTransactions = answerDatasetQuestionDeterministically({
  question: "Are there unusual transactions this period?",
  datasetId: "fixture:unusual-transactions",
  datasetType: "generic",
  columns: Object.keys(anomalyRows[0] ?? {}),
  rows: anomalyRows,
});
assert.ok(unusualTransactions, "unusual transaction question receives deterministic anomaly analysis");
assert.equal(unusualTransactions.result.intent, "unusual_transactions");
assert.notEqual(unusualTransactions.result.intent, "largest_transactions", "unusual transaction question does not route to largest transaction ranking");
assert.match(unusualTransactions.answer, /statistically unusual/i, "unusual answer identifies statistical anomaly candidates");
assert.match(unusualTransactions.answer, /Median transaction/i, "unusual answer includes median evidence");
assert.match(unusualTransactions.answer, /Upper outlier threshold/i, "unusual answer includes threshold evidence");
assert.match(unusualTransactions.answer, /Protein Bar/i, "unusual answer includes flagged transaction context");
assert.match(unusualTransactions.answer, /invalid or blank/i, "unusual answer reports malformed value exclusion");
assert.doesNotMatch(unusualTransactions.answer, /fraud|suspicious payment/i, "unusual answer does not imply fraud");

const noOutlierRows = [10, 11, 12, 12, 13, 14, 15, 16, 17, 18].map((amount, index) => ({
  Date: `2025-04-${String(index + 1).padStart(2, "0")}`,
  Description: `Normal ${index + 1}`,
  Amount: String(amount),
}));
const noOutliers = answerDatasetQuestionDeterministically({
  question: "Any anomalies?",
  datasetId: "fixture:no-outliers",
  datasetType: "generic",
  columns: Object.keys(noOutlierRows[0] ?? {}),
  rows: noOutlierRows,
});
assert.ok(noOutliers, "no-outlier dataset receives a deterministic anomaly answer");
assert.match(noOutliers.answer, /didn't detect any strong transaction-amount outliers/i, "no-outlier answer clearly says no strong outliers");
assert.match(noOutliers.answer, /does not exceed the anomaly threshold/i, "no-outlier answer distinguishes largest from unusual");

const insufficientAnomalies = answerDatasetQuestionDeterministically({
  question: "Anything unusual in these transactions?",
  datasetId: "fixture:small-anomaly-sample",
  datasetType: "generic",
  columns: Object.keys(largestTransactionRows[0] ?? {}),
  rows: largestTransactionRows,
});
assert.ok(insufficientAnomalies, "small dataset receives insufficient-data anomaly answer");
assert.match(insufficientAnomalies.answer, /not enough valid transaction amounts/i, "small dataset does not claim anomaly certainty");
assert.match(insufficientAnomalies.answer, /largest transaction/i, "small dataset can still mention largest transaction as largest only");

const amountVsQuantity = answerDatasetQuestionDeterministically({
  question: "Are there unusual payments?",
  datasetId: "fixture:amount-vs-quantity",
  datasetType: "generic",
  columns: Object.keys(anomalyRows[0] ?? {}),
  rows: anomalyRows,
});
assert.ok(amountVsQuantity, "amount and quantity dataset receives anomaly answer");
assert.equal(amountVsQuantity.result.amountColumn, "Amount", "anomaly analysis uses Amount instead of Quantity");

const idOnlyRows = Array.from({ length: 10 }, (_, index) => ({
  TransactionID: String(1000 + index),
  CustomerID: String(9000 + index),
  Quantity: String(index + 1),
}));
const idOnlyAnomalies = answerDatasetQuestionDeterministically({
  question: "Are there abnormal transaction amounts?",
  datasetId: "fixture:id-only",
  datasetType: "generic",
  columns: Object.keys(idOnlyRows[0] ?? {}),
  rows: idOnlyRows,
});
assert.ok(idOnlyAnomalies, "numeric ID dataset receives missing amount answer");
assert.match(idOnlyAnomalies.answer, /no validated transaction amount field/i, "numeric IDs are not treated as transaction values");

const suspiciousQuestion = answerDatasetQuestionDeterministically({
  question: "Are there suspicious transactions?",
  datasetId: "fixture:suspicious-wording",
  datasetType: "generic",
  columns: Object.keys(anomalyRows[0] ?? {}),
  rows: anomalyRows,
});
assert.ok(suspiciousQuestion, "suspicious wording routes to evidence-based anomaly analysis");
assert.match(suspiciousQuestion.answer, /statistical outlier candidates/i, "suspicious wording is softened to statistical outlier language");
assert.doesNotMatch(suspiciousQuestion.answer, /fraudulent|likely fraud|suspicious payment/i, "suspicious wording does not create fraud claims");

const prebookkeepingUnusual = answerPrebookkeepingQuestionDeterministically({
  question: "Are there unusual transactions this period?",
  categorization: prebookkeepingFixture([
    ...[10, 11, 12, 12, 13, 14, 15, 16, 18].map((amount, index) => ({ rowIndex: index, description: `Regular ${index + 1}`, amount, category: "other" as const })),
    { rowIndex: 10, description: "Protein Bar", amount: 678.37, category: "other", sourceCategory: "Food" },
  ]),
});
assert.match(prebookkeepingUnusual.answer, /statistical outlier candidates|unusually large/i, "pre-bookkeeping unusual question uses anomaly evidence");
assert.match(prebookkeepingUnusual.answer, /Median transaction/i, "pre-bookkeeping unusual answer includes median evidence");
assert.doesNotMatch(prebookkeepingUnusual.answer, /Large and low-confidence/i, "pre-bookkeeping unusual answer removes unsupported low-confidence takeaway");

process.stdout.write("ok - dataset AI assistant deterministic responses and Usy isolation\n");

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

function prebookkeepingFixture(
  rows: Array<Partial<PrebookkeepingCategorization["transactions"][number]>>,
): PrebookkeepingCategorization {
  const transactions = rows.map((row, index) => ({
    rowIndex: row.rowIndex ?? index,
    transactionDate: row.transactionDate ?? "2025-01-01",
    description: row.description ?? null,
    supplierCustomer: row.supplierCustomer ?? null,
    debit: row.debit ?? null,
    credit: row.credit ?? null,
    amount: row.amount ?? null,
    currency: row.currency ?? "EUR",
    vatTax: row.vatTax ?? null,
    category: row.category ?? "uncategorized",
    suggestedCategory: row.suggestedCategory ?? null,
    sourceCategory: row.sourceCategory ?? null,
    invoiceReference: row.invoiceReference ?? null,
    confidence: row.confidence ?? 0.8,
    reasons: row.reasons ?? [],
    reviewed: row.reviewed ?? false,
    needsReview: row.needsReview ?? false,
    reviewStatus: row.reviewStatus ?? "pending",
    duplicateStatus: row.duplicateStatus ?? "none",
    vatStatus: row.vatStatus ?? "missing",
    vatRate: row.vatRate ?? null,
    vatConfidence: row.vatConfidence ?? 0,
    vatReason: row.vatReason ?? null,
    vatBusinessRule: row.vatBusinessRule ?? null,
    vatSource: row.vatSource ?? null,
    vatNeedsReview: row.vatNeedsReview ?? false,
    isLargeTransaction: row.isLargeTransaction ?? false,
    autoReviewed: row.autoReviewed ?? false,
    autoReviewReason: row.autoReviewReason ?? null,
    autoReviewEvidence: row.autoReviewEvidence ?? [],
    autoReviewBusinessRule: row.autoReviewBusinessRule ?? null,
    autoReviewCalculationSource: row.autoReviewCalculationSource ?? null,
    autoReviewProviderSource: row.autoReviewProviderSource ?? null,
    reviewDecision: row.reviewDecision ?? null,
    riskScore: row.riskScore ?? 0,
    reviewBlockers: row.reviewBlockers ?? [],
  }));
  const incomeTotal = transactions.filter((row) => row.category === "revenue").reduce((sum, row) => sum + Math.max(row.amount ?? 0, 0), 0);
  const expenseTotal = transactions.filter((row) => ["operating_expenses", "payroll", "fixed_costs", "taxes", "bank_fees"].includes(row.category)).reduce((sum, row) => sum + Math.abs(row.amount ?? row.debit ?? 0), 0);
  return {
    status: "ready_for_review",
    generatedAt: "2026-08-09T00:00:00.000Z",
    rowCount: transactions.length,
    categorizedCount: transactions.filter((row) => row.category !== "uncategorized").length,
    uncategorizedCount: transactions.filter((row) => row.category === "uncategorized").length,
    incomeTotal,
    expenseTotal,
    vatTaxSummary: { total: 0, rowsWithTax: 0 },
    possibleDuplicates: [],
    missingDataWarnings: [],
    columns: { transactionDate: "Date", description: "Description", supplierCustomer: null, debit: null, credit: null, amount: "Amount", currency: null, vatTax: null, category: "Type", invoiceReference: null },
    categoryCounts: {
      revenue: transactions.filter((row) => row.category === "revenue").length,
      operating_expenses: transactions.filter((row) => row.category === "operating_expenses").length,
      payroll: 0,
      fixed_costs: 0,
      taxes: 0,
      bank_fees: 0,
      transfers: 0,
      assets: 0,
      liabilities: 0,
      equity: 0,
      other: 0,
      uncategorized: transactions.filter((row) => row.category === "uncategorized").length,
    },
    reviewSummary: {
      transactionsAnalyzed: transactions.length,
      categorizedAutomatically: transactions.length,
      requiresReview: 0,
      possibleDuplicatesDetected: 0,
      missingDataWarnings: 0,
      vatMissingPercent: 0,
      confidenceScore: 80,
      reviewedCount: 0,
      reviewProgressPercent: 0,
      totalCount: transactions.length,
      progress: 0,
      status: "ready_for_review",
      manualCorrections: 0,
      averageVatConfidence: 0,
      defaultVatRate: null,
      businessCountry: null,
      confidenceDistribution: { high: 0, medium: transactions.length, low: 0 },
      autoReviewedCount: 0,
      needsReviewCount: 0,
      riskDistribution: { low: transactions.length, medium: 0, high: 0 },
      thresholdConfig: { autoReview: 0.95, suggestedReview: 0.8, manualReview: 0 },
    },
    taxProfile: {
      taxCountry: null,
      vatRegistered: null,
      defaultVatRate: null,
      reducedVatRate: null,
      zeroVatRate: null,
      reverseChargeEnabled: false,
      fiscalYear: null,
      currency: null,
      taxRegime: null,
      businessType: null,
      availableRates: [],
      source: "business_profile",
    },
    recommendations: [],
    transactions,
    thresholdConfig: { autoReview: 0.95, suggestedReview: 0.8, manualReview: 0 },
  };
}
