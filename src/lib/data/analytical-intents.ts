import {
  analyzeSalesSegmentDeclines,
  isSalesSegmentDeclineQuestion,
} from "@/lib/data/segment-decline-analysis";
import {
  buildSemanticSchema,
  hasSemanticFields,
  normalizePercentValue,
  parseBusinessNumber,
  semanticColumn,
  type SemanticField,
  type SemanticSchema,
} from "@/lib/data/semantic-schema";

export type AnalyticalIntentId =
  | "total_revenue"
  | "total_cost"
  | "gross_profit"
  | "gross_margin"
  | "net_profit"
  | "net_margin"
  | "expense_growth"
  | "revenue_trend"
  | "profit_trend"
  | "cash_flow_risk"
  | "category_cost_impact"
  | "margin_pressure"
  | "unusual_transactions"
  | "monthly_operating_run_rate"
  | "segment_decline"
  | "revenue_concentration"
  | "top_products"
  | "top_customers"
  | "average_order_value";

export type AnalyticalUnsupportedCode =
  | "missing_revenue_metric"
  | "missing_cogs_metric"
  | "ambiguous_cost_mapping"
  | "zero_revenue"
  | "mixed_currency_dataset"
  | "invalid_numeric_values"
  | "dataset_context_unavailable"
  | "unsupported_dataset_type"
  | "insufficient_data"
  | "unsupported_question"
  | "missing_segment_dimension"
  | "missing_time_dimension"
  | "missing_sales_metric"
  | "insufficient_periods";

export type AnalyticalExecutionResult =
  | {
      status: "success";
      intent: AnalyticalIntentId;
      answer: string;
      insight: string;
      explanation: string;
      recommendation?: string;
      data: Array<Record<string, string | number | null>>;
      chartType: "kpi" | "table";
      result: Record<string, unknown>;
    }
  | {
      status: "unsupported";
      intent: AnalyticalIntentId;
      code: AnalyticalUnsupportedCode;
      message: string;
      schema: Pick<SemanticSchema, "datasetId" | "datasetType" | "mappings" | "ambiguous" | "currencyCode" | "mixedCurrency">;
    }
  | {
      status: "not_matched";
    };

export type AnalyticalIntentDefinition = {
  id: AnalyticalIntentId;
  patterns: RegExp[];
  requiredMetrics: SemanticField[];
  optionalDimensions: SemanticField[];
  minimumRows: number;
  supportedDatasetTypes: string[];
  unsupportedReason: AnalyticalUnsupportedCode;
  handler?: (input: AnalyticalExecutionInput) => AnalyticalExecutionResult;
};

export type AnalyticalExecutionInput = {
  question: string;
  datasetId: string;
  datasetType: string;
  columns: string[];
  rows: Record<string, unknown>[];
  schema: SemanticSchema;
};

const ANY_DATASET = ["generic", "retail", "saas", "startup", "ecommerce", "marketplace", "investor", "finance", "unknown"];

export const ANALYTICAL_INTENT_REGISTRY: AnalyticalIntentDefinition[] = [
  intent("total_revenue", [/total\s+revenue|revenue\s+total|how much revenue/i], ["revenue"]),
  intent("total_cost", [/total\s+cost|costs?\s+total|how much cost/i], ["cogs"]),
  intent("gross_profit", [/gross\s+profit/i], ["revenue"], ["cogs", "gross_profit"]),
  {
    ...intent("gross_margin", [/gross\s+margin|current\s+gross\s+margin/i], [], ["revenue", "cogs", "gross_profit", "gross_margin"]),
    handler: calculateGrossMargin,
  },
  intent("net_profit", [/net\s+profit|operating\s+profit/i], ["net_profit"]),
  intent("net_margin", [/net\s+margin|profit\s+margin/i], ["revenue"], ["net_profit", "net_margin"]),
  intent("expense_growth", [/expense.*growth|opex.*growth/i], ["expenses", "date"]),
  intent("revenue_trend", [/revenue.*trend|sales.*trend|revenue.*over time/i], ["revenue", "date"]),
  intent("profit_trend", [/profit.*trend|margin.*trend/i], ["date"], ["gross_profit", "net_profit"]),
  intent("cash_flow_risk", [/cash\s+flow.*risk|cash.*risk/i], [], ["revenue", "expenses", "date"]),
  intent("category_cost_impact", [/category.*cost|cost.*category/i], ["category"], ["cogs", "expenses"]),
  intent("margin_pressure", [/margin\s+pressure|margin.*declin/i], ["revenue", "date"], ["cogs", "gross_profit", "gross_margin"]),
  intent("unusual_transactions", [/unusual.*transaction|outlier|anomal/i], []),
  intent("monthly_operating_run_rate", [/monthly.*run rate|operating.*run rate/i], ["expenses", "date"]),
  {
    ...intent("segment_decline", [/segment.*declin|declin.*segment|which sales segments are declining/i], ["revenue", "date"]),
    handler: calculateSegmentDecline,
  },
  intent("revenue_concentration", [/revenue.*concentration|customer.*concentration/i], ["revenue"], ["customer"]),
  intent("top_products", [/top.*product|best.*product|product.*perform/i], ["revenue"], ["product"]),
  intent("top_customers", [/top.*customer|best.*customer|customer.*revenue/i], ["revenue"], ["customer"]),
  intent("average_order_value", [/average\s+order\s+value|aov/i], ["revenue"]),
];

export function executeAnalyticalIntent(input: {
  question: string;
  datasetId: string;
  datasetType: string;
  columns: string[];
  rows: Record<string, unknown>[];
}): AnalyticalExecutionResult {
  const schema = buildSemanticSchema(input);
  const matchedIntent = findAnalyticalIntent(input.question);
  if (!matchedIntent) return { status: "not_matched" };

  if (input.rows.length < matchedIntent.minimumRows) {
    return unsupported(matchedIntent.id, "insufficient_data", "This dataset does not contain enough rows for that calculation.", schema);
  }

  if (!supportsDatasetType(matchedIntent, input.datasetType)) {
    return unsupported(matchedIntent.id, "unsupported_dataset_type", "This dataset type is not supported for that calculation.", schema);
  }

  const handlerInput = { ...input, schema };
  if (matchedIntent.handler) return matchedIntent.handler(handlerInput);

  return unsupported(
    matchedIntent.id,
    "unsupported_question",
    "UseClevr recognizes this analytical question, but deterministic calculation for this intent is not available yet.",
    schema,
  );
}

export function availableAnalyticalSuggestions(input: {
  datasetId: string;
  datasetType: string;
  columns: string[];
  rows: Record<string, unknown>[];
}) {
  const schema = buildSemanticSchema(input);
  const suggestions: string[] = [];

  if (canCalculateGrossMargin(schema, input.rows)) {
    suggestions.push("What is the current gross margin?");
  }
  if (hasSemanticFields(schema, ["revenue"])) {
    suggestions.push("What is the total revenue?");
  }
  if (hasSemanticFields(schema, ["revenue", "date"])) {
    suggestions.push("What are the revenue trends over time?");
  }
  if (hasSemanticFields(schema, ["revenue", "product"])) {
    suggestions.push("Which products generate the most revenue?");
  }
  if (hasSemanticFields(schema, ["revenue", "customer"])) {
    suggestions.push("Which customers generate the most revenue?");
  }

  return suggestions;
}

export function findAnalyticalIntent(question: string) {
  if (isSalesSegmentDeclineQuestion(question)) {
    return ANALYTICAL_INTENT_REGISTRY.find((definition) => definition.id === "segment_decline") ?? null;
  }
  return ANALYTICAL_INTENT_REGISTRY.find((definition) => definition.patterns.some((pattern) => pattern.test(question))) ?? null;
}

function calculateGrossMargin(input: AnalyticalExecutionInput): AnalyticalExecutionResult {
  const schema = input.schema;
  if (schema.mixedCurrency) {
    return unsupported("gross_margin", "mixed_currency_dataset", "Gross margin cannot be calculated because this dataset contains multiple currencies.", schema);
  }

  const revenueColumn = semanticColumn(schema, "revenue");
  const cogsColumn = semanticColumn(schema, "cogs");
  const grossProfitColumn = semanticColumn(schema, "gross_profit");
  const grossMarginColumn = semanticColumn(schema, "gross_margin");

  if (schema.ambiguous.cogs?.length && !cogsColumn) {
    return unsupported("gross_margin", "ambiguous_cost_mapping", "UseClevr found cost-like fields, but none can be safely validated as cost of goods sold.", schema);
  }

  if (grossMarginColumn && !revenueColumn) {
    const marginValues = validNumbers(input.rows, grossMarginColumn).map(normalizePercentValue);
    if (marginValues.length === 0) return unsupported("gross_margin", "invalid_numeric_values", "Gross margin cannot be calculated because the gross margin values are not valid numbers.", schema);
    const grossMarginPercent = round(average(marginValues));
    return grossMarginSuccess({
      grossMarginPercent,
      revenue: null,
      cogs: null,
      grossProfit: null,
      calculationMethod: "existing_gross_margin",
      sourceColumns: { grossMargin: grossMarginColumn },
      currencyCode: schema.currencyCode,
    });
  }

  if (!revenueColumn) {
    return unsupported("gross_margin", "missing_revenue_metric", "Gross margin cannot be calculated because this dataset has no validated revenue field.", schema);
  }

  const revenue = sumValidNumbers(input.rows, revenueColumn);
  if (revenue.invalidCount > 0 && revenue.validCount === 0) {
    return unsupported("gross_margin", "invalid_numeric_values", "Gross margin cannot be calculated because revenue values are not valid numbers.", schema);
  }
  if (revenue.total === 0) {
    return unsupported("gross_margin", "zero_revenue", "Gross margin cannot be calculated because validated revenue totals zero.", schema);
  }

  if (grossMarginColumn) {
    const marginValues = validNumbers(input.rows, grossMarginColumn).map(normalizePercentValue);
    if (marginValues.length === 0) return unsupported("gross_margin", "invalid_numeric_values", "Gross margin cannot be calculated because the gross margin values are not valid numbers.", schema);
    const grossMarginPercent = round(average(marginValues));
    const grossProfit = round((grossMarginPercent / 100) * revenue.total);
    return grossMarginSuccess({
      grossMarginPercent,
      revenue: revenue.total,
      cogs: round(revenue.total - grossProfit),
      grossProfit,
      calculationMethod: "existing_gross_margin",
      sourceColumns: { revenue: revenueColumn, grossMargin: grossMarginColumn },
      currencyCode: schema.currencyCode,
    });
  }

  if (grossProfitColumn) {
    const grossProfit = sumValidNumbers(input.rows, grossProfitColumn);
    if (grossProfit.validCount === 0) return unsupported("gross_margin", "invalid_numeric_values", "Gross margin cannot be calculated because gross profit values are not valid numbers.", schema);
    const grossMarginPercent = round((grossProfit.total / revenue.total) * 100);
    return grossMarginSuccess({
      grossMarginPercent,
      revenue: revenue.total,
      cogs: round(revenue.total - grossProfit.total),
      grossProfit: grossProfit.total,
      calculationMethod: "gross_profit_over_revenue",
      sourceColumns: { revenue: revenueColumn, grossProfit: grossProfitColumn },
      currencyCode: schema.currencyCode,
    });
  }

  if (!cogsColumn) {
    const hasExpenses = Boolean(semanticColumn(schema, "expenses"));
    return unsupported(
      "gross_margin",
      "missing_cogs_metric",
      hasExpenses
        ? "UseClevr found revenue data, but no validated cost-of-goods-sold column. Gross margin cannot be calculated from operating expenses alone."
        : "Gross margin cannot be calculated because this dataset has no validated COGS field.",
      schema,
    );
  }

  const cogs = sumValidNumbers(input.rows, cogsColumn);
  if (cogs.validCount === 0) return unsupported("gross_margin", "invalid_numeric_values", "Gross margin cannot be calculated because COGS values are not valid numbers.", schema);
  const grossProfit = round(revenue.total - cogs.total);
  const grossMarginPercent = round((grossProfit / revenue.total) * 100);
  return grossMarginSuccess({
    grossMarginPercent,
    revenue: revenue.total,
    cogs: cogs.total,
    grossProfit,
    calculationMethod: "revenue_minus_cogs",
    sourceColumns: { revenue: revenueColumn, cogs: cogsColumn },
    currencyCode: schema.currencyCode,
  });
}

function calculateSegmentDecline(input: AnalyticalExecutionInput): AnalyticalExecutionResult {
  const result = analyzeSalesSegmentDeclines(input.rows, input.columns);
  if (!result.ok) {
    return unsupported("segment_decline", result.code, result.message, input.schema);
  }
  return {
    status: "success",
    intent: "segment_decline",
    answer: result.answer,
    insight: result.insight,
    explanation: result.explanation,
    recommendation: result.recommendation,
    data: result.data,
    chartType: "table",
    result,
  };
}

function grossMarginSuccess(input: {
  grossMarginPercent: number;
  revenue: number | null;
  cogs: number | null;
  grossProfit: number | null;
  calculationMethod: "revenue_minus_cogs" | "gross_profit_over_revenue" | "existing_gross_margin";
  sourceColumns: Record<string, string>;
  currencyCode: string | null;
}): AnalyticalExecutionResult {
  const answer = `Current gross margin: ${input.grossMarginPercent.toFixed(1)}%`;
  return {
    status: "success",
    intent: "gross_margin",
    answer,
    insight: answer,
    explanation: calculationExplanation(input.calculationMethod),
    recommendation: input.grossMarginPercent < 30 ? "Review product costs, pricing, and discounting for margin pressure." : "Monitor margin by product, channel, or customer segment for deeper drivers.",
    data: [
      { metric: "Gross margin", value: input.grossMarginPercent, unit: "percent" },
      { metric: "Revenue", value: input.revenue, unit: "currency" },
      { metric: "COGS", value: input.cogs, unit: "currency" },
      { metric: "Gross profit", value: input.grossProfit, unit: "currency" },
    ],
    chartType: "kpi",
    result: {
      intent: "gross_margin",
      status: "success",
      revenue: input.revenue,
      cogs: input.cogs,
      grossProfit: input.grossProfit,
      grossMarginPercent: input.grossMarginPercent,
      period: null,
      calculationMethod: input.calculationMethod,
      sourceColumns: input.sourceColumns,
      currencyCode: input.currencyCode,
    },
  };
}

function canCalculateGrossMargin(schema: SemanticSchema, rows: Record<string, unknown>[]) {
  if (schema.mixedCurrency) return false;
  if (semanticColumn(schema, "gross_margin")) return true;
  if (!semanticColumn(schema, "revenue")) return false;
  const revenueColumn = semanticColumn(schema, "revenue");
  if (!revenueColumn || sumValidNumbers(rows, revenueColumn).total === 0) return false;
  return Boolean(semanticColumn(schema, "cogs") || semanticColumn(schema, "gross_profit"));
}

function intent(
  id: AnalyticalIntentId,
  patterns: RegExp[],
  requiredMetrics: SemanticField[] = [],
  optionalDimensions: SemanticField[] = [],
): AnalyticalIntentDefinition {
  return {
    id,
    patterns,
    requiredMetrics,
    optionalDimensions,
    minimumRows: 1,
    supportedDatasetTypes: ANY_DATASET,
    unsupportedReason: "unsupported_question",
  };
}

function unsupported(
  intent: AnalyticalIntentId,
  code: AnalyticalUnsupportedCode,
  message: string,
  schema: SemanticSchema,
): AnalyticalExecutionResult {
  return {
    status: "unsupported",
    intent,
    code,
    message,
    schema: {
      datasetId: schema.datasetId,
      datasetType: schema.datasetType,
      mappings: schema.mappings,
      ambiguous: schema.ambiguous,
      currencyCode: schema.currencyCode,
      mixedCurrency: schema.mixedCurrency,
    },
  };
}

function supportsDatasetType(intentDefinition: AnalyticalIntentDefinition, datasetType: string) {
  return intentDefinition.supportedDatasetTypes.includes(datasetType) || intentDefinition.supportedDatasetTypes.includes("generic") || intentDefinition.supportedDatasetTypes.includes("unknown");
}

function validNumbers(rows: Record<string, unknown>[], column: string) {
  return rows
    .map((row) => parseBusinessNumber(row[column]))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function sumValidNumbers(rows: Record<string, unknown>[], column: string) {
  let total = 0;
  let validCount = 0;
  let invalidCount = 0;
  for (const row of rows) {
    const raw = row[column];
    if (raw === null || raw === undefined || raw === "") continue;
    const value = parseBusinessNumber(raw);
    if (value === null) {
      invalidCount += 1;
      continue;
    }
    total += value;
    validCount += 1;
  }
  return { total: round(total), validCount, invalidCount };
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
}

function calculationExplanation(method: string) {
  if (method === "revenue_minus_cogs") return "Calculation: (Revenue - COGS) / Revenue.";
  if (method === "gross_profit_over_revenue") return "Calculation: Gross profit / Revenue.";
  return "Calculation: validated gross margin field.";
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
