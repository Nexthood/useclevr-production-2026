CREATE TABLE IF NOT EXISTS "AiAgentPassport" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "agentKey" varchar(100) NOT NULL,
  "ownerName" varchar(160) NOT NULL,
  "purpose" varchar(2000) NOT NULL,
  "declaredScope" varchar(4000) NOT NULL,
  "riskClass" varchar(20) NOT NULL DEFAULT 'unclassified',
  "lifecycle" varchar(20) NOT NULL DEFAULT 'draft',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "AiAgentPassport_riskClass_check" CHECK ("riskClass" IN ('unclassified', 'low', 'medium', 'high')),
  CONSTRAINT "AiAgentPassport_lifecycle_check" CHECK ("lifecycle" IN ('draft', 'active', 'retired')),
  CONSTRAINT "AiAgentPassport_ownerName_check" CHECK (length(trim("ownerName")) > 0),
  CONSTRAINT "AiAgentPassport_purpose_check" CHECK (length(trim("purpose")) > 0),
  CONSTRAINT "AiAgentPassport_declaredScope_check" CHECK (length(trim("declaredScope")) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "AiAgentPassport_userId_agentKey_key"
  ON "AiAgentPassport" ("userId", "agentKey");

-- Existing trace rows retain NULL; historical attribution is not inferred.
ALTER TABLE "AiInteractionTrace" ADD COLUMN IF NOT EXISTS "agentPassportId" text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AiInteractionTrace_agentPassportId_fkey' AND conrelid = '"AiInteractionTrace"'::regclass) THEN
    ALTER TABLE "AiInteractionTrace" ADD CONSTRAINT "AiInteractionTrace_agentPassportId_fkey"
      FOREIGN KEY ("agentPassportId") REFERENCES "AiAgentPassport"("id") ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "AiInteractionTrace_agentPassportId_createdAt_idx"
  ON "AiInteractionTrace" ("agentPassportId", "createdAt");
