/**
 * End-to-end shape check for /api/suggestions/generate pipeline output for a
 * canonical Profitability "Revenue + Expense Analysis" dataset (no DB):
 * replicates the route's candidate pipeline exactly, including the capability
 * registry, the positive gross-margin guard, and the deterministic gate.
 */

import assert from "node:assert/strict";

import { calculateProfitabilityAnalysis } from "../../src/lib/profitability/two-file-analysis";
import type { ProfitabilitySourceFile } from "../../src/lib/profitability/two-file-analysis";
import { availableAnalyticalSuggestions } from "../../src/lib/data/analytical-intents";
import { canAnswerDatasetSuggestionDeterministically } from "../../src/lib/data/dataset-assistant-deterministic";
import { fallbackSuggestionsForDatasetType } from "../../src/lib/data/dataset-intelligence";
import {
  buildCapabilitySuggestedQuestions,
  deriveQuestionCapabilityContext,
} from "../../src/lib/data/question-capabilities";

const revenueFile: ProfitabilitySourceFile = {
  role: "revenue" as const,
  name: "revenue.xlsx",
  columns: ["period", "department", "product", "revenue"],
  rows: [
    { period: "2026-01", department: "Retail", product: "Hardware", revenue: 26312 },
    { period: "2026-02", department: "Retail", product: "Hardware", revenue: 30000 },
    { period: "2026-02", department: "Retail", product: "Services", revenue: 12000 },
    { period: "2026-03", department: "Retail", product: "Services", revenue: 18000 },
  ],
}

const expensesFile: ProfitabilitySourceFile = {
  role: "expenses" as const,
  name: "expenses.xlsx",
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

const payload = calculateProfitabilityAnalysis({ analysisId: "pa_live_shape", revenueFile, expensesFile })
const dataset = {
  id: "pa_live_shape",
  name: "Revenue + Expense Analysis",
  datasetType: "profitability" as const,
  columns: ["period", "department", "product", "category", "amount"],
  rows: [] as Array<Record<string, unknown>>,
  analysis: { datasetType: "profitability", profitability: payload } as unknown,
  precomputedMetrics: payload as unknown,
}

const rows = dataset.rows
const analyticalSuggestions = availableAnalyticalSuggestions({
  datasetId: dataset.id,
  datasetType: "Finance",
  columns: dataset.columns,
  rows,
})
const generatedSuggestions = rows.length > 0 ? [] : []
const fallbackPrompts = rows.length > 0
  ? fallbackSuggestionsForDatasetType("Finance")
  : []
const capabilitySuggestions = buildCapabilitySuggestedQuestions(deriveQuestionCapabilityContext({
  datasetId: dataset.id,
  datasetName: dataset.name,
  datasetType: "Finance",
  columns: dataset.columns,
  rows,
  dataset,
}))

const grossMarginQuestion = "What is the current gross margin?"
const candidates = [...new Set([
  ...analyticalSuggestions,
  ...generatedSuggestions,
  ...fallbackPrompts,
  ...capabilitySuggestions,
])]
const suggestions = candidates
  .filter((suggestion) => suggestion !== grossMarginQuestion || analyticalSuggestions.includes(grossMarginQuestion))
  .filter((suggestion) => canAnswerDatasetSuggestionDeterministically({
    question: suggestion,
    datasetId: dataset.id,
    datasetName: dataset.name,
    datasetType: "Finance",
    columns: dataset.columns,
    rows,
    analysis: dataset.analysis,
    precomputedMetrics: dataset.precomputedMetrics,
  }))
  .slice(0, 12)

process.stdout.write(`${JSON.stringify(suggestions, null, 2)}\n`)

assert.ok(suggestions.length >= 5 && suggestions.length <= 12, `suggestion count within budget, got ${suggestions.length}`)
for (const question of suggestions) {
  const answer = canAnswerDatasetSuggestionDeterministically({
    question,
    datasetId: dataset.id,
    datasetName: dataset.name,
    datasetType: "Finance",
    columns: dataset.columns,
    rows,
    analysis: dataset.analysis,
    precomputedMetrics: dataset.precomputedMetrics,
  })
  assert.equal(answer, true, `${question} is answerable`)
}
assert.ok(
  !suggestions.includes("What is the current gross margin?"),
  "gross margin value question stays withheld without COGS",
)
assert.ok(
  suggestions.includes("Why is gross profit unavailable?"),
  "why-unavailable suggestion present without COGS",
)

process.stdout.write("ok - live pipeline shape matches the master-fix expectation\n")
