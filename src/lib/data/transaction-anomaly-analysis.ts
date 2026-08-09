import {
  findMonetaryAmountColumn,
  parseBusinessNumber,
} from "@/lib/data/semantic-schema";

export type TransactionAnomalyCandidate = {
  label: string;
  amount: number;
  magnitude: number;
  medianMultiple: number | null;
  thresholdMultiple: number | null;
  direction: "above" | "below";
  context: string | null;
  rowIndex: number;
};

export type TransactionAnomalyAnalysis = {
  status: "missing_amount" | "insufficient_data" | "success";
  amountColumn: string | null;
  validCount: number;
  invalidCount: number;
  median: number | null;
  q1: number | null;
  q3: number | null;
  iqr: number | null;
  lowerThreshold: number | null;
  upperThreshold: number | null;
  candidates: TransactionAnomalyCandidate[];
  largest: TransactionAnomalyCandidate | null;
  confidence: number;
};

type TransactionAnomalyInput = {
  rows: Record<string, unknown>[];
  columns: string[];
  amountColumn?: string | null;
  labelColumns?: string[];
  contextColumns?: string[];
  minimumValidCount?: number;
};

const DEFAULT_MINIMUM_VALID_COUNT = 8;

export function analyzeTransactionAmountAnomalies(input: TransactionAnomalyInput): TransactionAnomalyAnalysis {
  const amountColumn = input.amountColumn || findTransactionAmountColumn(input.rows, input.columns);
  if (!amountColumn) {
    return emptyAnalysis("missing_amount", null, 0, 0, 0.38);
  }

  const observations = input.rows
    .map((row, rowIndex) => {
      const amount = parseBusinessNumber(row[amountColumn]);
      if (amount === null) return null;
      return {
        row,
        rowIndex,
        amount,
        magnitude: Math.abs(amount),
      };
    });
  const valid = observations.filter((row): row is NonNullable<typeof row> => row !== null && row.magnitude > 0);
  const invalidCount = observations.length - valid.length;
  const minimumValidCount = input.minimumValidCount ?? DEFAULT_MINIMUM_VALID_COUNT;

  if (valid.length < minimumValidCount) {
    const largest = largestObservation(valid, input, amountColumn);
    return {
      ...emptyAnalysis("insufficient_data", amountColumn, valid.length, invalidCount, confidenceForSample(valid.length, true)),
      largest,
    };
  }

  const magnitudes = valid.map((row) => row.magnitude).sort((a, b) => a - b);
  const median = percentile(magnitudes, 0.5);
  const q1 = percentile(magnitudes, 0.25);
  const q3 = percentile(magnitudes, 0.75);
  const iqr = q3 - q1;
  const lowerThreshold = Math.max(0, q1 - 1.5 * iqr);
  const upperThreshold = q3 + 1.5 * iqr;
  const candidates = valid
    .filter((row) => row.magnitude > upperThreshold || row.magnitude < lowerThreshold)
    .map((row) => candidateFromObservation(row, input, amountColumn, median, upperThreshold, lowerThreshold))
    .sort((a, b) => b.magnitude - a.magnitude);

  return {
    status: "success",
    amountColumn,
    validCount: valid.length,
    invalidCount,
    median: round(median),
    q1: round(q1),
    q3: round(q3),
    iqr: round(iqr),
    lowerThreshold: round(lowerThreshold),
    upperThreshold: round(upperThreshold),
    candidates,
    largest: largestObservation(valid, input, amountColumn),
    confidence: confidenceForResult(valid.length, candidates),
  };
}

export function findTransactionAmountColumn(rows: Record<string, unknown>[], columns: string[]) {
  const strong = columns
    .filter((column) => !isExcludedNumericColumn(column))
    .filter((column) => isTransactionAmountColumn(column))
    .find((column) => hasMostlyValidAmounts(rows, column));
  return strong ?? findMonetaryAmountColumn(rows, columns.filter((column) => !isExcludedNumericColumn(column)));
}

function emptyAnalysis(
  status: TransactionAnomalyAnalysis["status"],
  amountColumn: string | null,
  validCount: number,
  invalidCount: number,
  confidence: number,
): TransactionAnomalyAnalysis {
  return {
    status,
    amountColumn,
    validCount,
    invalidCount,
    median: null,
    q1: null,
    q3: null,
    iqr: null,
    lowerThreshold: null,
    upperThreshold: null,
    candidates: [],
    largest: null,
    confidence,
  };
}

function largestObservation(
  observations: Array<{ row: Record<string, unknown>; rowIndex: number; amount: number; magnitude: number }>,
  input: TransactionAnomalyInput,
  amountColumn: string,
) {
  const top = [...observations].sort((a, b) => b.magnitude - a.magnitude)[0];
  return top ? candidateFromObservation(top, input, amountColumn, null, null, null) : null;
}

function candidateFromObservation(
  observation: { row: Record<string, unknown>; rowIndex: number; amount: number; magnitude: number },
  input: TransactionAnomalyInput,
  amountColumn: string,
  median: number | null,
  upperThreshold: number | null,
  lowerThreshold: number | null,
): TransactionAnomalyCandidate {
  const label = labelForRow(observation.row, input.labelColumns) || `Row ${observation.rowIndex + 1}`;
  const threshold = observation.magnitude > (upperThreshold ?? Number.POSITIVE_INFINITY)
    ? upperThreshold
    : lowerThreshold;
  return {
    label,
    amount: round(observation.amount),
    magnitude: round(observation.magnitude),
    medianMultiple: median && median > 0 ? round(observation.magnitude / median, 1) : null,
    thresholdMultiple: threshold && threshold > 0 ? round(observation.magnitude / threshold, 1) : null,
    direction: observation.magnitude > (upperThreshold ?? Number.POSITIVE_INFINITY) ? "above" : "below",
    context: contextForRow(observation.row, input.contextColumns, amountColumn),
    rowIndex: observation.rowIndex,
  };
}

function labelForRow(row: Record<string, unknown>, labelColumns?: string[]) {
  const columns = labelColumns?.length
    ? labelColumns
    : Object.keys(row).filter((column) => /description|merchant|supplier|vendor|product|item|category|name/i.test(column));
  for (const column of columns) {
    const value = String(row[column] ?? "").trim();
    if (value) return value;
  }
  return "";
}

function contextForRow(row: Record<string, unknown>, contextColumns: string[] | undefined, amountColumn: string) {
  const columns = contextColumns?.length
    ? contextColumns
    : Object.keys(row).filter((column) => column !== amountColumn && /category|type|merchant|supplier|vendor|product|description/i.test(column));
  const parts = columns
    .map((column) => {
      const value = String(row[column] ?? "").trim();
      return value ? `${humanize(column)}: ${value}` : "";
    })
    .filter(Boolean)
    .slice(0, 3);
  return parts.length > 0 ? parts.join("; ") : null;
}

function isTransactionAmountColumn(column: string) {
  const normalized = normalizeColumn(column);
  return /^(amount|transaction_amount|transaction_total|payment_amount|invoice_amount|invoice_total|order_amount|order_value|sales_amount|total|gross|net_amount)$/.test(normalized) ||
    /(^|_)(transaction|payment|invoice|order|sales)_(amount|total|value)($|_)/.test(normalized);
}

function isExcludedNumericColumn(column: string) {
  const normalized = normalizeColumn(column);
  return /(^|_)(id|sku|quantity|qty|units|count|rate|tax_rate|percentage|percent|margin|postal|zip)($|_)/.test(normalized);
}

function hasMostlyValidAmounts(rows: Record<string, unknown>[], column: string) {
  const values = rows.map((row) => row[column]).filter((value) => value !== null && value !== undefined && value !== "");
  if (values.length === 0) return false;
  const valid = values.filter((value) => parseBusinessNumber(value) !== null).length;
  return valid / values.length >= 0.6;
}

function percentile(sortedValues: number[], position: number) {
  if (sortedValues.length === 0) return 0;
  const index = (sortedValues.length - 1) * position;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower] ?? 0;
  const weight = index - lower;
  return (sortedValues[lower] ?? 0) * (1 - weight) + (sortedValues[upper] ?? 0) * weight;
}

function confidenceForSample(validCount: number, hasClearAmountColumn: boolean) {
  if (validCount < DEFAULT_MINIMUM_VALID_COUNT) return hasClearAmountColumn ? 0.52 : 0.42;
  return hasClearAmountColumn ? 0.74 : 0.62;
}

function confidenceForResult(validCount: number, candidates: TransactionAnomalyCandidate[]) {
  if (validCount < 12) return candidates.length > 0 ? 0.72 : 0.68;
  const strongest = candidates[0]?.thresholdMultiple ?? 0;
  if (strongest >= 2) return 0.9;
  if (candidates.length > 0) return 0.82;
  return validCount >= 20 ? 0.84 : 0.76;
}

function normalizeColumn(column: string) {
  return column.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function humanize(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
