CREATE TABLE IF NOT EXISTS "RetailConnection" (
  "id" text PRIMARY KEY NOT NULL,
  "organizationId" text NOT NULL,
  "provider" varchar(40) NOT NULL,
  "externalMerchantId" text,
  "displayName" text NOT NULL,
  "connectionStatus" varchar(40) DEFAULT 'pending' NOT NULL,
  "accessTokenEncrypted" text,
  "refreshTokenEncrypted" text,
  "tokenExpiresAt" timestamp,
  "grantedScopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "lastSuccessfulSyncAt" timestamp,
  "lastSyncAttemptAt" timestamp,
  "lastWebhookAt" timestamp,
  "connectionError" text,
  "createdBy" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "disconnectedAt" timestamp,
  CONSTRAINT "RetailConnection_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Business"("id") ON DELETE cascade,
  CONSTRAINT "RetailConnection_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "RetailOauthState" (
  "id" text PRIMARY KEY NOT NULL,
  "organizationId" text NOT NULL,
  "provider" varchar(40) NOT NULL,
  "stateHash" varchar(64) NOT NULL,
  "createdBy" text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "usedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "RetailOauthState_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Business"("id") ON DELETE cascade,
  CONSTRAINT "RetailOauthState_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "RetailMerchant" (
  "id" text PRIMARY KEY NOT NULL,
  "organizationId" text NOT NULL,
  "connectionId" text NOT NULL,
  "provider" varchar(40) NOT NULL,
  "externalMerchantId" text NOT NULL,
  "businessName" text,
  "country" varchar(8),
  "currency" varchar(3),
  "timezone" text,
  "language" varchar(16),
  "status" varchar(40),
  "providerCreatedAt" timestamp,
  "providerUpdatedAt" timestamp,
  "syncedAt" timestamp DEFAULT now() NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "RetailMerchant_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "RetailConnection"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "RetailLocation" (
  "id" text PRIMARY KEY NOT NULL,
  "organizationId" text NOT NULL,
  "connectionId" text NOT NULL,
  "merchantId" text,
  "provider" varchar(40) NOT NULL,
  "externalLocationId" text NOT NULL,
  "name" text NOT NULL,
  "addressLine1" text,
  "addressLine2" text,
  "city" text,
  "region" text,
  "postalCode" text,
  "country" varchar(8),
  "currency" varchar(3),
  "timezone" text,
  "status" varchar(40),
  "providerCreatedAt" timestamp,
  "providerUpdatedAt" timestamp,
  "syncedAt" timestamp DEFAULT now() NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "RetailLocation_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "RetailConnection"("id") ON DELETE cascade,
  CONSTRAINT "RetailLocation_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "RetailMerchant"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "RetailProduct" (
  "id" text PRIMARY KEY NOT NULL,
  "organizationId" text NOT NULL,
  "connectionId" text NOT NULL,
  "provider" varchar(40) NOT NULL,
  "externalProductId" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text,
  "brand" text,
  "status" varchar(40),
  "imageUrl" text,
  "providerCreatedAt" timestamp,
  "providerUpdatedAt" timestamp,
  "syncedAt" timestamp DEFAULT now() NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "RetailProduct_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "RetailConnection"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "RetailVariant" (
  "id" text PRIMARY KEY NOT NULL,
  "organizationId" text NOT NULL,
  "connectionId" text NOT NULL,
  "productId" text,
  "provider" varchar(40) NOT NULL,
  "externalVariantId" text NOT NULL,
  "sku" text,
  "barcode" text,
  "variantName" text,
  "unitCost" numeric(14, 4),
  "retailPrice" numeric(14, 4),
  "currency" varchar(3),
  "compareAtPrice" numeric(14, 4),
  "taxable" boolean,
  "trackInventory" boolean,
  "status" varchar(40),
  "providerCreatedAt" timestamp,
  "providerUpdatedAt" timestamp,
  "syncedAt" timestamp DEFAULT now() NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "RetailVariant_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "RetailConnection"("id") ON DELETE cascade,
  CONSTRAINT "RetailVariant_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "RetailProduct"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "RetailInventoryLevel" (
  "id" text PRIMARY KEY NOT NULL,
  "organizationId" text NOT NULL,
  "connectionId" text NOT NULL,
  "locationId" text,
  "variantId" text,
  "provider" varchar(40) NOT NULL,
  "externalCatalogObjectId" text NOT NULL,
  "quantityOnHand" numeric(18, 6),
  "quantityAvailable" numeric(18, 6),
  "quantityCommitted" numeric(18, 6),
  "quantityIncoming" numeric(18, 6),
  "quantityReserved" numeric(18, 6),
  "reorderPoint" numeric(18, 6),
  "safetyStock" numeric(18, 6),
  "providerUpdatedAt" timestamp,
  "syncedAt" timestamp DEFAULT now() NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "RetailInventoryLevel_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "RetailConnection"("id") ON DELETE cascade,
  CONSTRAINT "RetailInventoryLevel_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "RetailLocation"("id") ON DELETE SET NULL,
  CONSTRAINT "RetailInventoryLevel_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "RetailVariant"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "RetailOrder" (
  "id" text PRIMARY KEY NOT NULL,
  "organizationId" text NOT NULL,
  "connectionId" text NOT NULL,
  "locationId" text,
  "provider" varchar(40) NOT NULL,
  "externalOrderId" text NOT NULL,
  "orderNumber" text,
  "salesChannel" text,
  "status" varchar(60),
  "currency" varchar(3),
  "subtotalAmount" numeric(14, 4),
  "discountAmount" numeric(14, 4),
  "taxAmount" numeric(14, 4),
  "tipAmount" numeric(14, 4),
  "refundAmount" numeric(14, 4),
  "totalAmount" numeric(14, 4),
  "customerCount" integer,
  "orderedAt" timestamp,
  "closedAt" timestamp,
  "providerCreatedAt" timestamp,
  "providerUpdatedAt" timestamp,
  "syncedAt" timestamp DEFAULT now() NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "RetailOrder_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "RetailConnection"("id") ON DELETE cascade,
  CONSTRAINT "RetailOrder_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "RetailLocation"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "RetailOrderItem" (
  "id" text PRIMARY KEY NOT NULL,
  "organizationId" text NOT NULL,
  "connectionId" text NOT NULL,
  "orderId" text NOT NULL,
  "productId" text,
  "variantId" text,
  "provider" varchar(40) NOT NULL,
  "externalOrderItemId" text NOT NULL,
  "externalCatalogObjectId" text,
  "sku" text,
  "itemName" text NOT NULL,
  "variantName" text,
  "quantity" numeric(18, 6),
  "unitPrice" numeric(14, 4),
  "grossAmount" numeric(14, 4),
  "discountAmount" numeric(14, 4),
  "taxAmount" numeric(14, 4),
  "refundAmount" numeric(14, 4),
  "netAmount" numeric(14, 4),
  "unitCost" numeric(14, 4),
  "grossProfit" numeric(14, 4),
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "RetailOrderItem_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "RetailOrder"("id") ON DELETE cascade,
  CONSTRAINT "RetailOrderItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "RetailProduct"("id") ON DELETE SET NULL,
  CONSTRAINT "RetailOrderItem_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "RetailVariant"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "RetailPayment" (
  "id" text PRIMARY KEY NOT NULL,
  "organizationId" text NOT NULL,
  "connectionId" text NOT NULL,
  "orderId" text,
  "provider" varchar(40) NOT NULL,
  "externalPaymentId" text NOT NULL,
  "status" varchar(60),
  "currency" varchar(3),
  "amount" numeric(14, 4),
  "processingFee" numeric(14, 4),
  "paymentMethod" text,
  "paidAt" timestamp,
  "providerCreatedAt" timestamp,
  "providerUpdatedAt" timestamp,
  "syncedAt" timestamp DEFAULT now() NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "RetailPayment_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "RetailOrder"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "RetailRefund" (
  "id" text PRIMARY KEY NOT NULL,
  "organizationId" text NOT NULL,
  "connectionId" text NOT NULL,
  "orderId" text,
  "paymentId" text,
  "provider" varchar(40) NOT NULL,
  "externalRefundId" text NOT NULL,
  "status" varchar(60),
  "currency" varchar(3),
  "amount" numeric(14, 4),
  "reason" text,
  "refundedAt" timestamp,
  "providerCreatedAt" timestamp,
  "providerUpdatedAt" timestamp,
  "syncedAt" timestamp DEFAULT now() NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "RetailRefund_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "RetailOrder"("id") ON DELETE SET NULL,
  CONSTRAINT "RetailRefund_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "RetailPayment"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "RetailSyncRun" (
  "id" text PRIMARY KEY NOT NULL,
  "organizationId" text NOT NULL,
  "connectionId" text NOT NULL,
  "provider" varchar(40) NOT NULL,
  "syncType" varchar(40) NOT NULL,
  "status" varchar(40) DEFAULT 'queued' NOT NULL,
  "startedAt" timestamp,
  "completedAt" timestamp,
  "cursor" text,
  "recordsReceived" integer DEFAULT 0 NOT NULL,
  "recordsCreated" integer DEFAULT 0 NOT NULL,
  "recordsUpdated" integer DEFAULT 0 NOT NULL,
  "recordsSkipped" integer DEFAULT 0 NOT NULL,
  "recordsFailed" integer DEFAULT 0 NOT NULL,
  "errorCode" varchar(80),
  "errorMessage" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "RetailSyncRun_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "RetailConnection"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "RetailWebhookEvent" (
  "id" text PRIMARY KEY NOT NULL,
  "organizationId" text,
  "connectionId" text,
  "provider" varchar(40) NOT NULL,
  "providerEventId" text NOT NULL,
  "eventType" text NOT NULL,
  "status" varchar(40) DEFAULT 'received' NOT NULL,
  "receivedAt" timestamp DEFAULT now() NOT NULL,
  "processedAt" timestamp,
  "retryCount" integer DEFAULT 0 NOT NULL,
  "processingError" text,
  "sanitizedPayload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "RetailWebhookEvent_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "RetailConnection"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "RetailAiInsight" (
  "id" text PRIMARY KEY NOT NULL,
  "organizationId" text NOT NULL,
  "connectionId" text,
  "provider" varchar(40),
  "reportingPeriodStart" timestamp,
  "reportingPeriodEnd" timestamp,
  "locationFilters" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "productFilters" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "kpiSnapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "sourceRecordCount" integer DEFAULT 0 NOT NULL,
  "modelMetadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "dataQualityWarnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "generatedAt" timestamp DEFAULT now() NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "RetailAiInsight_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "RetailConnection"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "RetailConnection_organization_provider_idx"
  ON "RetailConnection" ("organizationId", "provider");
CREATE UNIQUE INDEX IF NOT EXISTS "RetailConnection_org_provider_merchant_key"
  ON "RetailConnection" ("organizationId", "provider", "externalMerchantId");
CREATE UNIQUE INDEX IF NOT EXISTS "RetailOauthState_stateHash_key"
  ON "RetailOauthState" ("stateHash");
CREATE INDEX IF NOT EXISTS "RetailOauthState_organization_idx"
  ON "RetailOauthState" ("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "RetailMerchant_connection_external_key"
  ON "RetailMerchant" ("connectionId", "externalMerchantId");
CREATE INDEX IF NOT EXISTS "RetailMerchant_organization_idx"
  ON "RetailMerchant" ("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "RetailLocation_connection_external_key"
  ON "RetailLocation" ("connectionId", "externalLocationId");
CREATE INDEX IF NOT EXISTS "RetailLocation_organization_idx"
  ON "RetailLocation" ("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "RetailProduct_connection_external_key"
  ON "RetailProduct" ("connectionId", "externalProductId");
CREATE INDEX IF NOT EXISTS "RetailProduct_organization_idx"
  ON "RetailProduct" ("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "RetailVariant_connection_external_key"
  ON "RetailVariant" ("connectionId", "externalVariantId");
CREATE INDEX IF NOT EXISTS "RetailVariant_organization_idx"
  ON "RetailVariant" ("organizationId");
CREATE INDEX IF NOT EXISTS "RetailVariant_connection_sku_idx"
  ON "RetailVariant" ("connectionId", "sku");
CREATE UNIQUE INDEX IF NOT EXISTS "RetailInventoryLevel_connection_location_object_key"
  ON "RetailInventoryLevel" ("connectionId", "locationId", "externalCatalogObjectId");
CREATE INDEX IF NOT EXISTS "RetailInventoryLevel_organization_idx"
  ON "RetailInventoryLevel" ("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "RetailOrder_connection_external_key"
  ON "RetailOrder" ("connectionId", "externalOrderId");
CREATE INDEX IF NOT EXISTS "RetailOrder_organization_ordered_idx"
  ON "RetailOrder" ("organizationId", "orderedAt");
CREATE INDEX IF NOT EXISTS "RetailOrder_connection_status_idx"
  ON "RetailOrder" ("connectionId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "RetailOrderItem_connection_external_key"
  ON "RetailOrderItem" ("connectionId", "externalOrderItemId");
CREATE INDEX IF NOT EXISTS "RetailOrderItem_organization_idx"
  ON "RetailOrderItem" ("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "RetailPayment_connection_external_key"
  ON "RetailPayment" ("connectionId", "externalPaymentId");
CREATE INDEX IF NOT EXISTS "RetailPayment_organization_idx"
  ON "RetailPayment" ("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "RetailRefund_connection_external_key"
  ON "RetailRefund" ("connectionId", "externalRefundId");
CREATE INDEX IF NOT EXISTS "RetailRefund_organization_idx"
  ON "RetailRefund" ("organizationId");
CREATE INDEX IF NOT EXISTS "RetailSyncRun_connection_status_idx"
  ON "RetailSyncRun" ("connectionId", "status");
CREATE INDEX IF NOT EXISTS "RetailSyncRun_organization_created_idx"
  ON "RetailSyncRun" ("organizationId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "RetailWebhookEvent_provider_event_key"
  ON "RetailWebhookEvent" ("provider", "providerEventId");
CREATE INDEX IF NOT EXISTS "RetailWebhookEvent_connection_status_idx"
  ON "RetailWebhookEvent" ("connectionId", "status");
CREATE INDEX IF NOT EXISTS "RetailAiInsight_organization_generated_idx"
  ON "RetailAiInsight" ("organizationId", "generatedAt");
