import { and, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { datasets } from "@/lib/db/schema";
import {
  retailConnections,
  retailInventoryLevels,
  retailLocations,
  retailOrderItems,
  retailOrders,
  retailProducts,
  retailSyncRuns,
  retailVariants,
} from "@/lib/db/schema";
import {
  buildSquareRetailSnapshot,
  type RetailAnalyticsSnapshot,
  type SquareCatalogVariantInput,
  type SquareInventoryInput,
  type SquareOrderInput,
  type SquareOrderItemAggregateInput,
} from "@/lib/retail/retail-snapshot";
import type { RetailConnectionRecord } from "@/integrations/retail/core/normalized-types";

/**
 * Loads the already-synchronized Square records for a connection and maps
 * them into the normalized Retail analytics snapshot. The dashboard never
 * calls Square APIs directly; this reads the UseClevr database only, so
 * analytics stay fast, deterministic, and tenant-scoped. Order and line
 * aggregation happens in the database, not in the browser.
 */
export async function loadSquareRetailAnalytics(connection: RetailConnectionRecord): Promise<RetailAnalyticsSnapshot> {
  const db = getRequiredDb();

  const [connectionRow, locationRows, variantRows, inventoryRows, salesGroups, itemAggregates, latestSync] = await Promise.all([
    db
      .select({
        id: retailConnections.id,
        displayName: retailConnections.displayName,
        externalMerchantId: retailConnections.externalMerchantId,
        providerEnvironment: retailConnections.providerEnvironment,
        connectionStatus: retailConnections.connectionStatus,
        lastSuccessfulSyncAt: retailConnections.lastSuccessfulSyncAt,
        lastSyncAttemptAt: retailConnections.lastSyncAttemptAt,
        connectionError: retailConnections.connectionError,
      })
      .from(retailConnections)
      .where(eq(retailConnections.id, connection.id))
      .limit(1),

    db
      .select({
        id: retailLocations.id,
        name: retailLocations.name,
        status: retailLocations.status,
        currency: retailLocations.currency,
      })
      .from(retailLocations)
      .where(eq(retailLocations.connectionId, connection.id)),

    db
      .select({
        variantId: retailVariants.id,
        sku: retailVariants.sku,
        variantName: retailVariants.variantName,
        unitCost: retailVariants.unitCost,
        retailPrice: retailVariants.retailPrice,
        currency: retailVariants.currency,
        productId: retailProducts.id,
        productName: retailProducts.name,
        productCategory: retailProducts.category,
        productStatus: retailProducts.status,
      })
      .from(retailVariants)
      .leftJoin(retailProducts, eq(retailProducts.id, retailVariants.productId))
      .where(eq(retailVariants.connectionId, connection.id)),

    db
      .select({
        variantId: retailInventoryLevels.variantId,
        locationId: retailInventoryLevels.locationId,
        quantityOnHand: retailInventoryLevels.quantityOnHand,
        quantityAvailable: retailInventoryLevels.quantityAvailable,
        reorderPoint: retailInventoryLevels.reorderPoint,
        providerUpdatedAt: retailInventoryLevels.providerUpdatedAt,
      })
      .from(retailInventoryLevels)
      .where(eq(retailInventoryLevels.connectionId, connection.id)),

    // One aggregate row per status/currency/month keeps order volume out of
    // application memory while preserving exact sales math.
    db
      .select({
        status: retailOrders.status,
        currency: retailOrders.currency,
        period: sql<string>`to_char(date_trunc('month', coalesce(${retailOrders.orderedAt}, ${retailOrders.createdAt})), 'YYYY-MM')`,
        orderCount: sql<number>`count(*)::int`,
        totalAmount: sql<number>`coalesce(sum(${retailOrders.totalAmount}), 0)::float8`,
        discountAmount: sql<number>`coalesce(sum(${retailOrders.discountAmount}), 0)::float8`,
        refundAmount: sql<number>`coalesce(sum(${retailOrders.refundAmount}), 0)::float8`,
      })
      .from(retailOrders)
      .where(eq(retailOrders.connectionId, connection.id))
      .groupBy(
        retailOrders.status,
        retailOrders.currency,
        sql`date_trunc('month', coalesce(${retailOrders.orderedAt}, ${retailOrders.createdAt}))`,
      ),

    db
      .select({
        variantId: retailOrderItems.variantId,
        sku: retailOrderItems.sku,
        itemName: retailOrderItems.itemName,
        units: sql<number>`coalesce(sum(${retailOrderItems.quantity}), 0)::float8`,
        revenue: sql<number>`coalesce(sum(${retailOrderItems.netAmount}), 0)::float8`,
        orderCount: sql<number>`count(distinct ${retailOrderItems.orderId})::int`,
        lastSaleAt: sql<string | null>`max(coalesce(${retailOrders.orderedAt}, ${retailOrders.createdAt}))`,
      })
      .from(retailOrderItems)
      .leftJoin(retailOrders, eq(retailOrders.id, retailOrderItems.orderId))
      .where(eq(retailOrderItems.connectionId, connection.id))
      .groupBy(retailOrderItems.variantId, retailOrderItems.sku, retailOrderItems.itemName),

    db
      .select({
        status: retailSyncRuns.status,
        syncType: retailSyncRuns.syncType,
        errorMessage: retailSyncRuns.errorMessage,
        createdAt: retailSyncRuns.createdAt,
      })
      .from(retailSyncRuns)
      .where(eq(retailSyncRuns.connectionId, connection.id))
      .orderBy(desc(retailSyncRuns.createdAt))
      .limit(1),
  ]);

  const variants: SquareCatalogVariantInput[] = variantRows.map((row) => ({
    productId: row.productId,
    productName: row.productName || row.variantName || "Unknown product",
    productCategory: row.productCategory,
    productStatus: row.productStatus,
    variantId: row.variantId,
    sku: row.sku,
    variantName: row.variantName,
    unitCost: toNullableNumber(row.unitCost),
    retailPrice: toNullableNumber(row.retailPrice),
    currency: row.currency,
  }));

  const inventory: SquareInventoryInput[] = inventoryRows.map((row) => ({
    variantId: row.variantId,
    locationId: row.locationId,
    quantityOnHand: toNullableNumber(row.quantityOnHand),
    quantityAvailable: toNullableNumber(row.quantityAvailable),
    reorderPoint: toNullableNumber(row.reorderPoint),
    providerUpdatedAt: row.providerUpdatedAt,
  }));

  const orders: SquareOrderInput[] = salesGroups
    .map((row) => ({
      id: `${row.status || "ANY"}:${row.currency || "ANY"}:${row.period}`,
      status: row.status,
      currency: row.currency,
      totalAmount: row.totalAmount,
      discountAmount: row.discountAmount,
      refundAmount: row.refundAmount,
      orderedAt: row.period ? `${row.period}-01` : null,
      orderCount: row.orderCount,
    }))
    .sort((a, b) => String(a.orderedAt).localeCompare(String(b.orderedAt)));

  const orderItems: SquareOrderItemAggregateInput[] = itemAggregates.map((row) => ({
    variantId: row.variantId,
    sku: row.sku,
    itemName: row.itemName,
    units: row.units,
    revenue: row.revenue,
    orderCount: row.orderCount,
    lastSaleAt: row.lastSaleAt,
  }));

  const latestRun = latestSync[0] ?? null;
  const connectionDetail = connectionRow[0] ?? null;

  return buildSquareRetailSnapshot({
    connectionId: connection.id,
    label: connectionDetail?.displayName || connection.displayName || "Square",
    merchantId: connectionDetail?.externalMerchantId ?? connection.externalMerchantId,
    environment: connectionDetail?.providerEnvironment ?? connection.providerEnvironment,
    connectionStatus: connectionDetail?.connectionStatus ?? connection.connectionStatus,
    syncStatus: latestRun?.status ?? null,
    lastSuccessfulSyncAt: connectionDetail?.lastSuccessfulSyncAt ?? null,
    lastSyncAttemptAt: connectionDetail?.lastSyncAttemptAt ?? null,
    syncError: connectionDetail?.connectionError
      || (latestRun?.status === "failed"
        ? latestRun.errorMessage || "The last synchronization failed."
        : null),
    locations: locationRows,
    variants,
    inventory,
    orders,
    orderItems,
  });
}

export type RetailSourceOptionDataset = {
  type: "dataset";
  id: string;
  label: string;
  fileName: string | null;
  rowCount: number;
  columnCount: number;
  createdAt: string | null;
};

export type RetailSourceOptionConnection = {
  type: "square";
  id: string;
  label: string;
  merchantId: string | null;
  connectionStatus: string;
  lastSuccessfulSyncAt: string | null;
  counts: { locations: number; products: number; variants: number; orders: number };
};

export async function listRetailAnalyticsSources(userId: string): Promise<{
  datasets: RetailSourceOptionDataset[];
  connections: RetailSourceOptionConnection[];
}> {
  const db = getRequiredDb();

  const [datasetRows, squareConnections] = await Promise.all([
    db.query.datasets.findMany({
      where: and(eq(datasets.userId, userId), eq(datasets.datasetType, "retail")),
      columns: {
        id: true,
        name: true,
        fileName: true,
        rowCount: true,
        columnCount: true,
        createdAt: true,
      },
      orderBy: (rows, { desc: orderByDesc }) => [orderByDesc(rows.createdAt)],
    }),

    db
      .select({
        id: retailConnections.id,
        displayName: retailConnections.displayName,
        connectionStatus: retailConnections.connectionStatus,
        externalMerchantId: retailConnections.externalMerchantId,
        lastSuccessfulSyncAt: retailConnections.lastSuccessfulSyncAt,
        locations: sql<number>`(select count(*)::int from "RetailLocation" where "RetailLocation"."connectionId" = "RetailConnection"."id")`,
        products: sql<number>`(select count(*)::int from "RetailProduct" where "RetailProduct"."connectionId" = "RetailConnection"."id")`,
        variants: sql<number>`(select count(*)::int from "RetailVariant" where "RetailVariant"."connectionId" = "RetailConnection"."id")`,
        orders: sql<number>`(select count(*)::int from "RetailOrder" where "RetailOrder"."connectionId" = "RetailConnection"."id")`,
      })
      .from(retailConnections)
      .where(
        and(
          eq(retailConnections.provider, "square"),
          sql`${retailConnections.connectionStatus} <> 'disconnected'`,
          sql`${retailConnections.organizationId} in (select "Business"."id" from "Business" where "Business"."userId" = ${userId})`,
        ),
      )
      .orderBy(desc(retailConnections.updatedAt)),
  ]);

  return {
    datasets: datasetRows.map((row) => ({
      type: "dataset" as const,
      id: row.id,
      label: row.name,
      fileName: row.fileName,
      rowCount: row.rowCount,
      columnCount: row.columnCount,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    })),
    connections: squareConnections.map((row) => ({
      type: "square" as const,
      id: row.id,
      label: row.displayName || "Square",
      merchantId: row.externalMerchantId,
      connectionStatus: row.connectionStatus,
      lastSuccessfulSyncAt: row.lastSuccessfulSyncAt ? new Date(row.lastSuccessfulSyncAt).toISOString() : null,
      counts: {
        locations: row.locations,
        products: row.products,
        variants: row.variants,
        orders: row.orders,
      },
    })),
  };
}

function toNullableNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRequiredDb() {
  const db = getDb();
  if (!db) throw new Error("Database connection is unavailable.");
  return db;
}
