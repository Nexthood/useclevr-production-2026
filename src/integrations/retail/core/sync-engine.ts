import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  retailConnections,
  retailInventoryLevels,
  retailLocations,
  retailMerchants,
  retailOrderItems,
  retailOrders,
  retailProducts,
  retailSyncRuns,
  retailVariants,
} from "@/lib/db/schema";
import { getRetailConnector } from "./connector.factory";
import { createRetailId, createSyncRun, markConnectionError } from "./connection.service";
import { redactProviderError } from "./errors";
import type {
  NormalizedInventoryLevel,
  NormalizedLocation,
  NormalizedMerchant,
  NormalizedOrder,
  NormalizedProduct,
  RetailConnectionRecord,
  RetailSyncType,
} from "./normalized-types";

export async function queueRetailSync(connection: RetailConnectionRecord, syncType: RetailSyncType) {
  return createSyncRun({
    connection,
    syncType,
    status: "queued",
    metadata: { queuedReason: syncType === "initial" ? "oauth_connected" : "manual_request" },
  });
}

export async function runRetailSync(connection: RetailConnectionRecord, syncType: RetailSyncType) {
  const db = getRequiredDb();
  const connector = getRetailConnector(connection.provider);
  const syncRun = await createSyncRun({ connection, syncType, status: "running" });
  const counters = { received: 0, created: 0, updated: 0, skipped: 0, failed: 0 };

  try {
    const merchant = await connector.getMerchant(connection);
    await upsertMerchant(connection, merchant);

    const locations = await connector.getLocations(connection);
    for (const location of locations) await upsertLocation(connection, location);
    counters.received += locations.length;

    let productCursor: string | null | undefined;
    do {
      const page = await connector.getProducts(connection, productCursor || undefined);
      counters.received += page.data.length;
      for (const product of page.data) await upsertProduct(connection, product);
      productCursor = page.cursor;
    } while (productCursor);

    let inventoryCursor: string | null | undefined;
    do {
      const page = await connector.getInventory(connection, inventoryCursor || undefined);
      counters.received += page.data.length;
      for (const inventory of page.data) await upsertInventoryLevel(connection, inventory);
      inventoryCursor = page.cursor;
    } while (inventoryCursor);

    const createdAfter = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    let orderCursor: string | null | undefined;
    do {
      const page = await connector.getOrders(connection, {
        cursor: orderCursor || undefined,
        createdAfter,
      });
      counters.received += page.data.length;
      for (const order of page.data) await upsertOrder(connection, order);
      orderCursor = page.cursor;
    } while (orderCursor);

    const now = new Date();
    await db
      .update(retailSyncRuns)
      .set({
        status: "completed",
        completedAt: now,
        recordsReceived: counters.received,
        recordsCreated: counters.created,
        recordsUpdated: counters.updated,
        recordsSkipped: counters.skipped,
        recordsFailed: counters.failed,
        updatedAt: now,
      })
      .where(eq(retailSyncRuns.id, syncRun.id));
    await db
      .update(retailConnections)
      .set({
        connectionStatus: "active",
        lastSuccessfulSyncAt: now,
        connectionError: null,
        updatedAt: now,
      })
      .where(eq(retailConnections.id, connection.id));
    return { syncRunId: syncRun.id, status: "completed" as const, counters };
  } catch (error) {
    const sanitized = redactProviderError(error);
    await db
      .update(retailSyncRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        recordsReceived: counters.received,
        recordsFailed: counters.failed + 1,
        errorCode: sanitized.code,
        errorMessage: sanitized.message,
        updatedAt: new Date(),
      })
      .where(eq(retailSyncRuns.id, syncRun.id));
    await markConnectionError(connection.id, sanitized.message);
    return { syncRunId: syncRun.id, status: "failed" as const, error: sanitized };
  }
}

async function upsertMerchant(connection: RetailConnectionRecord, merchant: NormalizedMerchant) {
  const db = getRequiredDb();
  const now = new Date();
  await db
    .insert(retailMerchants)
    .values({
      id: createRetailId("merchant"),
      organizationId: connection.organizationId,
      connectionId: connection.id,
      provider: connection.provider,
      externalMerchantId: merchant.externalMerchantId,
      businessName: merchant.businessName,
      country: merchant.country,
      currency: merchant.currency,
      timezone: merchant.timezone,
      language: merchant.language,
      status: merchant.status,
      providerCreatedAt: merchant.providerCreatedAt,
      providerUpdatedAt: merchant.providerUpdatedAt,
      syncedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [retailMerchants.connectionId, retailMerchants.externalMerchantId],
      set: {
        businessName: merchant.businessName,
        country: merchant.country,
        currency: merchant.currency,
        timezone: merchant.timezone,
        language: merchant.language,
        status: merchant.status,
        providerUpdatedAt: merchant.providerUpdatedAt,
        syncedAt: now,
        updatedAt: now,
      },
    });
}

async function upsertLocation(connection: RetailConnectionRecord, location: NormalizedLocation) {
  const db = getRequiredDb();
  const now = new Date();
  const merchantId = await findMerchantId(connection.id, connection.externalMerchantId);
  await db
    .insert(retailLocations)
    .values({
      id: createRetailId("loc"),
      organizationId: connection.organizationId,
      connectionId: connection.id,
      merchantId,
      provider: connection.provider,
      externalLocationId: location.externalLocationId,
      name: location.name,
      addressLine1: location.addressLine1,
      addressLine2: location.addressLine2,
      city: location.city,
      region: location.region,
      postalCode: location.postalCode,
      country: location.country,
      currency: location.currency,
      timezone: location.timezone,
      status: location.status,
      providerCreatedAt: location.providerCreatedAt,
      providerUpdatedAt: location.providerUpdatedAt,
      syncedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [retailLocations.connectionId, retailLocations.externalLocationId],
      set: {
        merchantId,
        name: location.name,
        addressLine1: location.addressLine1,
        addressLine2: location.addressLine2,
        city: location.city,
        region: location.region,
        postalCode: location.postalCode,
        country: location.country,
        currency: location.currency,
        timezone: location.timezone,
        status: location.status,
        providerUpdatedAt: location.providerUpdatedAt,
        syncedAt: now,
        updatedAt: now,
      },
    });
}

async function upsertProduct(connection: RetailConnectionRecord, product: NormalizedProduct) {
  const db = getRequiredDb();
  const now = new Date();
  await db
    .insert(retailProducts)
    .values({
      id: createRetailId("prod"),
      organizationId: connection.organizationId,
      connectionId: connection.id,
      provider: connection.provider,
      externalProductId: product.externalProductId,
      name: product.name,
      description: product.description,
      category: product.category,
      brand: product.brand,
      status: product.status,
      imageUrl: product.imageUrl,
      providerCreatedAt: product.providerCreatedAt,
      providerUpdatedAt: product.providerUpdatedAt,
      syncedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [retailProducts.connectionId, retailProducts.externalProductId],
      set: {
        name: product.name,
        description: product.description,
        category: product.category,
        brand: product.brand,
        status: product.status,
        imageUrl: product.imageUrl,
        providerUpdatedAt: product.providerUpdatedAt,
        syncedAt: now,
        updatedAt: now,
      },
    });

  const productId = await findProductId(connection.id, product.externalProductId);
  for (const variant of product.variants) {
    await db
      .insert(retailVariants)
      .values({
        id: createRetailId("var"),
        organizationId: connection.organizationId,
        connectionId: connection.id,
        productId,
        provider: connection.provider,
        externalVariantId: variant.externalVariantId,
        sku: variant.sku,
        barcode: variant.barcode,
        variantName: variant.variantName,
        unitCost: variant.unitCost,
        retailPrice: variant.retailPrice,
        currency: variant.currency,
        compareAtPrice: variant.compareAtPrice,
        taxable: variant.taxable,
        trackInventory: variant.trackInventory,
        status: variant.status,
        providerCreatedAt: variant.providerCreatedAt,
        providerUpdatedAt: variant.providerUpdatedAt,
        syncedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [retailVariants.connectionId, retailVariants.externalVariantId],
        set: {
          productId,
          sku: variant.sku,
          barcode: variant.barcode,
          variantName: variant.variantName,
          unitCost: variant.unitCost,
          retailPrice: variant.retailPrice,
          currency: variant.currency,
          compareAtPrice: variant.compareAtPrice,
          taxable: variant.taxable,
          trackInventory: variant.trackInventory,
          status: variant.status,
          providerUpdatedAt: variant.providerUpdatedAt,
          syncedAt: now,
          updatedAt: now,
        },
      });
  }
}

async function upsertInventoryLevel(connection: RetailConnectionRecord, inventory: NormalizedInventoryLevel) {
  const db = getRequiredDb();
  const now = new Date();
  const locationId = inventory.externalLocationId
    ? await findLocationId(connection.id, inventory.externalLocationId)
    : null;
  const variantId = await findVariantId(connection.id, inventory.externalCatalogObjectId);
  await db
    .insert(retailInventoryLevels)
    .values({
      id: createRetailId("inv"),
      organizationId: connection.organizationId,
      connectionId: connection.id,
      locationId,
      variantId,
      provider: connection.provider,
      externalCatalogObjectId: inventory.externalCatalogObjectId,
      quantityOnHand: inventory.quantityOnHand,
      quantityAvailable: inventory.quantityAvailable,
      quantityCommitted: inventory.quantityCommitted,
      quantityIncoming: inventory.quantityIncoming,
      quantityReserved: inventory.quantityReserved,
      providerUpdatedAt: inventory.providerUpdatedAt,
      syncedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        retailInventoryLevels.connectionId,
        retailInventoryLevels.locationId,
        retailInventoryLevels.externalCatalogObjectId,
      ],
      set: {
        variantId,
        quantityOnHand: inventory.quantityOnHand,
        quantityAvailable: inventory.quantityAvailable,
        quantityCommitted: inventory.quantityCommitted,
        quantityIncoming: inventory.quantityIncoming,
        quantityReserved: inventory.quantityReserved,
        providerUpdatedAt: inventory.providerUpdatedAt,
        syncedAt: now,
        updatedAt: now,
      },
    });
}

async function upsertOrder(connection: RetailConnectionRecord, order: NormalizedOrder) {
  const db = getRequiredDb();
  const now = new Date();
  const locationId = order.externalLocationId ? await findLocationId(connection.id, order.externalLocationId) : null;
  await db
    .insert(retailOrders)
    .values({
      id: createRetailId("order"),
      organizationId: connection.organizationId,
      connectionId: connection.id,
      locationId,
      provider: connection.provider,
      externalOrderId: order.externalOrderId,
      orderNumber: order.orderNumber,
      salesChannel: order.salesChannel,
      status: order.status,
      currency: order.currency,
      subtotalAmount: order.subtotalAmount,
      discountAmount: order.discountAmount,
      taxAmount: order.taxAmount,
      tipAmount: order.tipAmount,
      refundAmount: order.refundAmount,
      totalAmount: order.totalAmount,
      customerCount: order.customerCount,
      orderedAt: order.orderedAt,
      closedAt: order.closedAt,
      providerCreatedAt: order.providerCreatedAt,
      providerUpdatedAt: order.providerUpdatedAt,
      syncedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [retailOrders.connectionId, retailOrders.externalOrderId],
      set: {
        locationId,
        orderNumber: order.orderNumber,
        salesChannel: order.salesChannel,
        status: order.status,
        currency: order.currency,
        subtotalAmount: order.subtotalAmount,
        discountAmount: order.discountAmount,
        taxAmount: order.taxAmount,
        tipAmount: order.tipAmount,
        refundAmount: order.refundAmount,
        totalAmount: order.totalAmount,
        customerCount: order.customerCount,
        orderedAt: order.orderedAt,
        closedAt: order.closedAt,
        providerUpdatedAt: order.providerUpdatedAt,
        syncedAt: now,
        updatedAt: now,
      },
    });

  const orderId = await findOrderId(connection.id, order.externalOrderId);
  for (const item of order.items) {
    const variantId = item.externalCatalogObjectId
      ? await findVariantId(connection.id, item.externalCatalogObjectId)
      : null;
    const productId = variantId ? await findProductIdByVariantId(variantId) : null;
    await db
      .insert(retailOrderItems)
      .values({
        id: createRetailId("item"),
        organizationId: connection.organizationId,
        connectionId: connection.id,
        orderId,
        productId,
        variantId,
        provider: connection.provider,
        externalOrderItemId: `${order.externalOrderId}:${item.externalOrderItemId}`,
        externalCatalogObjectId: item.externalCatalogObjectId,
        sku: item.sku,
        itemName: item.itemName,
        variantName: item.variantName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        grossAmount: item.grossAmount,
        discountAmount: item.discountAmount,
        taxAmount: item.taxAmount,
        refundAmount: item.refundAmount,
        netAmount: item.netAmount,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [retailOrderItems.connectionId, retailOrderItems.externalOrderItemId],
        set: {
          orderId,
          productId,
          variantId,
          sku: item.sku,
          itemName: item.itemName,
          variantName: item.variantName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          grossAmount: item.grossAmount,
          discountAmount: item.discountAmount,
          taxAmount: item.taxAmount,
          refundAmount: item.refundAmount,
          netAmount: item.netAmount,
          updatedAt: now,
        },
      });
  }
}

async function findMerchantId(connectionId: string, externalMerchantId: string | null) {
  if (!externalMerchantId) return null;
  const db = getRequiredDb();
  const [row] = await db
    .select({ id: retailMerchants.id })
    .from(retailMerchants)
    .where(and(eq(retailMerchants.connectionId, connectionId), eq(retailMerchants.externalMerchantId, externalMerchantId)))
    .limit(1);
  return row?.id || null;
}

async function findLocationId(connectionId: string, externalLocationId: string) {
  const db = getRequiredDb();
  const [row] = await db
    .select({ id: retailLocations.id })
    .from(retailLocations)
    .where(and(eq(retailLocations.connectionId, connectionId), eq(retailLocations.externalLocationId, externalLocationId)))
    .limit(1);
  return row?.id || null;
}

async function findProductId(connectionId: string, externalProductId: string) {
  const db = getRequiredDb();
  const [row] = await db
    .select({ id: retailProducts.id })
    .from(retailProducts)
    .where(and(eq(retailProducts.connectionId, connectionId), eq(retailProducts.externalProductId, externalProductId)))
    .limit(1);
  return row?.id || null;
}

async function findVariantId(connectionId: string, externalVariantId: string) {
  const db = getRequiredDb();
  const [row] = await db
    .select({ id: retailVariants.id })
    .from(retailVariants)
    .where(and(eq(retailVariants.connectionId, connectionId), eq(retailVariants.externalVariantId, externalVariantId)))
    .limit(1);
  return row?.id || null;
}

async function findProductIdByVariantId(variantId: string) {
  const db = getRequiredDb();
  const [row] = await db
    .select({ productId: retailVariants.productId })
    .from(retailVariants)
    .where(eq(retailVariants.id, variantId))
    .limit(1);
  return row?.productId || null;
}

async function findOrderId(connectionId: string, externalOrderId: string) {
  const db = getRequiredDb();
  const [row] = await db
    .select({ id: retailOrders.id })
    .from(retailOrders)
    .where(and(eq(retailOrders.connectionId, connectionId), eq(retailOrders.externalOrderId, externalOrderId)))
    .limit(1);
  if (!row?.id) throw new Error("Order upsert did not return a persisted order.");
  return row.id;
}

export async function hasActiveRetailSync(connectionId: string) {
  const db = getRequiredDb();
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(retailSyncRuns)
    .where(
      and(
        eq(retailSyncRuns.connectionId, connectionId),
        sql`${retailSyncRuns.status} in ('queued', 'running')`,
      ),
    );
  return (row?.value || 0) > 0;
}

function getRequiredDb() {
  const db = getDb();
  if (!db) throw new Error("Database connection is unavailable.");
  return db;
}
