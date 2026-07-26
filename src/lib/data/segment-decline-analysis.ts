export type SegmentDeclineErrorCode =
  | "missing_segment_dimension"
  | "missing_time_dimension"
  | "missing_sales_metric"
  | "insufficient_periods";

export type SegmentDeclineFinding = {
  dimension: string;
  dimensionLabel: string;
  segment: string;
  previousValue: number;
  currentValue: number;
  absoluteChange: number;
  changePercent: number;
};

export type SegmentDeclineAnalysis =
  | {
      ok: true;
      metric: string;
      metricLabel: string;
      timeColumn: string;
      periodComparison: {
        previous: string;
        current: string;
        ignoredLatestPeriod?: string;
      };
      decliningSegments: SegmentDeclineFinding[];
      data: Array<Record<string, string | number>>;
      answer: string;
      insight: string;
      explanation: string;
      recommendation: string;
    }
  | {
      ok: false;
      code: SegmentDeclineErrorCode;
      message: string;
    };

type PeriodStats = {
  key: string;
  label: string;
  rowCount: number;
};

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const SALES_SEGMENT_DECLINE_RE = /\b(declin|down|drop|fall|falling|shrinking|worse|weak|underperform)/i;
const SEGMENT_RE = /\b(segment|stage|plan|channel|region|country|market|category|customer|sales)\b/i;

const DATE_COLUMN_ALIASES = [
  "order_date",
  "date",
  "month",
  "period",
  "created_at",
  "sold_at",
  "sale_date",
  "transaction_date",
  "invoice_date",
];

const METRIC_COLUMN_ALIASES = [
  "revenue",
  "sales",
  "total_sales",
  "net_sales",
  "gross_sales",
  "order_value",
  "amount",
  "total",
  "mrr",
  "arr",
  "income",
];

const DIMENSION_COLUMN_ALIASES = [
  "startup_stage",
  "plan",
  "acquisition_channel",
  "segment",
  "customer_segment",
  "product_segment",
  "sales_segment",
  "channel",
  "region",
  "country",
  "market",
  "category",
  "product_category",
  "industry",
];

export function isSalesSegmentDeclineQuestion(question: string) {
  return SALES_SEGMENT_DECLINE_RE.test(question) && SEGMENT_RE.test(question);
}

export function analyzeSalesSegmentDeclines(
  rows: Record<string, unknown>[],
  columnsInput?: string[],
): SegmentDeclineAnalysis {
  const rowsWithData = rows.filter((row) => row && typeof row === "object" && !Array.isArray(row));
  const columns = normalizeColumns(columnsInput, rowsWithData);
  const timeColumn = findDateColumn(rowsWithData, columns);
  if (!timeColumn) {
    return {
      ok: false,
      code: "missing_time_dimension",
      message: "This dataset does not contain enough time-based segment data to identify declining segments.",
    };
  }

  const metricColumn = findMetricColumn(rowsWithData, columns);
  if (!metricColumn) {
    return {
      ok: false,
      code: "missing_sales_metric",
      message: "This dataset needs a sales or revenue metric before declining sales segments can be calculated.",
    };
  }

  const dimensions = findDimensionColumns(rowsWithData, columns, timeColumn, metricColumn);
  if (dimensions.length === 0) {
    return {
      ok: false,
      code: "missing_segment_dimension",
      message: "This dataset needs a segment, plan, channel, region, or similar grouping column before declining segments can be calculated.",
    };
  }

  const periodResult = completePeriods(rowsWithData, timeColumn);
  if (periodResult.periods.length < 2) {
    return {
      ok: false,
      code: "insufficient_periods",
      message: "This dataset needs at least two complete comparable periods before declining segments can be calculated.",
    };
  }

  const previousPeriod = periodResult.periods.at(-2);
  const currentPeriod = periodResult.periods.at(-1);
  if (!previousPeriod || !currentPeriod) {
    return {
      ok: false,
      code: "insufficient_periods",
      message: "This dataset needs at least two complete comparable periods before declining segments can be calculated.",
    };
  }

  const findings = dimensions.flatMap((dimension) =>
    declineFindingsForDimension(rowsWithData, {
      dimension,
      metricColumn,
      timeColumn,
      previousPeriod: previousPeriod.key,
      currentPeriod: currentPeriod.key,
    }),
  );

  findings.sort((a, b) => a.changePercent - b.changePercent || a.dimensionLabel.localeCompare(b.dimensionLabel) || a.segment.localeCompare(b.segment));

  const metricLabel = labelFor(metricColumn);
  const data = findings.map((finding) => ({
    dimension: finding.dimensionLabel,
    segment: finding.segment,
    previousPeriod: previousPeriod.label,
    previousValue: finding.previousValue,
    currentPeriod: currentPeriod.label,
    currentValue: finding.currentValue,
    declinePercent: Math.abs(finding.changePercent),
  }));

  return {
    ok: true,
    metric: metricColumn,
    metricLabel,
    timeColumn,
    periodComparison: {
      previous: previousPeriod.label,
      current: currentPeriod.label,
      ignoredLatestPeriod: periodResult.ignoredLatestPeriod?.label,
    },
    decliningSegments: findings,
    data,
    answer: buildAnswer(findings, metricLabel, previousPeriod.label, currentPeriod.label, periodResult.ignoredLatestPeriod?.label),
    insight: findings.length > 0
      ? `${findings.length} declining segment${findings.length === 1 ? "" : "s"} detected from ${previousPeriod.label} to ${currentPeriod.label}.`
      : `No declining segments were detected from ${previousPeriod.label} to ${currentPeriod.label}.`,
    explanation: periodResult.ignoredLatestPeriod
      ? `${periodResult.ignoredLatestPeriod.label} was excluded because it is not a complete comparison period.`
      : "The comparison uses the two latest complete detected periods.",
    recommendation: findings.length > 0
      ? "Review the largest declines first and compare acquisition, retention, and pricing changes in those segments."
      : "Continue monitoring the next complete period for early decline signals.",
  };
}

function normalizeColumns(columnsInput: string[] | undefined, rows: Record<string, unknown>[]) {
  const stored = Array.isArray(columnsInput) ? columnsInput.filter((column) => typeof column === "string" && column.trim()) : [];
  if (stored.length > 0) return stored;
  return Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
}

function findDateColumn(rows: Record<string, unknown>[], columns: string[]) {
  return pickColumn(columns, DATE_COLUMN_ALIASES, (column) => dateStats(rows, column).validCount >= Math.max(2, rows.length * 0.3) && dateStats(rows, column).periodCount >= 2);
}

function findMetricColumn(rows: Record<string, unknown>[], columns: string[]) {
  return pickColumn(columns, METRIC_COLUMN_ALIASES, (column) => {
    const values = rows.map((row) => toNumber(row[column])).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    return values.length >= Math.max(2, rows.length * 0.5) && values.some((value) => value !== 0);
  });
}

function findDimensionColumns(rows: Record<string, unknown>[], columns: string[], timeColumn: string, metricColumn: string) {
  const candidates = DIMENSION_COLUMN_ALIASES
    .map((alias) => columns.find((column) => normalized(column) === alias || normalized(column).includes(alias)))
    .filter((column): column is string => Boolean(column));

  return Array.from(new Set(candidates)).filter((column) => {
    if (column === timeColumn || column === metricColumn) return false;
    const values = rows.map((row) => String(row[column] ?? "").trim()).filter(Boolean);
    const uniqueCount = new Set(values).size;
    return uniqueCount >= 2 && uniqueCount <= Math.max(12, Math.min(80, rows.length * 0.8));
  });
}

function pickColumn(columns: string[], aliases: string[], validate: (column: string) => boolean) {
  const exact = aliases
    .map((alias) => columns.find((column) => normalized(column) === alias))
    .find((column): column is string => typeof column === "string" && validate(column));
  if (exact) return exact;

  return columns.find((column) => aliases.some((alias) => normalized(column).includes(alias)) && validate(column)) || null;
}

function completePeriods(rows: Record<string, unknown>[], timeColumn: string): { periods: PeriodStats[]; ignoredLatestPeriod?: PeriodStats } {
  const periods = new Map<string, PeriodStats>();
  for (const row of rows) {
    const periodKey = periodKeyFor(row[timeColumn]);
    if (!periodKey) continue;
    const current = periods.get(periodKey) ?? { key: periodKey, label: periodLabel(periodKey), rowCount: 0 };
    current.rowCount += 1;
    periods.set(periodKey, current);
  }

  const sorted = Array.from(periods.values()).sort((a, b) => a.key.localeCompare(b.key));
  if (sorted.length < 3) return { periods: sorted };

  const latest = sorted.at(-1);
  const previous = sorted.slice(0, -1);
  if (!latest || previous.length === 0) return { periods: sorted };

  const medianPrevious = median(previous.map((period) => period.rowCount));
  if (medianPrevious > 0 && latest.rowCount < medianPrevious * 0.5) {
    return {
      periods: previous,
      ignoredLatestPeriod: latest,
    };
  }

  return { periods: sorted };
}

function declineFindingsForDimension(
  rows: Record<string, unknown>[],
  input: {
    dimension: string;
    metricColumn: string;
    timeColumn: string;
    previousPeriod: string;
    currentPeriod: string;
  },
): SegmentDeclineFinding[] {
  const previous = aggregatePeriod(rows, input.previousPeriod, input.timeColumn, input.dimension, input.metricColumn);
  const current = aggregatePeriod(rows, input.currentPeriod, input.timeColumn, input.dimension, input.metricColumn);

  return Array.from(previous.entries())
    .map(([segment, previousValue]) => {
      const currentValue = current.get(segment) ?? 0;
      if (previousValue <= 0 || currentValue >= previousValue) return null;
      const absoluteChange = currentValue - previousValue;
      return {
        dimension: input.dimension,
        dimensionLabel: labelFor(input.dimension),
        segment,
        previousValue: round(previousValue),
        currentValue: round(currentValue),
        absoluteChange: round(absoluteChange),
        changePercent: round((absoluteChange / previousValue) * 100, 1),
      };
    })
    .filter((finding): finding is SegmentDeclineFinding => finding !== null);
}

function aggregatePeriod(
  rows: Record<string, unknown>[],
  period: string,
  timeColumn: string,
  dimension: string,
  metricColumn: string,
) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (periodKeyFor(row[timeColumn]) !== period) continue;
    const label = String(row[dimension] ?? "").trim();
    if (!label) continue;
    const value = toNumber(row[metricColumn]);
    if (value === null) continue;
    totals.set(label, (totals.get(label) ?? 0) + value);
  }
  return totals;
}

function dateStats(rows: Record<string, unknown>[], column: string) {
  const periods = new Set<string>();
  let validCount = 0;
  for (const row of rows) {
    const period = periodKeyFor(row[column]);
    if (!period) continue;
    validCount += 1;
    periods.add(period);
  }
  return { validCount, periodCount: periods.size };
}

function periodKeyFor(value: unknown) {
  const date = dateFromValue(value);
  if (!date) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function periodLabel(periodKey: string) {
  const [year, month] = periodKey.split("-").map(Number);
  return MONTH_FORMATTER.format(new Date(Date.UTC(year, month - 1, 1)));
}

function dateFromValue(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function buildAnswer(
  findings: SegmentDeclineFinding[],
  metricLabel: string,
  previousPeriod: string,
  currentPeriod: string,
  ignoredLatestPeriod?: string,
) {
  if (findings.length === 0) {
    return `No declining sales segments were detected from ${previousPeriod} to ${currentPeriod}.`;
  }

  const lines = [
    `Direct data analysis: ${metricLabel} declines from ${previousPeriod} to ${currentPeriod}:`,
    ...findings.slice(0, 12).map((finding) =>
      `- ${finding.dimensionLabel}: ${finding.segment}: ${formatNumber(finding.previousValue)} -> ${formatNumber(finding.currentValue)}, decline of ${Math.abs(finding.changePercent).toFixed(1)}%`,
    ),
  ];
  if (ignoredLatestPeriod) {
    lines.push(`${ignoredLatestPeriod} was excluded because it is not a complete comparison period.`);
  }
  return lines.join("\n");
}

function labelFor(column: string) {
  return column
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalized(column: string) {
  return column.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
