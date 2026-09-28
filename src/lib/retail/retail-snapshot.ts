import {
  RETAIL_DEFAULT_REORDER_POINT,
  aggregateRetailInventoryRecords,
  buildRetailRecords,
  computeDeadStock,
  computeLowStock,
  computeTopProfit,
  computeTopSellers,
  detectColumns,
  formatDateValue,
  getReferenceDate,
  retailProductIdentityKey,
  type RetailDeadStockItem,
  type RetailLowStockItem,
  type RetailRecord,
  type RetailTopProfitItem,
  type RetailTopSellerItem,
} from "@/lib/retail/retail-record-engine";

/**
 * Normalized Retail Analytics model.
 *
 * The dashboard consumes this shape regardless of whether the underlying
 * data came from an uploaded CSV/Excel dataset or a connected POS source
 * (Square today; Shopify/Clover/Lightspeed later). Values that a source
 * does not provide stay `null` so missing data is never turned into a fake
 * zero with a different business meaning.
 */

export const RETAIL_SOURCE_TYPES = ["dataset", "square", "shopify", "clover", "lightspeed"] as const;

export type RetailSourceType = (typeof RETAIL_SOURCE_TYPES)[number];

export type RetailSourceRef =
  | { type: "dataset"; datasetId: string }
  | { type: "square"; connectionId: string }
  | { type: "shopify"; connectionId: string }
  | { type: "clover"; connectionId: string }
  | { type: "lightspeed"; connectionId: string };

export function parseRetailSourceRef(param: string | null | undefined): RetailSourceRef | null {
  if (!param) return null;
  const [type, ...rest] = param.split(":");
  const id = rest.join(":").trim();
  if (!type || !id) return null;
  const normalizedType = type.trim().toLowerCase() as RetailSourceType;
  if (!RETAIL_SOURCE_TYPES.includes(normalizedType)) return null;
  if (normalizedType === "dataset") return { type: "dataset", datasetId: id };
  return { type: normalizedType, connectionId: id };
}

export function formatRetailSourceParam(ref: RetailSourceRef): string {
  return ref.type === "dataset" ? `dataset:${ref.datasetId}` : `${ref.type}:${ref.connectionId}`;
}

export type RetailListStatus =
  | "ok"
  | "insufficient_data"
  | "no_cost_data"
  | "no_reorder_thresholds"
  | "no_inventory"
  | "empty";

export type RetailSnapshotSourceDataset = {
  type: "dataset";
  id: string;
  label: string;
  fileName: string | null;
  rowCount: number;
  columnCount: number;
  createdAt: string | null;
};

export type RetailSnapshotSourcePos = {
  type: Exclude<RetailSourceType, "dataset">;
  id: string;
  label: string;
  merchantId: string | null;
  environment: string | null;
  connectionStatus: string;
  syncStatus: string | null;
  lastSuccessfulSyncAt: string | null;
  lastSyncAttemptAt: string | null;
  syncError: string | null;
  counts: {
    locations: number;
    products: number;
    variants: number;
    orders: number;
  };
};

export type RetailSnapshotKpis = {
  /** Distinct canonical products, independent of location. */
  productCount: number | null;
  /** Canonical product + location inventory entities. */
  inventoryItemCount: number | null;
  variantCount: number | null;
  locationCount: number | null;
  orderCount: number | null;
  customerCount: number | null;
  totalOnHand: number | null;
  inventoryValue: number | null;
  netSales: number | null;
  unitsSold: number | null;
  averageOrderValue: number | null;
  lastSaleAt: string | null;
};

export type RetailSalesSection = {
  hasSalesData: boolean;
  message: string | null;
  trend: Array<{ period: string; revenue: number }>;
};

export type RetailLowStockSection = {
  status: RetailListStatus;
  message: string;
  hasReorderThresholds: boolean;
  items: RetailLowStockItem[];
};

export type RetailDeadStockSection = {
  status: RetailListStatus;
  message: string;
  items: RetailDeadStockItem[];
};

export type RetailTopSellersSection = {
  status: RetailListStatus;
  message: string;
  items: RetailTopSellerItem[];
};

export type RetailTopProfitSection = {
  status: RetailListStatus;
  message: string;
  items: RetailTopProfitItem[];
};

export type RetailAnalyticsSnapshot = {
  source: RetailSnapshotSourceDataset | RetailSnapshotSourcePos;
  currency: string | null;
  kpis: RetailSnapshotKpis;
  sales: RetailSalesSection;
  lowStock: RetailLowStockSection;
  deadStock: RetailDeadStockSection;
  topSellers: RetailTopSellersSection;
  topProfit: RetailTopProfitSection;
  summary: {
    insight: string;
    explanation: string;
    recommendation: string;
    deterministic: boolean;
  };
  dataQualityWarnings: string[];
};

// ---------------------------------------------------------------------------
// Dataset source builder (uploaded CSV/Excel datasets)
// ---------------------------------------------------------------------------

export function buildDatasetRetailSnapshot(input: {
  datasetId: string;
  name: string;
  fileName: string | null;
  rowCount: number;
  columnCount: number;
  createdAt: Date | string | null;
  columns: string[];
  rows: Record<string, unknown>[];
}): RetailAnalyticsSnapshot {
  const detected = detectColumns(input.columns);
  const records = buildRetailRecords(input.rows, detected);
  const inventoryRecords = aggregateRetailInventoryRecords(records);
  const lowStockItems = computeLowStock(inventoryRecords);
  const deadStockItems = computeDeadStock(inventoryRecords);
  const topProfitItems = computeTopProfit(inventoryRecords);
  const topSellerItems = computeTopSellers(records);
  const referenceDate = getReferenceDate(inventoryRecords);
  const hasCostBasis = detected.costCol !== null;
  const hasStockBasis = detected.stockCol !== null;
  const hasMovementEvidence = Boolean(detected.salesCol || detected.dateCol);
  const warnings: string[] = [];
  if (!hasCostBasis) {
    warnings.push("No unit cost or COGS column was detected, so profit and margin cannot be calculated.");
  }
  const ambiguousCategoryEntities = inventoryRecords.filter((record) => record.categoryAmbiguous).length;
  if (ambiguousCategoryEntities > 0) {
    warnings.push(
      `${ambiguousCategoryEntities} product/location item${ambiguousCategoryEntities === 1 ? " has" : "s have"} conflicting category values across rows; the latest snapshot's category is shown.`,
    );
  }

  // Orders and customers are distinct identifiers, never transaction rows.
  const distinctOrders = detected.orderCol ? countDistinctColumnValues(input.rows, detected.orderCol) : null;
  const distinctCustomers = detected.customerCol ? countDistinctColumnValues(input.rows, detected.customerCol) : null;
  const distinctProducts = new Set(inventoryRecords.map(retailProductIdentityKey)).size;
  const netSales = detected.revenueCol ? round2(records.reduce((sum, record) => sum + (record.revenue ?? 0), 0)) : null;

  return {
    source: {
      type: "dataset",
      id: input.datasetId,
      label: input.name,
      fileName: input.fileName,
      rowCount: input.rowCount,
      columnCount: input.columnCount,
      createdAt: input.createdAt ? new Date(input.createdAt).toISOString() : null,
    },
    currency: null,
    kpis: {
      productCount: distinctProducts || null,
      inventoryItemCount: inventoryRecords.length || null,
      variantCount: null,
      locationCount: new Set(inventoryRecords.map((record) => record.store).filter(Boolean)).size || null,
      orderCount: distinctOrders,
      customerCount: distinctCustomers,
      totalOnHand: detected.stockCol ? round2(inventoryRecords.reduce((sum, record) => sum + Math.max(record.stock ?? 0, 0), 0)) : null,
      inventoryValue: detected.stockCol && detected.costCol
        ? round2(inventoryRecords.reduce((sum, record) => sum + (record.stockValue ?? 0), 0))
        : null,
      netSales,
      unitsSold: detected.salesCol ? round2(records.reduce((sum, record) => sum + (record.unitsSold ?? 0), 0)) : null,
      averageOrderValue: distinctOrders && netSales !== null ? round2(netSales / distinctOrders) : null,
      lastSaleAt: referenceDate ? referenceDate.toISOString() : null,
    },
    sales: {
      hasSalesData: Boolean(detected.revenueCol || detected.salesCol),
      message: null,
      trend: [],
    },
    lowStock: buildDatasetLowStockSection(detected, lowStockItems),
    deadStock: buildDatasetDeadStockSection(detected, deadStockItems),
    topSellers: {
      status: topSellerItems.length ? "ok" : "insufficient_data",
      message: topSellerItems.length
        ? "Ranked by detected sales movement in the dataset."
        : "No products with detected sales movement were found.",
      items: topSellerItems,
    },
    topProfit: {
      // Uploaded datasets keep their historical engine semantics: a missing
      // cost column computes profit as revenue; connected POS sources with
      // no cost basis report "no_cost_data" instead of fabricating values.
      // The message states that caveat whenever the cost basis is missing.
      status: topProfitItems.length ? "ok" : "empty",
      message: topProfitItems.length
        ? (hasCostBasis
          ? "Protect these winners: keep inventory available, avoid unnecessary markdowns, and watch supplier cost."
          : "No cost column was detected, so items are ranked with missing cost treated as zero (profit equals revenue). Add cost data for true profit ranking.")
        : "Add cost and revenue columns to see profit rankings.",
      items: topProfitItems,
    },
    summary: buildDatasetSummary({
      rowCount: input.rowCount,
      inventoryEntityCount: inventoryRecords.length,
      productCount: distinctProducts,
      columnCount: input.columnCount,
      hasReorderColumn: detected.reorderPointCol !== null,
      lowStockItems,
      deadStockItems,
      topProfitItems,
    }),
    dataQualityWarnings: warnings,
  };
}

/**
 * Low-stock/reorder rule: current stock <= the item's own reorder point.
 * Only when no reorder-point column exists does the default threshold
 * (10 units) apply, and the wording says so.
 */
function buildDatasetLowStockSection(
  detected: ReturnType<typeof detectColumns>,
  lowStockItems: RetailLowStockItem[],
): RetailLowStockSection {
  if (!detected.stockCol) {
    return {
      status: "no_inventory",
      message: "No stock column was detected, so stock levels are unknown and low-stock alerts cannot be raised.",
      hasReorderThresholds: detected.reorderPointCol !== null,
      items: [],
    };
  }
  const boundary = detected.reorderPointCol
    ? "their reorder point"
    : `the default threshold of ${RETAIL_DEFAULT_REORDER_POINT} units (no reorder-point column was detected)`;
  return {
    status: "ok",
    message: lowStockItems.length
      ? `Stock is at or below ${boundary}. Reorder these items first so recent sellers do not run out before the next buying cycle.`
      : `No products are at or below ${boundary}.`,
    hasReorderThresholds: detected.reorderPointCol !== null,
    items: lowStockItems,
  };
}

/**
 * Dead stock / slow mover rule: dead stock is stock on hand with no recorded
 * movement (zero units sold, or no sale for 60+ days). A slow mover has sold
 * before but has no sale for 30+ days. Without stock or movement columns the
 * section reports insufficient data instead of a false "no dead stock".
 */
function buildDatasetDeadStockSection(
  detected: ReturnType<typeof detectColumns>,
  deadStockItems: RetailDeadStockItem[],
): RetailDeadStockSection {
  if (!detected.stockCol) {
    return {
      status: "insufficient_data",
      message: "No stock column was detected, so dead stock and slow movers cannot be determined.",
      items: [],
    };
  }
  if (!detected.salesCol && !detected.dateCol) {
    return {
      status: "insufficient_data",
      message: "No sales or date columns were detected, so movement cannot be evaluated for dead stock.",
      items: [],
    };
  }
  const deadCount = deadStockItems.filter((item) => item.classification === "dead_stock").length;
  const slowCount = deadStockItems.length - deadCount;
  return {
    status: deadStockItems.length ? "ok" : "empty",
    message: deadStockItems.length
      ? `${deadCount} dead-stock and ${slowCount} slow-mover item${deadStockItems.length === 1 ? "" : "s"} detected. Free cash from items that sit on the shelf before reordering more of the same stock.`
      : "No dead stock or slow movers detected from stock and movement fields.",
    items: deadStockItems,
  };
}

function buildDatasetSummary(input: {
  rowCount: number;
  inventoryEntityCount: number;
  productCount: number;
  columnCount: number;
  hasReorderColumn: boolean;
  lowStockItems: RetailLowStockItem[];
  deadStockItems: RetailDeadStockItem[];
  topProfitItems: RetailTopProfitItem[];
}): RetailAnalyticsSnapshot["summary"] {
  const total = new Intl.NumberFormat().format(input.inventoryEntityCount);
  const products = new Intl.NumberFormat().format(input.productCount);
  const rows = new Intl.NumberFormat().format(input.rowCount);
  const low = input.lowStockItems.length;
  const deadCount = input.deadStockItems.filter((item) => item.classification === "dead_stock").length;
  const slowCount = input.deadStockItems.length - deadCount;
  const top = input.topProfitItems[0];
  const profit = top ? `${top.product}${top.store ? ` (${top.store})` : ""}` : "N/A";
  const maxProfit = top
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(top.profit ?? 0)
    : "N/A";
  const lowBoundary = input.hasReorderColumn ? "at or below their reorder point" : `at or below the default ${RETAIL_DEFAULT_REORDER_POINT}-unit threshold`;

  return {
    insight: `Analysis of ${total} product/location items complete`,
    explanation:
      `Found ${total} product/location inventory items for ${products} products from ${rows} transaction rows across ${input.columnCount} columns. ` +
      `${low} item${low === 1 ? " is" : "s are"} ${lowBoundary}. ` +
      `${deadCount} dead-stock and ${slowCount} slow-mover item${deadCount + slowCount === 1 ? "" : "s"} detected from recorded movement. ` +
      `Top profit product/location: ${profit} (${maxProfit}).`,
    recommendation:
      low > 0
        ? `Restock ${low} low-inventory product/location items to prevent stockouts. Focus on reordering top-selling items first.`
        : "Review pricing strategy and consider promotions for slow-moving items.",
    deterministic: true,
  };
}

/** Distinct non-empty text values in a column; identifiers are never summed. */
function countDistinctColumnValues(rows: Record<string, unknown>[], column: string): number | null {
  const values = new Set<string>();
  for (const row of rows) {
    const raw = row[column];
    if (raw === null || raw === undefined) continue;
    const text = String(raw).trim();
    if (!text || text === "Not provided") continue;
    values.add(text);
  }
  return values.size || null;
}

// ---------------------------------------------------------------------------
// Square (POS) source builder
// ---------------------------------------------------------------------------

export type SquareCatalogVariantInput = {
  productId: string | null;
  productName: string;
  productCategory: string | null;
  productStatus: string | null;
  variantId: string;
  sku: string | null;
  variantName: string | null;
  unitCost: number | null;
  retailPrice: number | null;
  currency: string | null;
};

export type SquareLocationInput = {
  id: string;
  name: string;
  status: string | null;
  currency: string | null;
};

export type SquareInventoryInput = {
  variantId: string | null;
  locationId: string | null;
  quantityOnHand: number | null;
  quantityAvailable: number | null;
  reorderPoint: number | null;
  providerUpdatedAt: Date | string | null;
};

export type SquareOrderInput = {
  id: string;
  status: string | null;
  currency: string | null;
  totalAmount: number | null;
  discountAmount: number | null;
  refundAmount: number | null;
  orderedAt: Date | string | null;
  /** Aggregated group row count; individual fixture orders pass 1. */
  orderCount?: number;
};

export type SquareOrderItemAggregateInput = {
  variantId: string | null;
  sku: string | null;
  itemName: string;
  units: number | null;
  revenue: number | null;
  orderCount: number | null;
  lastSaleAt: Date | string | null;
};

export type SquareSnapshotInput = {
  connectionId: string;
  label: string;
  merchantId: string | null;
  environment: string | null;
  connectionStatus: string;
  syncStatus: string | null;
  lastSuccessfulSyncAt: Date | string | null;
  lastSyncAttemptAt: Date | string | null;
  syncError: string | null;
  locations: SquareLocationInput[];
  variants: SquareCatalogVariantInput[];
  inventory: SquareInventoryInput[];
  orders: SquareOrderInput[];
  orderItems: SquareOrderItemAggregateInput[];
};

const includedOrderStatuses = new Set(["COMPLETED", "OPEN", "FULFILLED"]);

export function buildSquareRetailSnapshot(input: SquareSnapshotInput): RetailAnalyticsSnapshot {
  const source: RetailSnapshotSourcePos = {
    type: "square",
    id: input.connectionId,
    label: input.label || "Square",
    merchantId: input.merchantId,
    environment: input.environment,
    connectionStatus: input.connectionStatus,
    syncStatus: input.syncStatus,
    lastSuccessfulSyncAt: toIso(input.lastSuccessfulSyncAt),
    lastSyncAttemptAt: toIso(input.lastSyncAttemptAt),
    syncError: input.syncError,
    counts: {
      locations: input.locations.length,
      products: new Set(input.variants.map((variant) => variant.productId || variant.productName)).size,
      variants: input.variants.length,
      orders: input.orders.length,
    },
  };

  const currency = firstCurrency(input);
  const hasSales = input.orders.length > 0;
  const hasCostData = input.variants.some((variant) => variant.unitCost !== null);
  const warnings: string[] = [];

  // Inventory: aggregate per-variant stock across synchronized locations.
  const onHandByVariant = new Map<string, number | null>();
  for (const level of input.inventory) {
    if (!level.variantId) continue;
    const quantity = level.quantityOnHand ?? level.quantityAvailable;
    const current = onHandByVariant.get(level.variantId);
    onHandByVariant.set(level.variantId, quantity === null ? (current ?? null) : (current ?? 0) + quantity);
  }
  const hasInventoryData = input.inventory.length > 0;
  const hasReorderThresholds = input.inventory.some((level) => level.reorderPoint !== null);
  if (hasInventoryData && !hasReorderThresholds) {
    warnings.push("Square does not provide reorder thresholds, so low-stock alerts need a threshold from another source.");
  }
  const totalOnHand = hasInventoryData
    ? round2([...onHandByVariant.values()].reduce<number>((sum, value) => sum + (value ?? 0), 0))
    : null;

  // Sales: only completed-family orders count as sales history. Orders arrive
  // as database aggregates (one row per status/currency/month group).
  const salesOrders = input.orders.filter((order) => !order.status || includedOrderStatuses.has(order.status));
  const salesOrderCount = salesOrders.reduce((sum, order) => sum + (order.orderCount ?? 1), 0);
  // Aggregate rows already carry the group's summed amounts.
  const netSales = salesOrders.reduce(
    (sum, order) => sum + ((order.totalAmount ?? 0) - (order.discountAmount ?? 0) - (order.refundAmount ?? 0)),
    0,
  );
  const orderedAtByOrder = new Map<string, Date>();
  for (const order of input.orders) {
    const at = toDate(order.orderedAt);
    if (at) orderedAtByOrder.set(order.id, at);
  }
  const lastSaleAt = salesOrders.reduce<Date | null>((latest, order) => {
    const at = orderedAtByOrder.get(order.id) ?? null;
    if (!at) return latest;
    return !latest || at > latest ? at : latest;
  }, null);

  // Trend: net revenue per month over synchronized order history.
  const trendByPeriod = new Map<string, number>();
  for (const order of salesOrders) {
    const at = orderedAtByOrder.get(order.id);
    if (!at) continue;
    const period = `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}`;
    const net = (order.totalAmount ?? 0) - (order.discountAmount ?? 0) - (order.refundAmount ?? 0);
    trendByPeriod.set(period, (trendByPeriod.get(period) ?? 0) + net);
  }
  const trend = [...trendByPeriod.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, revenue]) => ({ period, revenue: round2(revenue) }));

  // Aggregated sales per variant feed the shared retail engine. Unknown
  // Square values stay null; a genuine zero (no synchronized sales for a
  // product) stays zero.
  const soldByVariant = new Map<string, { units: number; revenue: number; lastSaleAt: Date | null }>();
  for (const item of input.orderItems) {
    const key = item.variantId || `name:${item.itemName.toLowerCase()}`;
    const current = soldByVariant.get(key) ?? { units: 0, revenue: 0, lastSaleAt: null };
    current.units += item.units ?? 0;
    current.revenue += item.revenue ?? 0;
    const at = toDate(item.lastSaleAt);
    if (at && (!current.lastSaleAt || at > current.lastSaleAt)) current.lastSaleAt = at;
    soldByVariant.set(key, current);
  }

  // Normalized records for the shared retail engine. Square-native
  // variant IDs are preserved as the canonical product identity so
  // variants that share a display name or SKU stay separate. Unknown
  // Square values stay null; a genuine zero (no units of a sold product)
  // stays zero.
  const records: RetailRecord[] = input.variants.map((variant) => {
    const sold = soldByVariant.get(variant.variantId) ?? null;
    const onHand = onHandByVariant.get(variant.variantId) ?? null;
    const unitCost = variant.unitCost;
    return {
      productId: variant.variantId,
      product: variant.productName || "Unknown product",
      sku: variant.sku || "Not provided",
      category: variant.productCategory || "Not provided",
      store: null,
      stock: onHand,
      reorderPoint: null,
      unitsSold: hasSales ? sold?.units ?? 0 : null,
      revenue: hasSales ? round2(sold?.revenue ?? 0) : null,
      cost: unitCost === null || !hasSales ? null : round2(unitCost * (sold?.units ?? 0)),
      grossProfit: unitCost === null || !hasSales ? null : round2((sold?.revenue ?? 0) - unitCost * (sold?.units ?? 0)),
      margin: null,
      lastSaleDate: formatDateValue(sold?.lastSaleAt ?? null),
      lastSaleAt: sold?.lastSaleAt ?? null,
      orderId: "Not provided",
      stockValue: onHand !== null && unitCost !== null ? round2(Math.max(onHand, 0) * unitCost) : null,
    };
  });

  // One canonical pass so every finding uses the same entity grain.
  const inventoryRecords = aggregateRetailInventoryRecords(records);
  const lowStockKnown = computeLowStock(inventoryRecords);
  const deadStockItems = hasSales ? computeDeadStock(inventoryRecords) : [];
  const topProfitItems = hasSales && hasCostData ? computeTopProfit(inventoryRecords) : [];

  const topSellerItems: RetailTopSellerItem[] = input.orderItems
    .map((item) => ({
      product: item.itemName,
      sku: item.sku || "Not provided",
      unitsSold: item.units ?? 0,
      revenue: round2(item.revenue ?? 0),
      orderCount: item.orderCount ?? 0,
    }))
    .filter((item) => item.unitsSold > 0 || item.revenue > 0)
    .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)
    .slice(0, 20);

  const lowStock: RetailLowStockSection = !hasInventoryData
    ? {
      status: "no_inventory",
      message: "Square inventory has not been synchronized yet, so stock levels are unknown.",
      hasReorderThresholds: false,
      items: [],
    }
    : hasReorderThresholds
      ? {
        status: "ok",
        message: lowStockKnown.length
          ? "Reorder these items before the next buying cycle."
          : "No products are at or below their reorder point.",
        hasReorderThresholds: true,
        items: lowStockKnown,
      }
      : {
        status: "no_reorder_thresholds",
        message: "Square does not provide reorder thresholds, so no low-stock alerts can be raised. Current stock levels are shown for reference.",
        hasReorderThresholds: false,
        items: inventoryRecords
          .filter((record) => record.stock !== null)
          .map((record) => ({
            product: record.product,
            sku: record.sku,
            category: record.category,
            store: record.store,
            stock: record.stock,
            reorderPoint: null,
            unitsSold: record.unitsSold,
            revenue: record.revenue,
            cost: record.cost,
            grossProfit: record.grossProfit,
            margin: record.margin,
            lastSaleDate: record.lastSaleDate,
            orderId: record.orderId,
            recommendation: "Set a reorder threshold in your inventory policy to enable low-stock alerts.",
          }))
          .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
          .slice(0, 20),
      };

  const deadStock: RetailDeadStockSection = !hasSales
    ? {
      status: "insufficient_data",
      message: "Not enough sales history to identify slow-moving products.",
      items: [],
    }
    : {
      status: deadStockItems.length ? "ok" : "empty",
      message: deadStockItems.length
        ? "Products with synchronized stock but no synchronized sales movement."
        : "No dead stock detected in synchronized sales history.",
      items: deadStockItems,
    };

  const topProfit: RetailTopProfitSection = !hasSales
    ? {
      status: "insufficient_data",
      message: "No sales data available yet.",
      items: [],
    }
    : !hasCostData
      ? {
        status: "no_cost_data",
        message: "Square does not provide a synchronized cost basis, so profit and margin are not available.",
        items: [],
      }
      : {
        status: topProfitItems.length ? "ok" : "empty",
        message: topProfitItems.length
          ? "Protect these winners: keep inventory available, avoid unnecessary markdowns, and watch supplier cost."
          : "No profitable products were detected in synchronized sales.",
        items: topProfitItems,
      };

  const topSellers: RetailTopSellersSection = !hasSales
    ? {
      status: "insufficient_data",
      message: "Not enough synchronized sales history to rank top sellers.",
      items: [],
    }
    : {
      status: topSellerItems.length ? "ok" : "empty",
      message: topSellerItems.length
        ? "Ranked by units sold in synchronized order history."
        : "No synchronized sales movement was found.",
      items: topSellerItems,
    };

  return {
    source,
    currency: currency || null,
    kpis: {
      productCount: source.counts.products || null,
      inventoryItemCount: inventoryRecords.length || null,
      variantCount: source.counts.variants || null,
      locationCount: source.counts.locations || null,
      orderCount: salesOrderCount || null,
      customerCount: null,
      totalOnHand,
      inventoryValue: round2(inventoryRecords.reduce<number>((sum, record) => sum + (record.stockValue ?? 0), 0)) || null,
      netSales: hasSales ? round2(netSales) : null,
      unitsSold: hasSales ? round2(inventoryRecords.reduce((sum, record) => sum + (record.unitsSold ?? 0), 0)) : null,
      averageOrderValue: salesOrderCount ? round2(netSales / salesOrderCount) : null,
      lastSaleAt: lastSaleAt ? lastSaleAt.toISOString() : null,
    },
    sales: {
      hasSalesData: hasSales,
      message: hasSales ? null : "No synchronized sales history is available yet.",
      trend,
    },
    lowStock,
    deadStock,
    topSellers,
    topProfit,
    summary: buildSquareSummary({
      source,
      hasInventoryData,
      totalOnHand,
      hasSales,
      salesOrders: salesOrderCount,
      hasCostData,
      lastSaleAt,
    }),
    dataQualityWarnings: warnings,
  };
}

function buildSquareSummary(input: {
  source: RetailSnapshotSourcePos;
  hasInventoryData: boolean;
  totalOnHand: number | null;
  hasSales: boolean;
  salesOrders: number;
  hasCostData: boolean;
  lastSaleAt: Date | null;
}): RetailAnalyticsSnapshot["summary"] {
  const counts = input.source.counts;
  const catalogSentence = `${counts.products} product${counts.products === 1 ? "" : "s"} and ${counts.variants} variant${counts.variants === 1 ? "" : "s"} synchronized across ${counts.locations} location${counts.locations === 1 ? "" : "s"}.`;
  const inventorySentence = input.hasInventoryData && input.totalOnHand !== null
    ? ` Current tracked stock on hand is ${new Intl.NumberFormat().format(input.totalOnHand)} units.`
    : "";

  if (!input.hasSales) {
    return {
      insight: `Square is connected. ${catalogSentence}`,
      explanation: `Catalog data is synchronized, but no sales history is available yet. Revenue, trends, top sellers, dead stock, and profit analysis need synchronized sales history before UseClevr can report them. UseClevr does not infer sales performance from catalog presence.`,
      recommendation: counts.products
        ? "Review synchronized products and stock levels, then run Sync now after sales start recording in Square."
        : "Run Sync now to import your Square catalog.",
      deterministic: true,
    };
  }

  return {
    insight: `Square is connected. ${catalogSentence}`,
    explanation: `Synchronized sales history covers ${input.salesOrders} order${input.salesOrders === 1 ? "" : "s"}${input.lastSaleAt ? `, most recent ${formatDateValue(input.lastSaleAt)}` : ""}.${inventorySentence}${input.hasCostData ? "" : " Square does not provide a synchronized cost basis, so profit metrics are unavailable."}`,
    recommendation: input.hasCostData
      ? "Review low-stock risks and profit rankings below, then run Sync now to pull the latest Square activity."
      : "Review stock levels and sales rankings; profit metrics need a cost basis that Square does not synchronize.",
    deterministic: true,
  };
}

function firstCurrency(input: SquareSnapshotInput): string | null {
  return (
    input.locations.find((location) => location.currency)?.currency ||
    input.orders.find((order) => order.currency)?.currency ||
    input.variants.find((variant) => variant.currency)?.currency ||
    null
  );
}

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function toDate(value: Date | string | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
