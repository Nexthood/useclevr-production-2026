import { resolveQuestionMetric } from "@/lib/data/metric-resolver";
import {
  buildSemanticSchema,
  detectDatasetSemanticCapabilities,
  findExpenseTypeColumn,
  findMonetaryAmountColumn,
  parseBusinessNumber,
  semanticColumn,
} from "@/lib/data/semantic-schema";
import { analyzeTransactionAmountAnomalies } from "@/lib/data/transaction-anomaly-analysis";
import {
  answerRetailInventoryQuestionDeterministically,
  hasRetailInventoryDeterministicCapability,
  isRetailInventoryQuestion,
} from "@/lib/data/retail-inventory-intents";

export type DatasetAssistantDeterministicResult = {
  status: "success";
  answer: string;
  insight: string;
  explanation: string;
  recommendation?: string;
  data: Array<Record<string, string | number | null>>;
  chartType: "kpi" | "table";
  result: Record<string, unknown>;
};

type DatasetAssistantInput = {
  question: string;
  datasetId: string;
  datasetType: string;
  columns: string[];
  rows: Record<string, unknown>[];
};

type SegmentSummary = {
  dimension: string;
  segment: string;
  revenue: number;
  rows: number;
  sharePct: number;
};

type PeriodSummary = {
  period: string;
  revenue: number;
  rows: number;
};

const DIMENSION_PATTERNS = [
  /plan/i,
  /startup[_\s-]*stage|stage/i,
  /acquisition[_\s-]*channel|channel/i,
  /region/i,
  /country/i,
  /category|segment/i,
  /product|sku|item/i,
  /customer|client/i,
  /seller|vendor|merchant/i,
  /buyer|purchaser/i,
  /order|transaction|invoice/i,
  /channel/i,
];

export function answerDatasetQuestionDeterministically(
  input: DatasetAssistantInput,
): DatasetAssistantDeterministicResult | null {
  const question = input.question.trim();
  if (!question || input.rows.length === 0) return null;

  const retailInventoryResult = answerRetailInventoryQuestionDeterministically(input);
  if (retailInventoryResult) return retailInventoryResult;

  const resolvedMetric = resolveQuestionMetric(input);
  if (resolvedMetric.status === "success") {
    return {
      status: "success",
      answer: resolvedMetric.answer,
      insight: resolvedMetric.insight,
      explanation: resolvedMetric.explanation,
      recommendation: resolvedMetric.nextQuestion,
      data: resolvedMetric.data,
      chartType: resolvedMetric.chartType,
      result: resolvedMetric.result,
    };
  }
  if (resolvedMetric.status === "unsupported") {
    return {
      status: "success",
      answer: `Answer: ${resolvedMetric.message}\n\nInsight: Required data is missing for the requested metric.\n\nTakeaway: UseClevr will not substitute another metric or return a generic revenue summary.\n\nNext question: Ask about a metric available in the selected dataset.`,
      insight: "Required data is missing for the requested metric.",
      explanation: "The Question Intent Engine classified the question before calculation and the Metric Resolver rejected the calculation because required fields were unavailable.",
      recommendation: "Ask about a metric available in the selected dataset.",
      data: resolvedMetric.missingFields.map((field) => ({ field, status: "missing" })),
      chartType: "table",
      result: {
        intent: resolvedMetric.intent,
        status: "missing_data",
        missingFields: resolvedMetric.missingFields,
        datasetId: input.datasetId,
        datasetType: input.datasetType,
      },
    };
  }

  const schema = buildSemanticSchema(input);
  if (isExpenseQuestion(question)) {
    return describeExpenseCapability({ ...input, schema });
  }

  if (isAnomalyQuestion(question)) {
    return describeTransactionAnomalies({ ...input, schema });
  }

  if (isLargestTransactionQuestion(question)) {
    return describeLargestTransactions({ ...input, schema });
  }

  const revenueColumn = semanticColumn(schema, "revenue");
  if (!revenueColumn) return null;
  const currencyCode = schema.currencyCode;

  const dimensionColumns = findDimensionColumns(input.columns, revenueColumn);
  if (isExplicitRevenueTrendQuestion(question)) {
    return describeRevenueTrend({ ...input, revenueColumn, currencyCode });
  }

  const target = findRequestedSegment(question, input.rows, dimensionColumns);
  if (target) {
    return describeRequestedSegment({ ...input, revenueColumn, currencyCode, dimension: target.dimension, segment: target.segment });
  }

  if (isRevenueRiskQuestion(question)) {
    return describeRevenueRisks({ ...input, revenueColumn, currencyCode, dimensionColumns });
  }

  if (isBestSegmentQuestion(question)) {
    return describeBestSegments({ ...input, revenueColumn, currencyCode, dimensionColumns });
  }

  if (isGrowthQuestion(question)) {
    return describeRevenueTrend({ ...input, revenueColumn, currencyCode });
  }

  if (isForecastQuestion(question)) {
    const trend = describeRevenueTrend({ ...input, revenueColumn, currencyCode });
    if (!trend) return null;
    return {
      ...trend,
      answer: `${trend.answer}\n\nUseClevr has not generated a forecast from this chat request, so I will not invent future values. Use the observed trend above as the grounded baseline.`,
      recommendation: "Open the dataset forecast workflow for modelled future-period projections.",
    };
  }

  if (isDatasetSummaryQuestion(question)) {
    return describeDatasetSummary({ ...input, revenueColumn, currencyCode, dimensionColumns });
  }

  return null;
}

export function canAnswerDatasetSuggestionDeterministically(input: DatasetAssistantInput) {
  if (hasRetailInventoryDeterministicCapability(input)) return true;
  if (isRetailInventoryQuestion(input.question)) return false;
  return resolveQuestionMetric(input).status === "success";
}

function describeTransactionAnomalies(input: DatasetAssistantInput & {
  schema: ReturnType<typeof buildSemanticSchema>;
}): DatasetAssistantDeterministicResult {
  const analysis = analyzeTransactionAmountAnomalies({
    rows: input.rows,
    columns: input.columns,
  });
  const currencyCode = input.schema.currencyCode;

  if (analysis.status === "missing_amount") {
    return {
      status: "success",
      answer: [
        "Answer: I can't detect unusual transactions because no validated transaction amount field was found.",
        "Evidence: Quantity, item count, ID, SKU, tax rate, and similar numeric identifier fields are not valid transaction amount fields.",
        "Takeaway: UseClevr will not run anomaly detection on arbitrary numeric columns.",
        "Next question: Upload or map an amount, transaction amount, payment amount, invoice amount, or transaction total field.",
      ].join("\n\n"),
      insight: "No validated transaction amount field is available for anomaly detection.",
      explanation: "Direct data analysis refused transaction anomaly detection because amount semantics were missing.",
      recommendation: "Upload or map a transaction amount field before asking for outliers.",
      data: [{ capability: "transaction_amount", status: "unavailable" }],
      chartType: "table",
      result: anomalyResult(input, analysis),
    };
  }

  if (analysis.status === "insufficient_data") {
    return {
      status: "success",
      answer: [
        "Answer: There are not enough valid transaction amounts in this period to reliably detect statistical outliers.",
        `Evidence: ${analysis.validCount.toLocaleString("en-US")} valid amount value(s) were found in "${analysis.amountColumn}". At least 8 valid values are required for this IQR check.${analysis.invalidCount > 0 ? ` ${analysis.invalidCount.toLocaleString("en-US")} invalid or blank value(s) were excluded.` : ""}`,
        `Takeaway: I can show the largest transactions, but I can't reliably classify them as unusual.${analysis.largest ? ` The largest transaction is ${analysis.largest.label} at ${formatValue(analysis.largest.amount, currencyCode)}.` : ""}`,
        "Next question: Add more transaction rows or ask for the largest transactions instead.",
      ].join("\n\n"),
      insight: "Insufficient valid transaction amounts for reliable anomaly detection.",
      explanation: "Direct data analysis requires a minimum sample before applying IQR outlier detection.",
      recommendation: "Add more valid transaction rows or ask for largest transactions.",
      data: analysis.largest ? [{ label: analysis.largest.label, amount: analysis.largest.amount, status: "largest_only" }] : [],
      chartType: "table",
      result: anomalyResult(input, analysis),
    };
  }

  if (analysis.candidates.length === 0) {
    return {
      status: "success",
      answer: [
        "Answer: I didn't detect any strong transaction-amount outliers for this period.",
        `Evidence: Median transaction: ${formatValue(analysis.median || 0, currencyCode)}. Q1: ${formatValue(analysis.q1 || 0, currencyCode)}. Q3: ${formatValue(analysis.q3 || 0, currencyCode)}. IQR: ${formatValue(analysis.iqr || 0, currencyCode)}. Upper outlier threshold: ${formatValue(analysis.upperThreshold || 0, currencyCode)}.${analysis.invalidCount > 0 ? ` ${analysis.invalidCount.toLocaleString("en-US")} invalid or blank value(s) were excluded.` : ""}`,
        `Takeaway: No strong transaction-amount anomalies were detected.${analysis.largest ? ` The largest transaction was ${analysis.largest.label} at ${formatValue(analysis.largest.amount, currencyCode)}, but it does not exceed the anomaly threshold.` : ""}`,
        "Next question: No anomaly review is required based on transaction amount alone.",
      ].join("\n\n"),
      insight: "No strong transaction-amount outliers were detected.",
      explanation: `Applied IQR outlier detection to "${analysis.amountColumn}" after excluding invalid values.`,
      recommendation: "No anomaly review is required based on transaction amount alone.",
      data: [
        { metric: "Median transaction", value: analysis.median },
        { metric: "Upper outlier threshold", value: analysis.upperThreshold },
      ],
      chartType: "table",
      result: anomalyResult(input, analysis),
    };
  }

  return {
    status: "success",
    answer: [
      `Answer: Yes. I found ${analysis.candidates.length.toLocaleString("en-US")} ${analysis.candidates.length === 1 ? "transaction that is" : "transactions that are"} statistically unusual compared with the typical transaction size this period.`,
      [
        `Evidence: Median transaction: ${formatValue(analysis.median || 0, currencyCode)}`,
        `Q1: ${formatValue(analysis.q1 || 0, currencyCode)}`,
        `Q3: ${formatValue(analysis.q3 || 0, currencyCode)}`,
        `IQR: ${formatValue(analysis.iqr || 0, currencyCode)}`,
        `Upper outlier threshold: ${formatValue(analysis.upperThreshold || 0, currencyCode)}`,
        ...(analysis.invalidCount > 0 ? [`${analysis.invalidCount.toLocaleString("en-US")} invalid or blank value(s) were excluded.`] : []),
        ...analysis.candidates.slice(0, 5).map((candidate) => `${candidate.label}: ${formatValue(candidate.amount, currencyCode)} - ${candidate.thresholdMultiple ?? "above"}x threshold, ${candidate.medianMultiple ?? "above"}x median${candidate.context ? ` (${candidate.context})` : ""}`),
      ].join("\n"),
      "Takeaway: These transactions are statistical outlier candidates, not proof of an error or misconduct.",
      "Next question: Review the flagged outlier transactions and confirm that the amounts and categories are expected.",
    ].join("\n\n"),
    insight: `${analysis.candidates.length.toLocaleString("en-US")} transaction-amount outlier candidate${analysis.candidates.length === 1 ? "" : "s"} detected.`,
    explanation: `Applied IQR outlier detection to "${analysis.amountColumn}" using ${analysis.validCount.toLocaleString("en-US")} valid amount values.`,
    recommendation: "Review the flagged outlier transactions and confirm that the amounts and categories are expected.",
    data: analysis.candidates.map((candidate) => ({
      label: candidate.label,
      amount: candidate.amount,
      medianMultiple: candidate.medianMultiple,
      thresholdMultiple: candidate.thresholdMultiple,
      context: candidate.context,
      status: "outlier_candidate",
    })),
    chartType: "table",
    result: anomalyResult(input, analysis),
  };
}

function describeLargestTransactions(input: DatasetAssistantInput & {
  schema: ReturnType<typeof buildSemanticSchema>;
}): DatasetAssistantDeterministicResult {
  const analysis = analyzeTransactionAmountAnomalies({
    rows: input.rows,
    columns: input.columns,
    minimumValidCount: 1,
  });
  if (!analysis.amountColumn || !analysis.largest) {
    return {
      status: "success",
      answer: [
        "Answer: I can't rank largest transactions because no validated transaction amount field was found.",
        "Evidence: Quantity, IDs, SKUs, rates, and counts are not valid transaction amount fields.",
        "Takeaway: UseClevr will not rank arbitrary numeric columns as transaction values.",
        "Next question: Upload or map an amount, transaction amount, payment amount, invoice amount, or transaction total field.",
      ].join("\n\n"),
      insight: "No validated transaction amount field is available for largest-transaction ranking.",
      explanation: "Direct data analysis refused largest-transaction ranking because amount semantics were missing.",
      recommendation: "Upload or map a transaction amount field.",
      data: [{ capability: "transaction_amount", status: "unavailable" }],
      chartType: "table",
      result: {
        intent: "largest_transactions",
        status: "missing_amount",
        confidence: 0.4,
        datasetId: input.datasetId,
        datasetType: input.datasetType,
      },
    };
  }
  const amountColumn = analysis.amountColumn;
  const rows = input.rows
    .map((row, rowIndex) => ({ row, rowIndex, amount: parseBusinessNumber(row[amountColumn]) }))
    .filter((row): row is { row: Record<string, unknown>; rowIndex: number; amount: number } => row.amount !== null)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 10)
    .map((row) => ({
      label: labelForTransactionRow(row.row, row.rowIndex),
      amount: round(row.amount),
      context: contextForTransactionRow(row.row, amountColumn),
    }));

  return {
    status: "success",
    answer: [
      `Answer: The largest transaction is ${rows[0].label} at ${formatValue(rows[0].amount, input.schema.currencyCode)}.`,
      `Evidence: Ranked ${analysis.validCount.toLocaleString("en-US")} valid transaction amount value(s) from "${amountColumn}" by absolute amount.`,
      "Takeaway: This ranking shows the largest transaction amounts only; it does not classify them as unusual.",
      "Next question: Ask about unusual transactions to run statistical outlier detection.",
    ].join("\n\n"),
    insight: `Largest transaction: ${rows[0].label}.`,
    explanation: `Ranked validated transaction values from "${amountColumn}".`,
    recommendation: "Ask about unusual transactions to run statistical outlier detection.",
    data: rows,
    chartType: "table",
    result: {
      intent: "largest_transactions",
      status: "success",
      confidence: 0.9,
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      amountColumn,
      rows,
    },
  };
}

function describeExpenseCapability(input: DatasetAssistantInput & {
  schema: ReturnType<typeof buildSemanticSchema>;
}): DatasetAssistantDeterministicResult {
  const capabilities = detectDatasetSemanticCapabilities({ schema: input.schema, rows: input.rows });
  if (!capabilities.hasExpenseData) {
    const alternatives = availableExpenseAlternatives(capabilities);
    return {
      status: "success",
      answer: [
        "Answer: No expense or cost data was detected in this dataset, so I can't reliably determine your largest expenses.",
        `Insight: ${capabilities.hasRevenueData ? "The available data appears to contain sales or revenue records." : "Generic monetary fields such as amount, total, value, transaction, or price are semantically ambiguous."}`,
        "Evidence: No validated expense category, cost field, debit classification, or trusted expense mapping was found.",
        "Takeaway: UseClevr will not classify generic numeric values as expenses.",
        `Next question: ${alternatives}`,
      ].join("\n\n"),
      insight: "No validated expense or cost semantics were detected.",
      explanation: "Direct data analysis checked semantic field mappings and classifier values before refusing the expense calculation.",
      recommendation: alternatives,
      data: [
        { capability: "expense_data", status: "unavailable", evidence: "No reliable expense/cost semantics found." },
        { capability: "revenue_data", status: capabilities.hasRevenueData ? "available" : "unavailable", evidence: capabilities.revenueEvidence.join(" ") || null },
      ],
      chartType: "table",
      result: {
        intent: "ranking.top_expenses",
        status: "unsupported_semantics",
        confidence: 0.94,
        datasetId: input.datasetId,
        datasetType: input.datasetType,
        hasExpenseData: false,
        hasRevenueData: capabilities.hasRevenueData,
        evidence: capabilities.expenseEvidence,
      },
    };
  }

  const expenseColumn = semanticColumn(input.schema, "expenses") || semanticColumn(input.schema, "cogs");
  const typeColumn = findExpenseTypeColumn(input.rows, input.columns);
  const amountColumn = typeColumn ? findMonetaryAmountColumn(input.rows, input.columns) : null;
  const valueColumn = expenseColumn || amountColumn;
  if (!valueColumn) {
    return {
      status: "success",
      answer: [
        "Answer: Expense analysis unavailable: expense semantics were detected, but no numeric expense amount field was validated.",
        `Evidence: ${capabilities.expenseEvidence.join(" ")}`,
        "Takeaway: UseClevr needs both expense classification and numeric amount values before calculating largest expenses.",
        "Next question: Upload or map an expense amount, debit, cost, COGS, or unit cost field.",
      ].join("\n\n"),
      insight: "Expense labels exist, but no numeric expense amount is available.",
      explanation: "Direct data analysis refused the calculation because amount semantics were incomplete.",
      recommendation: "Upload or map an expense amount, debit, cost, COGS, or unit cost field.",
      data: capabilities.expenseEvidence.map((evidence) => ({ evidence })),
      chartType: "table",
      result: {
        intent: "ranking.top_expenses",
        status: "missing_amount",
        confidence: 0.9,
        datasetId: input.datasetId,
        datasetType: input.datasetType,
        evidence: capabilities.expenseEvidence,
      },
    };
  }

  const groupColumn = expenseGroupColumn(input.columns, valueColumn, typeColumn);
  const rows = expenseRows(input.rows, valueColumn, groupColumn, typeColumn).slice(0, 10);
  const top = rows[0];
  const evidence = capabilities.expenseEvidence.join(" ");
  return {
    status: "success",
    answer: [
      `Answer: ${top ? `${top.segment} is the largest detected expense/cost at ${formatValue(top.amount, input.schema.currencyCode)}.` : "No expense rows with numeric values were found."}`,
      `Evidence: ${evidence}`,
      `Takeaway: ${top ? "This calculation uses only validated expense/cost semantics." : "Expense semantics exist, but matching rows have no usable numeric values."}`,
      "Next question: Ask for expense trends, supplier concentration, or margin if revenue is also available.",
    ].join("\n\n"),
    insight: top ? `Largest detected expense/cost: ${top.segment}.` : "No numeric expense rows were available.",
    explanation: `Calculated from ${typeColumn ? `classifier "${typeColumn}" and amount column "${valueColumn}"` : `validated cost column "${valueColumn}"`}.`,
    recommendation: "Ask for expense trends, supplier concentration, or margin if revenue is also available.",
    data: rows,
    chartType: "table",
    result: {
      intent: "ranking.top_expenses",
      status: "success",
      confidence: 0.9,
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      expenseColumn: valueColumn,
      expenseTypeColumn: typeColumn,
      groupColumn,
      evidence: capabilities.expenseEvidence,
      rows,
    },
  };
}

function describeRequestedSegment(input: DatasetAssistantInput & {
  revenueColumn: string;
  currencyCode: string | null;
  dimension: string;
  segment: string;
}): DatasetAssistantDeterministicResult {
  const summaries = summarizeDimension(input.rows, input.dimension, input.revenueColumn);
  const segment = summaries.find((row) => row.segment.toLowerCase() === input.segment.toLowerCase()) ??
    summarizeSegment(input.rows, input.dimension, input.segment, input.revenueColumn);
  const totalRevenue = sumRevenue(input.rows, input.revenueColumn);
  const periods = summarizePeriodsForSegment(input.rows, input.dimension, input.segment, input.revenueColumn);
  const trendText = trendSentence(periods);
  const formattedRevenue = formatValue(segment.revenue, input.currencyCode);

  return {
    status: "success",
    answer: `${segment.segment} in ${humanizeColumn(input.dimension)} generated ${formattedRevenue} across ${segment.rows} row${segment.rows === 1 ? "" : "s"}${totalRevenue > 0 ? `, representing ${segment.sharePct.toFixed(1)}% of detected revenue` : ""}.${trendText ? ` ${trendText}` : ""}`,
    insight: `${segment.segment} is a ${humanizeColumn(input.dimension)} segment with ${formattedRevenue} in detected revenue.`,
    explanation: `Calculated from column "${input.dimension}" matched to "${segment.segment}" and revenue column "${input.revenueColumn}".`,
    recommendation: periods.length >= 2 && periods[periods.length - 1].revenue < periods[periods.length - 2].revenue
      ? `Review what changed for ${segment.segment} between ${periods[periods.length - 2].period} and ${periods[periods.length - 1].period}.`
      : `Compare ${segment.segment} against the top ${humanizeColumn(input.dimension)} segments for growth, risk, and next actions.`,
    data: [
      {
        dimension: humanizeColumn(input.dimension),
        segment: segment.segment,
        revenue: round(segment.revenue),
        rows: segment.rows,
        sharePct: round(segment.sharePct, 1),
      },
      ...periods.slice(-4).map((period) => ({
        dimension: "Period",
        segment: period.period,
        revenue: round(period.revenue),
        rows: period.rows,
        sharePct: null,
      })),
    ],
    chartType: "table",
    result: {
      intent: "segment_lookup",
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      dimension: input.dimension,
      segment: segment.segment,
      revenueColumn: input.revenueColumn,
      revenue: round(segment.revenue),
      sharePct: round(segment.sharePct, 1),
      periods,
    },
  };
}

function describeRevenueRisks(input: DatasetAssistantInput & {
  revenueColumn: string;
  currencyCode: string | null;
  dimensionColumns: string[];
}): DatasetAssistantDeterministicResult | null {
  const periodRisks = revenuePeriodRisks(input.rows, input.revenueColumn);
  const weakSegments = input.dimensionColumns
    .flatMap((dimension) => summarizeDimension(input.rows, dimension, input.revenueColumn)
      .slice(-3)
      .map((segment) => ({ ...segment, dimension })))
    .sort((a, b) => a.sharePct - b.sharePct)
    .slice(0, 5);
  const concentration = input.dimensionColumns
    .flatMap((dimension) => summarizeDimension(input.rows, dimension, input.revenueColumn)
      .slice(0, 1)
      .map((segment) => ({ ...segment, dimension })))
    .sort((a, b) => b.sharePct - a.sharePct)[0];

  const rows = [
    ...periodRisks.map((risk) => ({
      risk: "Revenue trend",
      detail: `${risk.previousPeriod} to ${risk.currentPeriod}`,
      value: round(risk.changePct, 1),
      revenue: round(risk.currentRevenue),
    })),
    ...weakSegments.map((segment) => ({
      risk: `Weak ${humanizeColumn(segment.dimension)}`,
      detail: segment.segment,
      value: round(segment.sharePct, 1),
      revenue: round(segment.revenue),
    })),
    ...(concentration && concentration.sharePct >= 50
      ? [{
        risk: "Revenue concentration",
        detail: `${concentration.segment} in ${humanizeColumn(concentration.dimension)}`,
        value: round(concentration.sharePct, 1),
        revenue: round(concentration.revenue),
      }]
      : []),
  ];

  if (rows.length === 0) return null;

  const leadingRisk = rows[0];
  return {
    status: "success",
    answer: `The biggest grounded revenue risk is ${String(leadingRisk.detail)}. ${riskExplanation(rows)}`,
    insight: `UseClevr found ${rows.length} revenue risk signal${rows.length === 1 ? "" : "s"} from the selected dataset.`,
    explanation: `Calculated from revenue column "${input.revenueColumn}" and available segment/date columns. No provider-generated values were used.`,
    recommendation: "Prioritize the largest negative period movement first, then review low-revenue segments and any high concentration risk.",
    data: rows,
    chartType: "table",
    result: {
      intent: "revenue_risks",
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      revenueColumn: input.revenueColumn,
      risks: rows,
    },
  };
}

function describeBestSegments(input: DatasetAssistantInput & {
  revenueColumn: string;
  currencyCode: string | null;
  dimensionColumns: string[];
}): DatasetAssistantDeterministicResult | null {
  const rows = input.dimensionColumns
    .flatMap((dimension) => summarizeDimension(input.rows, dimension, input.revenueColumn)
      .slice(0, 3)
      .map((segment) => ({
        dimension: humanizeColumn(dimension),
        segment: segment.segment,
        revenue: round(segment.revenue),
        rows: segment.rows,
        sharePct: round(segment.sharePct, 1),
      })))
    .sort((a, b) => Number(b.revenue) - Number(a.revenue))
    .slice(0, 8);

  if (rows.length === 0) return null;
  const best = rows[0];
  return {
    status: "success",
    answer: `${best.segment} is the strongest detected segment, with ${formatValue(Number(best.revenue), input.currencyCode)} in revenue.`,
    insight: `Best segment: ${best.segment} (${best.dimension}).`,
    explanation: `Ranked available segment columns by summed revenue from "${input.revenueColumn}".`,
    recommendation: "Use the top segments as benchmarks, then compare trend and margin where those fields are available.",
    data: rows,
    chartType: "table",
    result: {
      intent: "best_segments",
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      revenueColumn: input.revenueColumn,
      segments: rows,
    },
  };
}

function describeRevenueTrend(input: DatasetAssistantInput & {
  revenueColumn: string;
  currencyCode: string | null;
}): DatasetAssistantDeterministicResult | null {
  const periods = summarizePeriods(input.rows, input.revenueColumn);
  if (periods.length < 2) return null;
  const previous = periods[periods.length - 2];
  const current = periods[periods.length - 1];
  const change = current.revenue - previous.revenue;
  const changePct = previous.revenue === 0 ? null : (change / previous.revenue) * 100;
  const direction = change >= 0 ? "increased" : "declined";

  return {
    status: "success",
    answer: `Revenue ${direction} from ${formatValue(previous.revenue, input.currencyCode)} in ${previous.period} to ${formatValue(current.revenue, input.currencyCode)} in ${current.period}${changePct === null ? "" : ` (${formatSignedPercent(changePct)})`}.`,
    insight: `Latest period revenue: ${formatValue(current.revenue, input.currencyCode)}.`,
    explanation: `Grouped rows by detected date/period column and summed "${input.revenueColumn}".`,
    recommendation: change < 0 ? "Review the segments contributing most to the latest-period decline." : "Review which segments drove the latest-period increase and whether it is repeatable.",
    data: periods.slice(-6).map((period) => ({
      period: period.period,
      revenue: round(period.revenue),
      rows: period.rows,
    })),
    chartType: "table",
    result: {
      intent: "revenue_trend_summary",
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      revenueColumn: input.revenueColumn,
      periods,
      latestChangePct: changePct === null ? null : round(changePct, 1),
    },
  };
}

function describeDatasetSummary(input: DatasetAssistantInput & {
  revenueColumn: string;
  currencyCode: string | null;
  dimensionColumns: string[];
}): DatasetAssistantDeterministicResult {
  const totalRevenue = sumRevenue(input.rows, input.revenueColumn);
  const topSegments = input.dimensionColumns
    .flatMap((dimension) => summarizeDimension(input.rows, dimension, input.revenueColumn)
      .slice(0, 2)
      .map((segment) => ({
        dimension: humanizeColumn(dimension),
        segment: segment.segment,
        revenue: round(segment.revenue),
        rows: segment.rows,
        sharePct: round(segment.sharePct, 1),
      })))
    .sort((a, b) => Number(b.revenue) - Number(a.revenue))
    .slice(0, 5);
  const trend = describeRevenueTrend(input);
  const topText = topSegments.length
    ? ` Top segment: ${topSegments[0].segment} (${topSegments[0].dimension}) with ${formatValue(Number(topSegments[0].revenue), input.currencyCode)}.`
    : "";

  return {
    status: "success",
    answer: `The selected dataset contains ${input.rows.length.toLocaleString("en-US")} usable rows and ${input.columns.length.toLocaleString("en-US")} columns. Detected revenue totals ${formatValue(totalRevenue, input.currencyCode)}.${topText}${trend ? ` ${trend.answer}` : ""}`,
    insight: `Detected revenue total: ${formatValue(totalRevenue, input.currencyCode)}.`,
    explanation: `Calculated from revenue column "${input.revenueColumn}" and available dataset rows. No provider-generated values were used.`,
    recommendation: topSegments.length
      ? "Ask about a specific segment, plan, channel, region, or revenue risk for a narrower answer."
      : "Ask about revenue trend, totals, data quality, or a specific column for a narrower answer.",
    data: topSegments.length ? topSegments : [{ metric: "Detected revenue", value: round(totalRevenue), rows: input.rows.length }],
    chartType: "table",
    result: {
      intent: "dataset_grounded_summary",
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      revenueColumn: input.revenueColumn,
      revenue: round(totalRevenue),
      topSegments,
      latestTrend: trend?.result ?? null,
    },
  };
}

function findRequestedSegment(question: string, rows: Record<string, unknown>[], dimensions: string[]) {
  const normalizedQuestion = normalizeToken(question);
  for (const dimension of dimensions) {
    const values = uniqueValues(rows, dimension);
    for (const value of values) {
      if (normalizeToken(value) && normalizedQuestion.includes(normalizeToken(value))) {
        return { dimension, segment: value };
      }
    }
  }
  return null;
}

function findDimensionColumns(columns: string[], revenueColumn: string) {
  return columns
    .filter((column) => column !== revenueColumn)
    .filter((column) => DIMENSION_PATTERNS.some((pattern) => pattern.test(column)))
    .slice(0, 8);
}

function summarizeDimension(rows: Record<string, unknown>[], dimension: string, revenueColumn: string): SegmentSummary[] {
  const totalRevenue = sumRevenue(rows, revenueColumn);
  const groups = new Map<string, { revenue: number; rows: number }>();
  for (const row of rows) {
    const segment = String(row[dimension] ?? "Unknown").trim() || "Unknown";
    const current = groups.get(segment) ?? { revenue: 0, rows: 0 };
    current.revenue += parseBusinessNumber(row[revenueColumn]) ?? 0;
    current.rows += 1;
    groups.set(segment, current);
  }
  return Array.from(groups.entries())
    .map(([segment, value]) => ({
      dimension,
      segment,
      revenue: round(value.revenue),
      rows: value.rows,
      sharePct: totalRevenue > 0 ? round((value.revenue / totalRevenue) * 100, 1) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

function summarizeSegment(rows: Record<string, unknown>[], dimension: string, segment: string, revenueColumn: string): SegmentSummary {
  const matchedRows = rows.filter((row) => String(row[dimension] ?? "").trim().toLowerCase() === segment.toLowerCase());
  const revenue = sumRevenue(matchedRows, revenueColumn);
  const totalRevenue = sumRevenue(rows, revenueColumn);
  return {
    dimension,
    segment,
    revenue: round(revenue),
    rows: matchedRows.length,
    sharePct: totalRevenue > 0 ? round((revenue / totalRevenue) * 100, 1) : 0,
  };
}

function summarizePeriodsForSegment(
  rows: Record<string, unknown>[],
  dimension: string,
  segment: string,
  revenueColumn: string,
) {
  const allowedPeriods = completePeriodKeys(rows);
  return summarizePeriods(
    rows.filter((row) => String(row[dimension] ?? "").trim().toLowerCase() === segment.toLowerCase()),
    revenueColumn,
    allowedPeriods,
  );
}

function summarizePeriods(rows: Record<string, unknown>[], revenueColumn: string, allowedPeriods?: Set<string>): PeriodSummary[] {
  const dateColumn = findDateColumn(rows);
  if (!dateColumn) return [];
  const groups = new Map<string, { revenue: number; rows: number }>();
  for (const row of rows) {
    const period = monthKey(row[dateColumn]);
    if (!period) continue;
    if (allowedPeriods && !allowedPeriods.has(period)) continue;
    const current = groups.get(period) ?? { revenue: 0, rows: 0 };
    current.revenue += parseBusinessNumber(row[revenueColumn]) ?? 0;
    current.rows += 1;
    groups.set(period, current);
  }
  const periods = Array.from(groups.entries())
    .map(([period, value]) => ({ period, revenue: round(value.revenue), rows: value.rows }))
    .sort((a, b) => a.period.localeCompare(b.period));
  if (allowedPeriods) return periods;
  const complete = completePeriodKeys(rows);
  return complete.size > 0 ? periods.filter((period) => complete.has(period.period)) : periods;
}

function completePeriodKeys(rows: Record<string, unknown>[]) {
  const dateColumn = findDateColumn(rows);
  if (!dateColumn) return new Set<string>();
  const counts = new Map<string, number>();
  for (const row of rows) {
    const period = monthKey(row[dateColumn]);
    if (!period) continue;
    counts.set(period, (counts.get(period) ?? 0) + 1);
  }
  const entries = Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length <= 2) return new Set(entries.map(([period]) => period));
  const maxCount = Math.max(...entries.map(([, count]) => count));
  const trailingPeriod = entries[entries.length - 1][0];
  return new Set(entries
    .filter(([period, count]) => period !== trailingPeriod || count >= maxCount * 0.5)
    .map(([period]) => period));
}

function revenuePeriodRisks(rows: Record<string, unknown>[], revenueColumn: string) {
  const periods = summarizePeriods(rows, revenueColumn);
  const risks: Array<{
    previousPeriod: string;
    currentPeriod: string;
    previousRevenue: number;
    currentRevenue: number;
    changePct: number;
  }> = [];
  for (let index = 1; index < periods.length; index += 1) {
    const previous = periods[index - 1];
    const current = periods[index];
    if (previous.revenue <= 0 || current.revenue >= previous.revenue) continue;
    risks.push({
      previousPeriod: previous.period,
      currentPeriod: current.period,
      previousRevenue: previous.revenue,
      currentRevenue: current.revenue,
      changePct: round(((current.revenue - previous.revenue) / previous.revenue) * 100, 1),
    });
  }
  return risks.sort((a, b) => a.changePct - b.changePct).slice(0, 3);
}

function uniqueValues(rows: Record<string, unknown>[], column: string) {
  return Array.from(new Set(rows.map((row) => String(row[column] ?? "").trim()).filter(Boolean))).slice(0, 200);
}

function sumRevenue(rows: Record<string, unknown>[], revenueColumn: string) {
  return rows.reduce((total, row) => total + (parseBusinessNumber(row[revenueColumn]) ?? 0), 0);
}

function findDateColumn(rows: Record<string, unknown>[]) {
  const sample = rows[0] ?? {};
  return Object.keys(sample).find((column) => /date|month|period/i.test(column));
}

function monthKey(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const monthMatch = text.match(/^(\d{4})-(\d{2})/);
  if (monthMatch) return `${monthMatch[1]}-${monthMatch[2]}`;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}`;
}

function trendSentence(periods: PeriodSummary[]) {
  if (periods.length < 2) return "";
  const previous = periods[periods.length - 2];
  const current = periods[periods.length - 1];
  if (previous.revenue === 0) return "";
  const changePct = ((current.revenue - previous.revenue) / previous.revenue) * 100;
  return `Latest comparable movement: ${previous.period} ${formatNumber(previous.revenue)} to ${current.period} ${formatNumber(current.revenue)} (${formatSignedPercent(changePct)}).`;
}

function riskExplanation(rows: Array<Record<string, string | number | null>>) {
  const trend = rows.find((row) => row.risk === "Revenue trend");
  if (trend) return `Detected revenue declined ${formatSignedPercent(Number(trend.value))} for ${trend.detail}.`;
  const weak = rows.find((row) => String(row.risk).startsWith("Weak"));
  if (weak) return `${weak.detail} contributes only ${Number(weak.value).toFixed(1)}% of detected revenue.`;
  return "The dataset shows revenue concentration that should be reviewed.";
}

function isRevenueRiskQuestion(question: string) {
  return /risk|weak|problem|concern|declin|drop|down|loss/i.test(question) && /revenue|sales|segment|plan|growth/i.test(question);
}

function isBestSegmentQuestion(question: string) {
  return /best|top|strong|largest|highest|perform/i.test(question) && /segment|plan|channel|region|country|product|customer|category/i.test(question);
}

function isExpenseQuestion(question: string) {
  return /expense|expenses|spend|spending|cost|costs|opex|operating\s+expense|money\s+going/i.test(question) &&
    /largest|biggest|top|most|where|show|what|which|total|category/i.test(question);
}

function isAnomalyQuestion(question: string) {
  return /unusual|anomal|outlier|abnormal|stand(s)?\s+out|suspicious/i.test(question) &&
    /transaction|payment|amount|anything|any|value/i.test(question);
}

function isLargestTransactionQuestion(question: string) {
  return /largest|biggest|highest[-\s]*value|top/i.test(question) && /transaction|payment|amount|value/i.test(question);
}

function availableExpenseAlternatives(capabilities: ReturnType<typeof detectDatasetSemanticCapabilities>) {
  const alternatives: string[] = [];
  if (capabilities.hasRevenueData) {
    alternatives.push("largest revenue categories", "top-selling products", "biggest revenue transactions", "sales trends");
  }
  if (alternatives.length === 0) return "Ask about data quality, row counts, or upload a dataset with expense/cost columns.";
  return `I can analyze ${alternatives.join(", ")} instead.`;
}

function expenseGroupColumn(columns: string[], valueColumn: string, typeColumn: string | null) {
  const candidates = columns.filter((column) => column !== valueColumn && column !== typeColumn);
  return candidates.find((column) => /category|account/i.test(column)) ??
    candidates.find((column) => /supplier|vendor|merchant/i.test(column)) ??
    candidates.find((column) => /product/i.test(column)) ??
    candidates.find((column) => /description/i.test(column)) ??
    null;
}

function expenseRows(rows: Record<string, unknown>[], valueColumn: string, groupColumn: string | null, typeColumn: string | null) {
  const groups = new Map<string, { amount: number; rows: number }>();
  const quantityColumn = Object.keys(rows[0] ?? {}).find((column) => /^(quantity|qty|units)$/i.test(column));
  for (const row of rows) {
    if (typeColumn && !/\b(expense|expenses|cost|costs|cogs|opex|debit|supplier|vendor|procurement|operating expense|fixed costs|payroll|bank fees)\b/i.test(String(row[typeColumn] ?? ""))) continue;
    const baseValue = parseBusinessNumber(row[valueColumn]);
    if (baseValue === null) continue;
    const quantity = /unit[_\s-]*cost/i.test(valueColumn) && quantityColumn ? parseBusinessNumber(row[quantityColumn]) : null;
    const amount = Math.abs(baseValue * (quantity ?? 1));
    const segment = groupColumn ? String(row[groupColumn] ?? "Uncategorized").trim() || "Uncategorized" : valueColumn;
    const current = groups.get(segment) ?? { amount: 0, rows: 0 };
    current.amount += amount;
    current.rows += 1;
    groups.set(segment, current);
  }
  const total = Array.from(groups.values()).reduce((sum, row) => sum + row.amount, 0);
  return Array.from(groups.entries())
    .map(([segment, value]) => ({
      segment,
      amount: round(value.amount),
      rows: value.rows,
      sharePct: total > 0 ? round((value.amount / total) * 100, 1) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function anomalyResult(
  input: DatasetAssistantInput,
  analysis: ReturnType<typeof analyzeTransactionAmountAnomalies>,
) {
  return {
    intent: "unusual_transactions",
    status: analysis.status,
    confidence: analysis.confidence,
    datasetId: input.datasetId,
    datasetType: input.datasetType,
    amountColumn: analysis.amountColumn,
    validCount: analysis.validCount,
    invalidCount: analysis.invalidCount,
    median: analysis.median,
    q1: analysis.q1,
    q3: analysis.q3,
    iqr: analysis.iqr,
    lowerThreshold: analysis.lowerThreshold,
    upperThreshold: analysis.upperThreshold,
    outlierCount: analysis.candidates.length,
    candidates: analysis.candidates,
    largest: analysis.largest,
  };
}

function labelForTransactionRow(row: Record<string, unknown>, rowIndex: number) {
  const column = Object.keys(row).find((key) => /description|merchant|supplier|vendor|product|item|category|name/i.test(key));
  const value = column ? String(row[column] ?? "").trim() : "";
  return value || `Row ${rowIndex + 1}`;
}

function contextForTransactionRow(row: Record<string, unknown>, amountColumn: string) {
  const parts = Object.keys(row)
    .filter((column) => column !== amountColumn && /category|type|merchant|supplier|vendor|product|description/i.test(column))
    .map((column) => {
      const value = String(row[column] ?? "").trim();
      return value ? `${humanizeColumn(column)}: ${value}` : "";
    })
    .filter(Boolean)
    .slice(0, 3);
  return parts.length > 0 ? parts.join("; ") : null;
}

function isGrowthQuestion(question: string) {
  return /growth|trend|over\s+time|increase|decrease/i.test(question) && /revenue|sales|growth|trend/i.test(question);
}

function isExplicitRevenueTrendQuestion(question: string) {
  return /revenue|sales|trend|over\s+time/i.test(question) && /growth|trend|increase|decrease|over\s+time/i.test(question);
}

function isForecastQuestion(question: string) {
  return /forecast|predict|projection|next\s+(month|period|quarter)/i.test(question);
}

function isDatasetSummaryQuestion(question: string) {
  return /summary|overview|summarize|analyse|analyze|what\s+do\s+you\s+see|tell\s+me\s+about|dataset|total\s+revenue|revenue\s+summary/i.test(question);
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function humanizeColumn(column: string) {
  return column.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value: number, currencyCode: string | null) {
  if (!currencyCode) return formatNumber(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSignedPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
