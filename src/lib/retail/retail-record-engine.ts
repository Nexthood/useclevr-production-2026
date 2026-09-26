import { parseBusinessNumber } from "@/lib/data/semantic-schema";

/**
 * Shared Retail Analytics record engine.
 *
 * Deterministic, environment-free calculations used by both the browser
 * upload flow and the server-side retail source analytics endpoint. The
 * dataset path keeps its historical zero/default semantics; connected POS
 * sources pass `null` for unknown values so missing data is never turned
 * into a fake zero with a different business meaning.
 */

export type RetailLowStockItem = {
  product: string;
  sku: string;
  category: string;
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

export type RetailDeadStockItem = {
  product: string;
  sku: string;
  category: string;
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
  suggestedAction: string;
  recommendation: string;
};

export type RetailTopProfitItem = {
  product: string;
  sku: string;
  category: string;
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

export type BuildRetailRecordsOptions = {
  /** Dataset uploads historically defaulted missing reorder points to 10. */
  defaultReorderPoint?: number | null;
  /** Dataset uploads historically defaulted missing stock/units/revenue to 0. */
  defaultMissingNumbersToZero?: boolean;
};

export function matchColumn(columns: string[], keywords: string[]): string | null {
  const normalized = columns.map((c) => ({
    original: c,
    normalized: c.toLowerCase().trim().replace(/[^a-z0-9]/g, "_"),
  }));
  for (const keyword of keywords) {
    const kw = keyword.toLowerCase().trim().replace(/[^a-z0-9]/g, "_")
    const found = normalized.find((c) => c.normalized.includes(kw))
    if (found) return found.original
  }
  return null
}

export function detectColumns(columns: string[]) {
  return {
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
    storeCol: matchColumn(columns, [
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
    orderCol: matchColumn(columns, [
      "order_number", "order_id", "orderid", "order", "invoice_number",
      "invoice_id", "receipt_number", "transaction_id",
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
  const defaultReorderPoint = options.defaultReorderPoint === undefined ? 10 : options.defaultReorderPoint

  return rows
    .map((row) => {
      const product = detected.productCol
        ? toText(row[detected.productCol], "Unknown product")
        : "Unknown product"
      const sku = detected.skuCol ? toText(row[detected.skuCol]) : "Not provided"
      const category = detected.categoryCol ? toText(row[detected.categoryCol]) : "Not provided"
      const store = detected.storeCol ? toText(row[detected.storeCol]) : null
      const stock = detected.stockCol
        ? (zeroDefaults ? toNumber(row[detected.stockCol]) : parseNullableNumber(row[detected.stockCol]))
        : zeroDefaults ? 0 : null
      const reorderPoint = detected.reorderPointCol
        ? (zeroDefaults ? toNumber(row[detected.reorderPointCol]) : parseNullableNumber(row[detected.reorderPointCol]))
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
    .filter((record) => record.product !== "Unknown product" || record.sku !== "Not provided")
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
      stock: item.stock,
      reorderPoint: item.reorderPoint,
      unitsSold: item.unitsSold,
      revenue: item.revenue,
      cost: item.cost,
      grossProfit: item.grossProfit,
      margin: item.margin,
      lastSaleDate: item.lastSaleDate,
      orderId: item.orderId,
      recommendation: `Stock ${formatPlainNumber(item.stock ?? 0)}, reorder point ${formatPlainNumber(item.reorderPoint ?? 0)}, sold ${formatPlainNumber(item.unitsSold ?? 0)} units recently → reorder recommended.`,
    }))
    .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
    .slice(0, 20)
}

export function computeDeadStock(records: RetailRecord[]): RetailDeadStockItem[] {
  const referenceDate = getReferenceDate(records)

  return records
    .map((item) => {
      const daysSinceLastSale = referenceDate && item.lastSaleAt
        ? Math.max(0, Math.floor((referenceDate.getTime() - item.lastSaleAt.getTime()) / 86_400_000))
        : null
      const unitsSold = item.unitsSold ?? 0
      const suggestedAction = unitsSold === 0
        ? "Discount or bundle"
        : daysSinceLastSale !== null && daysSinceLastSale >= 60
          ? "Bundle or stop reorder"
          : "Review before reorder"

      return {
        product: item.product,
        sku: item.sku,
        category: item.category,
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
        suggestedAction,
        recommendation:
          `${suggestedAction}: ${item.stock !== null && item.stock > 0 ? "clear stocked units before buying more" : "keep off reorder lists until demand returns"}.`,
      }
    })
    .filter((item) => (item.stock ?? 0) > 0 && ((item.unitsSold ?? 0) <= 0 || (item.daysSinceLastSale !== null && item.daysSinceLastSale >= 60)))
    .sort((a, b) => (b.stockValue ?? 0) - (a.stockValue ?? 0))
    .slice(0, 20)
}

export function computeTopProfit(records: RetailRecord[]): RetailTopProfitItem[] {
  const grouped = new Map<string, RetailRecord>()

  for (const record of records) {
    const key = [
      record.product.toLowerCase(),
      record.sku.toLowerCase(),
      record.orderId === "Not provided" ? "" : record.orderId.toLowerCase(),
    ].join("|")
    const existing = grouped.get(key)

    if (!existing) {
      grouped.set(key, { ...record })
      continue
    }

    const revenue = (existing.revenue ?? 0) + (record.revenue ?? 0)
    const cost = (existing.cost ?? 0) + (record.cost ?? 0)
    const grossProfit = existing.cost === null || record.cost === null ? null : revenue - cost
    const lastSaleAt = !existing.lastSaleAt || (record.lastSaleAt && record.lastSaleAt > existing.lastSaleAt)
      ? record.lastSaleAt
      : existing.lastSaleAt

    grouped.set(key, {
      ...existing,
      stock: maxNullable(existing.stock, record.stock),
      reorderPoint: maxNullable(existing.reorderPoint, record.reorderPoint),
      unitsSold: existing.unitsSold === null && record.unitsSold === null ? null : (existing.unitsSold ?? 0) + (record.unitsSold ?? 0),
      revenue,
      cost,
      grossProfit,
      margin: revenue > 0 && grossProfit !== null ? (grossProfit / revenue) * 100 : null,
      lastSaleAt,
      lastSaleDate: formatDateValue(lastSaleAt),
      stockValue: existing.stockValue === null && record.stockValue === null ? null : (existing.stockValue ?? 0) + (record.stockValue ?? 0),
    })
  }

  return Array.from(grouped.values())
    .filter((item) => item.grossProfit !== null && item.grossProfit > 0)
    .sort((a, b) => (b.grossProfit ?? 0) - (a.grossProfit ?? 0))
    .slice(0, 20)
    .map((item) => ({
      product: item.product,
      sku: item.sku,
      category: item.category,
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

export function computeTopSellers(records: RetailRecord[]): RetailTopSellerItem[] {
  const grouped = new Map<string, RetailTopSellerItem & { key: string }>()

  for (const record of records) {
    if ((record.unitsSold ?? 0) <= 0 && (record.revenue ?? 0) <= 0) continue
    const key = [record.product.toLowerCase(), record.sku.toLowerCase()].join("|")
    const existing = grouped.get(key)
    if (existing) {
      existing.unitsSold += record.unitsSold ?? 0
      existing.revenue += record.revenue ?? 0
      existing.orderCount += 1
      continue
    }
    grouped.set(key, {
      key,
      product: record.product,
      sku: record.sku,
      unitsSold: record.unitsSold ?? 0,
      revenue: record.revenue ?? 0,
      orderCount: 1,
    })
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)
    .slice(0, 20)
    .map(({ key: _key, ...item }) => item)
}

export function formatPlainNumber(val: number): string {
  return new Intl.NumberFormat().format(val)
}

function parseNullableNumber(val: unknown): number | null {
  const parsed = parseBusinessNumber(val)
  return parsed === null ? null : parsed
}

function maxNullable(a: number | null, b: number | null): number | null {
  if (a === null) return b
  if (b === null) return a
  return Math.max(a, b)
}
