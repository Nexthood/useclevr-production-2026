/**
 * Deterministic Profitability assistant.
 *
 * Answers canonical Profitability questions strictly from the stored
 * Profitability analysis payload: canonical metric totals come from
 * `resolveCanonicalFinancialMetrics` and composition detail comes from the
 * recorded payload aggregates (expense categories, revenue composition,
 * metric provenance). This module never re-adds rows, never re-derives
 * canonical financials, and never fabricates a missing metric.
 *
 * Answer kinds:
 * - "value": a supported canonical metric or composition question.
 * - "explain": why an important metric is unavailable (missing-data question).
 * - "refuse": the question requires a metric that is unavailable; the answer
 *   explains the missing evidence instead of fabricating numbers.
 */

import {
  resolveCanonicalFinancialMetrics,
  resolveCanonicalProfitabilityPayload,
  type CanonicalFinancialMetrics,
} from "@/lib/data/canonical-financial-metrics";
import {
  payloadNumber,
  payloadRecord,
  payloadStringList,
  payloadTupleEntries,
} from "@/lib/data/question-capabilities";
import type { DatasetAssistantDeterministicResult } from "@/lib/data/dataset-assistant-deterministic";

export type ProfitabilityAssistantContext = {
  datasetId: string
  datasetName: string
  metrics: CanonicalFinancialMetrics
  payload: Record<string, unknown>
}

export type ProfitabilityAnswerKind = "value" | "explain" | "refuse"

export type ProfitabilityAnswer = {
  kind: ProfitabilityAnswerKind
  result: DatasetAssistantDeterministicResult
}

type ProfitabilityAnswerInput = {
  question: string
  datasetId: string
  datasetName: string
}

/** Read the canonical Profitability context for a dataset. Null when the dataset is not canonical Profitability. */
export function readProfitabilityAssistantContext(
  input: {
    datasetId: string
    datasetName?: string | null
    datasetType?: string | null
    analysis?: unknown
    precomputedMetrics?: unknown
  },
): ProfitabilityAssistantContext | null {
  if (!input.datasetId) return null
  const dataset = {
    id: input.datasetId,
    datasetType: input.datasetType,
    analysis: input.analysis,
    precomputedMetrics: input.precomputedMetrics,
  }
  const metrics = resolveCanonicalFinancialMetrics(dataset)
  const payload = metrics ? resolveCanonicalProfitabilityPayload(dataset) : null
  if (!metrics || !payload) return null
  return {
    datasetId: input.datasetId,
    datasetName: typeof input.datasetName === "string" ? input.datasetName : "",
    metrics,
    payload,
  }
}

/**
 * Resolve a recognized Profitability question from canonical data. Returns
 * null when the question is not a recognizable Profitability question.
 */
export function resolveProfitabilityAnswer(
  input: ProfitabilityAnswerInput,
  context: ProfitabilityAssistantContext,
): ProfitabilityAnswer | null {
  const normalized = input.question.trim().toLowerCase();
  if (!normalized) return null;

  if (isDatasetSummaryQuestion(normalized)) {
    return { kind: "value", result: describeCanonicalSummary(input, context) };
  }

  if (/revenue.{0,12}ratio|ratio.{0,12}(revenue|expense)|expense.{0,12}ratio/.test(normalized)) {
    return revenueExpenseRatioAnswer(input, context);
  }

  if (/driving|drivers?|what affects|what moves/.test(normalized) && /operating profit|profit/.test(normalized)) {
    return operatingProfitDriversAnswer(input, context);
  }

  if (/gross\s+(profit|margin)/.test(normalized) && /unavailable|missing|why|not available|absent/.test(normalized)) {
    return grossProfitUnavailabilityAnswer(input, context);
  }
  if (/gross\s+margin/.test(normalized)) {
    return marginValueAnswer(input, context, "grossMargin", "Gross margin");
  }
  if (/gross\s+profit/.test(normalized)) {
    return metricValueAnswer(input, context, "grossProfit", "Gross profit");
  }
  if (/operating\s+margin/.test(normalized)) {
    return marginValueAnswer(input, context, "operatingMargin", "Operating margin");
  }
  if (/operating\s+profit/.test(normalized)) {
    return metricValueAnswer(input, context, "operatingProfit", "Operating profit");
  }
  if (/net\s+margin/.test(normalized)) {
    return marginValueAnswer(input, context, "netMargin", "Net margin");
  }
  if (/net\s+profit|net income|how much profit/.test(normalized)) {
    return metricValueAnswer(input, context, "netProfit", "Net profit");
  }

  if (/(biggest|largest|top|highest).*(expense|cost)|expense categor(y|ies)/.test(normalized)) {
    return expenseCategoryAnswer(input, context);
  }

  if (/reduce|cut|lower|trim|spend less|save/.test(normalized) && /cost|expense|spend/.test(normalized)) {
    return expenseReductionAnswer(input, context);
  }

  if (/(revenue|income).*(source|stream|product|service|channel|contribut)/.test(normalized)
    || /(product|service|channel|source).*(contribut)/.test(normalized)) {
    return topRevenueSourceAnswer(input, context);
  }

  if (/revenue.*(trend|over time|change|month)/.test(normalized)) {
    return revenueTimeseriesAnswer(input, context);
  }

  const growth = payloadNumber(context.payload, "revenueGrowth");
  if (/growth/.test(normalized) && typeof growth === "number") {
    return revenueGrowthAnswer(input, context, growth);
  }

  if (/additional data|more complete|complete the analysis|what data|missing (data|information|metrics)/.test(normalized)) {
    return gapAnalysisAnswer(input, context);
  }

  if (/total\s+(operating\s+)?expenses?|how much (are my|do i spend)/.test(normalized)) {
    return metricValueAnswer(input, context, "operatingExpenses", "Operating expenses");
  }

  if (/total\s+revenue|how much revenue|what is (the|my) revenue|what is my total revenue/.test(normalized)) {
    return metricValueAnswer(input, context, "revenue", "Total revenue");
  }

  return null;
}

/**
 * Suggestion support check. A Profitability question may be suggested only
 * when every required canonical metric for it is available, or when it is an
 * unavailable-metric explanation. Refusals are never suggested.
 */
export function isSupportedProfitabilitySuggestion(question: string, context: ProfitabilityAssistantContext) {
  const answer = resolveProfitabilityAnswer({ question, datasetId: context.datasetId, datasetName: context.datasetName }, context);
  if (!answer) return false;
  if (answer.kind === "refuse") return false;
  if (answer.kind === "value") {
    const status = (answer.result.result as Record<string, unknown> | undefined)?.status;
    return status !== "missing_evidence";
  }
  return true;
}

/** Deterministic explanation for gross-profit unavailability, or null when not deterministically known. */
export function grossProfitUnavailability(context: ProfitabilityAssistantContext): { reason: string; records: Array<Record<string, string | number | null>> } | null {
  const metricSources = payloadRecord(context.payload, "metricSources");
  const grossProfitSource = metricSourceEntry(metricSources, "grossProfit");
  if (context.metrics.grossProfit !== null) return null;
  if (!grossProfitSource || grossProfitSource.kind !== "unavailable") return null;
  const cogsMissing = context.metrics.cogs === null;
  const cogsSource = cogsMissing ? metricSourceEntry(metricSources, "cogs") : null;
  const reason = cogsSource?.note
    ? `No recognized cost of goods sold (COGS) source field: ${grossProfitSource.note}`
    : grossProfitSource.note;
  return {
    reason,
    records: [
      { metric: "Gross profit", status: "unavailable", reason },
      ...(cogsMissing ? [{ metric: "COGS", status: "unavailable", reason: cogsSource?.note ?? "No recognized COGS source field." }] : []),
    ],
  };
}

function grossProfitUnavailabilityAnswer(input: ProfitabilityAnswerInput, context: ProfitabilityAssistantContext): ProfitabilityAnswer | null {
  const explanation = grossProfitUnavailability(context);
  if (!explanation) return null;
  return {
    kind: "explain",
    result: answerResult(input, {
      intent: "profitability.explain_gross_profit_unavailable",
      answer: [
        "Answer: Gross profit is unavailable because this Profitability analysis has no cost of goods sold (COGS) data.",
        [
          "Evidence: The recorded Profitability metric provenance states:",
          `- Gross profit: ${metricSourceEntry(payloadRecord(context.payload, "metricSources"), "grossProfit")?.note ?? "unavailable"}`,
          ...(explanation.reason ? [`- Detail: ${explanation.reason}`] : []),
        ].join("\n"),
        "Takeaway: UseClevr will not reinterpret operating expenses as COGS, so gross profit and gross margin stay unavailable instead of fabricated.",
        `Next question: Load gross profit source data (COGS) for this analysis, or ask: ${context.metrics.operatingProfit !== null ? "What is my operating profit?" : "What additional data would make this analysis more complete?"}`,
      ].join("\n\n"),
      insight: "Gross profit is unavailable in this dataset.",
      explanation: "Explanation is built from the recorded Profitability metric provenance, not invented.",
      recommendation: "Load gross profit inputs (COGS) to enable gross profit and gross margin results.",
      data: explanation.records,
      chartType: "table",
      result: {
        metric: "grossProfit",
        unavailableReason: explanation.reason,
        provenanceRecorded: true,
      },
    }),
  };
}

function isDatasetSummaryQuestion(normalized: string) {
  return /available (metrics|fields)|which metrics|what metrics|what can (i|you) (ask|analy[sz]e)|semantics|capabilit/.test(normalized);
}

function describeCanonicalSummary(input: ProfitabilityAnswerInput, context: ProfitabilityAssistantContext): DatasetAssistantDeterministicResult {
  const canonicalFields: Array<[keyof CanonicalFinancialMetrics, string]> = [
    ["revenue", "Total revenue"],
    ["operatingExpenses", "Operating expenses"],
    ["operatingProfit", "Operating profit"],
    ["operatingMargin", "Operating margin"],
    ["cogs", "COGS"],
    ["grossProfit", "Gross profit"],
    ["grossMargin", "Gross margin"],
    ["netProfit", "Net profit"],
    ["netMargin", "Net margin"],
  ];
  const rows = canonicalFields.map(([metricKey, label]) => {
    const value = context.metrics[metricKey];
    return {
      metric: label,
      value: typeof value === "number" ? round2(value) : null,
      status: typeof value === "number" ? "available" : "unavailable",
    };
  });
  const unavailable = context.metrics.missingFields;
  return {
    status: "success",
    answer: [
      "Answer: This dataset is a canonical Profitability analysis. Recorded availability of each metric:",
      rows.map((row) => `- ${row.metric}: ${row.status === "available" ? formatValue(row.value as number) : "unavailable"}`).join("\n"),
      `Takeaway: ${unavailable.length > 0 ? `Recorded as unavailable: ${unavailable.join(", ")}. UseClevr does not fabricate unavailable metrics.` : "All canonical Profitability metrics were recorded."}`,
      "Next question: Ask about any metric marked available, or about the recorded data gaps.",
    ].join("\n\n"),
    insight: `Canonical Profitability analysis with ${rows.filter((row) => row.status === "available").length} available metric(s).`,
    explanation: "Availability comes from the stored Profitability metric totals and provenance.",
    recommendation: unavailable.length > 0
      ? "Ask: What additional data would make this analysis more complete?"
      : "Ask: What is driving my operating profit?",
    data: rows,
    chartType: "table",
    result: {
      intent: "profitability.dataset_summary",
      status: "success",
      confidence: 0.95,
      datasetId: input.datasetId,
      datasetType: "profitability",
      availableMetrics: context.metrics.availableFields,
      missingFields: context.metrics.missingFields,
      profit_unavailability: context.metrics.missingFields.includes("grossProfit") ? grossProfitUnavailability(context)?.reason ?? null : null,
    },
  };
}

function revenueExpenseRatioAnswer(input: ProfitabilityAnswerInput, context: ProfitabilityAssistantContext): ProfitabilityAnswer {
  const ratioValue = revenueExpenseRatio(context);
  if (!ratioValue) {
    return {
      kind: "refuse",
      result: profitabilityMissingEvidence(input, "Revenue-to-expense ratio is unavailable because both revenue and expense totals are required.", ["revenue and expense totals"], "profitability.revenue_expense_ratio"),
    };
  }
  return {
    kind: "value",
    result: answerResult(input, {
      intent: "profitability.revenue_expense_ratio",
      answer: [
        `Answer: Total revenue is ${formatValue(ratioValue.revenue)} against operating expenses ${formatValue(ratioValue.expenses)}: revenue-to-expense ratio ${ratioValue.ratio}.`,
        "Evidence: The ratio uses the canonical revenue and operating-expense totals recorded by the Profitability analysis without recalculation.",
        "Takeaway: A ratio above 1 means revenue covers operating expenses in this analysis.",
        "Next question: Ask: Which expense categories have the biggest impact?",
      ].join("\n\n"),
      insight: `Revenue-to-expense ratio is ${ratioValue.ratio}.`,
      explanation: "Ratio is derived from the canonical revenue and operating-expense totals recorded by the Profitability analysis.",
      recommendation: "Ask: Which expense categories have the biggest impact?",
      data: [
        { metric: "Total revenue", value: round2(ratioValue.revenue) },
        { metric: "Operating expenses", value: round2(ratioValue.expenses) },
        { metric: "Revenue-to-expense ratio", value: ratioValue.ratio },
      ],
      chartType: "kpi",
      result: {
        revenue: round2(ratioValue.revenue),
        operatingExpenses: round2(ratioValue.expenses),
        revenueExpenseRatio: ratioValue.ratio,
      },
    }),
  };
}

function operatingProfitDriversAnswer(input: ProfitabilityAnswerInput, context: ProfitabilityAssistantContext): ProfitabilityAnswer | null {
  const operatingProfit = context.metrics.operatingProfit;
  if (typeof operatingProfit !== "number") {
    return { kind: "refuse", result: availabilityRefusal(input, context, "operatingProfit", "Operating profit") };
  }
  const drivers = expenseCategoryEntries(context);
  const composition = topRevenueEntries(context).slice(0, 3);
  const revenue = context.metrics.revenue ?? 0;
  const operatingExpenses = context.metrics.operatingExpenses ?? 0;
  return {
    kind: "value",
    result: answerResult(input, {
      intent: "profitability.operating_profit_drivers",
      answer: [
        `Answer: Operating profit is ${formatValue(operatingProfit)}${context.metrics.operatingMargin !== null ? ` (operating margin ${formatPercent(context.metrics.operatingMargin)})` : ""}.`,
        [
          `Evidence: Revenue ${formatValue(revenue)} against operating expenses ${formatValue(operatingExpenses)}.`,
          ...(drivers.length > 0 ? [`Largest recorded expense categories: ${drivers.slice(0, 3).map((entry) => `${entry.label} ${formatValue(entry.amount)} (${formatPercent(entry.share)})`).join(", ")}.`] : []),
          ...(composition.length > 0 ? [`Largest recorded revenue sources: ${composition.map((entry) => `${entry.label} ${formatValue(entry.amount)}`).join(", ")}.`] : []),
        ].join("\n"),
        "Takeaway: Operating profit moves with revenue, the recorded expense categories above, and their share of recorded expenses.",
        `Next question: ${drivers.length > 0 ? "Ask: Which expense categories have the biggest impact?" : "Ask more detail about a recorded revenue source or expense category."}`,
      ].join("\n\n"),
      insight: `Operating profit sits at ${formatValue(operatingProfit)} on ${formatValue(revenue)} revenue.`,
      explanation: "Values come from the canonical Profitability totals and recorded composition entries without recalculation.",
      recommendation: drivers.length > 0 ? "Review the largest recorded expense categories for reduction potential." : "Review recorded revenue sources for concentration.",
      data: [
        { metric: "Revenue", value: round2(revenue) },
        { metric: "Operating expenses", value: round2(operatingExpenses) },
        { metric: "Operating profit", value: round2(operatingProfit) },
        ...(context.metrics.operatingMargin !== null ? [{ metric: "Operating margin", value: round2(context.metrics.operatingMargin), unit: "%" }] : []),
        ...drivers.slice(0, 5).map((entry) => ({ category: entry.label, amount: round2(entry.amount), shareOfExpenses: round2(entry.share), unit: "%" })),
      ],
      chartType: "table",
      result: {
        operatingProfit: round2(operatingProfit),
        revenue: round2(revenue),
        operatingExpenses: round2(operatingExpenses),
        topExpenseCategories: drivers.slice(0, 5).map((entry) => ({ category: entry.label, amount: round2(entry.amount), shareOfExpenses: round2(entry.share) })),
        topRevenueSources: composition.map((entry) => ({ source: entry.label, amount: round2(entry.amount) })),
      },
    }),
  };
}

function metricValueAnswer(
  input: ProfitabilityAnswerInput,
  context: ProfitabilityAssistantContext,
  metricKey: keyof CanonicalFinancialMetrics,
  label: string,
): ProfitabilityAnswer {
  const value = context.metrics[metricKey];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { kind: "refuse", result: availabilityRefusal(input, context, metricKey, label) };
  }
  const unit = metricKey.endsWith("Margin") ? "%" : null;
  return {
    kind: "value",
    result: answerResult(input, {
      intent: `profitability.${metricKey}`,
      answer: `Answer: ${label} is ${metricText(value, unit)} from the canonical Profitability total.`,
      insight: `${label}: ${metricText(value, unit)}.`,
      explanation: "Value is read directly from the stored Profitability analysis totals without recalculation.",
      recommendation: metricKey === "revenue"
        ? `Ask: ${context.metrics.operatingProfit !== null ? "What is my operating profit?" : "Which expense categories have the biggest impact?"}`
        : "Ask: What is driving my operating profit?",
      data: [{ metric: label, value: round2(value), ...(unit ? { unit } : {}) }],
      chartType: "kpi",
      result: {
        metricKey,
        metricValue: round2(value),
        ...(unit ? { unit: "percent" } : {}),
      },
    }),
  };
}

function marginValueAnswer(
  input: ProfitabilityAnswerInput,
  context: ProfitabilityAssistantContext,
  metricKey: keyof CanonicalFinancialMetrics,
  label: string,
): ProfitabilityAnswer {
  return metricValueAnswer(input, context, metricKey, label);
}

function expenseCategoryAnswer(input: ProfitabilityAnswerInput, context: ProfitabilityAssistantContext): ProfitabilityAnswer | null {
  const entries = expenseCategoryEntries(context);
  if (entries.length === 0) {
    return { kind: "refuse", result: profitabilityMissingEvidence(input, "Expense-category analytics are unavailable because the Profitability payload does not record expense categories.", ["expense categories"], "profitability.expense_categories") };
  }
  const concentration = payloadNumber(context.payload, "costConcentration");
  const top3 = payloadNumber(context.payload, "top3CostShare");
  const rows = entries.slice(0, 10).map((entry) => ({
    category: entry.label,
    amount: round2(entry.amount),
    shareOfExpenses: round2(entry.share),
  }));
  const top = entries[0];
  return {
    kind: "value",
    result: answerResult(input, {
      intent: "profitability.expense_categories",
      answer: [
        `Answer: ${top.label} is the largest recorded expense category at ${formatValue(top.amount)} (${formatPercent(top.share)} of recorded expenses).`,
        `Evidence: Ranked ${entries.length} recorded expense categories.${top3 !== null ? ` Top 3 categories cover ${formatPercent(top3)}.` : ""}${concentration !== null ? ` Recorded expense concentration is ${formatNumber(concentration)}.` : ""}`,
        "Takeaway: Category shares come from the recorded Profitability categories; COGS, interest, and tax stay separate from operating expenses.",
        "Next question: Ask: Where could I reduce costs?",
      ].join("\n\n"),
      insight: `${top.label} leads recorded expense categories.`,
      explanation: "Category totals and shares come from the recorded Profitability payload without recalculation.",
      recommendation: "Focus on the largest recorded categories first when reviewing cost reduction.",
      data: rows,
      chartType: "table",
      result: {
        categories: rows,
        costConcentration: concentration,
        top3CostShare: top3,
      },
    }),
  };
}

function expenseReductionAnswer(input: ProfitabilityAnswerInput, context: ProfitabilityAssistantContext): ProfitabilityAnswer | null {
  const entries = expenseCategoryEntries(context);
  if (entries.length === 0) {
    return { kind: "refuse", result: profitabilityMissingEvidence(input, "Cost-reduction guidance is unavailable because the Profitability payload does not record expense categories.", ["expense categories"], "profitability.cost_reduction") };
  }
  const rows = entries.slice(0, 8).map((entry) => ({
    category: entry.label,
    amount: round2(entry.amount),
    shareOfExpenses: round2(entry.share),
  }));
  const ratioValue = revenueExpenseRatio(context);
  const top = entries[0];
  return {
    kind: "value",
    result: answerResult(input, {
      intent: "profitability.cost_reduction",
      answer: [
        `Answer: Start with "${top.label}" (${formatValue(top.amount)}, ${formatPercent(top.share)} of recorded expenses) when looking for cost reduction.`,
        `Evidence: Candidates are ranked by recorded category amounts: ${entries.slice(0, 3).map((entry) => `${entry.label} (${formatPercent(entry.share)})`).join(", ")}.${ratioValue ? ` Revenue-to-expense ratio is ${ratioValue.ratio}.` : ""}`,
        "Takeaway: The largest recorded categories are the highest-leverage cost-reduction checkpoints; this ranking stays within recorded categories instead of inventing benchmarks.",
        "Next question: Ask: Which expense categories have the biggest impact?",
      ].join("\n\n"),
      insight: `Largest recorded cost concentration: ${top.label} at ${formatPercent(top.share)}.`,
      explanation: "Cost-reduction candidates are ranked strictly by the recorded Profitability expense categories.",
      recommendation: "Review the top recorded categories for potential savings.",
      data: rows,
      chartType: "table",
      result: {
        categories: rows,
        revenueExpenseRatio: ratioValue ? ratioValue.ratio : null,
      },
    }),
  };
}

function topRevenueSourceAnswer(input: ProfitabilityAnswerInput, context: ProfitabilityAssistantContext): ProfitabilityAnswer | null {
  const entries = topRevenueEntries(context);
  if (entries.length === 0) {
    return { kind: "refuse", result: profitabilityMissingEvidence(input, "Revenue composition is unavailable because the Profitability payload does not record revenue by product, category, customer, or region.", ["revenue composition"], "profitability.top_revenue_source") };
  }
  const top = entries[0];
  const revenue = context.metrics.revenue ?? 0;
  const shareOfRevenue = revenue > 0 ? (top.amount / revenue) * 100 : null;
  return {
    kind: "value",
    result: answerResult(input, {
      intent: "profitability.top_revenue_source",
      answer: [
        `Answer: ${top.label} contributes the most revenue at ${formatValue(top.amount)}${shareOfRevenue !== null ? ` (${formatPercent(shareOfRevenue)} of recorded revenue)` : ""}.`,
        `Evidence: Ranked ${entries.length} recorded revenue sources by amount.`,
        "Takeaway: Revenue concentration uses recorded composition entries from the Profitability payload.",
        "Next question: Ask: How does my revenue change over time?",
      ].join("\n\n"),
      insight: `Top recorded revenue source: ${top.label}.`,
      explanation: "Revenue composition comes from the recorded Profitability payload without recalculation.",
      recommendation: "Check the concentration of this revenue source before planning changes.",
      data: entries.slice(0, 10).map((entry) => ({ source: entry.label, amount: round2(entry.amount) })),
      chartType: "table",
      result: {
        topSource: top.label,
        topSourceAmount: round2(top.amount),
        sources: entries.slice(0, 10).map((entry) => ({ source: entry.label, amount: round2(entry.amount) })),
      },
    }),
  };
}

function revenueTimeseriesAnswer(input: ProfitabilityAnswerInput, context: ProfitabilityAssistantContext): ProfitabilityAnswer | null {
  const monthEntries = Object.entries(payloadRecord(context.payload, "revenueByMonth"))
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]))
    .sort((a, b) => a[0].localeCompare(b[0]));
  if (monthEntries.length < 2) {
    return { kind: "refuse", result: profitabilityMissingEvidence(input, "Revenue-over-time analytics are unavailable because the Profitability payload records fewer than two revenue periods.", ["revenue periods"], "profitability.revenue_timeseries") };
  }
  const rows = monthEntries.map(([month, amount]) => ({ period: month, amount: round2(amount) }));
  const first = monthEntries[0];
  const last = monthEntries[monthEntries.length - 1];
  return {
    kind: "value",
    result: answerResult(input, {
      intent: "profitability.revenue_timeseries",
      answer: [
        `Answer: Recorded revenue spans ${monthEntries.length} periods, from ${formatValue(first[1])} (${first[0]}) to the latest recorded period ${last[0]} at ${formatValue(last[1])}.`,
        `Evidence: Values are read from the recorded monthly Profitability payload without recalculation.`,
        "Takeaway: This shows recorded period revenue only; UseClevr does not invent a forecast here.",
        "Next question: Ask: How has my revenue grown?",
      ].join("\n\n"),
      insight: `Recorded revenue periods: ${monthEntries.length}.`,
      explanation: "Time-series values come from the recorded Profitability payload aggregation.",
      recommendation: "Compare revenue movement between the oldest and latest recorded periods.",
      data: rows,
      chartType: "table",
      result: {
        periods: monthEntries.length,
        rows,
      },
    }),
  };
}

function revenueGrowthAnswer(input: ProfitabilityAnswerInput, context: ProfitabilityAssistantContext, growth: number): ProfitabilityAnswer {
  return {
    kind: "value",
    result: answerResult(input, {
      intent: "profitability.revenue_growth",
      answer: `Answer: Recorded revenue growth is ${percentText(growth)} for the recorded reporting period.`,
      insight: `Revenue growth: ${percentText(growth)}.`,
      explanation: "Growth value is the recorded Profitability analysis total without recalculation.",
      recommendation: "Ask: Which revenue source contributes the most?",
      data: [{ metric: "Revenue growth", value: round2(growth), unit: "%" }],
      chartType: "kpi",
      result: {
        revenueGrowth: round2(growth),
        unit: "percent",
      },
    }),
  };
}

function gapAnalysisAnswer(input: ProfitabilityAnswerInput, context: ProfitabilityAssistantContext): ProfitabilityAnswer | null {
  const missingColumns = payloadStringList(context.payload, "missingColumns");
  const unavailableMetrics = payloadStringList(context.payload, "unavailableMetrics");
  const dataQualityNotes = payloadStringList(context.payload, "dataQualityNotes");
  return {
    kind: "value",
    result: answerResult(input, {
      intent: "profitability.data_completeness",
      answer: [
        `Answer: This analysis currently records ${context.metrics.availableFields.length > 0 ? formatList(context.metrics.availableFields) : "no canonical metrics"}.${unavailableMetrics.length > 0 ? ` Unavailable metrics: ${formatList(unavailableMetrics)}.` : ""}`,
        [
          `Evidence: ${missingColumns.length > 0 ? `Missing source data: ${formatList(missingColumns)}.` : "No missing source columns were recorded."}${context.metrics.confidence !== null ? ` Data confidence: ${formatPercent(context.metrics.confidence)}.` : ""}`,
          ...dataQualityNotes.slice(0, 5).map((note) => `- ${note}`),
        ].join("\n"),
        "Takeaway: UseClevr lists the recorded gaps only and will not treat missing metrics as zero.",
        "Next question: Ask: Why is gross profit unavailable? to see the recorded reason for the missing metric.",
      ].join("\n\n"),
      insight: unavailableMetrics.length > 0 ? `Recorded data gaps: ${unavailableMetrics.join(", ")}.` : "No recorded data gaps.",
      explanation: "The gap list is read from the stored Profitability provenance without inference.",
      recommendation: unavailableMetrics.includes("grossProfit")
        ? "Load cost of goods sold data to enable gross profit and gross margin results."
        : "Add the recorded missing source data to expand the analysis.",
      data: [
        ...missingColumns.map((column) => ({ missing: column, kind: "source_column" })),
        ...unavailableMetrics.map((metric) => ({ missing: metric, kind: "metric" })),
        ...(context.metrics.confidence !== null ? [{ missing: "data confidence", value: round2(context.metrics.confidence), kind: "confidence" }] : []),
        ...dataQualityNotes.slice(0, 5).map((note) => ({ missing: note, kind: "note" })),
      ],
      chartType: "table",
      result: {
        missingColumns,
        unavailableMetrics,
        dataConfidence: context.metrics.confidence,
        dataQualityNotes: dataQualityNotes.slice(0, 5),
      },
    }),
  };
}

function availabilityRefusal(
  input: ProfitabilityAnswerInput,
  context: ProfitabilityAssistantContext,
  metricKey: keyof CanonicalFinancialMetrics,
  label: string,
): DatasetAssistantDeterministicResult {
  const explanation = metricKey === "grossProfit" || metricKey === "grossMargin" ? grossProfitUnavailability(context) : null;
  const reason = explanation?.reason
    ?? (context.metrics.missingFields.length > 0
      ? `The Profitability analysis records these metrics as unavailable: ${formatList(context.metrics.missingFields)}.`
      : `${label} is not recorded for this dataset.`);
  return {
    status: "success",
    answer: [
      `Answer: ${label} is unavailable in this dataset.`,
      `Evidence: ${reason}`,
      `Takeaway: UseClevr will not fabricate unavailable Profitability metrics${label === "Gross margin" || label === "Gross profit" ? " and will not reinterpret operating expenses as COGS" : ""}.`,
      "Next question: Ask about a recorded metric, or ask: What additional data would make this analysis more complete?",
    ].join("\n\n"),
    insight: `${label} is unavailable in this dataset.`,
    explanation: "Direct data analysis refuses unrecorded Profitability metrics based on stored provenance.",
    recommendation: "Ask about a metric recorded in this dataset.",
    data: [{ metric: label, status: "unavailable" }],
    chartType: "table",
    result: {
      intent: `profitability.${metricKey}`,
      status: "missing_evidence",
      missingFields: context.metrics.missingFields,
      datasetId: input.datasetId,
      datasetType: "profitability",
    },
  };
}

function profitabilityMissingEvidence(input: ProfitabilityAnswerInput, message: string, missingFields: string[], intent: string): DatasetAssistantDeterministicResult {
  return {
    status: "success",
    answer: [
      `Answer: ${message}`,
      `Evidence: Missing required source evidence: ${formatList(missingFields)}.`,
      "Takeaway: UseClevr will not route recognized Profitability metric gaps to a provider or fabricate values.",
      "Next question: Ask about a Profitability metric backed by recorded source data in this dataset.",
    ].join("\n\n"),
    insight: "Required Profitability source evidence is missing.",
    explanation: "Direct data analysis recognized the question and refused the calculation because the required Profitability payload fields are unavailable.",
    recommendation: "Ask about a Profitability metric backed by recorded source data in this dataset.",
    data: missingFields.map((field) => ({ field, status: "missing" })),
    chartType: "table",
    result: {
      intent,
      status: "missing_evidence",
      missingFields,
      datasetId: input.datasetId,
      datasetType: "profitability",
    },
  };
}

function answerResult(
  input: ProfitabilityAnswerInput,
  extra: {
    intent: string
    answer: string
    insight: string
    explanation: string
    recommendation: string
    data: Array<Record<string, string | number | null>>
    chartType: "kpi" | "table"
    result: Record<string, unknown>
  },
): DatasetAssistantDeterministicResult {
  return {
    status: "success",
    answer: extra.answer,
    insight: extra.insight,
    explanation: extra.explanation,
    recommendation: extra.recommendation,
    data: extra.data,
    chartType: extra.chartType,
    result: {
      intent: extra.intent,
      status: "success",
      confidence: 0.96,
      datasetId: input.datasetId,
      datasetType: "profitability",
      source: "canonical_profitability_metrics",
      ...extra.result,
    },
  };
}

function expenseCategoryEntries(context: ProfitabilityAssistantContext): Array<{ label: string; amount: number; share: number }> {
  const entries = payloadTupleEntries(context.payload, "expenseCategories");
  const total = entries.reduce((sum, entry) => sum + entry[1], 0);
  return entries
    .map((entry): { label: string; amount: number; share: number } => ({
      label: entry[0],
      amount: entry[1],
      share: total > 0 ? (entry[1] / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function topRevenueEntries(context: ProfitabilityAssistantContext): Array<{ label: string; amount: number }> {
  for (const key of ["revenueByProduct", "revenueByCategory", "revenueByCustomer", "revenueByRegion"]) {
    const entries = payloadTupleEntries(context.payload, key);
    if (entries.length > 0) {
      return entries
        .map((entry) => ({ label: entry[0], amount: entry[1] }))
        .sort((a, b) => b.amount - a.amount);
    }
  }
  return [];
}

type RevenueExpenseRatioParts = {
  revenue: number
  expenses: number
  ratio: number
}

/**
 * Canonical revenue-to-expense ratio: stored ratio first, otherwise a ratio
 * computed only from the canonical totals' own invariant (never from rows).
 */
function revenueExpenseRatio(context: ProfitabilityAssistantContext): RevenueExpenseRatioParts | null {
  const storedRatio = payloadNumber(context.payload, "revenueExpenseRatio");
  const revenue = context.metrics.revenue;
  const expenses = context.metrics.operatingExpenses;
  if (typeof storedRatio === "number" && Number.isFinite(storedRatio)) {
    return { revenue: revenue ?? 0, expenses: expenses ?? 0, ratio: storedRatio };
  }
  return revenue !== null && expenses !== null && expenses > 0
    ? { revenue, expenses, ratio: Math.round((revenue / expenses) * 100) / 100 }
    : null;
}

function metricSourceEntry(metricSources: Record<string, unknown>, metricId: string): { kind: string; note: string } | null {
  const entry = metricSources[metricId];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  if (typeof (entry as Record<string, unknown>).note !== "string") return null;
  return entry as { kind: string; note: string };
}

function formatValue(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatNumber(value: number): string {
  return formatValue(value);
}

function metricText(value: number, unit: string | null): string {
  return unit === "%" ? formatPercent(value) : formatValue(value);
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}%`;
}

function percentText(value: number): string {
  return `${value > 0 ? "+" : ""}${formatPercent(value)}`;
}

function formatList(values: string[]): string {
  return values.join(", ");
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
