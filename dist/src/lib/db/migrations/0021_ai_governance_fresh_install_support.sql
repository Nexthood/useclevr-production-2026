CREATE TABLE IF NOT EXISTS "AiInteractionTrace" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "datasetId" text,
  "prompt" text NOT NULL,
  "response" text NOT NULL,
  "providerName" varchar(100) NOT NULL,
  "modelName" varchar(100) NOT NULL,
  "promptVersion" varchar(50),
  "latencyMs" integer,
  "tokenCount" integer,
  "estimatedCostUsd" integer,
  "error" text,
  "feedback" varchar(20),
  "feedbackText" text,
  "userAnonymized" boolean DEFAULT false NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "AiInteractionTrace_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "AiInteractionTrace_userId_idx"
  ON "AiInteractionTrace" ("userId");
CREATE INDEX IF NOT EXISTS "AiInteractionTrace_createdAt_idx"
  ON "AiInteractionTrace" ("createdAt");
CREATE INDEX IF NOT EXISTS "AiInteractionTrace_providerName_idx"
  ON "AiInteractionTrace" ("providerName");
CREATE INDEX IF NOT EXISTS "AiInteractionTrace_feedback_idx"
  ON "AiInteractionTrace" ("feedback");
