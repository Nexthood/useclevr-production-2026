ALTER TABLE "RetailConnection"
  ADD COLUMN IF NOT EXISTS "providerEnvironment" varchar(40) DEFAULT 'sandbox' NOT NULL;

ALTER TABLE "RetailOauthState"
  ADD COLUMN IF NOT EXISTS "providerEnvironment" varchar(40) DEFAULT 'sandbox' NOT NULL;

DROP INDEX IF EXISTS "RetailConnection_org_provider_merchant_key";

CREATE UNIQUE INDEX IF NOT EXISTS "RetailConnection_org_provider_env_merchant_key"
  ON "RetailConnection" USING btree ("organizationId", "provider", "providerEnvironment", "externalMerchantId");
