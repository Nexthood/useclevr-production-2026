import type {
  NormalizedInventoryLevel,
  NormalizedLocation,
  NormalizedMerchant,
  NormalizedOrder,
  NormalizedOrderItem,
  NormalizedProduct,
  NormalizedVariant,
  NormalizedWebhookEvent,
} from "../../core/normalized-types";

type SquareMoney = { amount?: number; currency?: string };
type SquareCatalogObject = {
  id?: string;
  type?: string;
  updated_at?: string;
  created_at?: string;
  present_at_all_locations?: boolean;
  item_data?: {
    name?: string;
    description?: string;
    category_id?: string;
    variations?: SquareCatalogObject[];
    image_ids?: string[];
  };
  item_variation_data?: {
    item_id?: string;
    name?: string;
    sku?: string;
    upc?: string;
    price_money?: SquareMoney;
    track_inventory?: boolean;
  };
  is_deleted?: boolean;
};

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function moneyToDecimal(money: SquareMoney | null | undefined): string | null {
  if (!money || typeof money.amount !== "number") return null;
  return (money.amount / 100).toFixed(2);
}

function quantity(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

export function mapSquareMerchant(payload: unknown): NormalizedMerchant {
  const merchant = (payload as { merchant?: Record<string, unknown> }).merchant || (payload as Record<string, unknown>);
  const externalMerchantId = String(merchant.id || "");
  if (!externalMerchantId) throw new Error("Square merchant response is missing id.");

  return {
    externalMerchantId,
    businessName: typeof merchant.business_name === "string" ? merchant.business_name : null,
    country: typeof merchant.country === "string" ? merchant.country : null,
    currency: typeof merchant.currency === "string" ? merchant.currency : null,
    timezone: typeof merchant.timezone === "string" ? merchant.timezone : null,
    language: typeof merchant.language_code === "string" ? merchant.language_code : null,
    status: typeof merchant.status === "string" ? merchant.status : null,
    providerCreatedAt: parseDate(merchant.created_at),
    providerUpdatedAt: null,
  };
}

export function mapSquareLocation(location: Record<string, unknown>): NormalizedLocation {
  const address = (location.address || {}) as Record<string, unknown>;
  return {
    externalLocationId: String(location.id || ""),
    name: typeof location.name === "string" ? location.name : "Square location",
    addressLine1: typeof address.address_line_1 === "string" ? address.address_line_1 : null,
    addressLine2: typeof address.address_line_2 === "string" ? address.address_line_2 : null,
    city: typeof address.locality === "string" ? address.locality : null,
    region: typeof address.administrative_district_level_1 === "string"
      ? address.administrative_district_level_1
      : null,
    postalCode: typeof address.postal_code === "string" ? address.postal_code : null,
    country: typeof address.country === "string" ? address.country : null,
    currency: typeof location.currency === "string" ? location.currency : null,
    timezone: typeof location.timezone === "string" ? location.timezone : null,
    status: typeof location.status === "string" ? location.status : null,
    providerCreatedAt: parseDate(location.created_at),
    providerUpdatedAt: null,
  };
}

export function mapSquareCatalogItems(objects: SquareCatalogObject[]): NormalizedProduct[] {
  return objects
    .filter((object) => object.type === "ITEM" && object.id && object.item_data && !object.is_deleted)
    .map((item) => {
      const itemData = item.item_data || {};
      const externalProductId = String(item.id);
      return {
        externalProductId,
        name: itemData.name || "Unnamed Square item",
        description: itemData.description || null,
        category: itemData.category_id || null,
        brand: null,
        status: item.is_deleted ? "deleted" : "active",
        imageUrl: null,
        providerCreatedAt: parseDate(item.created_at),
        providerUpdatedAt: parseDate(item.updated_at),
        variants: (itemData.variations || [])
          .filter((variation) => variation.id && variation.item_variation_data)
          .map((variation) => mapSquareVariation(variation, externalProductId)),
      };
    });
}

function mapSquareVariation(
  variation: SquareCatalogObject,
  fallbackProductId: string,
): NormalizedVariant {
  const data = variation.item_variation_data || {};
  return {
    externalVariantId: String(variation.id || ""),
    externalProductId: data.item_id || fallbackProductId,
    sku: data.sku || null,
    barcode: data.upc || null,
    variantName: data.name || null,
    unitCost: null,
    retailPrice: moneyToDecimal(data.price_money),
    currency: data.price_money?.currency || null,
    compareAtPrice: null,
    taxable: null,
    trackInventory: typeof data.track_inventory === "boolean" ? data.track_inventory : null,
    status: variation.is_deleted ? "deleted" : "active",
    providerCreatedAt: parseDate(variation.created_at),
    providerUpdatedAt: parseDate(variation.updated_at),
  };
}

export function mapSquareInventoryCount(count: Record<string, unknown>): NormalizedInventoryLevel {
  const state = typeof count.state === "string" ? count.state : "";
  const value = quantity(count.quantity);
  return {
    externalLocationId: typeof count.location_id === "string" ? count.location_id : null,
    externalCatalogObjectId: String(count.catalog_object_id || ""),
    quantityOnHand: state === "IN_STOCK" ? value : null,
    quantityAvailable: state === "IN_STOCK" ? value : null,
    quantityCommitted: null,
    quantityIncoming: null,
    quantityReserved: null,
    providerUpdatedAt: parseDate(count.calculated_at),
  };
}

export function mapSquareOrder(order: Record<string, unknown>): NormalizedOrder {
  const tenders = Array.isArray(order.tenders) ? order.tenders : [];
  const refunds = Array.isArray(order.refunds) ? order.refunds : [];
  const lineItems = Array.isArray(order.line_items) ? order.line_items : [];
  const totalRefund = refunds.reduce((sum, refund) => {
    const amount = (refund as { amount_money?: SquareMoney }).amount_money?.amount;
    return sum + (typeof amount === "number" ? amount : 0);
  }, 0);

  return {
    externalOrderId: String(order.id || ""),
    externalLocationId: typeof order.location_id === "string" ? order.location_id : null,
    orderNumber: typeof order.ticket_name === "string" ? order.ticket_name : null,
    salesChannel: typeof order.source === "object" && order.source
      ? String((order.source as Record<string, unknown>).name || "")
      : null,
    status: typeof order.state === "string" ? order.state : null,
    currency: (order.total_money as SquareMoney | undefined)?.currency || null,
    subtotalAmount: moneyToDecimal(order.total_service_charge_money as SquareMoney),
    discountAmount: moneyToDecimal(order.total_discount_money as SquareMoney),
    taxAmount: moneyToDecimal(order.total_tax_money as SquareMoney),
    tipAmount: tenders.length > 0
      ? moneyToDecimal((tenders[0] as { tip_money?: SquareMoney }).tip_money)
      : null,
    refundAmount: totalRefund > 0 ? (totalRefund / 100).toFixed(2) : null,
    totalAmount: moneyToDecimal(order.total_money as SquareMoney),
    customerCount: null,
    orderedAt: parseDate(order.created_at),
    closedAt: parseDate(order.closed_at),
    providerCreatedAt: parseDate(order.created_at),
    providerUpdatedAt: parseDate(order.updated_at),
    items: lineItems.map((item, index) => mapSquareOrderItem(item as Record<string, unknown>, index)),
  };
}

function mapSquareOrderItem(item: Record<string, unknown>, index: number): NormalizedOrderItem {
  const grossAmount = moneyToDecimal(item.gross_sales_money as SquareMoney);
  const discountAmount = moneyToDecimal(item.total_discount_money as SquareMoney);
  const taxAmount = moneyToDecimal(item.total_tax_money as SquareMoney);
  const netAmount = moneyToDecimal(item.total_money as SquareMoney);
  return {
    externalOrderItemId: String(item.uid || item.catalog_object_id || `line-${index}`),
    externalCatalogObjectId: typeof item.catalog_object_id === "string" ? item.catalog_object_id : null,
    sku: typeof item.catalog_object_id === "string" ? null : null,
    itemName: typeof item.name === "string" ? item.name : "Square order item",
    variantName: typeof item.variation_name === "string" ? item.variation_name : null,
    quantity: quantity(item.quantity),
    unitPrice: moneyToDecimal(item.base_price_money as SquareMoney),
    grossAmount,
    discountAmount,
    taxAmount,
    refundAmount: null,
    netAmount,
  };
}

export function mapSquareWebhookEvent(event: unknown): NormalizedWebhookEvent {
  const body = event as Record<string, unknown>;
  const data = (body.data || {}) as Record<string, unknown>;
  const object = (data.object || {}) as Record<string, unknown>;
  return {
    providerEventId: String(body.event_id || body.id || ""),
    eventType: String(body.type || "unknown"),
    externalMerchantId: typeof body.merchant_id === "string" ? body.merchant_id : null,
    externalLocationId: typeof object.location_id === "string" ? object.location_id : null,
    sanitizedPayload: {
      event_id: body.event_id || body.id || null,
      type: body.type || null,
      merchant_id: body.merchant_id || null,
      data_id: data.id || null,
      object_id: object.id || null,
      location_id: object.location_id || null,
    },
  };
}
