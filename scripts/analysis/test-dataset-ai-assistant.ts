import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  answerDatasetQuestionDeterministically,
  canAnswerDatasetSuggestionDeterministically,
} from "../../src/lib/data/dataset-assistant-deterministic";
import { answerPrebookkeepingQuestionDeterministically } from "../../src/lib/accountancy/prebookkeeping-ai-assistant";
import type { PrebookkeepingCategorization } from "../../src/lib/accountancy/prebookkeeping-categorization";
import {
  availableAnalyticalSuggestions,
  executeAnalyticalIntent,
} from "../../src/lib/data/analytical-intents";
import {
  buildDatasetIntelligenceEngine,
  buildSaasAssistantSummary,
} from "../../src/lib/data/dataset-intelligence-engine";
import {
  buildDatasetIntelligence,
  fallbackSuggestionsForDatasetType,
  generateSuggestions,
} from "../../src/lib/data/dataset-intelligence";

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
const accuracyDisclaimerSource = readFileSync(join(repoRoot, "src", "components", "chat", "ai-accuracy-disclaimer.tsx"), "utf8");
const disclaimerSurfaces = [
  "src/components/chat/ai-assistant-workspace.tsx",
  "src/components/ui/help-chatbox.tsx",
  "src/components/chat/ai-chat-interface.tsx",
  "src/components/chat/chat-panel.tsx",
  "src/components/chat/clevr-chat.tsx",
  "src/components/modals/dataset-modal.tsx",
  "src/components/hybrid-ai/byoai-hybrid-chat.tsx",
  "src/components/hybrid-ai/useclevr-hybrid-ai-chat-panel.tsx",
  "src/app/report/[id]/page.tsx",
];
assert.match(
  accuracyDisclaimerSource,
  /UseClevr AI can make mistakes\. Verify important business and financial information\./,
  "AI accuracy disclaimer uses the approved concise product wording",
);
assert.doesNotMatch(accuracyDisclaimerSource, /WARNING|DANGER|DO NOT TRUST AI/, "AI accuracy disclaimer avoids alarming warning language");
for (const relativePath of disclaimerSurfaces) {
  const surfaceSource = readFileSync(join(repoRoot, relativePath), "utf8");
  assert.match(surfaceSource, /AiAccuracyDisclaimer/, `${relativePath} renders the shared AI accuracy disclaimer`);
  assert.doesNotMatch(
    surfaceSource,
    /UseClevr AI can make mistakes\. Verify important business and financial information\./,
    `${relativePath} does not duplicate the disclaimer wording`,
  );
}
assert.match(datasetAssistantSource, /\/api\/hybrid-ai\/dataset-chat/, "Dataset AI frontend uses the dataset-chat API when a dataset is selected");
assert.match(datasetAssistantSource, /retryQuestion/, "Dataset AI preserves failed questions for retry");
assert.match(datasetAssistantSource, /Retry/, "Dataset AI renders a retry action");
assert.match(datasetAssistantSource, /Dataset assistant issue/, "Dataset AI renders a specific error title");
assert.doesNotMatch(datasetAssistantSource, /window\.(prompt|confirm|alert)/, "Dataset AI Human Control edit does not use browser dialogs");
assert.match(datasetAssistantSource, /<Dialog open=\{Boolean\(responseEditor\)\}/, "Dataset AI Human Control edit opens a real dialog");
assert.match(datasetAssistantSource, /Edit AI response/, "Dataset AI edit dialog uses the approved title");
assert.match(datasetAssistantSource, /Review and edit this response before saving it\./, "Dataset AI edit dialog uses the approved helper text");
assert.match(datasetAssistantSource, /<textarea[\s\S]*value=\{responseEditor\?\.draft \?\? ""\}/, "Dataset AI edit dialog preloads the complete editable response");
assert.match(datasetAssistantSource, /originalValue: responseEditor\.message\.content[\s\S]*editedValue: responseEditor\.draft/, "Dataset AI edit save sends original and edited values to the override API");
assert.match(datasetAssistantSource, /setMessages\(\(current\) => current\.map/, "Dataset AI edit save updates the displayed assistant message");
assert.match(datasetAssistantSource, /setOverrideMap\(\(prev\) => \(\{ \.\.\.prev, \[editedMessageId\]: "edit" \}\)\)/, "Dataset AI marks Human Control Edit only after save");
assert.match(datasetAssistantSource, /disabled=\{savingResponseEdit \|\| !responseEditor\?\.draft\.trim\(\)\}/, "Dataset AI disables Save during empty or saving edit states");
assert.doesNotMatch(datasetAssistantSource, /fallback-\$\{selectedDatasetId\}/, "Selected-dataset suggestions do not use client-side generic fallback buttons");
assert.match(datasetAssistantSource, /SUGGESTION_CLIENT_CACHE_VERSION = "v5"/, "Selected-dataset suggestion memory cache uses the current semantic cache version");
assert.match(datasetAssistantSource, /SUGGESTION_CLIENT_CACHE_VERSION\}:\$\{selectedDatasetId\}/, "Selected-dataset suggestion memory cache is dataset-specific and semantic-version-specific");
assert.match(datasetAssistantSource, /No supported suggested questions are available for this dataset yet\. You can still ask a question below\./, "Selected-dataset suggestions show a neutral empty state when the server returns no supported questions");
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
assert.ok(
  datasetRouteSource.indexOf("let deterministicResult: DatasetAssistantDeterministicResult | null = answerDatasetQuestionDeterministically") <
    datasetRouteSource.indexOf("const analyticalResult = executeAnalyticalIntent"),
  "Dataset AI checks Marketplace deterministic answers before generic analytical dispatch",
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

const retailInventoryRows = [
  { date: "2025-01-01", product: "Coffee", category: "Drinks", supplier: "Acme", revenue: "400", units_sold: "40", stock_on_hand: "30", reorder_point: "20", unit_cost: "4" },
  { date: "2025-02-01", product: "Coffee", category: "Drinks", supplier: "Acme", revenue: "500", units_sold: "50", stock_on_hand: "12", reorder_point: "20", unit_cost: "4" },
  { date: "2025-01-01", product: "Tea", category: "Drinks", supplier: "Garden", revenue: "300", units_sold: "30", stock_on_hand: "80", reorder_point: "15", unit_cost: "2" },
  { date: "2025-02-01", product: "Tea", category: "Drinks", supplier: "Garden", revenue: "20", units_sold: "2", stock_on_hand: "96", reorder_point: "15", unit_cost: "2" },
  { date: "2025-01-01", product: "Mug", category: "Accessories", supplier: "ClayCo", revenue: "0", units_sold: "0", stock_on_hand: "25", reorder_point: "5", unit_cost: "6" },
  { date: "2025-02-01", product: "Mug", category: "Accessories", supplier: "ClayCo", revenue: "0", units_sold: "0", stock_on_hand: "25", reorder_point: "5", unit_cost: "6" },
];
const retailColumns = Object.keys(retailInventoryRows[0] ?? {});
const retailSuggestedQuestions = [
  "What are the top selling products?",
  "Which products are low stock items?",
  "Which products are dead stock products?",
  "What is the current inventory valuation?",
  "Which products need reorder recommendations?",
  "Which products have the highest margin?",
  "Which suppliers drive the most revenue or risk?",
  "What are the revenue trends over time?",
  "Which products are slow moving inventory?",
  "What cash-flow risks are created by inventory and stock levels?",
  "Which categories generate the most gross profit?",
  "Which SKUs should be discounted, bundled, or stopped?",
];
for (const question of retailSuggestedQuestions) {
  const answer = answerDatasetQuestionDeterministically({
    question,
    datasetId: "fixture:retail-inventory",
    datasetType: "Retail",
    columns: retailColumns,
    rows: retailInventoryRows,
  });
  assert.ok(answer, `${question} receives a deterministic retail answer`);
  assert.match(String(answer.result.intent), /^retail_inventory\./, `${question} uses the retail inventory deterministic route`);
  assert.match(answer.answer, /No provider-generated values were used|will not .* route .* provider/i, `${question} does not need provider routing`);
  assert.notEqual(answer.result.status, "missing_evidence", `${question} has sufficient fixture evidence`);
}

const deadStock = answerDatasetQuestionDeterministically({
  question: "Which products are dead stock products?",
  datasetId: "fixture:retail-inventory",
  datasetType: "Retail",
  columns: retailColumns,
  rows: retailInventoryRows,
});
assert.ok(deadStock, "dead stock production wording receives a deterministic answer");
assert.match(deadStock.answer, /Mug/i, "dead stock answer names product-level evidence");
assert.match(deadStock.answer, /25 units on hand|stock.*25/i, "dead stock answer includes stock evidence");

const inventoryWithoutUnitCostRows = retailInventoryRows.map(({ unit_cost: _unitCost, ...row }) => row);
const inventoryWithoutUnitCost = answerDatasetQuestionDeterministically({
  question: "What is the current inventory valuation?",
  datasetId: "fixture:retail-missing-cost",
  datasetType: "Retail",
  columns: Object.keys(inventoryWithoutUnitCostRows[0] ?? {}),
  rows: inventoryWithoutUnitCostRows,
});
assert.ok(inventoryWithoutUnitCost, "inventory valuation without unit cost receives a deterministic missing-evidence answer");
assert.equal(inventoryWithoutUnitCost.result.status, "missing_evidence");
assert.match(inventoryWithoutUnitCost.answer, /unit cost/i, "inventory valuation refuses when unit cost evidence is missing");
assert.match(inventoryWithoutUnitCost.answer, /will not substitute arbitrary numeric columns or route this deterministic retail KPI to a provider/i);
assert.equal(canAnswerDatasetSuggestionDeterministically({
  question: "What is the current inventory valuation?",
  datasetId: "fixture:retail-missing-cost",
  datasetType: "Retail",
  columns: Object.keys(inventoryWithoutUnitCostRows[0] ?? {}),
  rows: inventoryWithoutUnitCostRows,
}), false, "unsupported retail valuation is excluded from generated suggestions");
assert.equal(canAnswerDatasetSuggestionDeterministically({
  question: "Which products are dead stock products?",
  datasetId: "fixture:retail-inventory",
  datasetType: "Retail",
  columns: retailColumns,
  rows: retailInventoryRows,
}), true, "supported dead-stock question is allowed as a suggestion");

const marketplaceRows = parseRootCsv("test-fixtures/business-models/04_marketplace_startup.csv");
const marketplaceColumns = Object.keys(marketplaceRows[0] ?? {});
const marketplaceQuestions = [
  "What is the total revenue?",
  "What are the revenue trends over time?",
  "Which customers generate the most revenue?",
  "Which suppliers drive the most revenue or risk?",
];
const marketplaceAnswers = marketplaceQuestions.map((question) => {
  const answer = answerDatasetQuestionDeterministically({
    question,
    datasetId: "fixture:04-marketplace-startup",
    datasetType: "Marketplace",
    columns: marketplaceColumns,
    rows: marketplaceRows,
  });
  assert.ok(answer, `${question} receives a Marketplace deterministic answer`);
  assert.equal(answer.status, "success", `${question} succeeds through the deterministic assistant`);
  assert.match(String(answer.result.intent), /^marketplace\./, `${question} uses the Marketplace route`);
  assert.doesNotMatch(answer.answer, /PROVIDER_UNAVAILABLE|AI_PROVIDER_ERROR|unsupported_question|provider route is unavailable/i, `${question} does not route to provider failure`);
  assert.doesNotMatch(answer.answer, /leading supplier signal|inventory exposure at 0|Total revenue is/i, `${question} avoids stale retail/generic wording`);
  return { question, answer };
});
const marketplaceTotal = marketplaceAnswers.find((entry) => entry.question === "What is the total revenue?")?.answer;
assert.ok(marketplaceTotal);
assert.equal(marketplaceTotal.result.intent, "marketplace.total_gmv");
assert.equal(marketplaceTotal.result.gmv, 83778.17);
assert.equal(marketplaceTotal.result.gmvColumn, "gross_merchandise_value");
assert.match(marketplaceTotal.answer, /Total GMV is 83,778\.17/);
assert.doesNotMatch(marketplaceTotal.answer, /Total revenue is/i);

const marketplaceTrend = marketplaceAnswers.find((entry) => entry.question === "What are the revenue trends over time?")?.answer;
assert.ok(marketplaceTrend);
assert.equal(marketplaceTrend.result.intent, "marketplace.gmv_trend");
assert.equal(marketplaceTrend.result.latestObservedPeriod, "2026-04");
assert.match(marketplaceTrend.answer, /Latest observed GMV is 20,944\.44 in 2026-04/);
assert.match(marketplaceTrend.answer, /complete|partial\/incomplete/);

const marketplacePartialRows = [
  { date: "2026-03-01", transaction_id: "M-1", buyer_id: "B-1", seller_id: "S-1", gross_merchandise_value: "100", platform_fee: "12" },
  { date: "2026-03-02", transaction_id: "M-2", buyer_id: "B-2", seller_id: "S-1", gross_merchandise_value: "200", platform_fee: "24" },
  { date: "2026-04-01", transaction_id: "M-3", buyer_id: "B-1", seller_id: "S-2", gross_merchandise_value: "50", platform_fee: "6" },
];
const marketplacePartialColumns = Object.keys(marketplacePartialRows[0] ?? {});
const marketplaceStandardTotal = executeAnalyticalIntent({
  question: "What is the total revenue?",
  datasetId: "fixture:standard-marketplace",
  datasetType: "standard",
  columns: marketplacePartialColumns,
  rows: marketplacePartialRows,
});
assert.equal(marketplaceStandardTotal.status, "success");
if (marketplaceStandardTotal.status === "success") {
  assert.match(marketplaceStandardTotal.answer, /Total GMV is 350/);
  assert.doesNotMatch(marketplaceStandardTotal.answer, /Total revenue is|Marketplace Revenue is/);
}
const marketplaceStandardTrend = executeAnalyticalIntent({
  question: "What are the revenue trends over time?",
  datasetId: "fixture:standard-marketplace",
  datasetType: "standard",
  columns: marketplacePartialColumns,
  rows: marketplacePartialRows,
});
assert.equal(marketplaceStandardTrend.status, "success");
if (marketplaceStandardTrend.status === "success") {
  assert.match(marketplaceStandardTrend.answer, /April 2026 is the latest observed period and appears partial/);
  assert.match(marketplaceStandardTrend.answer, /March 2026 is the latest complete comparable period/);
  assert.match(marketplaceStandardTrend.answer, /Latest Monthly GMV is 50 in 2026-04/);
}
const marketplaceStandardBuyers = executeAnalyticalIntent({
  question: "Which customers generate the most revenue?",
  datasetId: "fixture:standard-marketplace",
  datasetType: "standard",
  columns: marketplacePartialColumns,
  rows: marketplacePartialRows,
});
assert.equal(marketplaceStandardBuyers.status, "success");
if (marketplaceStandardBuyers.status === "success") {
  assert.match(marketplaceStandardBuyers.answer, /Top buyers\/customers by GMV/);
  assert.match(marketplaceStandardBuyers.answer, /detected GMV/);
  assert.equal((marketplaceStandardBuyers.data as Array<Record<string, unknown>>)[0]?.gmv, 200);
  assert.equal((marketplaceStandardBuyers.data as Array<Record<string, unknown>>)[0]?.revenue, undefined);
}

const marketplaceBuyers = marketplaceAnswers.find((entry) => entry.question === "Which customers generate the most revenue?")?.answer;
assert.ok(marketplaceBuyers);
assert.equal(marketplaceBuyers.result.intent, "marketplace.top_buyers");
assert.equal(marketplaceBuyers.result.groupColumn, "buyer_id");
assert.equal((marketplaceBuyers.result.rows as Array<{ segment: string; gmv: number }>)[0]?.segment, "buyer_007");
assert.equal((marketplaceBuyers.result.rows as Array<{ segment: string; gmv: number }>)[0]?.gmv, 930.88);
assert.match(marketplaceBuyers.answer, /Top buyers\/customers by GMV/);

const marketplaceSellers = marketplaceAnswers.find((entry) => entry.question === "Which suppliers drive the most revenue or risk?")?.answer;
assert.ok(marketplaceSellers);
assert.equal(marketplaceSellers.result.intent, "marketplace.top_sellers");
assert.equal(marketplaceSellers.result.groupColumn, "seller_id");
assert.equal((marketplaceSellers.result.rows as Array<{ segment: string; gmv: number; inventoryExposure: null; stock: null }>)[0]?.segment, "seller_005");
assert.equal((marketplaceSellers.result.rows as Array<{ segment: string; gmv: number; inventoryExposure: null; stock: null }>)[0]?.gmv, 1861.75);
assert.equal((marketplaceSellers.result.rows as Array<{ segment: string; gmv: number; inventoryExposure: null; stock: null }>)[0]?.inventoryExposure, null);
assert.equal((marketplaceSellers.result.rows as Array<{ segment: string; gmv: number; inventoryExposure: null; stock: null }>)[0]?.stock, null);
assert.match(marketplaceSellers.answer, /Top sellers\/merchants by GMV/);
assert.match(marketplaceSellers.answer, /Inventory exposure is unavailable/);
assert.doesNotMatch(marketplaceSellers.answer, /supplier signal|0 inventory exposure/i);

const mrrMovementRows = buildMrrMovementRows();
const mrrMovementColumns = Object.keys(mrrMovementRows[0] ?? {});
const mrrMovementSuggestions = [
  ...new Set([
    ...availableAnalyticalSuggestions({
      datasetId: "fixture:saas-mrr-movement",
      datasetType: "SaaS",
      columns: mrrMovementColumns,
      rows: mrrMovementRows,
    }),
    ...generateSuggestions(buildDatasetIntelligence(mrrMovementRows), "saas_subscription_mrr_movements_test"),
    ...fallbackSuggestionsForDatasetType("SaaS"),
  ]),
].filter((question) => canAnswerDatasetSuggestionDeterministically({
  question,
  datasetId: "fixture:saas-mrr-movement",
  datasetType: "SaaS",
  columns: mrrMovementColumns,
  rows: mrrMovementRows,
})).slice(0, 12);

assert.ok(mrrMovementSuggestions.length >= 9, "SaaS MRR movement fixture returns a useful deterministic suggestion set");
for (const expectedQuestion of [
  "What is the current MRR?",
  "What changed in MRR across the available periods?",
  "What is the current ARR?",
  "How much New MRR is in the data?",
  "How much Expansion MRR is in the data?",
  "How much Contraction MRR is in the data?",
  "How much Churned MRR is in the data?",
  "What is the net MRR movement?",
  "How many active customers are represented?",
  "What churn signal is visible in the source data?",
]) {
  assert.ok(mrrMovementSuggestions.includes(expectedQuestion), `${expectedQuestion} is shown for the SaaS MRR movement fixture`);
}
for (const invalidGenericQuestion of [
  "What risks does this data reveal?",
  "Which segments need attention?",
  "What actions should I take next?",
  "What should I compare against the previous period?",
]) {
  assert.ok(!mrrMovementSuggestions.includes(invalidGenericQuestion), `${invalidGenericQuestion} is not shown as a stale generic fallback`);
}
for (const question of mrrMovementSuggestions) {
  const answer = answerDatasetQuestionDeterministically({
    question,
    datasetId: "fixture:saas-mrr-movement",
    datasetType: "SaaS",
    columns: mrrMovementColumns,
    rows: mrrMovementRows,
  });
  assert.ok(answer, `${question} receives a deterministic SaaS answer`);
  assert.match(String(answer.result.intent), /^saas\./, `${question} uses the SaaS deterministic route`);
  assert.equal(answer.result.status, "success", `${question} has sufficient SaaS fixture evidence`);
  assert.doesNotMatch(answer.answer, /PROVIDER_UNAVAILABLE|AI_PROVIDER_ERROR|unsupported_question|provider route is unavailable/i, `${question} does not fail through provider routing`);
  assert.match(answer.answer, /no provider-generated values|works without any cloud AI provider|without any cloud AI provider|no provider interpretation|no provider-generated values/i, `${question} states direct data analysis`);
}

const mrrAnswer = answerDatasetQuestionDeterministically({
  question: "What is the current MRR?",
  datasetId: "fixture:saas-mrr-movement",
  datasetType: "SaaS",
  columns: mrrMovementColumns,
  rows: mrrMovementRows,
});
assert.ok(mrrAnswer, "current MRR question receives a deterministic SaaS answer");
assert.match(mrrAnswer.answer, /\$372,136/, "current MRR answer uses latest-period active MRR-after values");

const arrAnswer = answerDatasetQuestionDeterministically({
  question: "What is the current ARR?",
  datasetId: "fixture:saas-mrr-movement",
  datasetType: "SaaS",
  columns: mrrMovementColumns,
  rows: mrrMovementRows,
});
assert.ok(arrAnswer, "current ARR question receives a deterministic SaaS answer");
assert.match(arrAnswer.answer, /\$4,465,632/, "current ARR answer annualizes validated MRR");

const churnSignalAnswer = answerDatasetQuestionDeterministically({
  question: "What churn signal is visible in the source data?",
  datasetId: "fixture:saas-mrr-movement",
  datasetType: "SaaS",
  columns: mrrMovementColumns,
  rows: mrrMovementRows,
});
assert.ok(churnSignalAnswer, "churn-signal question receives a deterministic SaaS answer");
assert.equal(churnSignalAnswer.result.intent, "saas.churn_signal");
assert.equal(churnSignalAnswer.result.status, "success");
assert.match(churnSignalAnswer.answer, /Churned MRR is \$643/, "churn-signal answer returns actual churned MRR");
assert.match(churnSignalAnswer.answer, /Churn events: 1/, "churn-signal answer returns churn event evidence");
assert.match(churnSignalAnswer.answer, /Churned customers: 1/, "churn-signal answer returns churned customer evidence");
assert.match(churnSignalAnswer.answer, /Period with highest churn: 2025-12-01 \(\$643\)/, "churn-signal answer identifies the highest churn period");
assert.match(churnSignalAnswer.answer, /Source fields: .*movement_type.*mrr_delta.*mrr_before.*mrr_after.*customer_id.*event_date.*customer_status/, "churn-signal answer lists validated source fields");
assert.match(churnSignalAnswer.answer, /contraction is kept separate from full churn/i, "churn-signal answer does not label contraction as churn");
assert.doesNotMatch(churnSignalAnswer.answer, /UseClevr found \d+ SaaS semantic fields/, "churn-signal answer does not fall back to the generic SaaS capability response");
assert.doesNotMatch(churnSignalAnswer.answer, /PROVIDER_UNAVAILABLE|AI_PROVIDER_ERROR|unsupported_question|provider route is unavailable/i, "churn-signal answer does not fail through provider routing");

const activeCustomersAnswer = answerDatasetQuestionDeterministically({
  question: "How many active customers are represented?",
  datasetId: "fixture:saas-mrr-movement",
  datasetType: "SaaS",
  columns: mrrMovementColumns,
  rows: mrrMovementRows,
});
assert.ok(activeCustomersAnswer, "active-customer question receives a deterministic SaaS answer");
assert.match(activeCustomersAnswer.answer, /123 active customers/, "active customers use distinct latest customer state and exclude churned customers");
assert.equal(activeCustomersAnswer.result.customers, 123, "active customers do not double-count duplicate movement rows");
assert.match(mrrAnswer.answer, /\$372,136/, "current MRR does not double-count duplicate movement rows for one customer");

const planMissingRows = mrrMovementRows.map(({ plan: _plan, ...row }) => row);
const missingPlanAnswer = answerDatasetQuestionDeterministically({
  question: "Which plans generate the most recurring revenue?",
  datasetId: "fixture:saas-mrr-missing-plan",
  datasetType: "SaaS",
  columns: Object.keys(planMissingRows[0] ?? {}),
  rows: planMissingRows,
});
assert.ok(missingPlanAnswer, "missing-plan SaaS question receives a deterministic missing-evidence answer");
assert.equal(missingPlanAnswer.result.status, "missing_evidence");
assert.match(missingPlanAnswer.answer, /Plan-level recurring revenue is unavailable because no validated plan field was found in this dataset\./);
assert.doesNotMatch(missingPlanAnswer.answer, /provider route|Gemini|AI_PROVIDER_ERROR|PROVIDER_UNAVAILABLE/i, "missing-plan answer does not route to a provider");

const startupSaasRows = parseRootCsv("test-fixtures/business-models/03_saas_startup.csv");
const startupSaasColumns = Object.keys(startupSaasRows[0] ?? {});
const startupSaasEngine = buildDatasetIntelligenceEngine({
  rows: startupSaasRows,
  columns: startupSaasColumns,
  fileName: "03_saas_startup.csv",
});
assert.equal(startupSaasEngine.saas?.mappings.churn, "churned", "explicit churned field maps to SaaS churn semantics");
const startupSaasSummary = buildSaasAssistantSummary({
  rows: startupSaasRows,
  columns: startupSaasColumns,
  fileName: "03_saas_startup.csv",
});
assert.equal(startupSaasSummary.customerState.totalCustomers, 12, "monthly SaaS fixture resolves latest state per customer");
assert.equal(startupSaasSummary.customerState.activeCustomers, 11, "monthly SaaS fixture excludes latest churned customers from active customers");
assert.equal(startupSaasSummary.customerState.churnedCustomers, 1, "monthly SaaS fixture counts latest churned customers");
assert.equal(startupSaasSummary.customerState.churnShare, 8.33, "monthly SaaS fixture calculates current churn prevalence from latest customer state");

const startupSaasQuestions = [
  ...new Set([
    ...availableAnalyticalSuggestions({
      datasetId: "fixture:03-saas-startup",
      datasetType: "SaaS",
      columns: startupSaasColumns,
      rows: startupSaasRows,
    }),
    ...generateSuggestions(buildDatasetIntelligence(startupSaasRows), "03_saas_startup"),
    ...fallbackSuggestionsForDatasetType("SaaS"),
  ]),
].filter((question) => canAnswerDatasetSuggestionDeterministically({
  question,
  datasetId: "fixture:03-saas-startup",
  datasetType: "SaaS",
  columns: startupSaasColumns,
  rows: startupSaasRows,
})).slice(0, 12);

assert.deepEqual(startupSaasQuestions, [
  "What is the current MRR?",
  "What changed in MRR across the available periods?",
  "What is the current ARR?",
  "How much New MRR is in the data?",
  "How much Expansion MRR is in the data?",
  "How much Contraction MRR is in the data?",
  "How much Churned MRR is in the data?",
  "What is the net MRR movement?",
  "How many active customers are represented?",
  "Which plan contributes the most SaaS revenue or users?",
  "Which customers or accounts are highest value?",
  "What churn signal is visible in the source data?",
], "03_saas_startup keeps the 12 SaaS sidebar questions");

const startupSaasQuestionMatrix = startupSaasQuestions.map((question) => {
  const answer = answerDatasetQuestionDeterministically({
    question,
    datasetId: "fixture:03-saas-startup",
    datasetType: "SaaS",
    columns: startupSaasColumns,
    rows: startupSaasRows,
  });
  assert.ok(answer, `${question} receives a deterministic SaaS answer`);
  assert.match(String(answer.result.intent), /^saas\./, `${question} uses the SaaS deterministic route`);
  assert.doesNotMatch(answer.answer, /UseClevr found \d+ SaaS semantic fields/, `${question} does not return the generic SaaS capability response`);
  assert.doesNotMatch(answer.answer, /PROVIDER_UNAVAILABLE|AI_PROVIDER_ERROR|unsupported_question|provider route is unavailable/i, `${question} does not route to provider failure`);
  return { question, answer };
});

const startupMrrAnswer = startupSaasQuestionMatrix.find((entry) => entry.question === "What is the current MRR?")?.answer;
assert.ok(startupMrrAnswer);
assert.equal(startupMrrAnswer.result.value, 11477, "current MRR uses latest active customer state for 03_saas_startup");
const startupActiveAnswer = startupSaasQuestionMatrix.find((entry) => entry.question === "How many active customers are represented?")?.answer;
assert.ok(startupActiveAnswer);
assert.equal(startupActiveAnswer.result.totalCustomers, 12);
assert.equal(startupActiveAnswer.result.activeCustomers, 11);
assert.equal(startupActiveAnswer.result.churnedCustomers, 1);
assert.match(startupActiveAnswer.answer, /Total distinct customers: 12\. Active customers: 11\. Churned customers: 1\./);
const startupChurnSignalAnswer = startupSaasQuestionMatrix.find((entry) => entry.question === "What churn signal is visible in the source data?")?.answer;
assert.ok(startupChurnSignalAnswer);
assert.equal(startupChurnSignalAnswer.result.churnedCustomers, 1);
assert.equal(startupChurnSignalAnswer.result.activeCustomers, 11);
assert.equal(startupChurnSignalAnswer.result.churnShare, 8.33);
assert.match(startupChurnSignalAnswer.answer, /Churned customers: 1/);
assert.match(startupChurnSignalAnswer.answer, /Churn share: 8\.3%/);
assert.match(startupChurnSignalAnswer.answer, /Source fields: customer_id, churned/);
assert.match(startupChurnSignalAnswer.answer, /Churned MRR: not available/);
const startupChurnedMrrAnswer = startupSaasQuestionMatrix.find((entry) => entry.question === "How much Churned MRR is in the data?")?.answer;
assert.ok(startupChurnedMrrAnswer);
assert.equal(startupChurnedMrrAnswer.result.status, "missing_evidence");
assert.match(startupChurnedMrrAnswer.answer, /1 churned customer was detected, but Churned MRR cannot be calculated reliably/);
assert.doesNotMatch(startupChurnedMrrAnswer.answer, /Churned MRR is 0|Churned MRR is \$0/);
const startupNetMovementAnswer = startupSaasQuestionMatrix.find((entry) => entry.question === "What is the net MRR movement?")?.answer;
assert.ok(startupNetMovementAnswer);
assert.equal(startupNetMovementAnswer.result.status, "missing_evidence");
assert.match(startupNetMovementAnswer.answer, /missing movement evidence is not treated as zero/);

const churnedCurrentStateRows = buildCurrentStateChurnRows();
const churnedCurrentStateColumns = Object.keys(churnedCurrentStateRows[0] ?? {});
const churnedCurrentStateSummary = buildSaasAssistantSummary({
  rows: churnedCurrentStateRows,
  columns: churnedCurrentStateColumns,
  fileName: "saas-current-state-churn.csv",
});
assert.equal(churnedCurrentStateSummary.customerState.totalCustomers, 144, "current-state churn fixture represents 144 distinct customers");
assert.equal(churnedCurrentStateSummary.customerState.churnedCustomers, 7, "current-state churn fixture detects seven churned customers");
assert.equal(churnedCurrentStateSummary.customerState.activeCustomers, 137, "current-state churn fixture excludes churned customers from active customers");
const currentStateActiveAnswer = answerDatasetQuestionDeterministically({
  question: "How many active customers are represented?",
  datasetId: "fixture:saas-current-state-churn",
  datasetType: "SaaS",
  columns: churnedCurrentStateColumns,
  rows: churnedCurrentStateRows,
});
assert.ok(currentStateActiveAnswer);
assert.equal(currentStateActiveAnswer.result.totalCustomers, 144);
assert.equal(currentStateActiveAnswer.result.activeCustomers, 137);
assert.equal(currentStateActiveAnswer.result.churnedCustomers, 7);

const noChurnRows = churnedCurrentStateRows.map((row) => ({ ...row, churned: "0" }));
const noChurnAnswer = answerDatasetQuestionDeterministically({
  question: "How much Churned MRR is in the data?",
  datasetId: "fixture:saas-current-state-no-churn",
  datasetType: "SaaS",
  columns: churnedCurrentStateColumns,
  rows: noChurnRows,
});
assert.ok(noChurnAnswer);
assert.equal(noChurnAnswer.result.status, "success");
assert.equal(noChurnAnswer.result.churnedMrr, 0, "validated zero churn becomes a confirmed zero Churned MRR answer");

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

function parseRootCsv(relativePath: string) {
  const [headerLine, ...lines] = readFileSync(join(repoRoot, relativePath), "utf8").trim().split(/\r?\n/);
  const headers = headerLine?.split(",") ?? [];
  return lines.map((line) => {
    const values = line.split(",");
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

function buildCurrentStateChurnRows() {
  return Array.from({ length: 144 }, (_, index) => {
    const churned = index < 7;
    const mrr = churned ? 0 : 100 + (index % 5) * 25;
    return {
      month: "2026-11-01",
      customer_id: `CURRENT-${String(index + 1).padStart(3, "0")}`,
      plan: index % 3 === 0 ? "Scale" : index % 3 === 1 ? "Growth" : "Starter",
      mrr: String(mrr),
      churned: churned ? "1" : "0",
    };
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

function buildMrrMovementRows() {
  const rows: Record<string, string | number>[] = [
    { month: "2025-11-01", event_date: "2025-11-01", customer_id: "cus_previous", customer_name: "Previous Customer", industry: "Software", region: "EMEA", plan: "Pro", seats_before: 7, seats_after: 7, movement_type: "no_change", mrr_before: 2100, mrr_after: 2100, mrr_delta: 0, currency: "USD", signup_date: "2024-01-10", customer_status: "active" },
    { month: "2025-12-01", event_date: "2025-12-02", customer_id: "cus_new", customer_name: "New Customer", industry: "Software", region: "North America", plan: "Business", seats_before: 0, seats_after: 12, movement_type: "new", mrr_before: 0, mrr_after: 3361, mrr_delta: 3361, currency: "USD", signup_date: "2025-12-02", customer_status: "active" },
    { month: "2025-12-01", event_date: "2025-12-03", customer_id: "cus_expansion", customer_name: "Expansion Customer", industry: "Healthcare", region: "EMEA", plan: "Enterprise", seats_before: 35, seats_after: 48, movement_type: "expansion", mrr_before: 10000, mrr_after: 15248, mrr_delta: 5248, currency: "USD", signup_date: "2024-03-15", customer_status: "active" },
    { month: "2025-12-01", event_date: "2025-12-04", customer_id: "cus_contraction", customer_name: "Contraction Customer", industry: "Finance", region: "APAC", plan: "Pro", seats_before: 20, seats_after: 16, movement_type: "contraction", mrr_before: 6219, mrr_after: 5000, mrr_delta: -1219, currency: "USD", signup_date: "2024-06-20", customer_status: "active" },
    { month: "2025-12-01", event_date: "2025-12-05", customer_id: "cus_churn", customer_name: "Churn Customer", industry: "Retail", region: "North America", plan: "Starter", seats_before: 3, seats_after: 0, movement_type: "churn", mrr_before: 643, mrr_after: 0, mrr_delta: -643, currency: "USD", signup_date: "2025-01-12", customer_status: "churned" },
  ];
  for (let index = 0; index < 120; index += 1) {
    const mrrAfter = index === 119 ? 3427 : 2900;
    rows.push({
      month: "2025-12-01",
      event_date: "2025-12-06",
      customer_id: `cus_no_change_${index + 1}`,
      customer_name: `No Change Customer ${index + 1}`,
      industry: index % 2 === 0 ? "Software" : "Services",
      region: index % 3 === 0 ? "EMEA" : "North America",
      plan: index % 4 === 0 ? "Enterprise" : "Business",
      seats_before: 10,
      seats_after: 10,
      movement_type: "no_change",
      mrr_before: mrrAfter,
      mrr_after: mrrAfter,
      mrr_delta: 0,
      currency: "USD",
      signup_date: "2024-02-01",
      customer_status: "active",
    });
  }
  rows.push({ month: "2025-12-01", event_date: "2025-12-01", customer_id: "cus_expansion", customer_name: "Expansion Customer", industry: "Healthcare", region: "EMEA", plan: "Enterprise", seats_before: 35, seats_after: 35, movement_type: "no_change", mrr_before: 10000, mrr_after: 10000, mrr_delta: 0, currency: "USD", signup_date: "2024-03-15", customer_status: "active" });
  return rows;
}
