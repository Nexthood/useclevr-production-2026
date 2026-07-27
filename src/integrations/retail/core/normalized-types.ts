import type {
  RetailConnectionStatus,
  RetailProviderEnvironment,
  RetailProvider,
  RetailSyncStatus,
  RetailSyncType,
  RetailWebhookStatus,
} from "@/lib/db/schema";

export type {
  RetailConnectionStatus,
  RetailProviderEnvironment,
  RetailProvider,
  RetailSyncStatus,
  RetailSyncType,
  RetailWebhookStatus,
};

export type RetailConnectionRecord = {
  id: string;
  organizationId: string;
  provider: RetailProvider;
  providerEnvironment: RetailProviderEnvironment | null;
  externalMerchantId: string | null;
  displayName: string;
  connectionStatus: RetailConnectionStatus;
  accessTokenEncrypted: string | null;
  refreshTokenEncrypted: string | null;
  tokenExpiresAt: Date | null;
  grantedScopes: string[];
};

export type AuthorizationInput = {
  state: string;
  redirectUri: string;
};

export type AuthorizationCodeInput = {
  code: string;
  redirectUri: string;
};

export type TokenResult = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  merchantId: string | null;
  scopes: string[];
};

export type PaginatedResult<T> = {
  data: T[];
  cursor: string | null;
};

export type OrderSyncParams = {
  locationIds?: string[];
  cursor?: string;
  updatedAfter?: Date;
  createdAfter?: Date;
  createdBefore?: Date;
};

export type NormalizedMerchant = {
  externalMerchantId: string;
  businessName: string | null;
  country: string | null;
  currency: string | null;
  timezone: string | null;
  language: string | null;
  status: string | null;
  providerCreatedAt: Date | null;
  providerUpdatedAt: Date | null;
};

export type NormalizedLocation = {
  externalLocationId: string;
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  currency: string | null;
  timezone: string | null;
  status: string | null;
  providerCreatedAt: Date | null;
  providerUpdatedAt: Date | null;
};

export type NormalizedProduct = {
  externalProductId: string;
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  status: string | null;
  imageUrl: string | null;
  providerCreatedAt: Date | null;
  providerUpdatedAt: Date | null;
  variants: NormalizedVariant[];
};

export type NormalizedVariant = {
  externalVariantId: string;
  externalProductId: string;
  sku: string | null;
  barcode: string | null;
  variantName: string | null;
  unitCost: string | null;
  retailPrice: string | null;
  currency: string | null;
  compareAtPrice: string | null;
  taxable: boolean | null;
  trackInventory: boolean | null;
  status: string | null;
  providerCreatedAt: Date | null;
  providerUpdatedAt: Date | null;
};

export type NormalizedInventoryLevel = {
  externalLocationId: string | null;
  externalCatalogObjectId: string;
  quantityOnHand: string | null;
  quantityAvailable: string | null;
  quantityCommitted: string | null;
  quantityIncoming: string | null;
  quantityReserved: string | null;
  providerUpdatedAt: Date | null;
};

export type NormalizedOrder = {
  externalOrderId: string;
  externalLocationId: string | null;
  orderNumber: string | null;
  salesChannel: string | null;
  status: string | null;
  currency: string | null;
  subtotalAmount: string | null;
  discountAmount: string | null;
  taxAmount: string | null;
  tipAmount: string | null;
  refundAmount: string | null;
  totalAmount: string | null;
  customerCount: number | null;
  orderedAt: Date | null;
  closedAt: Date | null;
  providerCreatedAt: Date | null;
  providerUpdatedAt: Date | null;
  items: NormalizedOrderItem[];
};

export type NormalizedOrderItem = {
  externalOrderItemId: string;
  externalCatalogObjectId: string | null;
  sku: string | null;
  itemName: string;
  variantName: string | null;
  quantity: string | null;
  unitPrice: string | null;
  grossAmount: string | null;
  discountAmount: string | null;
  taxAmount: string | null;
  refundAmount: string | null;
  netAmount: string | null;
};

export type NormalizedWebhookEvent = {
  providerEventId: string;
  eventType: string;
  externalMerchantId: string | null;
  externalLocationId: string | null;
  sanitizedPayload: Record<string, unknown>;
};

export type ConnectorHealthResult = {
  status: "healthy" | "delayed" | "degraded" | "reauthorization_required" | "disconnected";
  message: string;
};
