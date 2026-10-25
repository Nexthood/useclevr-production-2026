CREATE TABLE IF NOT EXISTS "ExecutiveDailyHealthCheck" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "workspaceId" text,
  "workspaceKey" varchar(255) NOT NULL,
  "date" varchar(10) NOT NULL,
  "score" integer DEFAULT 0 NOT NULL,
  "aiConfidence" integer DEFAULT 0 NOT NULL,
  "brief" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "alerts" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "sourceHash" varchar(64),
  "generatedBy" varchar(80) DEFAULT 'deterministic' NOT NULL,
  "modelName" varchar(160),
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "ExecutiveDailyHealthCheck_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE cascade,
  CONSTRAINT "ExecutiveDailyHealthCheck_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExecutiveDailyHealthCheck_workspaceKey_date_key"
  ON "ExecutiveDailyHealthCheck" ("workspaceKey", "date");

CREATE INDEX IF NOT EXISTS "ExecutiveDailyHealthCheck_userId_idx"
  ON "ExecutiveDailyHealthCheck" ("userId");

CREATE INDEX IF NOT EXISTS "ExecutiveDailyHealthCheck_date_idx"
  ON "ExecutiveDailyHealthCheck" ("date");
