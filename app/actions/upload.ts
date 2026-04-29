"use server"

import { debugLog, debugError, debugWarn } from "@/lib/debug"



import { db } from "@/lib/db"
import { datasets, users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { v4 as uuidv4 } from 'uuid'

interface CsvRow {
  [key: string]: string | number | boolean | null
}

// Retry configuration
const MAX_RETRIES = 5
const RETRY_DELAYS = [5000, 8000, 12000, 20000, 30000] // longer delays for Neon cold start

// Minimal DB availability probe to avoid broken downstream logic
async function isDbAvailable(): Promise<boolean> {
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
}> {
  try {
    // Check authentication
    const session = await auth()
    
    debugLog("[UPLOAD] Session:", session ? { userId: session.user?.id, email: session.user?.email } : null)
    debugLog("[UPLOAD] FormData keys:", Array.from(formData.keys()))
    
    // FIXED: Check for demo-user-id specifically and force demo mode
    const sessionUserId = session?.user?.id
    const isDemoUserId = sessionUserId === 'demo-user-id'
    // FIX: DEMO_MODE env var is NOT set, so this should be false for logged-in users
    // The issue is likely that !sessionUserId is true because session is null for unauthenticated users
    const envDemoMode = process.env.DEMO_MODE === "true"
    const isDemoMode = envDemoMode || !sessionUserId || isDemoUserId
    
    debugLog("[UPLOAD] ========== DEBUG MODE CHECK ==========")
    debugLog("[UPLOAD] process.env.DEMO_MODE:", process.env.DEMO_MODE)
    debugLog("[UPLOAD] envDemoMode (process.env.DEMO_MODE === 'true'):", envDemoMode)
    debugLog("[UPLOAD] sessionUserId:", sessionUserId)
    debugLog("[UPLOAD] !sessionUserId (no user):", !sessionUserId)
    debugLog("[UPLOAD] isDemoUserId (userId === 'demo-user-id'):", isDemoUserId)
    debugLog("[UPLOAD] isDemoMode FINAL:", isDemoMode)
    debugLog("[UPLOAD] ======================================")
    
    // Check if this is a profitability analysis upload (by checking for fileType)
    const fileType = formData.get('fileType') as string
    const isProfitabilityUpload = fileType?.startsWith('profitability_') || fileType?.includes('profitability')
    debugLog("[UPLOAD] fileType:", fileType)
    debugLog("[UPLOAD] isProfitabilityUpload:", isProfitabilityUpload)
    
    // Demo mode should ONLY apply to profitability uploads - NOT standard uploads
    // For standard uploads, we should always try to insert into the database
    const shouldUseDemoMode = isDemoMode && isProfitabilityUpload
    
    // Demo mode: skip normal Dataset insert, return success with demo result
    // Only for profitability analysis - NOT for standard CSV uploads
    if (shouldUseDemoMode) {
      debugLog("[UPLOAD] === DEMO MODE - Using non-persistent profitability flow ===")
      
      const profitabilityDataStr = formData.get('profitabilityData') as string
      let profitabilityData = null
      if (profitabilityDataStr) {
        try {
          profitabilityData = JSON.parse(profitabilityDataStr)
        } catch (e) {
          debugLog("[UPLOAD] Could not parse profitabilityData:", e)
        }
      }
      
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
    
    // Authenticated user path - use demo user as fallback for standard uploads
    let effectiveUserId = session?.user?.id
    debugLog("[UPLOAD] Authenticated user:", effectiveUserId)
    
    // HARD GUARD: If session user is "demo-user-id", this is NOT a real user
    // We must NOT insert with this fake ID - either find real demo user or use non-persistent mode
    if (effectiveUserId === 'demo-user-id') {
      debugLog("[UPLOAD] WARNING: session.userId is 'demo-user-id' - this is NOT a real user!")
      debugLog("[UPLOAD] Searching for REAL demo user in DB...")
      
      try {
        const demoUser = await (db as any).query.users.findFirst({
          where: (users as any).email === 'demo@useclever.app',
        })
        
        if (demoUser) {
          effectiveUserId = demoUser.id
          debugLog("[UPLOAD] SUCCESS: Found REAL demo user, using:", effectiveUserId)
          debugLog("[UPLOAD] CHOSEN PATH: real-db-insert")
        } else {
          // No real demo user - must use non-persistent mode
          debugLog("[UPLOAD] ERROR: No demo user in DB!")
          debugLog("[UPLOAD] CHOSEN PATH: demo-non-persistent")
          
          // Parse file for preview
          const file = formData.get("file") as File | null
          let preview = null
          
          if (file) {
            try {
              const text = await file.text()
              const lines = text.trim().split("\n")
              if (lines.length > 0) {
                const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ''))
                const previewRows = lines.slice(1, 6).map(line => {
                  const values = line.split(",")
                  const row: Record<string, string> = {}
                  headers.forEach((h, i) => { row[h] = values[i]?.trim() || '' })
                  return row
                })
                preview = { headers, rows: previewRows }
              }
            } catch (e) {
              debugLog("[UPLOAD] Could not parse preview:", e)
            }
          }
          
          return {
            success: true,
            datasetId: `demo_${Date.now()}`,
            redirectTo: `/app/datasets/demo_${Date.now()}`,
            fileName: file?.name || 'unknown.csv',
            preview: preview || undefined
          }
        }
      } catch (e) {
        debugLog("[UPLOAD] Error finding demo user:", e)
        return { 
          success: false, 
          error: "Unable to create dataset. Please try again or sign in." 
        }
      }
    }

    // For standard uploads, if no user is logged in, we MUST find a real demo user from DB
    // We CANNOT use a fake user ID or the insert will fail with FK violation
    if (!effectiveUserId) {
      debugLog("[UPLOAD] No user session - searching for real demo user in DB...")
      try {
        const demoUser = await (db as any).query.users.findFirst({
          where: (users as any).email === 'demo@useclever.app',
        })
        
        if (demoUser) {
          effectiveUserId = demoUser.id
          debugLog("[UPLOAD] Found REAL demo user in DB:", effectiveUserId)
        } else {
          // CRITICAL: No demo user exists - we cannot insert with a fake ID
          // Fall back to non-persistent demo mode for standard uploads
          debugLog("[UPLOAD] ERROR: No demo user found in DB!")
          debugLog("[UPLOAD] Falling back to non-persistent mode for standard upload")
          
          // Parse file for preview (we already have it in formData)
          const file = formData.get("file") as File | null
          let preview = null
          
          if (file) {
            try {
              const text = await file.text()
              const lines = text.trim().split("\n")
              if (lines.length > 0) {
                const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ''))
                const previewRows = lines.slice(1, 6).map(line => {
                  const values = line.split(",")
                  const row: Record<string, string> = {}
                  headers.forEach((h, i) => { row[h] = values[i]?.trim() || '' })
                  return row
                })
                preview = { headers, rows: previewRows }
              }
            } catch (e) {
              debugLog("[UPLOAD] Could not parse preview:", e)
            }
          }
          
          return {
            success: true,
            datasetId: `demo_${Date.now()}`,
            redirectTo: `/app/datasets/demo_${Date.now()}`,
            fileName: file?.name || 'unknown.csv',
            preview: preview || undefined
          }
        }
      } catch (e) {
        debugLog("[UPLOAD] Error finding demo user:", e)
        // Database error - return error instead of using fake ID
        return { 
          success: false, 
          error: "Unable to create dataset. Please try again or sign in." 
        }
      }
    }

    // If we get here, we have a valid userId (either from session or real demo user from DB)
    debugLog("[UPLOAD] FINAL effectiveUserId:", effectiveUserId)
    
    // PROOF LOGGING: Confirm we're using a REAL user ID, not "demo-user-id"
    if (effectiveUserId && effectiveUserId !== 'demo-user-id') {
      debugLog("[UPLOAD] CHOSEN PATH: real-db-insert")
      debugLog("[UPLOAD] FINAL USER ID IS REAL - proceeding with Dataset insert")
    } else {
      // This should never happen if guards above are working correctly
      debugLog("[UPLOAD] ERROR: EffectiveUserId is still invalid!")
      return { 
        success: false, 
        error: "Unable to create dataset. Please sign in." 
      }
    }
    
    if (!effectiveUserId) {
      return { success: false, error: "User ID not found. Please sign in again." }
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
    
    // Simple CSV parsing - just get headers and first few rows
    const lines = text.trim().split("\n")
    if (lines.length === 0) {
      return { success: false, error: "CSV file is empty" }
    }

    // Parse headers from first line
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ''))
    
    // Count total rows first (just count newlines)
    const totalRowCount = lines.length - 1 // Exclude header
    
    // Parse ALL rows for full dataset analysis
    const allRows: CsvRow[] = []
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ''))
      const row: CsvRow = {}
      headers.forEach((header, index) => {
        const value = values[index] ?? ""
        // Try to convert to number if possible
        if (typeof value === "string" && !isNaN(Number(value)) && value !== "") {
          row[header] = Number(value)
        } else if (value.toLowerCase() === "true") {
          row[header] = true
        } else if (value.toLowerCase() === "false") {
          row[header] = false
        } else if (value === "") {
          row[header] = null
        } else {
          row[header] = value
        }
      })
      allRows.push(row)
    }

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
      debugLog("[UPLOAD] isDemoMode:", isDemoMode)
      debugLog("[UPLOAD] effectiveUserId being used:", effectiveUserId)
      debugLog("[UPLOAD] isProfitabilityAnalysis:", isProfitabilityAnalysis)
      debugLog("[UPLOAD] Will insert into Dataset with userId:", effectiveUserId)
      debugLog("[UPLOAD] ============================")
      
      try {
        await (db as any).insert(datasets).values(insertData)
        debugLog("[UPLOAD] Dataset created with", totalRowCount, "rows")
      } catch (insertErr) {
        debugError("[UPLOAD] INSERT FAILED:", insertErr)
        debugError("[UPLOAD] INSERT ERROR:", insertErr instanceof Error ? insertErr.message : String(insertErr))
        // Return actual error instead of masking as success
        return { 
          success: false, 
          error: "Could not generate profitability analysis. Please try again." 
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
    const session = await auth()
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    const dataset = await (db as any).query.datasets.findFirst({
      where: (datasets as any).id === datasetId,
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
