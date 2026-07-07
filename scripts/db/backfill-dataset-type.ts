import { getDb } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { resolveDatasetType } from "@/lib/data/dataset-category"
import { eq, sql } from "drizzle-orm"

async function backfillDatasetTypes() {
  const db = getDb()
  if (!db) {
    console.error("[BACKFILL] Database not available")
    process.exit(1)
  }

  console.log("[BACKFILL] Starting datasetType backfill...")

  const missing = await db
    .select({
      id: datasets.id,
      datasetType: datasets.datasetType,
      analysis: datasets.analysis,
    })
    .from(datasets)
    .where(sql`${datasets.datasetType} IS NULL OR ${datasets.datasetType} = 'standard'`)

  console.log(`[BACKFILL] Found ${missing.length} datasets to check`)

  let updated = 0
  for (const row of missing) {
    const inferred = resolveDatasetType(row.datasetType, row.analysis)
    if (inferred !== "standard") {
      await db
        .update(datasets)
        .set({ datasetType: inferred, updatedAt: new Date() })
        .where(eq(datasets.id, row.id))
      updated++
      console.log(`[BACKFILL] Updated ${row.id} -> ${inferred}`)
    }
  }

  console.log(`[BACKFILL] Complete. Updated ${updated} datasets out of ${missing.length} checked.`)
}

backfillDatasetTypes()
  .then(() => {
    console.log("[BACKFILL] Done")
    process.exit(0)
  })
  .catch((err) => {
    console.error("[BACKFILL] Failed:", err)
    process.exit(1)
  })
