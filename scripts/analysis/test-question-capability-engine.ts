/**
 * Universal AI Analyst suggested-questions capability engine tests.
 *
 * Covers the master-fix contract:
 * - Profitability datasets receive capability-derived, deterministic suggestions.
 * - Missing-data explanatory questions are valid; unavailable value metrics are not.
 * - Suggestions never leak capabilities across datasets or users.
 * - Retail and existing dataset behavior keeps working.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { calculateProfitabilityAnalysis } from "../../src/lib/profitability/two-file-analysis";
import type { ProfitabilitySourceFile } from "../../src/lib/profitability/two-file-analysis";
import {
  answerDatasetQuestionDeterministically,
  canAnswerDatasetSuggestionDeterministically,
} from "../../src/lib/data/dataset-assistant-deterministic";
import {
  buildCapabilitySuggestedQuestions,
} from "../../src/lib/data/question-capabilities";
import { deriveQuestionCapabilityContext } from "../../src/lib/data/question-capabilities";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

function nearlyEqual(actual: number | null, expected: number, message: string) {
  assert.ok(actual !== null, `${message}: expected ${expected}, received null`)
  assert.ok(Math.abs((actual as number) - expected) < 0.001, `${message}: expected ${expected}, received ${actual}`)
}

const fullRevenueFile: ProfitabilitySourceFile = {
  role: "revenue" as const,
  name: "revenue_full.xlsx",
  columns: ["period", "department", "product", "revenue"],
  rows: [
    { period: "2026-01", department: "Retail", product: "Hardware", revenue: 26312 },
    { period: "2026-02", department: "Retail", product: "Hardware", revenue: 30000 },
    { period: "2026-02", department: "Retail", product: "Services", revenue: 12000 },
    { period: "2026-03", department: "Retail", product: "Services", revenue: 18000 },
  ],
}

const expenseFileWithCogs: ProfitabilitySourceFile = {
  role: "expenses" as const,
  name: "expenses_full.xlsx",
  columns: ["period", "department", "category", "amount"],
  rows: [
    { period: "2026-01", department: "Retail", category: "Cost of goods sold", amount: 5000 },
    { period: "2026-01", department: "Retail", category: "Rent", amount: 4000 },
    { period: "2026-01", department: "Retail", category: "Salaries", amount: 6000 },
    { period: "2026-02", department: "Retail", category: "Cost of goods sold", amount: 5000 },
    { period: "2026-02", department: "Retail", category: "Rent", amount: 4000 },
    { period: "2026-02", department: "Retail", category: "Salaries", amount: 6000 },
    { period: "2026-03", department: "Retail", category: "Cost of goods sold", amount: 5000 },
    { period: "2026-03", department: "Retail", category: "Rent", amount: 4000 },
    { period: "2026-03", department: "Retail", category: "Salaries", amount: 6000 },
  ],
}

const expenseFileOperatingOnly: ProfitabilitySourceFile = {
  role: "expenses" as const,
  name: "expenses_operating.xlsx",
  columns: ["period", "department", "category", "amount"],
  rows: [
    { period: "2026-01", department: "Retail", category: "Rent", amount: 4000 },
    { period: "2026-01", department: "Retail", category: "Salaries", amount: 6000 },
    { period: "2026-01", department: "Retail", category: "Marketing", amount: 1544.4 },
    { period: "2026-02", department: "Retail", category: "Rent", amount: 4000 },
    { period: "2026-02", department: "Retail", category: "Salaries", amount: 6000 },
    { period: "2026-02", department: "Retail", category: "Marketing", amount: 1544.4 },
    { period: "2026-03", department: "Retail", category: "Rent", amount: 4000 },
    { period: "2026-03", department: "Retail", category: "Salaries", amount: 6000 },
    { period: "2026-03", department: "Retail", category: "Marketing", amount: 1544.4 },
  ],
}

function profitabilityDatasetFixture(input: {
  analysisId: string
  revenueFile: ProfitabilitySourceFile | null
  expensesFile: ProfitabilitySourceFile | null
}) {
  const payload = calculateProfitabilityAnalysis({
    analysisId: input.analysisId,
    revenueFile: input.revenueFile || undefined,
    expensesFile: input.expensesFile || undefined,
  })
  return {
    id: input.analysisId,
    datasetType: "profitability",
    businessModel: "profitability",
    columns: ["period", "department", "product", "category", "amount"],
    data: [] as Record<string, unknown>[],
    rowCount: (input.revenueFile?.rows.length ?? 0) + (input.expensesFile?.rows.length ?? 0),
    analysis: {
      datasetType: "profitability",
      profitability: payload,
    } as unknown,
    precomputedMetrics: payload as unknown,
    columnMapping: {
      profitabilityAnalysisId: input.analysisId,
      sourceFiles: payload.sourceFiles,
    },
  }
}

function stableDataset(input: ReturnType<typeof profitabilityDatasetFixture>) {
  // The engine must read only from this object; no shared references across fixtures.
  return JSON.parse(JSON.stringify(input)) as ReturnType<typeof profitabilityDatasetFixture>
}

const typicalAssistantInput = (dataset: ReturnType<typeof profitabilityDatasetFixture>, question: string) => ({
  question,
  datasetId: dataset.id,
  datasetName: "Revenue + Expense Analysis",
  datasetType: dataset.datasetType,
  columns: dataset.columns,
  rows: dataset.data,
  analysis: dataset.analysis,
  precomputedMetrics: dataset.precomputedMetrics,
});

// ────────────────────────────────────────────────────────────────────────
// A. Profitability dataset with full recurring revenue, expense categories,
//    and revenue composition: capability-derived suggestions are available,
//    and every suggestion answers deterministically.
// ────────────────────────────────────────────────────────────────────────
const fullDataset = profitabilityDatasetFixture({
  analysisId: "pa_capability_full",
  revenueFile: fullRevenueFile,
  expensesFile: expenseFileWithCogs,
})
const fullCanvasInput = {
  datasetId: fullDataset.id,
  datasetName: "Revenue + Expense Analysis",
  datasetType: fullDataset.datasetType,
  columns: fullDataset.columns,
  rows: fullDataset.data,
  dataset: fullDataset,
}
const fullSuggestions = buildCapabilitySuggestedQuestions(fullCanvasInput)

const expectedEssentialQuestions = [
  "What is driving my operating profit?",
  "Which revenue source contributes the most?",
  "What is my revenue-to-expense ratio?",
  "Which expense categories have the biggest impact?",
  "Where could I reduce costs?",
  "What is my total revenue?",
]
for (const question of expectedEssentialQuestions) {
  assert.ok(fullSuggestions.includes(question), `full profitability fixture must suggest: ${question}`)
}
assert.ok(
  !fullSuggestions.some((question) => /why is gross profit unavailable/i.test(question)),
  "why-unavailable must not be suggested when gross profit is available",
)
assert.ok(fullSuggestions.length <= 8, `capability suggestions stay within the 5-8 question budget, got ${fullSuggestions.length}`)

for (const question of fullSuggestions) {
  const answer = answerDatasetQuestionDeterministically(typicalAssistantInput(fullDataset, question));
  assert.ok(answer, `${question} receives a deterministic profitability answer`);
  assert.match(String(answer.result.intent), /^profitability\./, `${question} uses the profitability deterministic route`);
  assert.equal(answer.status, "success", `${question} answers successfully`);
  assert.doesNotMatch(answer.answer, /PROVIDER_UNAVAILABLE|AI_PROVIDER_ERROR|unsupported_question/i, `${question} does not route to provider failure`);
}

// COGS present: the gross margin value question passes the support gate even
// when the usefulness budget ranks it out of the visible list.
assert.equal(
  canAnswerDatasetSuggestionDeterministically(typicalAssistantInput(fullDataset, "What is my gross margin?")),
  true,
  "gross margin value question is supported when COGS exists",
);

// ────────────────────────────────────────────────────────────────────────
// B. Profitability without COGS: unavailable-value questions are withheld,
//    the deterministic why-is-it-unavailable question is available.
// ────────────────────────────────────────────────────────────────────────
const noCogsDataset = profitabilityDatasetFixture({
  analysisId: "pa_capability_no_cogs",
  revenueFile: fullRevenueFile,
  expensesFile: expenseFileOperatingOnly,
})
const noCogsSuggestions = buildCapabilitySuggestedQuestions({
  datasetId: noCogsDataset.id,
  datasetName: "Revenue + Expense Analysis",
  datasetType: noCogsDataset.datasetType,
  columns: noCogsDataset.columns,
  rows: noCogsDataset.data,
  dataset: noCogsDataset,
})
assert.ok(noCogsSuggestions.includes("Why is gross profit unavailable?"), "why-unavailable question is suggested when COGS is missing");
assert.ok(!noCogsSuggestions.includes("What is my gross margin?"), "gross margin value question is withheld when COGS is missing");
assert.ok(!noCogsSuggestions.includes("What is the current gross margin?"), "literal gross margin question is withheld when COGS is missing");

const grossMarginAnswer = answerDatasetQuestionDeterministically(typicalAssistantInput(noCogsDataset, "What is my gross margin?"));
assert.ok(grossMarginAnswer, "asked gross margin still receives a deterministic refusal");
assert.match(String(grossMarginAnswer.result.intent), /^profitability\./);
assert.match(grossMarginAnswer.answer, /unavailable/i, "gross margin refusal explains unavailability");
assert.doesNotMatch(grossMarginAnswer.answer, /\d\d% margin/, "gross margin refusal does not include a fabricated percentage");

const whyUnavailableAnswer = answerDatasetQuestionDeterministically(typicalAssistantInput(noCogsDataset, "Why is gross profit unavailable?"));
assert.ok(whyUnavailableAnswer, "why-unavailable question receives a deterministic explanation");
assert.match(whyUnavailableAnswer.answer, /COGS|cost of goods sold/i, "why-unavailable answer names the missing COGS source");
assert.equal(((whyUnavailableAnswer.result as Record<string, unknown>).provenanceRecorded), true, "why-unavailable answer is recorded provenance");

// ────────────────────────────────────────────────────────────────────────
// C. Revenue-only Profitability fixture: no expense/profit questions.
// ────────────────────────────────────────────────────────────────────────
const revenueOnlyDataset = profitabilityDatasetFixture({
  analysisId: "pa_capability_revenue_only",
  revenueFile: fullRevenueFile,
  expensesFile: null,
})
const revenueOnlySuggestions = buildCapabilitySuggestedQuestions({
  datasetId: revenueOnlyDataset.id,
  datasetName: "Revenue + Expense Analysis",
  datasetType: revenueOnlyDataset.datasetType,
  columns: revenueOnlyDataset.columns,
  rows: revenueOnlyDataset.data,
  dataset: revenueOnlyDataset,
})
for (const forbiddenQuestion of [
  "Which expense categories have the biggest impact?",
  "Where could I reduce costs?",
  "What is my operating profit?",
  "What is my revenue-to-expense ratio?",
  "What is driving my operating profit?",
]) {
  assert.ok(!revenueOnlySuggestions.includes(forbiddenQuestion), `revenue-only fixture must not suggest: ${forbiddenQuestion}`);
}
assert.ok(revenueOnlySuggestions.includes("What is my total revenue?"), "revenue-only fixture still suggests the supported revenue question");
assert.ok(revenueOnlySuggestions.includes("Which revenue source contributes the most?"), "revenue-only fixture keeps recorded revenue composition suggestions");

// ────────────────────────────────────────────────────────────────────────
// D. Retail datasets keep the existing retail capability behavior: the
//    retail deterministic capability gate stays authoritative for row-level
//    retail datasets, and the capability registry adds only questions that
//    still answer deterministically for those rows.
// ────────────────────────────────────────────────────────────────────────
const retailRows = [
  { order_date: "2026-01-01", product: "Mug", category: "Drinkware", sales_amount: "100", quantity: "2", unit_cost: "4", stock_on_hand: "0", reorder_point: "10" },
  { order_date: "2026-01-02", product: "Bottle", category: "Drinkware", sales_amount: "250", quantity: "5", unit_cost: "6", stock_on_hand: "40", reorder_point: "10" },
];
const retailColumns = Object.keys(retailRows[0] ?? {});
assert.equal(
  canAnswerDatasetSuggestionDeterministically({
    question: "Which products are dead stock products?",
    datasetId: "fixture:capability-retail",
    datasetType: "retail",
    columns: retailColumns,
    rows: retailRows,
  }),
  true,
  "retail deterministic capability stays available for supported retail suggestions",
);
const retailRegistrySuggestions = buildCapabilitySuggestedQuestions({
  datasetId: "fixture:capability-retail",
  datasetName: "Retail inventory",
  datasetType: "retail",
  columns: retailColumns,
  rows: retailRows,
}).filter((question) => canAnswerDatasetSuggestionDeterministically({
  question,
  datasetId: "fixture:capability-retail",
  datasetType: "retail",
  columns: retailColumns,
  rows: retailRows,
}));
assert.ok(
  retailRegistrySuggestions.every((question) => ["What is my total revenue?", "How does my revenue change over time?"].includes(question)),
  "capability registry adds only deterministic, generic-answerable questions for retail rows",
);
const retailMissingCostRows = retailRows.map(({ unit_cost: _unitCost, ...row }) => row);
assert.equal(
  canAnswerDatasetSuggestionDeterministically({
    question: "What is the current inventory valuation?",
    datasetId: "fixture:capability-retail-missing-cost",
    datasetType: "retail",
    columns: Object.keys(retailMissingCostRows[0] ?? {}),
    rows: retailMissingCostRows,
  }),
  false,
  "retail valuation question stays withheld without unit-cost evidence (existing contract)",
);

// ────────────────────────────────────────────────────────────────────────
// E+F. Dataset switch and cross-user/dataset isolation: switching datasets
// drops prior suggestions; answering one dataset never reads another.
// ────────────────────────────────────────────────────────────────────────
const otherDataset = profitabilityDatasetFixture({
  analysisId: "pa_capability_other",
  revenueFile: fullRevenueFile,
  expensesFile: expenseFileWithCogs,
})
// Mutate the other dataset's payload: isolation requires the engine answers for
// `otherDataset` never depend on `fullDataset` values.
const otherPayload = otherDataset.precomputedMetrics as Record<string, unknown>;
otherPayload.totalRevenue = 4321;
otherPayload.operatingProfit = 222;
otherPayload.revenue = 4321;
otherPayload.operatingExpenses = 4099;

const isolatedAnswer = answerDatasetQuestionDeterministically(typicalAssistantInput(otherDataset, "What is my total revenue?"));
assert.ok(isolatedAnswer, "isolated dataset receives a deterministic revenue answer");
assert.match(isolatedAnswer.answer, /4,321/, "isolated answer uses the mutated dataset payload only");
assert.doesNotMatch(isolatedAnswer.answer, /86,312|51,678/, "isolated answer does not leak another dataset's totals");

const fullAnswerAfterMutation = answerDatasetQuestionDeterministically(typicalAssistantInput(fullDataset, "What is my total revenue?"));
assert.ok(fullAnswerAfterMutation, "first dataset still answers after the other dataset changed");
nearlyEqual(
  Number((fullAnswerAfterMutation!.result as Record<string, unknown>).metricValue),
  86312,
  "first dataset stays isolated from the other dataset's mutation",
);

// Suggestions route must stay owner-scoped for the refreshed capability flow.
const suggestionsRouteSource = readFileSync(join(repoRoot, "src", "app", "api", "suggestions", "generate", "route.ts"), "utf8");
assert.match(suggestionsRouteSource, /eq\(datasets\.userId, session\.user\.id\)/, "suggestions route scoping is owner-based");
assert.match(suggestionsRouteSource, /suggestions_dataset_v6_\$\{datasetId\}/, "suggestion cache key includes dataset ID and the semantic version");
assert.match(suggestionsRouteSource, /deriveQuestionCapabilityContext\(/, "suggestions route derives the central capability context for the active dataset");
assert.match(suggestionsRouteSource, /buildCapabilitySuggestedQuestions\(capabilityContext\)/, "suggestions route sources candidates from the capability question registry");
assert.match(suggestionsRouteSource, /precomputedMetrics: input\.dataset\.precomputedMetrics/, "suggestions route passes the canonical dataset context into the deterministic capability gate");
assert.match(suggestionsRouteSource, /analysis: input\.dataset\.analysis/, "suggestions route passes canonical analysis provenance into the deterministic capability gate");

// Workspace dataset switching resets suggestions and keys the client cache per dataset.
const workspaceSource = readFileSync(join(repoRoot, "src", "components", "chat", "ai-assistant-workspace.tsx"), "utf8");
assert.match(workspaceSource, /setSavedSuggestions\(\[\]\)/, "workspace clears stale suggestions on dataset switches");
assert.match(workspaceSource, /SUGGESTION_CLIENT_CACHE_VERSION\}:\$\{selectedDatasetId\}/, "workspace suggestion cache key is dataset-specific");
assert.match(workspaceSource, /No supported suggested questions are available for this dataset yet\./, "empty state is retained for datasets with genuinely no supported questions");

// Suggestions for the first dataset must stay locked to the first dataset.
const firstDatasetAgain = buildCapabilitySuggestedQuestions({
  datasetId: fullDataset.id,
  datasetName: "Revenue + Expense Analysis",
  datasetType: fullDataset.datasetType,
  columns: fullDataset.columns,
  rows: fullDataset.data,
  dataset: fullDataset,
});
assert.ok(firstDatasetAgain.includes("What is my total revenue?"), "first dataset still keeps its revenue suggestion after the other dataset changed");

// ────────────────────────────────────────────────────────────────────────
// G. Missing metrics: unsupported registry questions are withheld.
// ────────────────────────────────────────────────────────────────────────
const noCompositionDataset = profitabilityDatasetFixture({
  analysisId: "pa_capability_no_composition",
  revenueFile: {
    role: "revenue" as const,
    name: "revenue_no_composition.xlsx",
    columns: ["period", "revenue"],
    rows: [
      { period: "2026-01", revenue: 26312 },
      { period: "2026-02", revenue: 30000 },
      { period: "2026-03", revenue: 30000 },
    ],
  },
  expensesFile: expenseFileWithCogs,
})
const noCompositionSuggestions = buildCapabilitySuggestedQuestions({
  datasetId: noCompositionDataset.id,
  datasetName: "Revenue + Expense Analysis",
  datasetType: noCompositionDataset.datasetType,
  columns: noCompositionDataset.columns,
  rows: noCompositionDataset.data,
  dataset: noCompositionDataset,
});
assert.ok(!noCompositionSuggestions.includes("Which revenue source contributes the most?"), "revenue-source question is withheld without recorded composition");
assert.ok(noCompositionSuggestions.includes("What is my total revenue?"), "revenue value stays supported for the reduced fixture");

// ────────────────────────────────────────────────────────────────────────
// H. Deterministic suggestions never depend on provider availability.
// ────────────────────────────────────────────────────────────────────────
const suggestionsRouteHasNoProviderDependencies = [
  "generateText(",
  "getManagedCloudLanguageModel",
  "generateAntigravityCompletion",
  "generateWithUniversalAiAdapter",
  "openai",
  "gemini",
].every((fragment) => !suggestionsRouteSource.includes(fragment));
assert.ok(suggestionsRouteHasNoProviderDependencies, "suggestion generation import surface includes no AI provider dependencies");
const offlineSuggestions = buildCapabilitySuggestedQuestions(fullCanvasInput);
assert.deepEqual(offlineSuggestions, fullSuggestions, "provider-independent suggestions must be strictly deterministic");

// ────────────────────────────────────────────────────────────────────────
// I. Refresh: recomputation is order-stable for the current dataset only.
// ────────────────────────────────────────────────────────────────────────
const recomputedSuggestions = buildCapabilitySuggestedQuestions({
  ...fullCanvasInput,
  dataset: stableDataset(fullDataset),
});
assert.deepEqual(recomputedSuggestions, fullSuggestions, "refresh recomputes the same capability suggestions deterministically");
assert.match(workspaceSource, /generateSuggestions\(true\)/, "workspace refresh button forces recomputation for the active dataset");

// ────────────────────────────────────────────────────────────────────────
// J. Unknown schema / zero-row dataset: safe empty state, no fabricated
//    questions.
// ────────────────────────────────────────────────────────────────────────
const unknownSchemaSuggestions = buildCapabilitySuggestedQuestions({
  datasetId: "fixture:unknown-schema",
  datasetName: "Unknown upload",
  datasetType: "Generic",
  columns: [],
  rows: [],
});
assert.deepEqual(unknownSchemaSuggestions, [], "unknown schema with zero rows shows the safe empty state");

process.stdout.write("ok - suggested-question capability engine (profitability, isolation, retail, refresh, empty state)\n");
