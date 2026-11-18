CREATE TABLE IF NOT EXISTS "DailyAIRequestCount" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "date" varchar(10) NOT NULL,
  "requestCount" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "DailyAIRequestCount_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyAIRequestCount_userId_date_key"
  ON "DailyAIRequestCount" ("userId", "date");

CREATE INDEX IF NOT EXISTS "DailyAIRequestCount_userId_idx"
  ON "DailyAIRequestCount" ("userId");

CREATE INDEX IF NOT EXISTS "DailyAIRequestCount_date_idx"
  ON "DailyAIRequestCount" ("date");
