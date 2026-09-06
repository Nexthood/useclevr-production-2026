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
  | "units_sold"
  | "stock_on_hand"
  | "reorder_point"
  | "unit_cost"
  | "currency"
  | "product"
  | "customer"
  | "supplier"
  | "seller"
  | "buyer"
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

export type DatasetSemanticCapabilities = {
  hasExpenseData: boolean;
  hasRevenueData: boolean;
  hasCostData: boolean;
  hasMarginData: boolean;
  hasInventoryData: boolean;
  hasTaxData: boolean;
  expenseEvidence: string[];
  revenueEvidence: string[];
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
    exact: ["revenue", "sales", "total_sales", "sales_amount", "income", "turnover", "net_sales", "gross_sales", "order_value", "gmv", "gross_merchandise_value"],
    contains: ["revenue", "sales_amount", "total_sales", "turnover", "gross_merchandise_value", "order_value"],
    rejectContains: ["cost", "expense", "profit", "margin", "tax", "discount", "refund", "debit", "credit"],
    validator: isMostlyNumeric,
  },
  {
    field: "cogs",
    exact: ["cogs", "cost_of_goods_sold", "cost_of_goods", "cost_of_sales", "product_cost", "direct_cost", "purchase_cost", "unit_cost", "supplier_cost", "vendor_cost", "procurement_cost"],
    contains: ["cost_of_goods", "cost_of_sales", "product_cost", "direct_cost", "purchase_cost", "unit_cost", "supplier_cost", "vendor_cost", "procurement_cost"],
    rejectContains: ["operating", "opex", "overhead", "admin", "marketing", "advertising", "shipping", "delivery", "general", "debit", "credit"],
    validator: isMostlyNumeric,
  },
  {
    field: "expenses",
    exact: ["expense", "expenses", "operating_expense", "operating_expenses", "opex", "overhead", "admin_cost", "marketing_cost", "supplier_cost", "vendor_cost", "procurement_cost"],
    contains: ["expense", "opex", "overhead", "admin_cost", "marketing_cost", "supplier_cost", "vendor_cost", "procurement_cost"],
    rejectContains: ["debit", "credit"],
    validator: isMostlyNumeric,
  },
  {
    field: "gross_profit",
    exact: ["gross_profit", "gross_profit_amount", "contribution_profit"],
    contains: ["gross_profit", "contribution_profit"],
    rejectContains: ["debit", "credit"],
    validator: isMostlyNumeric,
  },
  {
    field: "net_profit",
    exact: ["net_profit", "operating_profit", "profit", "net_income"],
    contains: ["net_profit", "operating_profit", "net_income"],
    rejectContains: ["debit", "credit"],
    validator: isMostlyNumeric,
  },
  {
    field: "gross_margin",
    exact: ["gross_margin", "gross_margin_pct", "gross_margin_percent", "gross_profit_margin"],
    contains: ["gross_margin"],
    rejectContains: ["debit", "credit"],
    validator: isMostlyNumeric,
  },
  {
    field: "net_margin",
    exact: ["net_margin", "net_margin_pct", "net_margin_percent", "profit_margin"],
    contains: ["net_margin", "profit_margin"],
    rejectContains: ["debit", "credit"],
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
    field: "units_sold",
    exact: ["units_sold", "quantity_sold", "qty_sold", "sold_units", "sales_units", "units_sold_recent", "recent_units_sold"],
    contains: ["units_sold", "quantity_sold", "qty_sold", "sold_units", "sales_units", "sell_through"],
    rejectContains: ["stock", "inventory", "on_hand", "available", "reorder"],
    validator: isMostlyNumeric,
  },
  {
    field: "stock_on_hand",
    exact: ["stock_on_hand", "stock", "inventory", "inventory_qty", "inventory_quantity", "quantity_on_hand", "qty_on_hand", "on_hand", "available_stock", "stock_level", "current_stock"],
    contains: ["stock_on_hand", "inventory_qty", "inventory_quantity", "quantity_on_hand", "qty_on_hand", "on_hand", "available_stock", "stock_level", "current_stock"],
    rejectContains: ["stockout", "risk", "reorder"],
    validator: isMostlyNumeric,
  },
  {
    field: "reorder_point",
    exact: ["reorder_point", "reorder_level", "reorder_threshold", "minimum_stock", "min_stock", "safety_stock", "par_level"],
    contains: ["reorder_point", "reorder_level", "reorder_threshold", "minimum_stock", "min_stock", "safety_stock", "par_level"],
    validator: isMostlyNumeric,
  },
  {
    field: "unit_cost",
    exact: ["unit_cost", "unit_cogs", "cost_per_unit", "purchase_cost", "supplier_cost", "vendor_cost", "product_cost", "procurement_cost"],
    contains: ["unit_cost", "unit_cogs", "cost_per_unit", "purchase_cost", "supplier_cost", "vendor_cost", "product_cost", "procurement_cost"],
    rejectContains: ["total", "revenue", "sales", "price", "margin"],
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
    field: "seller",
    exact: ["seller", "seller_id", "merchant", "merchant_id", "vendor", "vendor_id"],
    contains: ["seller", "merchant", "vendor"],
  },
  {
    field: "supplier",
    exact: ["supplier", "supplier_id", "supplier_name", "vendor", "vendor_id", "vendor_name", "brand", "manufacturer"],
    contains: ["supplier", "vendor", "manufacturer"],
  },
  {
    field: "buyer",
    exact: ["buyer", "buyer_id", "purchaser", "purchaser_id"],
    contains: ["buyer", "purchaser"],
  },
  {
    field: "customer",
    exact: ["customer", "customer_id", "customer_name", "client", "client_id", "account", "account_id", "buyer", "buyer_id", "purchaser", "purchaser_id"],
    contains: ["customer", "client", "buyer", "purchaser"],
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

export function detectDatasetSemanticCapabilities(input: {
  schema: SemanticSchema;
  rows: Record<string, unknown>[];
}): DatasetSemanticCapabilities {
  const schema = input.schema;
  const expenseEvidence = expenseSemanticEvidence(schema, input.rows);
  const revenueEvidence = semanticColumn(schema, "revenue")
    ? [`Revenue field "${semanticColumn(schema, "revenue")}" is validated by column semantics.`]
    : [];

  return {
    hasExpenseData: expenseEvidence.length > 0,
    hasRevenueData: revenueEvidence.length > 0,
    hasCostData: Boolean(semanticColumn(schema, "cogs") || semanticColumn(schema, "expenses")),
    hasMarginData: Boolean(semanticColumn(schema, "gross_margin") || semanticColumn(schema, "net_margin") || semanticColumn(schema, "gross_profit") || semanticColumn(schema, "net_profit")),
    hasInventoryData: schema.columns.some((column) => /inventory|stock|on_hand|sku/i.test(normalizeColumnName(column))),
    hasTaxData: schema.columns.some((column) => /(^|_)tax($|_)|vat|gst|btw/i.test(normalizeColumnName(column))),
    expenseEvidence,
    revenueEvidence,
  };
}

export function findExpenseTypeColumn(rows: Record<string, unknown>[], columns: string[]) {
  return columns.find((column) => isExpenseClassifierColumn(column, rows)) ?? null;
}

export function findMonetaryAmountColumn(rows: Record<string, unknown>[], columns: string[]) {
  const ranked = columns
    .filter((column) => isMostlyNumeric(rows, column))
    .map((column) => ({ column, rank: amountColumnRank(column) }))
    .filter((candidate) => candidate.rank > 0)
    .sort((a, b) => b.rank - a.rank);
  return ranked[0]?.column ?? null;
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

function expenseSemanticEvidence(schema: SemanticSchema, rows: Record<string, unknown>[]) {
  const evidence: string[] = [];
  const expenseColumn = semanticColumn(schema, "expenses");
  const cogsColumn = semanticColumn(schema, "cogs");
  const typeColumn = findExpenseTypeColumn(rows, schema.columns);

  if (expenseColumn) evidence.push(`Expense field "${expenseColumn}" is validated by column semantics.`);
  if (cogsColumn) evidence.push(`Cost/COGS field "${cogsColumn}" is validated by column semantics.`);
  if (typeColumn) evidence.push(`Classifier field "${typeColumn}" contains expense/cost values.`);

  return evidence;
}

function isExpenseClassifierColumn(column: string, rows: Record<string, unknown>[]) {
  const normalized = normalizeColumnName(column);
  if (!/(^|_)(type|transaction_type|category|account|ledger|classification)($|_)/.test(normalized)) return false;
  const values = rows
    .map((row) => String(row[column] ?? "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 500);
  if (values.length === 0) return false;
  const expenseCount = values.filter((value) => /\b(expense|expenses|cost|costs|cogs|opex|debit|supplier|vendor|procurement|operating expense|fixed costs|payroll|bank fees)\b/i.test(value)).length;
  return expenseCount > 0;
}

function amountColumnRank(column: string) {
  const normalized = normalizeColumnName(column);
  if (/^(amount|transaction_amount|total|value|gross|net_amount|debit|credit)$/.test(normalized)) return 3;
  if (/(^|_)(amount|total|value|debit|credit)($|_)/.test(normalized)) return 2;
  if (/price|revenue|sales|cost|expense|cogs|income|gmv/.test(normalized)) return 1;
  return 0;
}

function confidenceRank(confidence: MappingConfidence) {
  if (confidence === "high") return 3;
  if (confidence === "medium") return 2;
  return 1;
}
