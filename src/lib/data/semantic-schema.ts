export type SemanticField =
  | "revenue"
  | "cogs"
  | "expenses"
  | "gross_profit"
  | "net_profit"
  | "gross_margin"
  | "net_margin"
  | "date"
  | "quantity"
  | "currency"
  | "product"
  | "customer"
  | "category"
  | "region"
  | "country";

export type MappingConfidence = "high" | "medium" | "low";

export type SemanticColumnMapping = {
  field: SemanticField;
  column: string;
  confidence: MappingConfidence;
  reason: string;
};

export type SemanticSchema = {
  datasetId: string;
  datasetType: string;
  columns: string[];
  mappings: Partial<Record<SemanticField, SemanticColumnMapping>>;
  ambiguous: Partial<Record<SemanticField, SemanticColumnMapping[]>>;
  currencyCode: string | null;
  mixedCurrency: boolean;
};

type FieldRule = {
  field: SemanticField;
  exact: string[];
  contains?: string[];
  rejectContains?: string[];
  validator?: (rows: Record<string, unknown>[], column: string) => boolean;
};

const FIELD_RULES: FieldRule[] = [
  {
    field: "revenue",
    exact: ["revenue", "sales", "total_sales", "amount", "sales_amount", "income", "turnover", "net_sales", "gross_sales", "order_value"],
    contains: ["revenue", "sales_amount", "total_sales", "turnover"],
    rejectContains: ["cost", "expense", "profit", "margin", "tax", "discount", "refund"],
    validator: isMostlyNumeric,
  },
  {
    field: "cogs",
    exact: ["cogs", "cost_of_goods_sold", "cost_of_goods", "cost_of_sales", "product_cost", "direct_cost", "purchase_cost"],
    contains: ["cost_of_goods", "cost_of_sales", "product_cost", "direct_cost", "purchase_cost"],
    rejectContains: ["operating", "opex", "overhead", "admin", "marketing", "advertising", "shipping", "delivery", "general"],
    validator: isMostlyNumeric,
  },
  {
    field: "expenses",
    exact: ["expenses", "operating_expenses", "opex", "overhead", "admin_cost", "marketing_cost"],
    contains: ["expense", "opex", "overhead", "admin_cost", "marketing_cost"],
    validator: isMostlyNumeric,
  },
  {
    field: "gross_profit",
    exact: ["gross_profit", "gross_profit_amount", "contribution_profit"],
    contains: ["gross_profit", "contribution_profit"],
    validator: isMostlyNumeric,
  },
  {
    field: "net_profit",
    exact: ["net_profit", "operating_profit", "profit", "net_income"],
    contains: ["net_profit", "operating_profit", "net_income"],
    validator: isMostlyNumeric,
  },
  {
    field: "gross_margin",
    exact: ["gross_margin", "gross_margin_pct", "gross_margin_percent", "gross_profit_margin"],
    contains: ["gross_margin"],
    validator: isMostlyNumeric,
  },
  {
    field: "net_margin",
    exact: ["net_margin", "net_margin_pct", "net_margin_percent", "profit_margin"],
    contains: ["net_margin", "profit_margin"],
    validator: isMostlyNumeric,
  },
  {
    field: "date",
    exact: ["date", "order_date", "transaction_date", "invoice_date", "month", "period"],
    contains: ["date", "month", "period"],
    validator: isDateLike,
  },
  {
    field: "quantity",
    exact: ["quantity", "units", "qty"],
    contains: ["quantity", "units"],
    validator: isMostlyNumeric,
  },
  {
    field: "currency",
    exact: ["currency", "currency_code", "iso_currency"],
    contains: ["currency"],
  },
  {
    field: "product",
    exact: ["product", "product_name", "sku", "item", "item_name"],
    contains: ["product", "sku"],
  },
  {
    field: "customer",
    exact: ["customer", "customer_id", "customer_name", "client", "client_id"],
    contains: ["customer", "client"],
  },
  {
    field: "category",
    exact: ["category", "segment", "type", "department"],
    contains: ["category", "segment", "department"],
  },
  {
    field: "region",
    exact: ["region", "market", "territory"],
    contains: ["region", "market", "territory"],
  },
  {
    field: "country",
    exact: ["country", "country_code", "nation"],
    contains: ["country", "nation"],
  },
];

export function buildSemanticSchema(input: {
  datasetId: string;
  datasetType: string;
  columns: string[];
  rows: Record<string, unknown>[];
}): SemanticSchema {
  const columns = Array.from(new Set(input.columns.filter(Boolean)));
  const mappings: Partial<Record<SemanticField, SemanticColumnMapping>> = {};
  const ambiguous: Partial<Record<SemanticField, SemanticColumnMapping[]>> = {};

  for (const rule of FIELD_RULES) {
    const candidates = findCandidates(rule, columns, input.rows);
    if (candidates.length === 1) {
      mappings[rule.field] = candidates[0];
    } else if (candidates.length > 1) {
      const highConfidence = candidates.filter((candidate) => candidate.confidence === "high");
      if (highConfidence.length === 1) mappings[rule.field] = highConfidence[0];
      else ambiguous[rule.field] = candidates;
    }
  }

  const currencyProfile = profileCurrency(input.rows, mappings.currency?.column);
  return {
    datasetId: input.datasetId,
    datasetType: input.datasetType,
    columns,
    mappings,
    ambiguous,
    currencyCode: currencyProfile.currencyCode,
    mixedCurrency: currencyProfile.mixedCurrency,
  };
}

export function semanticColumn(schema: SemanticSchema, field: SemanticField) {
  return schema.mappings[field]?.column ?? null;
}

export function hasSemanticFields(schema: SemanticSchema, fields: SemanticField[]) {
  return fields.every((field) => Boolean(schema.mappings[field]));
}

export function parseBusinessNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const negative = /^\(.*\)$/.test(trimmed);
  const parsed = Number.parseFloat(trimmed.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(parsed)) return null;
  return negative ? -Math.abs(parsed) : parsed;
}

export function normalizePercentValue(value: number) {
  if (Math.abs(value) <= 1) return value * 100;
  return value;
}

function findCandidates(rule: FieldRule, columns: string[], rows: Record<string, unknown>[]) {
  const normalizedColumns = columns.map((column) => ({ original: column, normalized: normalizeColumnName(column) }));
  const candidates: SemanticColumnMapping[] = [];

  for (const column of normalizedColumns) {
    if (rule.rejectContains?.some((term) => column.normalized.includes(term))) continue;
    const exact = rule.exact.includes(column.normalized);
    const contains = rule.contains?.some((term) => column.normalized.includes(term)) ?? false;
    if (!exact && !contains) continue;
    if (rule.validator && !rule.validator(rows, column.original)) continue;
    candidates.push({
      field: rule.field,
      column: column.original,
      confidence: exact ? "high" : "medium",
      reason: exact ? "Exact semantic column match" : "Semantic column name match",
    });
  }

  return candidates.sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence));
}

function isMostlyNumeric(rows: Record<string, unknown>[], column: string) {
  const values = rows.map((row) => row[column]).filter((value) => value !== null && value !== undefined && value !== "");
  if (values.length === 0) return false;
  const numericCount = values.filter((value) => parseBusinessNumber(value) !== null).length;
  return numericCount / values.length >= 0.6;
}

function isDateLike(rows: Record<string, unknown>[], column: string) {
  const values = rows.map((row) => row[column]).filter((value) => value !== null && value !== undefined && value !== "");
  if (values.length === 0) return false;
  const validCount = values.filter((value) => !Number.isNaN(Date.parse(String(value)))).length;
  return validCount / values.length >= 0.5;
}

function profileCurrency(rows: Record<string, unknown>[], currencyColumn?: string) {
  if (!currencyColumn) return { currencyCode: null, mixedCurrency: false };
  const codes = new Set<string>();
  for (const row of rows) {
    const code = currencyCodeFromValue(row[currencyColumn]);
    if (code) codes.add(code);
  }
  return {
    currencyCode: codes.size === 1 ? Array.from(codes)[0] ?? null : null,
    mixedCurrency: codes.size > 1,
  };
}

function currencyCodeFromValue(value: unknown) {
  const text = String(value ?? "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(text)) return text;
  if (text.includes("USD") || text.includes("$")) return "USD";
  if (text.includes("EUR") || text.includes("€")) return "EUR";
  if (text.includes("GBP") || text.includes("£")) return "GBP";
  return null;
}

function normalizeColumnName(col: string) {
  return col
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function confidenceRank(confidence: MappingConfidence) {
  if (confidence === "high") return 3;
  if (confidence === "medium") return 2;
  return 1;
}
