CREATE TABLE IF NOT EXISTS "AiGovernanceOverride" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "traceId" text,
  "datasetId" text,
  "action" varchar(20) NOT NULL,
  "originalValue" text,
  "editedValue" text,
  "reason" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "AiGovernanceOverride_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE cascade,
  CONSTRAINT "AiGovernanceOverride_traceId_fkey"
    FOREIGN KEY ("traceId") REFERENCES "AiInteractionTrace"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "AiGovernanceOverride_userId_idx"
  ON "AiGovernanceOverride" ("userId");

CREATE INDEX IF NOT EXISTS "AiGovernanceOverride_traceId_idx"
  ON "AiGovernanceOverride" ("traceId");

CREATE INDEX IF NOT EXISTS "AiGovernanceOverride_datasetId_idx"
  ON "AiGovernanceOverride" ("datasetId");

CREATE INDEX IF NOT EXISTS "AiGovernanceOverride_createdAt_idx"
  ON "AiGovernanceOverride" ("createdAt");
