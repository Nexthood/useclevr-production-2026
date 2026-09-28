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

export function detectColumns(columns: string[]) {
  return {
    productIdCol: matchColumn(columns, [
      "product_id", "variant_id", "item_id", "productid", "variantid", "itemid",
      "product_number", "item_number", "listing_id",
    ]),
    skuCol: matchColumn(columns, [
      "sku", "product_sku", "item_sku", "variant_sku", "barcode",
      "upc", "ean", "code", "item_code", "product_code",
    ]),
    productCol: matchColumn(columns, [
      "product_name", "item_name", "product", "name", "item", "title",
      "description", "article",
    ]),
    categoryCol: matchColumn(columns, [
      "category", "department", "collection", "product_type", "type",
      "class", "group",
    ]),
    // Stable store/location IDs win over free-text location names so the
    // canonical location identity follows the source's own keying.
    storeCol: matchColumn(columns, [
      "store_id", "location_id", "branch_id", "shop_id",
      "store", "location", "branch", "shop",
    ]),
    stockCol: matchColumn(columns, [
      "stock", "quantity", "qty", "on_hand", "inventory", "available",
      "qty_in_stock", "units_in_stock", "stock_qty", "stock_level",
    ]),
    reorderPointCol: matchColumn(columns, [
      "reorder_point", "reorder", "minimum_stock", "min_stock", "par_level",
      "safety_stock", "restock_level",
    ]),
    salesCol: matchColumn(columns, [
      "sold", "units_sold", "quantity_sold", "sales_quantity", "qty_sold",
      "sales", "sell", "quantity", "qty",
    ]),
    revenueCol: matchColumn(columns, [
      "revenue", "sales_amount", "total_sales", "income", "turnover",
      "total_revenue", "amount", "price", "selling_price", "retail_price",
      "unit_price", "sale_price",
    ]),
    costCol: matchColumn(columns, [
      "cost", "cogs", "unit_cost", "product_cost", "cost_price",
      "wholesale_price", "purchase_price", "cost_of_goods", "buying_price",
    ]),
    dateCol: matchColumn(columns, [
      "date", "transaction_date", "order_date", "sale_date", "created_at",
      "timestamp", "datetime", "date_created",
    ]),
    // "order" must never match "reorder_point"/"reorder" columns.
    orderCol: matchColumn(columns, [
      "order_number", "order_id", "orderid", "order", "invoice_number",
      "invoice_id", "receipt_number", "transaction_id",
    ], /reorder/),
    customerCol: matchColumn(columns, [
      "customer_id", "customer_number", "customer", "client_id", "client",
      "buyer_id", "buyer", "member_id",
    ]),
  }
}

export type DetectedColumns = ReturnType<typeof detectColumns>

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

export function computeLowStock(records: RetailRecord[]): RetailLowStockItem[] {
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
    .slice(0, 20)
}

export function computeDeadStock(records: RetailRecord[]): RetailDeadStockItem[] {
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
    .slice(0, 20)
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
