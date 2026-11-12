CREATE TABLE IF NOT EXISTS "ClevrSyncConnector" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "organizationId" text NOT NULL,
  "type" varchar(50) NOT NULL,
  "status" varchar(50) DEFAULT 'connected' NOT NULL,
  "displayName" text NOT NULL,
  "sourceMeta" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "accessTokenEncrypted" text,
  "refreshTokenEncrypted" text,
  "tokenExpiresAt" timestamp,
  "providerAccountLabel" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "ClevrSyncConnector_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "ClevrSyncConnector_userId_idx"
  ON "ClevrSyncConnector" ("userId");
CREATE INDEX IF NOT EXISTS "ClevrSyncConnector_organizationId_type_idx"
  ON "ClevrSyncConnector" ("organizationId", "type");

CREATE TABLE IF NOT EXISTS "ClevrSyncRun" (
  "id" text PRIMARY KEY NOT NULL,
  "connectorId" text NOT NULL,
  "userId" text NOT NULL,
  "lastSync" timestamp,
  "rowCount" integer DEFAULT 0 NOT NULL,
  "columnMapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" varchar(50) DEFAULT 'previewed' NOT NULL,
  "datasetId" text,
  "error" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "ClevrSyncRun_connectorId_fkey"
    FOREIGN KEY ("connectorId") REFERENCES "ClevrSyncConnector"("id") ON DELETE cascade,
  CONSTRAINT "ClevrSyncRun_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE cascade,
  CONSTRAINT "ClevrSyncRun_datasetId_fkey"
    FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE set null
);

CREATE INDEX IF NOT EXISTS "ClevrSyncRun_connectorId_idx"
  ON "ClevrSyncRun" ("connectorId");
CREATE INDEX IF NOT EXISTS "ClevrSyncRun_userId_idx"
  ON "ClevrSyncRun" ("userId");

ALTER TABLE IF EXISTS "ClevrSyncConnector"
  ADD COLUMN IF NOT EXISTS "accessTokenEncrypted" text;
ALTER TABLE IF EXISTS "ClevrSyncConnector"
  ADD COLUMN IF NOT EXISTS "refreshTokenEncrypted" text;
ALTER TABLE IF EXISTS "ClevrSyncConnector"
  ADD COLUMN IF NOT EXISTS "tokenExpiresAt" timestamp;
ALTER TABLE IF EXISTS "ClevrSyncConnector"
  ADD COLUMN IF NOT EXISTS "providerAccountLabel" text;
