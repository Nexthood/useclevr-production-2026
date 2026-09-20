import { sql } from "drizzle-orm"
import { db } from "@/lib/db"

/**
 * One-time grant for the initial AI analysis included in an upload's
 * standard_upload_analysis feature. The dataset must belong to the caller and
 * be freshly uploaded; a single conditional UPDATE marks the grant consumed so
 * concurrent or repeated requests cannot replay the free analysis.
 */
export const INITIAL_ANALYSIS_WINDOW_MINUTES = 15

export async function consumeIncludedInitialAnalysis(
  datasetId: string,
  userId: string,
): Promise<boolean> {
  if (!db || !datasetId || !userId) return false

  try {
    const result = await db.execute(sql`
      UPDATE "Dataset"
      SET
        "analysis" = jsonb_set(COALESCE("analysis", '{}'::jsonb), '{initialAnalysisConsumed}', 'true'::jsonb, true),
        "updatedAt" = now()
      WHERE "id" = ${datasetId}
        AND "userId" = ${userId}
        AND COALESCE("analysis"->>'initialAnalysisConsumed', 'false') <> 'true'
        AND "createdAt" > now() - ${`${INITIAL_ANALYSIS_WINDOW_MINUTES} minutes`}::interval
      RETURNING "id"
    `)
    const rows = Array.isArray(result)
      ? result
      : Array.isArray((result as { rows?: unknown[] })?.rows)
        ? (result as { rows: unknown[] }).rows
        : []
    return rows.length > 0
  } catch (error) {
    console.warn("[ANALYZE] included initial analysis grant check failed", {
      datasetId,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}
