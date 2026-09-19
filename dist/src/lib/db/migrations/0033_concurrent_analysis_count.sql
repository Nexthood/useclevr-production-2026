-- ConcurrentAnalysisCount stores the per-user concurrent analysis count used by
-- usage enforcement (dashboard report generation, dataset analysis limits). Databases
-- created before this table rely on the fail-open lookup fallback in
-- src/lib/billing/usage-enforcement.ts, which treats a missing or unreadable table as
-- zero concurrent analyses instead of blocking paid report generation and analysis.
CREATE TABLE IF NOT EXISTS "ConcurrentAnalysisCount" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "activeCount" integer DEFAULT 0 NOT NULL,
  "maxReachedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConcurrentAnalysisCount_userId_key"
  ON "ConcurrentAnalysisCount" USING btree ("userId");
