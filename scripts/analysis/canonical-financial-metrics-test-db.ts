/**
 * Installs the database singleton used by scripts/analysis/test-canonical-financial-metrics.ts
 * before any src/lib/db import evaluates. The fake database keeps the regression test
 * hermetic: the Profitability parent dataset stores canonical totals with `data: []`, so
 * `loadDatasetData` legitimately falls through to the DatasetRow relation — this fake
 * answers that boundary with the same empty row set the persisted parent dataset owns,
 * without querying a real database in local or CI runs.
 *
 * This module must stay the first import of the test file so the global db singleton is
 * captured from globalThis instead of creating a real connection.
 */

type FakeRow = Record<string, unknown>

export function installCanonicalFinancialMetricsTestDb() {
  const globalForDb = globalThis as unknown as {
    db?: unknown
    dbUnavailable?: boolean
  }

  globalForDb.dbUnavailable = false
  globalForDb.db = {
    query: {
      profiles: {
        findFirst: async () => null,
      },
      datasetRows: {
        findMany: async (): Promise<FakeRow[]> => [],
      },
    },
  }
}

installCanonicalFinancialMetricsTestDb()
