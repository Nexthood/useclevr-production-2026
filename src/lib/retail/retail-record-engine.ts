import { parseBusinessNumber } from "@/lib/data/semantic-schema";

/**
 * Shared Retail Analytics record engine.
 *
 * Deterministic, environment-free calculations used by both the browser
 * upload flow and the server-side retail source analytics endpoint. The
 * dataset path keeps its historical zero/default semantics for missing
 * numeric values; connected POS sources pass `null` for unknown values so
 * missing data is never turned into a fake zero with a different business
 * meaning.
 *
 * Canonical identity rules (shared by every Retail finding):
 * - Product identity: stable product_id/variant_id/item_id first, then SKU,
 *   then the normalized display name only as a last fallback. Distinct
 *   product IDs are never merged because their display names match.
 * - Location identity: a stable store/location ID column when detected,
 *   otherwise the normalized store/location name. The canonical inventory
 *   grain is product identity + location identity.
 * - Stock on hand is a snapshot, never an additive value: for repeated
 *   rows the latest dated snapshot wins and equal timestamps keep the
 *   first row in input order.
 */

/** Items with no sale/movement for at least this many days are dead stock. */
export const RETAIL_DEAD_STOCK_AFTER_DAYS = 60;
/** Items whose last sale is this many days back (but below the dead threshold) are slow movers. */
export const RETAIL_SLOW_MOVER_AFTER_DAYS = 30;
/** Default reorder threshold used only when a dataset has no reorder-point column. */
export const RETAIL_DEFAULT_REORDER_POINT = 10;

export type RetailLowStockItem = {
  product: string;
  sku: string;
  category: string;
  store: string | null;
  stock: number | null;
  reorderPoint: number | null;
  unitsSold: number | null;
  revenue: number | null;
  cost: number | null;
  grossProfit: number | null;
  margin: number | null;
  lastSaleDate: string;
  orderId: string;
  recommendation: string;
};

export type RetailDeadStockClassification = "dead_stock" | "slow_mover";

export type RetailDeadStockItem = {
  product: string;
  sku: string;
  category: string;
  store: string | null;
  stock: number | null;
  reorderPoint: number | null;
  unitsSold: number | null;
  revenue: number | null;
  cost: number | null;
  grossProfit: number | null;
  margin: number | null;
  lastSaleDate: string;
  daysSinceLastSale: number | null;
  stockValue: number | null;
  orderId: string;
  classification: RetailDeadStockClassification;
  suggestedAction: string;
  recommendation: string;
};

export type RetailTopProfitItem = {
  product: string;
  sku: string;
  category: string;
  store: string | null;
  stock: number | null;
  reorderPoint: number | null;
  unitsSold: number | null;
  profit: number | null;
  margin: number | null;
  revenue: number | null;
  cost: number | null;
  lastSaleDate: string;
  orderId: string;
  reason: string;
  recommendation: string;
};

export type RetailTopSellerItem = {
  product: string;
  sku: string;
  unitsSold: number;
  revenue: number;
  orderCount: number;
};

export type RetailRecord = {
  /** Stable source-native product identifier (product_id/variant_id/item_id). */
  productId: string | null;
  product: string;
  sku: string;
  category: string;
  store: string | null;
  stock: number | null;
  reorderPoint: number | null;
  unitsSold: number | null;
  revenue: number | null;
  cost: number | null;
  grossProfit: number | null;
  margin: number | null;
  lastSaleDate: string;
  lastSaleAt: Date | null;
  orderId: string;
  stockValue: number | null;
};

export type RetailInventoryEntityRecord = RetailRecord & {
  transactionRows: number;
  orderCount: number | null;
  /** True when rows of the same canonical entity carried conflicting category values. */
  categoryAmbiguous: boolean;
};

export type BuildRetailRecordsOptions = {
  /** Dataset uploads historically defaulted missing reorder points to 10. */
  defaultReorderPoint?: number | null;
  /** Dataset uploads historically defaulted missing stock/units/revenue to 0. */
  defaultMissingNumbersToZero?: boolean;
};

export function matchColumn(columns: string[], keywords: string[], exclude?: RegExp): string | null {
  const normalized = columns.map((c) => ({
    original: c,
    normalized: c.toLowerCase().trim().replace(/[^a-z0-9]/g, "_"),
  }));
  for (const keyword of keywords) {
    const kw = keyword.toLowerCase().trim().replace(/[^a-z0-9]/g, "_")
    const found = normalized.find((c) => c.normalized.includes(kw) && (!exclude || !exclude.test(c.normalized)))
    if (found) return found.original
  }
  return null
}

// ---------------------------------------------------------------------------
// Deterministic Retail schema resolver
//
// Maps arbitrary real-world Retail column names onto one canonical Retail
// model with tiered matching, cross-field exclusivity, and lightweight
// value-shape validation. Matching is tiered, never a bare substring scan:
//
// 1. "exact"     — normalized column name equals a canonical alias.
// 2. "alias"     — explicit high-confidence alias whose full token list is
//                  contained in the column's tokens ("min_stock" ⊆
//                  "min_stock_level").
// 3. "token"     — one distinctive alias token appears as a whole token
//                  ("receipt" ⊆ "receipt_no"); whole-token equality is what
//                  keeps "reorder_point" from ever matching the "order" token.
// 4. "heuristic" — legacy fallbacks (for example a bare price column standing
//                  in for revenue), only when nothing stronger matched, and
//                  only with value-shape evidence plus a data-quality note.
//
// A physical column can serve only one canonical field: once claimed at a
// stronger tier, later fields must find another candidate. Reserved tokens
// (vendor/supplier/brand for product, date/time for order identity,
// refund/cost-like tokens for revenue) never map into the protected field.
// ---------------------------------------------------------------------------

export type RetailCanonicalField =
  | "date" | "order" | "customer" | "productId" | "sku" | "product"
  | "category" | "store" | "supplier" | "reorderPoint" | "stock"
  | "sales" | "unitPrice" | "revenue" | "cost";

export type RetailColumnConfidence = "exact" | "alias" | "token" | "heuristic";

export type RetailColumnMapping = {
  field: RetailCanonicalField;
  column: string | null;
  confidence: RetailColumnConfidence | null;
  reason: string;
};

/** Tokens that describe seller/brand metadata, never an item's display name. */
const PRODUCT_RESERVED_TOKENS = ["vendor", "supplier", "brand", "manufacturer", "seller", "store", "shop", "branch"];
/** Tokens that mark order-like money aggregates rather than per-unit prices. */
const UNIT_PRICE_RESERVED_TOKENS = ["total", "net", "gross", "cogs", "cost"];
/** Money-deduction tokens that must never become operating revenue. */
const REVENUE_RESERVED_PATTERN = /refund|return|payout|cost|expense|discount|tax|fee/;

type FieldSpec = {
  field: RetailCanonicalField;
  /** Human-readable canonical concept name for diagnostics. */
  label: string;
  exact: string[];
  alias?: string[];
  token?: string[];
  heuristic?: string[];
  /** Column candidates containing any of these tokens are never used. */
  reservedTokens?: string[];
  /** Extra normalized-name exclusion (kept from the historical reorder guard). */
  reservedPattern?: RegExp;
  /** Required value shape when rows are available. */
  shape?: "number" | "date";
  /** Extra validation applied to weak-tier matches only. */
  weakShape?: "integer_dominant";
};

const FIELD_SPECS: FieldSpec[] = [
  {
    field: "date",
    label: "sale date",
    exact: ["date", "sale_date", "sales_date", "transaction_date", "order_date", "sold_at", "timestamp", "datetime", "date_time", "created_at", "date_created", "order_datetime", "day"],
    alias: ["sale", "sold_at", "date_of_sale"],
    token: ["date"],
    shape: "date",
  },
  {
    field: "order",
    label: "transaction / order identity",
    exact: ["order_id", "orderid", "order_number", "order_no", "order_ref", "receipt_no", "receipt_id", "receipt_number", "receipt", "transaction_id", "transaction_number", "transaction_no", "invoice_no", "invoice_id", "invoice_number", "sale_id", "sale_number"],
    reservedTokens: ["date", "time", "reorder"],
    reservedPattern: /reorder/,
  },
  {
    field: "customer",
    label: "customer identity",
    exact: ["customer_id", "customerid", "customer_number", "customer_no", "customer_ref", "client_id", "clientid", "client_ref", "client_number", "buyer_id", "buyer"],
    alias: ["customer", "client"],
    token: ["customer", "client", "buyer"],
  },
  {
    field: "productId",
    label: "stable product identity",
    exact: ["product_id", "productid", "product_number", "item_id", "itemid", "item_number", "variant_id", "variantid", "listing_id"],
    // No token tier on purpose: the bare "product"/"item" token must never
    // capture display-name columns such as "product_name".
  },
  {
    field: "sku",
    label: "SKU identity",
    exact: ["sku", "product_sku", "item_sku", "variant_sku", "stock_code", "item_code", "product_code", "barcode", "upc", "ean", "gtin"],
    token: ["sku"],
  },
  {
    field: "product",
    label: "product display name",
    exact: ["product_name", "productname", "item_name", "itemname", "item_description", "product_description", "product_title", "product", "item", "title", "article"],
    alias: ["name", "description", "title"],
    token: ["product", "item", "description"],
    reservedTokens: PRODUCT_RESERVED_TOKENS,
  },
  {
    field: "category",
    label: "category",
    exact: ["category", "department", "product_category", "item_category", "product_type", "item_type", "product_group", "item_group"],
    alias: ["type", "class", "group", "collection"],
    token: ["category", "department"],
    reservedTokens: ["cost", "price", "revenue", "amount"],
  },
  {
    field: "store",
    label: "store / location identity",
    exact: ["store_id", "storeid", "store_number", "store_code", "branch_id", "branch_code", "location_id", "location_code", "shop_id", "shop_code", "outlet_id", "warehouse_id"],
    alias: ["store", "branch", "location", "shop", "outlet", "warehouse"],
    token: ["store", "branch", "location", "shop", "outlet", "warehouse"],
    // City/region/country stay geography metadata; the store identity follows
    // the source's own keying, not a free-text place name.
    reservedTokens: ["city", "region", "country", "state", "market", "zone"],
  },
  {
    field: "supplier",
    label: "supplier",
    exact: ["supplier", "supplier_name", "supplier_id", "vendor", "vendor_name", "vendor_id", "manufacturer", "brand"],
    alias: ["vendor", "supplier"],
    token: ["vendor", "supplier", "manufacturer", "brand"],
  },
  {
    field: "reorderPoint",
    label: "reorder point",
    exact: ["reorder_point", "reorderpoint", "reorder_level", "min_stock_level", "minimum_stock", "min_stock", "minimum_inventory", "min_inventory", "par_level", "safety_stock", "restock_level"],
    token: ["reorder"],
    shape: "number",
    // A reorder-point column is never stock-on-hand evidence: the stock field
    // skips it through cross-field exclusivity, never by name luck.
  },
  {
    field: "stock",
    label: "stock on hand",
    exact: ["stock_on_hand", "stockonhand", "stock_onhand", "inventory_qty", "inventory_quantity", "current_stock", "stock_qty", "stock_level", "stock_quantity", "on_hand", "onhand", "qty_on_hand", "units_in_stock", "qty_in_stock", "closing_stock", "stock_count", "inventory_on_hand"],
    alias: ["stock", "inventory", "available"],
    token: ["stock", "inventory", "onhand"],
    shape: "number",
    // Bare qty/quantity tokens are transaction quantities; they map to units
    // sold, never to stock, unless every stock-flavored name is absent.
    heuristic: ["qty", "quantity", "units"],
  },
  {
    field: "sales",
    label: "units sold",
    exact: ["units_sold", "unitssold", "qty_sold", "qtysold", "quantity_sold", "sold_qty", "sold_units", "sales_quantity", "sales_units", "sold_quantity", "qty", "quantity", "units"],
    alias: ["sold", "sold_qty"],
    token: ["sold", "qty", "quantity", "units"],
    shape: "number",
    weakShape: "integer_dominant",
    // Inventory snapshot columns are stock, never units sold.
    reservedTokens: ["stock", "inventory", "onhand", "on_hand"],
  },
  {
    field: "unitPrice",
    label: "unit price",
    exact: ["unit_price", "unitprice", "price_per_unit", "price_each", "selling_price", "sale_price", "retail_price", "list_price", "price"],
    alias: ["price"],
    token: ["price"],
    shape: "number",
    reservedTokens: ["total", "net", "gross", "cogs", "cost"],
  },
  {
    field: "revenue",
    label: "revenue",
    exact: ["revenue", "net_sales", "netsales", "total_sales", "total_revenue", "gross_sales", "sales_amount", "line_total", "linetotal", "net_revenue", "sale_amount", "turnover", "income", "gross_sales_amount"],
    alias: ["amount", "sales", "total"],
    token: ["revenue", "sales", "turnover", "income"],
    shape: "number",
    reservedTokens: ["refund", "payout", "discount", "expense"],
    reservedPattern: REVENUE_RESERVED_PATTERN,
  },
  {
    field: "cost",
    label: "cost basis",
    // Unit-cost fields win over aggregate/COGS fields: the canonical engine
    // multiplies a detected unit cost by units sold, and a unit-cost reading
    // is the only one that stays correct for both grain interpretations.
    exact: ["unit_cost", "unitcost", "cost_price", "costprice", "purchase_cost", "purchase_price", "cost_per_unit", "product_cost", "wholesale_price", "buying_price", "total_cost", "cogs", "cost_of_goods_sold", "cost_of_goods", "cost_of_sales", "cost_amount", "cost"],
    alias: ["cost"],
    token: ["cost", "cogs"],
    shape: "number",
    reservedTokens: ["revenue", "refund"],
  },
];

type NormalizedColumn = { original: string; normalized: string; tokens: string[] };

function normalizeRetailColumnName(column: string): string {
  return column.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function columnTokenList(normalized: string): string[] {
  return normalized.split("_").filter(Boolean);
}

function aliasTokensInColumn(alias: string, tokens: string[]): boolean {
  const aliasTokens = alias.split("_").filter(Boolean);
  return aliasTokens.length > 0 && aliasTokens.every((token) => tokens.includes(token));
}

function isReservedColumn(spec: FieldSpec, entry: NormalizedColumn): boolean {
  if (spec.reservedPattern && spec.reservedPattern.test(entry.normalized)) return true;
  if (spec.reservedTokens?.some((token) => entry.tokens.includes(token))) return true;
  return false;
}

function numericShare(rows: Record<string, unknown>[], column: string): number {
  const values = rows.map((row) => row[column]).filter((value) => value !== null && value !== undefined && String(value).trim() !== "");
  if (values.length === 0) return 0;
  const numeric = values.filter((value) => parseBusinessNumber(value) !== null).length;
  return numeric / values.length;
}

function dateLikeShare(rows: Record<string, unknown>[], column: string): number {
  const values = rows.map((row) => row[column]).filter((value) => value !== null && value !== undefined && String(value).trim() !== "");
  if (values.length === 0) return 0;
  const parseable = values.filter((value) => value instanceof Date || parseDateValue(value) !== null).length;
  return parseable / values.length;
}

function integerDominantShare(rows: Record<string, unknown>[], column: string): number {
  const values = rows.map((row) => row[column]).filter((value) => value !== null && value !== undefined && String(value).trim() !== "");
  if (values.length === 0) return 0;
  const integral = values.filter((value) => {
    const parsed = parseBusinessNumber(value);
    return parsed !== null && Number.isInteger(parsed);
  }).length;
  return integral / values.length;
}

function passesShapeValidation(
  spec: FieldSpec,
  column: string,
  tier: RetailColumnConfidence,
  rows: Record<string, unknown>[] | null,
): boolean {
  if (!rows || rows.length === 0) return true;
  if (spec.shape === "number" && numericShare(rows, column) < 0.5) return false;
  if (spec.shape === "date" && dateLikeShare(rows, column) < 0.5) return false;
  // Weak matches must show quantity-like evidence before driving units sold;
  // explicit qty-family aliases may carry legitimate decimal quantities.
  if (spec.weakShape === "integer_dominant" && tier !== "exact" && integerDominantShare(rows, column) < 0.8) return false;
  return true;
}

/**
 * Resolves one canonical Retail schema from physical column names, with
 * optional value-shape validation from the parsed rows.
 *
 * Cross-field exclusivity is enforced by tiered passes: every field claims
 * its exact match before any field may take an alias match, and so on, so a
 * strong explicit match ("net_sales" → revenue) can never be stolen by a
 * weaker match from an earlier field ("sales" token inside "net_sales").
 */
export function resolveRetailSchema(
  columns: string[],
  rows?: Record<string, unknown>[],
): {
  detected: DetectedColumns;
  mapping: RetailColumnMapping[];
  warnings: string[];
} {
  const normalized = columns.map((column) => {
    const normalizedColumn = normalizeRetailColumnName(column);
    return { original: column, normalized: normalizedColumn, tokens: columnTokenList(normalizedColumn) };
  });
  const claimed = new Map<string, RetailCanonicalField>();
  const mapping = new Map<RetailCanonicalField, RetailColumnMapping>();
  const warnings: string[] = [];
  const rowsOrNull = rows && rows.length > 0 ? rows : null;
  const tiers: RetailColumnConfidence[] = ["exact", "alias", "token", "heuristic"];

  for (const tier of tiers) {
    for (const spec of FIELD_SPECS) {
      const existing = mapping.get(spec.field);
      if (existing && existing.column) continue;
      if (tier === "heuristic" && !spec.heuristic?.length) continue;
      const aliases = tier === "exact" ? spec.exact : tier === "alias" ? (spec.alias ?? []) : tier === "token" ? (spec.token ?? []) : (spec.heuristic ?? []);
      for (const alias of aliases) {
        const candidates = candidateColumnsFor(spec, alias, tier, normalized);
        for (const candidate of candidates) {
          if (claimed.has(candidate.normalized)) continue;
          if (!passesShapeValidation(spec, candidate.original, tier, rowsOrNull)) continue;
          claimed.set(candidate.normalized, spec.field);
          mapping.set(spec.field, {
            field: spec.field,
            column: candidate.original,
            confidence: tier,
            reason: `${spec.label} resolved from "${candidate.original}" via ${tier} match`,
          });
          break;
        }
        const current = mapping.get(spec.field);
        if (current && current.column) break;
      }
    }
  }

  // Legacy failsafe: when no revenue column exists, the detected unit-price
  // column served as per-row revenue. Keep it, but flag the weaker reading.
  if (!mapping.get("revenue")?.column && mapping.get("unitPrice")?.column) {
    const priceColumn = mapping.get("unitPrice")!.column!;
    if (!claimed.has(normalizeRetailColumnName(priceColumn)) || claimed.get(normalizeRetailColumnName(priceColumn)) === "unitPrice") {
      claimed.set(normalizeRetailColumnName(priceColumn), "revenue");
      mapping.set("revenue", {
        field: "revenue",
        column: priceColumn,
        confidence: "heuristic",
        reason: `revenue fell back to the unit price column "${priceColumn}" because no revenue-like column exists`,
      });
      warnings.push(
        `Revenue could not be confidently identified, so the unit price column "${priceColumn}" was used as per-row revenue; add a line-total or revenue column for exact sales totals.`,
      );
    }
  }

  const detected: DetectedColumns = {
    productIdCol: mapping.get("productId")?.column ?? null,
    skuCol: mapping.get("sku")?.column ?? null,
    productCol: mapping.get("product")?.column ?? null,
    categoryCol: mapping.get("category")?.column ?? null,
    storeCol: mapping.get("store")?.column ?? null,
    stockCol: mapping.get("stock")?.column ?? null,
    reorderPointCol: mapping.get("reorderPoint")?.column ?? null,
    salesCol: mapping.get("sales")?.column ?? null,
    unitPriceCol: mapping.get("unitPrice")?.column ?? null,
    revenueCol: mapping.get("revenue")?.column ?? null,
    costCol: mapping.get("cost")?.column ?? null,
    dateCol: mapping.get("date")?.column ?? null,
    orderCol: mapping.get("order")?.column ?? null,
    customerCol: mapping.get("customer")?.column ?? null,
    supplierCol: mapping.get("supplier")?.column ?? null,
  };

  for (const spec of FIELD_SPECS) {
    if (!mapping.has(spec.field)) {
      mapping.set(spec.field, { field: spec.field, column: null, confidence: null, reason: `no confident ${spec.label} column was found` });
    }
  }

  return {
    detected,
    mapping: FIELD_SPECS.map((spec) => mapping.get(spec.field)!),
    warnings,
  };
}

function candidateColumnsFor(
  spec: FieldSpec,
  alias: string,
  tier: RetailColumnConfidence,
  normalized: NormalizedColumn[],
): NormalizedColumn[] {
  const aliasTokens = alias.split("_").filter(Boolean);
  return normalized
    .filter((entry) => {
      if (tier === "exact") return entry.normalized === alias;
      if (tier === "alias") {
        if (aliasTokens.length === 0) return false;
        // A bare reserved token ("name", "description") must not sweep a
        // vendor/seller column into the product field.
        if (spec.reservedTokens?.includes(alias) && isReservedColumn(spec, entry)) return false;
        return aliasTokens.every((token) => entry.tokens.includes(token));
      }
      // token tier: the alias is one distinctive whole token inside the column
      return aliasTokens.length === 1 && entry.tokens.includes(aliasTokens[0]);
    })
    .filter((entry) => !isReservedColumn(spec, entry));
}

export function detectColumns(columns: string[], rows?: Record<string, unknown>[]): DetectedColumns {
  return resolveRetailSchema(columns, rows).detected;
}

export type DetectedColumns = {
  /** Stable source-native product/item/variant identifier column. */
  productIdCol: string | null;
  skuCol: string | null;
  productCol: string | null;
  categoryCol: string | null;
  storeCol: string | null;
  stockCol: string | null;
  reorderPointCol: string | null;
  salesCol: string | null;
  /** Alternative-structure price field; informational for mapping quality. */
  unitPriceCol?: string | null;
  revenueCol: string | null;
  costCol: string | null;
  dateCol: string | null;
  orderCol: string | null;
  customerCol: string | null;
  /** Alternative-structure supplier field; informational for mapping quality. */
  supplierCol?: string | null;
};

export function isUnitCostColumn(column: string | null): boolean {
  if (!column) return false
  return /unit|wholesale|purchase|buying|cost_price|product_cost/i.test(column)
}

export function toNumber(val: unknown): number {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0
  if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9.\-]/g, "")
    const n = parseFloat(cleaned)
    return isNaN(n) ? 0 : n
  }
  return 0
}

export function toText(val: unknown, fallback = "Not provided"): string {
  if (val === null || val === undefined) return fallback
  const text = String(val).trim()
  return text.length > 0 ? text : fallback
}

export function parseDateValue(val: unknown): Date | null {
  if (val instanceof Date && !isNaN(val.getTime())) return val
  if (typeof val === "number" && val > 0) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const date = new Date(excelEpoch.getTime() + val * 24 * 60 * 60 * 1000)
    return isNaN(date.getTime()) ? null : date
  }
  if (typeof val === "string" && val.trim()) {
    const date = new Date(val)
    return isNaN(date.getTime()) ? null : date
  }
  return null
}

export function formatDateValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "Not provided"
}

export function buildRetailRecords(
  rows: Record<string, unknown>[],
  detected: DetectedColumns,
  options: BuildRetailRecordsOptions = {},
): RetailRecord[] {
  const zeroDefaults = options.defaultMissingNumbersToZero !== false
  const defaultReorderPoint = options.defaultReorderPoint === undefined ? RETAIL_DEFAULT_REORDER_POINT : options.defaultReorderPoint

  return rows
    .map((row) => {
      const product = detected.productCol
        ? toText(row[detected.productCol], "Unknown product")
        : "Unknown product"
      const productId = detected.productIdCol ? (toText(row[detected.productIdCol], "") || null) : null
      const sku = detected.skuCol ? toText(row[detected.skuCol]) : "Not provided"
      const category = detected.categoryCol ? toText(row[detected.categoryCol]) : "Not provided"
      const store = detected.storeCol ? toText(row[detected.storeCol]) : null
      // A missing stock column means stock is unknown (null); a present
      // column with an empty cell keeps the dataset zero-default.
      const stock = detected.stockCol
        ? (zeroDefaults ? toNumber(row[detected.stockCol]) : parseNullableNumber(row[detected.stockCol]))
        : null
      // An empty reorder cell means "not provided" and falls back to the
      // dataset default threshold instead of fabricating a zero reorder
      // point, which would silently change the alert boundary.
      const reorderPoint = detected.reorderPointCol
        ? (parseNullableNumber(row[detected.reorderPointCol]) ?? (defaultReorderPoint === null ? null : defaultReorderPoint))
        : defaultReorderPoint === null ? null : defaultReorderPoint
      const unitsSold = detected.salesCol
        ? (zeroDefaults ? toNumber(row[detected.salesCol]) : parseNullableNumber(row[detected.salesCol]))
        : zeroDefaults ? 0 : null
      const revenue = detected.revenueCol
        ? (zeroDefaults ? toNumber(row[detected.revenueCol]) : parseNullableNumber(row[detected.revenueCol]))
        : zeroDefaults ? 0 : null
      const rawCost = detected.costCol
        ? (zeroDefaults ? toNumber(row[detected.costCol]) : parseNullableNumber(row[detected.costCol]))
        : zeroDefaults ? 0 : null
      const unitsSoldValue = unitsSold ?? 0
      const unitCost = isUnitCostColumn(detected.costCol)
        ? rawCost
        : unitsSoldValue > 0 && rawCost !== null ? rawCost / unitsSoldValue : rawCost
      const cost = isUnitCostColumn(detected.costCol) && unitsSoldValue > 0 && rawCost !== null
        ? rawCost * unitsSoldValue
        : rawCost
      const revenueValue = revenue ?? 0
      const grossProfit = cost === null ? null : revenueValue - cost
      const margin = revenueValue > 0
        ? (grossProfit === null ? null : (grossProfit / revenueValue) * 100)
        : zeroDefaults ? 0 : null
      const lastSaleAt = detected.dateCol ? parseDateValue(row[detected.dateCol]) : null
      const orderId = detected.orderCol ? toText(row[detected.orderCol]) : "Not provided"

      return {
        productId,
        product,
        sku,
        category,
        store,
        stock,
        reorderPoint,
        unitsSold,
        revenue,
        cost,
        grossProfit,
        margin,
        lastSaleDate: formatDateValue(lastSaleAt),
        lastSaleAt,
        orderId,
        stockValue: stock !== null && unitCost !== null
          ? Math.max(stock, 0) * Math.max(unitCost, 0)
          : null,
      }
    })
    .filter((record) => record.product !== "Unknown product" || record.sku !== "Not provided" || record.productId !== null)
}

/**
 * Collapses transaction rows into the canonical product/location inventory
 * grain (product identity + location identity).
 *
 * Sales fields (units, revenue, cost) are additive. Stock-on-hand and the
 * reorder point are inventory snapshots: for repeated rows the latest dated
 * snapshot wins, equal timestamps keep the first row in input order, and
 * rows without any date fall back to first-occurrence order. Stock is never
 * summed across transaction rows.
 */
export function aggregateRetailInventoryRecords(records: RetailRecord[]): RetailInventoryEntityRecord[] {
  type AggregateEntry = {
    entity: RetailInventoryEntityRecord;
    orderIds: Set<string>;
    latest: RetailRecord;
    categories: Set<string>;
  };
  const grouped = new Map<string, AggregateEntry>()

  for (const record of records) {
    const key = retailInventoryEntityKey(record)
    const existing = grouped.get(key)
    if (!existing) {
      const orderIds = new Set<string>()
      if (record.orderId !== "Not provided") orderIds.add(record.orderId)
      const categories = new Set<string>()
      if (record.category !== "Not provided") categories.add(record.category)
      grouped.set(key, {
        entity: {
          ...record,
          transactionRows: 1,
          orderCount: orderIds.size || null,
          categoryAmbiguous: false,
        },
        orderIds,
        latest: record,
        categories,
      })
      continue
    }

    const entity = existing.entity
    const revenue = combineAdditive(entity.revenue, record.revenue)
    const cost = combineAdditive(entity.cost, record.cost)
    const unitsSold = combineAdditive(entity.unitsSold, record.unitsSold)
    const grossProfit = revenue !== null && cost !== null ? revenue - cost : null
    const latestInventory = chooseLatestInventoryRecord(existing.latest, record)
    const lastSaleAt = !entity.lastSaleAt || (record.lastSaleAt && record.lastSaleAt > entity.lastSaleAt)
      ? record.lastSaleAt
      : entity.lastSaleAt
    if (record.orderId !== "Not provided") existing.orderIds.add(record.orderId)
    if (record.category !== "Not provided") existing.categories.add(record.category)

    entity.category = latestInventory.category !== "Not provided" ? latestInventory.category : entity.category
    entity.stock = latestInventory.stock
    entity.reorderPoint = latestInventory.reorderPoint
    entity.unitsSold = unitsSold
    entity.revenue = revenue
    entity.cost = cost
    entity.grossProfit = grossProfit
    entity.margin = revenue !== null && revenue > 0 && grossProfit !== null ? (grossProfit / revenue) * 100 : null
    entity.lastSaleAt = lastSaleAt
    entity.lastSaleDate = formatDateValue(lastSaleAt)
    entity.orderId = existing.orderIds.size ? `${existing.orderIds.size} orders` : "Not provided"
    entity.stockValue = latestInventory.stockValue
    entity.transactionRows = entity.transactionRows + 1
    entity.orderCount = existing.orderIds.size || null
    entity.categoryAmbiguous = existing.categories.size > 1
    existing.latest = latestInventory
  }

  return Array.from(grouped.values()).map((entry) => entry.entity)
}

export function getReferenceDate(records: RetailRecord[]): Date | null {
  return records.reduce<Date | null>((latest, record) => {
    if (!record.lastSaleAt) return latest
    if (!latest || record.lastSaleAt > latest) return record.lastSaleAt
    return latest
  }, null)
}

/** The visible item list stays capped; callers needing the true count pass a larger limit. */
export function computeLowStock(records: RetailRecord[], limit = 20): RetailLowStockItem[] {
  return records
    .filter((item) => item.stock !== null && item.reorderPoint !== null && item.stock <= item.reorderPoint)
    .map((item) => ({
      product: item.product,
      sku: item.sku,
      category: item.category,
      store: item.store,
      stock: item.stock,
      reorderPoint: item.reorderPoint,
      unitsSold: item.unitsSold,
      revenue: item.revenue,
      cost: item.cost,
      grossProfit: item.grossProfit,
      margin: item.margin,
      lastSaleDate: item.lastSaleDate,
      orderId: item.orderId,
      recommendation: `Stock ${formatPlainNumber(item.stock ?? 0)} is at or below reorder point ${formatPlainNumber(item.reorderPoint ?? 0)}, sold ${formatPlainNumber(item.unitsSold ?? 0)} units recently → reorder recommended.`,
    }))
    .sort(compareEntityThen((a, b) => (a.stock ?? 0) - (b.stock ?? 0)))
    .slice(0, limit)
}

/** The visible item list stays capped; callers needing the true count pass a larger limit. */
export function computeDeadStock(records: RetailRecord[], limit = 20): RetailDeadStockItem[] {
  const referenceDate = getReferenceDate(records)

  return records
    .map((item) => {
      const daysSinceLastSale = referenceDate && item.lastSaleAt
        ? Math.max(0, Math.floor((referenceDate.getTime() - item.lastSaleAt.getTime()) / 86_400_000))
        : null
      // Zero recorded units is direct no-movement evidence; without a units
      // column, only a stale last-sale date may classify movement.
      const unitsSold = item.unitsSold
      const hasNoRecordedUnits = unitsSold !== null && unitsSold <= 0
      const isDead = (item.stock ?? 0) > 0
        && (hasNoRecordedUnits || (daysSinceLastSale !== null && daysSinceLastSale >= RETAIL_DEAD_STOCK_AFTER_DAYS))
      const isSlowMover = (item.stock ?? 0) > 0
        && !hasNoRecordedUnits
        && unitsSold !== null
        && daysSinceLastSale !== null
        && daysSinceLastSale >= RETAIL_SLOW_MOVER_AFTER_DAYS
        && daysSinceLastSale < RETAIL_DEAD_STOCK_AFTER_DAYS
      if (!isDead && !isSlowMover) return null
      const classification: RetailDeadStockClassification = isDead ? "dead_stock" : "slow_mover"
      const suggestedAction = isDead
        ? (hasNoRecordedUnits ? "Discount or bundle" : "Bundle or stop reorder")
        : "Review before reorder"
      const movementSummary = hasNoRecordedUnits
        ? "no recorded units sold"
        : daysSinceLastSale !== null
          ? `no sale in ${formatPlainNumber(daysSinceLastSale)} days`
          : "no sale date recorded"

      return {
        product: item.product,
        sku: item.sku,
        category: item.category,
        store: item.store,
        stock: item.stock,
        reorderPoint: item.reorderPoint,
        unitsSold: item.unitsSold,
        revenue: item.revenue,
        cost: item.cost,
        grossProfit: item.grossProfit,
        margin: item.margin,
        lastSaleDate: item.lastSaleDate,
        daysSinceLastSale,
        stockValue: item.stockValue,
        orderId: item.orderId,
        classification,
        suggestedAction,
        recommendation:
          isDead
            ? `${suggestedAction}: ${item.stock !== null && item.stock > 0 ? "clear stocked units before buying more" : "keep off reorder lists until demand returns"} (${movementSummary}).`
            : `Slow mover with ${movementSummary}: review pricing or placement before it turns into dead stock.`,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort(compareEntityThen((a, b) => round2(b.stockValue ?? 0) - round2(a.stockValue ?? 0)))
    .slice(0, limit)
}

/**
 * Ranks canonical product/location entities by recomputed gross profit.
 *
 * Input must already be at the canonical entity grain (see
 * aggregateRetailInventoryRecords); no secondary regrouping happens here, so
 * entities in different locations (or sharing a display name) keep their own
 * profit.
 */
export function computeTopProfit(records: RetailRecord[]): RetailTopProfitItem[] {
  return [...records]
    .filter((item) => item.grossProfit !== null && item.grossProfit > 0)
    .sort(compareEntityThen((a, b) => round2(b.grossProfit ?? 0) - round2(a.grossProfit ?? 0) || round2(b.revenue ?? 0) - round2(a.revenue ?? 0)))
    .slice(0, 20)
    .map((item) => ({
      product: item.product,
      sku: item.sku,
      category: item.category,
      store: item.store,
      stock: item.stock,
      reorderPoint: item.reorderPoint,
      unitsSold: item.unitsSold,
      profit: item.grossProfit,
      margin: item.margin,
      revenue: item.revenue,
      cost: item.cost,
      lastSaleDate: item.lastSaleDate,
      orderId: item.orderId,
      reason: (item.margin ?? 0) >= 50
        ? "High margin converts sales into strong profit."
        : (item.unitsSold ?? 0) >= 10
          ? "Sales volume drives strong total profit."
          : "Positive margin and profitable sales make this worth protecting.",
      recommendation: "Keep this item in stock and protect margin before discounting.",
    }))
}

/**
 * Global product-level sales ranking (not per location). Order counts are
 * distinct order IDs, never transaction-row counts.
 */
export function computeTopSellers(records: RetailRecord[]): RetailTopSellerItem[] {
  const grouped = new Map<string, RetailTopSellerItem & { key: string; orderIds: Set<string> }>()

  for (const record of records) {
    if ((record.unitsSold ?? 0) <= 0 && (record.revenue ?? 0) <= 0) continue
    const key = retailProductIdentityKey(record)
    const existing = grouped.get(key)
    const orderIds = existing?.orderIds ?? new Set<string>()
    if (record.orderId !== "Not provided") orderIds.add(record.orderId)
    if (existing) {
      existing.unitsSold += record.unitsSold ?? 0
      existing.revenue += record.revenue ?? 0
      existing.orderCount = orderIds.size
      continue
    }
    grouped.set(key, {
      key,
      product: record.product,
      sku: record.sku,
      unitsSold: record.unitsSold ?? 0,
      revenue: record.revenue ?? 0,
      orderCount: orderIds.size,
      orderIds,
    })
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.unitsSold - a.unitsSold || round2(b.revenue) - round2(a.revenue) || a.product.localeCompare(b.product))
    .slice(0, 20)
    .map(({ key: _key, orderIds: _orderIds, ...item }) => item)
}

export function formatPlainNumber(val: number): string {
  return new Intl.NumberFormat().format(val)
}

function parseNullableNumber(val: unknown): number | null {
  const parsed = parseBusinessNumber(val)
  return parsed === null ? null : parsed
}

/** Money-precision rounding used for deterministic ranking comparisons. */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Normalized identity value: case-insensitive, trimmed, whitespace-collapsed.
 * Identity comparisons never depend on display formatting.
 */
export function normalizeRetailIdentityValue(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ")
}

/**
 * Canonical product identity precedence:
 * 1. stable product_id / variant_id / item_id
 * 2. SKU
 * 3. normalized display name (final fallback only)
 *
 * Distinct stable IDs are never merged because their display names match.
 */
export function retailProductIdentityKey(record: Pick<RetailRecord, "productId" | "sku" | "product">): string {
  if (record.productId) return `id:${normalizeRetailIdentityValue(record.productId)}`
  if (record.sku && record.sku !== "Not provided") return `sku:${normalizeRetailIdentityValue(record.sku)}`
  return `name:${normalizeRetailIdentityValue(record.product)}`
}

/**
 * Canonical location identity: the detected stable store/location ID column
 * value when present, otherwise the normalized store/location name. Entities
 * without any location field share one unnamed-location bucket.
 */
export function retailLocationIdentityKey(record: Pick<RetailRecord, "store">): string {
  return normalizeRetailIdentityValue(record.store ?? "")
}

/** Canonical inventory grain: product identity + location identity. */
export function retailInventoryEntityKey(record: RetailRecord): string {
  return `${retailProductIdentityKey(record)}|${retailLocationIdentityKey(record)}`
}

function combineAdditive(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null
  return (a ?? 0) + (b ?? 0)
}

/**
 * Latest inventory snapshot selection: a strictly newer date wins, equal
 * dates keep the first row in input order, undated rows fall back to
 * first-occurrence order.
 */
function chooseLatestInventoryRecord(existing: RetailRecord, next: RetailRecord) {
  if (!existing.lastSaleAt && next.lastSaleAt) return next
  if (existing.lastSaleAt && next.lastSaleAt && next.lastSaleAt > existing.lastSaleAt) return next
  if (existing.lastSaleAt || !next.lastSaleAt) return existing
  return next
}

/** Deterministic ordering: primary metric first, then stable entity tie-breakers. */
function compareEntityThen<T extends Pick<RetailRecord, "product" | "sku" | "store">>(primary: (a: T, b: T) => number) {
  return (a: T, b: T) =>
    primary(a, b)
    || a.product.localeCompare(b.product)
    || (a.store ?? "").localeCompare(b.store ?? "")
    || a.sku.localeCompare(b.sku)
}
