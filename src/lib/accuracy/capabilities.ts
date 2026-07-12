import { getDb } from "@/lib/db"
import { debugWarn } from "@/lib/utils/debug"
import { sql } from "drizzle-orm"

export type AccuracySearchMode = "lakebase_hybrid" | "pgvector_fts" | "fts_only"

export type AccuracyCapabilityStatus = {
  mode: AccuracySearchMode
  lakebaseVector: boolean
  lakebaseText: boolean
  pgvector: boolean
  fullTextSearch: boolean
  checkedAt: string
}

let cachedStatus: AccuracyCapabilityStatus | null = null
let cachedAt = 0
const CACHE_TTL_MS = 60_000

export async function detectAccuracyCapabilities(options: { force?: boolean } = {}): Promise<AccuracyCapabilityStatus> {
  const now = Date.now()
  if (!options.force && cachedStatus && now - cachedAt < CACHE_TTL_MS) {
    return cachedStatus
  }

  const db = getDb()
  if (!db) {
    return cacheStatus({
      mode: "fts_only",
      lakebaseVector: false,
      lakebaseText: false,
      pgvector: false,
      fullTextSearch: false,
      checkedAt: new Date().toISOString(),
    })
  }

  try {
    const installed = await db.execute(sql`
      SELECT extname
      FROM pg_extension
      WHERE extname IN ('lakebase_vector', 'lakebase_text', 'vector')
    `)
    const installedExtensions = new Set(extractRows(installed).map((row) => String(row.extname)))
    const fts = await db.execute(sql`SELECT to_regproc('to_tsvector') IS NOT NULL AS available`)
    const fullTextSearch = extractRows(fts).some((row) => row.available === true || row.available === "t")
    const lakebaseVector = installedExtensions.has("lakebase_vector")
    const lakebaseText = installedExtensions.has("lakebase_text")
    const pgvector = installedExtensions.has("vector")
    const mode: AccuracySearchMode = lakebaseVector && lakebaseText
      ? "lakebase_hybrid"
      : pgvector && fullTextSearch
        ? "pgvector_fts"
        : "fts_only"

    return cacheStatus({
      mode,
      lakebaseVector,
      lakebaseText,
      pgvector,
      fullTextSearch,
      checkedAt: new Date().toISOString(),
    })
  } catch (error) {
    debugWarn("[ACCURACY] Capability detection failed; falling back to FTS-only mode", {
      error: error instanceof Error ? error.message : String(error),
    })
    return cacheStatus({
      mode: "fts_only",
      lakebaseVector: false,
      lakebaseText: false,
      pgvector: false,
      fullTextSearch: true,
      checkedAt: new Date().toISOString(),
    })
  }
}

function cacheStatus(status: AccuracyCapabilityStatus) {
  cachedStatus = status
  cachedAt = Date.now()
  return status
}

function extractRows(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: unknown }).rows)) {
    return (result as { rows: Array<Record<string, unknown>> }).rows
  }
  return []
}
