"use server"

import { debugError, debugLog } from "@/lib/utils/debug"



import { parseCSVString } from "@/lib/data/csvLoader"
import { auth } from "@/lib/auth/auth"
import { isBuiltinUserId } from "@/lib/auth/builtin-users"
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store"
import { getDb } from "@/lib/db"
import { datasetRows, datasets } from "@/lib/db/schema"
import { consumeAnalystCredit, requireAnalystCredit, type AnalystCreditUsage } from "@/lib/usage/analyst-credits"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { v4 as uuidv4 } from 'uuid'

interface CsvRow {
  [key: string]: string | number | boolean | null
}

async function executeWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 3,
  delayMs: number = 2000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      debugLog(`[DB] ${operationName} - Attempt ${attempt}/${maxRetries}`)
      const result = await operation()
      debugLog(`[DB] ${operationName} - Success on attempt ${attempt}`)
      return result
    } catch (error: any) {
      debugError(`[DB] ${operationName} - Attempt ${attempt} failed:`, error.message)

      if (attempt === maxRetries) {
        debugError(`[DB] ${operationName} - All ${maxRetries} attempts failed`)
        throw error
      }

      debugLog(`[DB] ${operationName} - Retrying in ${delayMs}ms...`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  throw new Error(`${operationName} failed after ${maxRetries} attempts`)
}

// Minimal DB availability probe to avoid broken downstream logic
async function isDbAvailable(): Promise<boolean> {
  const db = getDb()
  if (!db) {
    debugError("[UPLOAD] DB health check failed: database client is not configured")
    return false
  }

  try {
    // Perform a trivial query; any driver-level failure (e.g., Neon cold start/fetch failed)
    // will throw here and we can fail early before demo-user/database operations.
    await db.query.datasets.findFirst()
    return true
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    debugError("[UPLOAD] DB health check failed:", msg)
    return false
  }
}

/**
 * Upload CSV file and store in database
 */
export async function uploadCSV(formData: FormData): Promise<{
  success: boolean
  error?: string
  datasetId?: string
  redirectTo?: string
  fileName?: string
  preview?: { headers: string[]; rows: CsvRow[] }
  profitabilityResult?: any
  usage?: AnalystCreditUsage
  step?: string
}> {
  try {
    const db = getDb()
    if (!db) {
      return {
        success: false,
        error: "Database is not configured. Please set DATABASE_URL and try again.",
      }
    }

    // Check authentication
    const session = await auth()
    const sessionUserId = session?.user?.id

    if (!sessionUserId) {
      return {
        success: false,
        error: "Unauthorized|Please sign in before uploading a dataset.",
      }
    }
    
    debugLog("[UPLOAD] Session:", session ? { userId: session.user?.id, email: session.user?.email } : null)
    debugLog("[UPLOAD] FormData keys:", Array.from(formData.keys()))
    
    const envDemoMode = process.env.DEMO_MODE === "true"
    
    debugLog("[UPLOAD] ========== DEBUG MODE CHECK ==========")
    debugLog("[UPLOAD] process.env.DEMO_MODE:", process.env.DEMO_MODE)
    debugLog("[UPLOAD] envDemoMode (process.env.DEMO_MODE === 'true'):", envDemoMode)
    debugLog("[UPLOAD] sessionUserId:", sessionUserId)
    debugLog("[UPLOAD] ======================================")
    
    // Check if this is a profitability analysis upload (by checking for fileType)
    const fileType = formData.get('fileType') as string
    const isProfitabilityUpload = fileType?.startsWith('profitability_') || fileType?.includes('profitability')
    debugLog("[UPLOAD] fileType:", fileType)
    debugLog("[UPLOAD] isProfitabilityUpload:", isProfitabilityUpload)
    debugLog("[UPLOAD] file received:", formData.get("file") instanceof File)
    
    // Explicit demo mode may bypass persistence only for non-built-in profitability uploads.
    const shouldUseDemoMode =
      envDemoMode && !isBuiltinUserId(sessionUserId) && isProfitabilityUpload
    
    if (shouldUseDemoMode) {
      debugLog("[UPLOAD] === DEMO MODE - Using non-persistent profitability flow ===")
      const file = formData.get("file") as File | null
      if (file) {
        debugLog("[UPLOAD] file received:", { name: file.name, size: file.size, type: file.type })
        const text = await file.text()
        const parsed = parseCSVString(text)
        const headers = parsed.columns
        debugLog("[UPLOAD] CSV parsed")
        debugLog("[UPLOAD] columns detected:", headers)
        debugLog("[UPLOAD] row count detected:", parsed.rowCount)
      }
      debugLog("[UPLOAD] profitability analysis started")
      
      const profitabilityDataStr = formData.get('profitabilityData') as string
      let profitabilityData = null
      if (profitabilityDataStr) {
        try {
          profitabilityData = JSON.parse(profitabilityDataStr)
          debugLog("[UPLOAD] profitability metrics calculated:", {
            hasRevenue: profitabilityData?.hasRevenue,
            hasExpenses: profitabilityData?.hasExpenses,
            totalRevenue: profitabilityData?.totalRevenue,
            totalExpenses: profitabilityData?.totalExpenses,
          })
        } catch (e) {
          debugLog("[UPLOAD] Could not parse profitabilityData:", e)
        }
      }
      
      debugLog("[UPLOAD] AI/explanation layer called: false")
      debugLog("[UPLOAD] result saved: non-persistent demo profitability result")
      debugLog("[UPLOAD] Demo mode - returning demo result (no DB insert)")
      return {
        success: true,
        datasetId: `demo_${Date.now()}`,
        redirectTo: `/app/upload`, // Stay on same page, component handles result
        profitabilityResult: profitabilityData, // Return actual result data
        preview: {
          headers: ["Revenue", "Expenses", "Profit", "Margin"],
          rows: [{
            Revenue: profitabilityData?.totalRevenue || 0,
            Expenses: profitabilityData?.totalExpenses || 0,
            Profit: profitabilityData?.profit || 0,
            Margin: profitabilityData?.margin || 0
          }]
        }
      }
    }
    
    // For standard uploads (non-profitability), proceed with normal database insert
    // Even in demo mode, standard uploads should create actual dataset records
    debugLog("[UPLOAD] Standard upload mode - proceeding with database insert")
    
    // EARLY FAIL: If DB is unavailable, return a clean structured error and stop
    const dbOk = await isDbAvailable()
    if (!dbOk) {
      return {
        success: false,
        // Structured error: machine-readable code | user-facing message
        error: "DB_UNAVAILABLE|Our database is waking up. Please retry in 15–60 seconds.",
      }
    }
    
    let effectiveUserId = sessionUserId
    debugLog("[UPLOAD] Authenticated user:", effectiveUserId)

    await requireBuiltinUserRecord(effectiveUserId)

    debugLog("[UPLOAD] FINAL effectiveUserId:", effectiveUserId)
    
    if (effectiveUserId) {
      debugLog("[UPLOAD] CHOSEN PATH: real-db-insert")
      debugLog("[UPLOAD] FINAL USER ID IS REAL - proceeding with Dataset insert")
    }
    
    if (!effectiveUserId) {
      return { success: false, error: "User ID not found. Please sign in again." }
    }

    const currentUsage = await requireAnalystCredit(effectiveUserId)
    if (!currentUsage.canAnalyze) {
      return {
        success: false,
        error: "Analyst credit limit reached. Subscribe to Pro or top up to upload another dataset.",
        usage: currentUsage,
      }
    }

    const file = formData.get("file") as File | null
    if (!file) {
      return { success: false, error: "No file provided" }
    }

    // Validate file type
    if (!file.name.endsWith(".csv") && !file.type.includes("csv")) {
      return { success: false, error: "File must be a CSV file" }
    }

    // File size limits - support up to 50MB
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      return { success: false, error: "File size must be less than 50MB" }
    }

    // Read file content
    const text = await file.text()
    debugLog("[UPLOAD] file received:", { name: file.name, size: file.size, type: file.type })
    
    // Parse CSV content using canonical parser
    const parsedDataset = parseCSVString(text)
    if (parsedDataset.rowCount === 0) {
      return { success: false, error: "CSV file is empty" }
    }

    const headers = parsedDataset.columns
    const totalRowCount = parsedDataset.rowCount
    const allRows = parsedDataset.rows as CsvRow[]

    debugLog("[UPLOAD] CSV parsed")
    debugLog("[UPLOAD] columns detected:", headers)
    debugLog("[UPLOAD] row count detected:", totalRowCount)

    // Generate dataset ID
    const datasetId = `ds_${Date.now()}_${uuidv4().slice(0, 8)}`
    const datasetName = file.name.replace(/\.csv$/i, '')

    debugLog("[UPLOAD] Creating dataset:", datasetId, "for user:", effectiveUserId)
    debugLog("[UPLOAD] Total rows:", totalRowCount)

    // Get profitability data if present
    const profitabilityDataStr = formData.get('profitabilityData') as string
    
    let profitabilityData = null
    if (profitabilityDataStr) {
      try {
        profitabilityData = JSON.parse(profitabilityDataStr)
      } catch (e) {
        debugLog("[UPLOAD] Could not parse profitabilityData:", e)
      }
    }

    debugLog("[UPLOAD] profitabilityData:", profitabilityData ? "present" : "none")

    // Check if this is a profitability analysis (has profitability data)
    const isProfitabilityAnalysis = !!profitabilityData
    if (isProfitabilityAnalysis) {
      debugLog("[UPLOAD] profitability analysis started")
      debugLog("[UPLOAD] profitability metrics calculated:", {
        hasRevenue: profitabilityData?.hasRevenue,
        hasExpenses: profitabilityData?.hasExpenses,
        totalRevenue: profitabilityData?.totalRevenue,
        totalExpenses: profitabilityData?.totalExpenses,
      })
      debugLog("[UPLOAD] AI/explanation layer called: false")
    }
    
    // For profitability analysis, store minimal data - don't store full raw rows
    const shouldStoreFullData = !isProfitabilityAnalysis
    
    // Create dataset - store ALL rows for full analysis (unless profitability)
    try {
      const now = new Date()
      
      // Insert dataset record - with minimal data for profitability
      debugLog("[UPLOAD] Inserting dataset...")
      debugLog("[UPLOAD] Payload:", {
        id: datasetId,
        userId: effectiveUserId,
        name: datasetName,
        fileName: file.name,
        fileSize: file.size,
        rowCount: totalRowCount,
        columnCount: headers.length,
        columns: headers,
        data: shouldStoreFullData ? "[FULL DATA]" : "[MINIMAL - profitability]",
        columnTypes: {},
        status: 'ready',
        analysis: isProfitabilityAnalysis ? { profitability: profitabilityData } : {},
        createdAt: now,
        updatedAt: now,
      })

      // For profitability: store only metadata + summary, NOT full raw rows
      // For regular: store full data as before
      const insertData = isProfitabilityAnalysis ? {
        id: datasetId,
        userId: effectiveUserId,
        name: datasetName,
        fileName: file.name,
        fileSize: file.size,
        rowCount: totalRowCount,
        columnCount: headers.length,
        columns: headers,
        data: [], // Don't store full raw rows for profitability
        columnTypes: {},
        status: 'ready',
        analysis: { profitability: profitabilityData }, // Store summary in analysis
        precomputedMetrics: profitabilityData ? {
          totalRevenue: profitabilityData.totalRevenue,
          totalExpenses: profitabilityData.totalExpenses,
          profit: profitabilityData.profit,
          margin: profitabilityData.margin,
          hasBothFiles: profitabilityData.hasBothFiles
        } : null,
        createdAt: now,
        updatedAt: now,
      } : {
        // Regular dataset - store full data
        id: datasetId,
        userId: effectiveUserId,
        name: datasetName,
        fileName: file.name,
        fileSize: file.size,
        rowCount: totalRowCount,
        columnCount: headers.length,
        columns: headers,
        data: allRows,
        columnTypes: {},
        status: 'ready',
        analysis: {},
        createdAt: now,
        updatedAt: now,
      }

      debugLog("[UPLOAD] Insert values (data length):", insertData.data?.length || 0)
      
      // PROOF LOGGING: Log exact userId being used for insert
      debugLog("[UPLOAD] ========== PROOF ==========")
      debugLog("[UPLOAD] persistentUpload:", !shouldUseDemoMode)
      debugLog("[UPLOAD] effectiveUserId being used:", effectiveUserId)
      debugLog("[UPLOAD] isProfitabilityAnalysis:", isProfitabilityAnalysis)
      debugLog("[UPLOAD] Will insert into Dataset with userId:", effectiveUserId)
      debugLog("[UPLOAD] ============================")
      
      try {
        await executeWithRetry(
          () => (db as any).insert(datasets).values(insertData),
          "Insert dataset"
        )
        debugLog("[UPLOAD] Dataset created with", totalRowCount, "rows")
        debugLog("[UPLOAD] dataset saved:", datasetId)
        if (isProfitabilityAnalysis) {
          debugLog("[UPLOAD] result saved:", datasetId)
        }

        // Also write rows to datasetRows so the detail page can paginate them
        if (!isProfitabilityAnalysis && allRows.length > 0) {
          const BATCH_SIZE = 100
          for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
            const batch = allRows.slice(i, i + BATCH_SIZE)
            const rowValues = batch.map((row: Record<string, unknown>, j: number) => ({
              id: `${datasetId}-row-${i + j}`,
              datasetId,
              rowIndex: i + j,
              data: row,
            }))
            await executeWithRetry(
              () => (db as any).insert(datasetRows).values(rowValues),
              `Insert datasetRows batch ${i / BATCH_SIZE + 1}`
            )
          }
          debugLog("[UPLOAD] Wrote", allRows.length, "rows to datasetRows")
        }
      } catch (insertErr) {
        debugError("[UPLOAD] INSERT FAILED:", insertErr)
        debugError("[UPLOAD] INSERT ERROR:", insertErr instanceof Error ? insertErr.message : String(insertErr))
        // Return actual error instead of masking as success
        return { 
          success: false, 
          step: "profitability_analysis",
          error: isProfitabilityAnalysis
            ? "Could not save profitability analysis. Please try again."
            : "Could not save dataset. Please try again.",
        }
      }
    } catch (err) {
      debugError("[UPLOAD] Database error:", err)
      debugError("[UPLOAD] Error stack:", err instanceof Error ? err.stack : 'No stack')
      debugError("[UPLOAD] Error message:", err instanceof Error ? err.message : String(err))
      
      // Return sanitized error - never expose internal details
      return { success: false, error: "Database error: " + (err instanceof Error ? err.message : "Failed to save dataset") }
    }

    // Revalidate datasets page
    revalidatePath("/app/datasets")

    // Fire suggestion regeneration (best-effort, non-blocking)
    try {
      const origin = process.env.AUTH_URL || "http://localhost:3000"
      fetch(`${origin}/api/suggestions/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId }),
      }).catch(() => {})
    } catch {
      // Suggestion refresh is best-effort
    }

    const usage = await consumeAnalystCredit(effectiveUserId)

    debugLog("[UPLOAD] Dataset created successfully:", datasetId)

    return {
      success: true,
      datasetId: datasetId,
      redirectTo: `/app/datasets/${datasetId}/analyze`,
      fileName: file.name,
      preview: {
        headers,
        rows: allRows.slice(0, 5),
      },
      profitabilityResult: profitabilityData || undefined,
      usage,
    }
  } catch (error) {
    debugError("Upload error:", error)
    debugError("Error stack:", error instanceof Error ? error.stack : 'No stack')
    
    const errorMessage = error instanceof Error ? error.message : "Failed to upload file"
    debugError("Error message:", errorMessage)
    
    if (errorMessage.includes("Can't reach database") || 
        errorMessage.includes("ECONNREFUSED")) {
      return {
        success: false,
        error: "Database connection failed. Please check your database configuration.",
      }
    }
    
    // Sanitize error - never expose internal details to frontend
    return {
      success: false,
      error: "Upload failed: " + errorMessage,
    }
  }
}

/**
 * Get dataset by ID with preview data
 */
export async function getDataset(datasetId: string) {
  try {
    const db = getDb()
    if (!db) {
      return { error: "Database connection is unavailable" }
    }

    const session = await auth()
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    const dataset = await db.query.datasets.findFirst({
      where: and(eq(datasets.id, datasetId), eq(datasets.userId, session.user.id)),
    })

    if (!dataset) {
      return { error: "Dataset not found" }
    }

    return dataset
  } catch (error) {
    debugError("Error fetching dataset:", error)
    return { error: "Failed to fetch dataset" }
  }
}
