/**
 * Installs the database singleton used by scripts/analysis/test-profitability-report-entry-points.ts
 * before any src/lib/db import evaluates. The fake database mirrors the production failure that
 * broke Profitability report generation: every relation resolves, while the ConcurrentAnalysisCount
 * relation rejects exactly like the live database did (relation does not exist).
 *
 * This module must stay the first import of the test file so the global db singleton is captured
 * from globalThis instead of creating a real connection.
 */

type FakeRow = Record<string, unknown>

type ConcurrentAnalysisCountMissingError = Error & { code: string }

export const CONCURRENT_ANALYSIS_COUNT_MISSING_MESSAGE =
  'Failed query: select "id", "userId", "activeCount", "maxReachedAt", "createdAt", "updatedAt" from "ConcurrentAnalysisCount" "concurrentAnalysisCounts" where "concurrentAnalysisCounts"."userId" = $1 limit $2'

export function createConcurrentAnalysisCountMissingError(): ConcurrentAnalysisCountMissingError {
  const error = new Error(
    `${CONCURRENT_ANALYSIS_COUNT_MISSING_MESSAGE}\nrelation "ConcurrentAnalysisCount" does not exist`,
  ) as ConcurrentAnalysisCountMissingError
  error.code = "42P01"
  return error
}

export const PROFITABILITY_TEST_USER_ID = "user_profitability_regression_pro"

function installFakeDb() {
  const globalForDb = globalThis as unknown as {
    db?: unknown
    dbUnavailable?: boolean
  }

  globalForDb.dbUnavailable = false
  globalForDb.db = {
    query: {
      profiles: {
        findFirst: async () => ({
          userId: PROFITABILITY_TEST_USER_ID,
          role: null,
          subscriptionTier: "pro",
        }),
      },
      dailyAiRequestCounts: {
        findFirst: async () => null,
      },
      concurrentAnalysisCounts: {
        findFirst: async () => {
          throw createConcurrentAnalysisCountMissingError()
        },
      },
      datasetRows: {
        findMany: async (): Promise<FakeRow[]> => [],
      },
    },
  }
}

installFakeDb()
