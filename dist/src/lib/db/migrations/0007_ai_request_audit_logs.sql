CREATE TABLE IF NOT EXISTS "AiRequestAuditLog" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "datasetId" text,
  "providerName" varchar(160) NOT NULL,
  "providerType" varchar(80) NOT NULL,
  "modelName" varchar(160) NOT NULL,
  "mode" varchar(30) NOT NULL,
  "executionLocation" varchar(20) NOT NULL,
  "fallbackUsed" boolean DEFAULT false NOT NULL,
  "purpose" varchar(60) NOT NULL,
  "success" boolean DEFAULT true NOT NULL,
  "errorReason" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "AiRequestAuditLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "AiRequestAuditLog_datasetId_idx"
  ON "AiRequestAuditLog" ("datasetId");
CREATE INDEX IF NOT EXISTS "AiRequestAuditLog_userId_idx"
  ON "AiRequestAuditLog" ("userId");
CREATE INDEX IF NOT EXISTS "AiRequestAuditLog_createdAt_idx"
  ON "AiRequestAuditLog" ("createdAt");
CREATE INDEX IF NOT EXISTS "AiRequestAuditLog_purpose_idx"
  ON "AiRequestAuditLog" ("purpose");
CREATE INDEX IF NOT EXISTS "AiRequestAuditLog_providerType_idx"
  ON "AiRequestAuditLog" ("providerType");
