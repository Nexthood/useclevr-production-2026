CREATE TABLE IF NOT EXISTS "AiProviderConfig" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "providerType" varchar(40) DEFAULT 'openai-compatible' NOT NULL,
  "providerName" varchar(120) NOT NULL,
  "baseUrl" text NOT NULL,
  "modelName" varchar(160) NOT NULL,
  "encryptedApiKey" text,
  "selected" boolean DEFAULT true NOT NULL,
  "lastTestStatus" varchar(30),
  "lastTestMessage" text,
  "lastTestedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "AiProviderConfig_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiProviderConfig_userId_key"
  ON "AiProviderConfig" ("userId");
