import {
  buildSemanticSchema,
  parseBusinessNumber,
  semanticColumn,
} from "@/lib/data/semantic-schema";

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
];

export function answerDatasetQuestionDeterministically(
  input: DatasetAssistantInput,
): DatasetAssistantDeterministicResult | null {
  const question = input.question.trim();
  if (!question || input.rows.length === 0) return null;

  const schema = buildSemanticSchema(input);
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

  return describeDatasetSummary({ ...input, revenueColumn, currencyCode, dimensionColumns });
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

function isGrowthQuestion(question: string) {
  return /growth|trend|over\s+time|increase|decrease/i.test(question) && /revenue|sales|growth|trend/i.test(question);
}

function isExplicitRevenueTrendQuestion(question: string) {
  return /revenue|sales|trend|over\s+time/i.test(question) && /growth|trend|increase|decrease|over\s+time/i.test(question);
}

function isForecastQuestion(question: string) {
  return /forecast|predict|projection|next\s+(month|period|quarter)/i.test(question);
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
