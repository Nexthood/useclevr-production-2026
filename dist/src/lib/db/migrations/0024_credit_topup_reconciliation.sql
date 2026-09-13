CREATE TABLE IF NOT EXISTS "CreditTopUp" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "workspaceId" text,
  "provider" varchar(20) NOT NULL,
  "providerPaymentId" text NOT NULL,
  "providerCheckoutId" text,
  "providerEventId" text,
  "currency" varchar(3) NOT NULL,
  "amountMinor" integer NOT NULL,
  "creditsGranted" integer NOT NULL,
  "creditPackageId" text,
  "pricingVersion" varchar(40),
  "status" varchar(30) DEFAULT 'pending' NOT NULL,
  "ledgerEntryId" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "CreditTopUp_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "CreditTopUp_provider_payment_key"
  ON "CreditTopUp" ("provider", "providerPaymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "CreditTopUp_provider_event_key"
  ON "CreditTopUp" ("provider", "providerEventId");
CREATE INDEX IF NOT EXISTS "CreditTopUp_status_idx" ON "CreditTopUp" ("status");
CREATE INDEX IF NOT EXISTS "CreditTopUp_userId_idx" ON "CreditTopUp" ("userId");
CREATE INDEX IF NOT EXISTS "CreditTopUp_createdAt_idx" ON "CreditTopUp" ("createdAt");
