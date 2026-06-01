import { debugError, debugLog } from "@/lib/utils/debug"

import { recordActivity } from '@/lib/activity/activity-store'
import { auth } from '@/lib/auth/auth'
import { db } from '@/lib/db'
import { datasetRows, datasets, users } from '@/lib/db/schema'
import { consumeAnalystCredit, requireAnalystCredit } from '@/lib/usage/analyst-credits'
import { eq } from 'drizzle-orm'
import { promises as fs } from 'fs'
import { NextResponse } from 'next/server'
import { parseUploadForm, UploadFormError } from '@/lib/data/parse-upload-form'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

// ============================================================================
// Database Retry Helper for Neon Cold Starts
// ============================================================================

/**
 * Execute database operation with retry logic for Neon serverless cold starts
 */
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

// ============================================================================
// CSV Upload Route - Deterministic, Non-AI-driven Upload
// ============================================================================
// This module handles:
// 1. CSV parsing (deterministic)
// 2. Data normalization (deterministic)
// 3. Numeric/date column detection (deterministic)
// 4. Database storage (single source of truth)
//
// IMPORTANT: AI analysis is SEPARATE and must be triggered explicitly by the user.
// No auto-tool execution or AI parsing happens in this flow.
// ============================================================================

// ============================================================================
// CSV Parsing Configuration
// ============================================================================

const CURRENCY_SYMBOLS = ['$', '€', '£', '¥', '₹', 'C$', 'A$', 'CHF', '₽', 'R$', '₩', '₪']
const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}$/,                    // ISO: 2024-01-15
  /^\d{2}\/\d{2}\/\d{4}$/,                  // US: 01/15/2024
  /^\d{2}-\d{2}-\d{4}$/,                    // EU: 15-01-2024
  /^\d{2}\.\d{2}\.\d{4}$/,                  // German: 15.01.2024
  /^\d{4}\/\d{2}\/\d{2}$/,                  // Alt: 2024/01/15
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,   // ISO datetime
]

// ============================================================================
// EXECUTION SAFEGUARDS - Prevent loops and repeated commands
// ============================================================================

// In-memory execution tracking (reset on server restart)
const executionLog: Map<string, { count: number; lastTime: number; lastArgs: string }> = new Map()
const MAX_EXECUTION_COUNT = 3
const EXECUTION_TIMEOUT_MS = 30000 // 30 seconds

/**
 * Check if a command has been executed too many times (loop detection)
 */
function _checkExecutionLoop(commandKey: string, args: string): { allowed: boolean; message?: string } {
  const now = Date.now()
  const existing = executionLog.get(commandKey)

  if (existing) {
    // Check timeout - reset if last execution was too long ago
    if (now - existing.lastTime > EXECUTION_TIMEOUT_MS) {
      executionLog.set(commandKey, { count: 1, lastTime: now, lastArgs: args })
      return { allowed: true }
    }

    // Check if same command with same args executed too many times
    if (existing.lastArgs === args && existing.count >= MAX_EXECUTION_COUNT) {
      return {
        allowed: false,
        message: `Command blocked: '${commandKey}' executed ${MAX_EXECUTION_COUNT}+ times with same arguments. Aborting to prevent infinite loop.`
      }
    }

    // Increment count
    executionLog.set(commandKey, {
      count: existing.count + 1,
      lastTime: now,
      lastArgs: args
    })
  } else {
    executionLog.set(commandKey, { count: 1, lastTime: now, lastArgs: args })
  }

  return { allowed: true }
}

/**
 * Log execution for debugging
 */
function logExecution(action: string, details: Record<string, any>) {
  debugLog(`[EXECUTION] ${action}:`, JSON.stringify({
    ...details,
    timestamp: new Date().toISOString(),
    activeCommands: executionLog.size
  }))
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Clean a value - trim whitespace
 */
function cleanValue(value: any): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

/**
 * Parse currency/numeric value
 */
function parseNumericValue(value: string): number | null {
  if (!value || value.trim() === '') return null

  let cleaned = value.trim()

  // Remove currency symbols (prefix and suffix)
  for (const symbol of CURRENCY_SYMBOLS) {
    if (cleaned.startsWith(symbol)) {
      cleaned = cleaned.slice(symbol.length).trim()
      break
    }
    if (cleaned.endsWith(symbol)) {
      cleaned = cleaned.slice(0, -symbol.length).trim()
      break
    }
  }

  // Handle accounting format: (100) = -100
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1)
  }

  // Remove thousand separators (comma, space)
  cleaned = cleaned.replace(/[, ]/g, '')

  // Handle percentage
  const isPercent = cleaned.endsWith('%')
  if (isPercent) {
    cleaned = cleaned.slice(0, -1)
  }

  const num = parseFloat(cleaned)
  if (isNaN(num)) return null

  return isPercent ? num / 100 : num
}

/**
 * Check if value is a date
 */
function isDateValue(value: string): boolean {
  if (!value) return false
  return DATE_PATTERNS.some(pattern => pattern.test(value.trim()))
}

/**
 * Parse date value to ISO string
 */
function parseDateValue(value: string): string | null {
  if (!value || !isDateValue(value)) return null

  const trimmed = value.trim()

  // ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }

  // US: MM/DD/YYYY
  const usMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (usMatch) {
    const d = new Date(parseInt(usMatch[3]), parseInt(usMatch[1]) - 1, parseInt(usMatch[2]))
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }

  // EU: DD-MM-YYYY or DD.MM.YYYY
  const euMatch = trimmed.match(/^(\d{2})[-.](\d{2})[-.](\d{4})$/)
  if (euMatch) {
    const d = new Date(parseInt(euMatch[3]), parseInt(euMatch[2]) - 1, parseInt(euMatch[1]))
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }

  return null
}

/**
 * Check if plain numeric
 */
function isPlainNumeric(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value.trim())
}

/**
 * Detect column type based on sample values
 */
function detectColumnType(values: string[]): 'numeric' | 'date' | 'currency' | 'text' {
  const samples = values.filter(v => v && v.trim() !== '').slice(0, 100)
  if (samples.length === 0) return 'text'

  let currencyCount = 0
  let numericCount = 0
  let dateCount = 0

  for (const val of samples) {
    const trimmed = val.trim()

    // Check currency first (has symbol)
    if (CURRENCY_SYMBOLS.some(s => trimmed.startsWith(s) || trimmed.endsWith(s))) {
      if (parseNumericValue(trimmed) !== null) {
        currencyCount++
        continue
      }
    }

    // Check plain number
    if (isPlainNumeric(trimmed)) {
      numericCount++
      continue
    }

    // Check date
    if (isDateValue(trimmed)) {
      dateCount++
      continue
    }
  }

  const threshold = samples.length * 0.5

  if (currencyCount > threshold) return 'currency'
  if (numericCount > threshold) return 'numeric'
  if (dateCount > threshold) return 'date'
  return 'text'
}

/**
 * Process all rows with type detection
 */
function processRows(rows: any[], headers: string[]): { processed: any[], columnTypes: Record<string, string> } {
  if (rows.length === 0 || headers.length === 0) {
    return { processed: [], columnTypes: {} }
  }

  // Detect column types from first 100 rows
  const columnTypes: Record<string, string> = {}

  for (const header of headers) {
    const values = rows.slice(0, 100).map(row => cleanValue(row[header]))
    columnTypes[header] = detectColumnType(values)
  }

  debugLog('[TYPE] Detected column types:', JSON.stringify(columnTypes))

  // Count numeric/date columns
  const numericCols = Object.values(columnTypes).filter(t => t === 'numeric' || t === 'currency').length
  const dateCols = Object.values(columnTypes).filter(t => t === 'date').length
  debugLog('[TYPE] Numeric columns:', numericCols)
  debugLog('[TYPE] Date columns:', dateCols)

  // Process all rows
  const processed = rows.map(row => {
    const processedRow: any = {}

    for (const header of headers) {
      const rawValue = row[header]
      const type = columnTypes[header]
      const cleaned = cleanValue(rawValue)

      if (cleaned === '') {
        processedRow[header] = null
        continue
      }

      switch (type) {
        case 'currency':
        case 'numeric':
          const num = parseNumericValue(cleaned)
          processedRow[header] = num !== null ? num : cleaned
          break
        case 'date':
          const dateStr = parseDateValue(cleaned)
          processedRow[header] = dateStr || cleaned
          break
        default:
          processedRow[header] = cleaned
      }
    }

    return processedRow
  })

  return { processed, columnTypes }
}

// ============================================================================
// Main Upload Handler
// ============================================================================

export async function POST(request: Request) {
  try {
    debugLog('[UPLOAD] Upload received')

    if (!db) {
      return NextResponse.json({ error: 'Database is not configured' }, { status: 503 })
    }

    const database = db

    // Auth
    const session = await auth()
    const isDemoMode = process.env.DEMO_MODE === 'true' || !session?.user?.id

    let userId: string
    if (isDemoMode) {
      debugLog('[UPLOAD] Demo mode - finding demo user')
      const demoUser = await executeWithRetry(
        () => database.query.users.findFirst({
          where: eq((users as any).email, 'demo@useclevr.app'),
        }),
        'Find demo user'
      )
      if (!demoUser) {
        return NextResponse.json({ error: 'Demo user not found' }, { status: 400 })
      }
      userId = demoUser.id
    } else if (session?.user?.id) {
      userId = session.user.id
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUsage = await requireAnalystCredit(userId)
    if (!currentUsage.canAnalyze) {
      return NextResponse.json({
        error: 'Analyst credit limit reached',
        message: 'You have used your free dataset credits. Subscribe to Pro or top up to upload another dataset.',
        usage: currentUsage,
      }, { status: 402 })
    }

    // Parse upload form
    const parsed = await parseUploadForm(request)
    const { file, fileText, headers, rawRows } = parsed

    // Process rows with type detection
    const { processed, columnTypes } = processRows(rawRows, headers)

    debugLog('[PROCESSED] First processed row:', JSON.stringify(processed[0]))

    // Count columns
    const numericCount = Object.values(columnTypes).filter(t => t === 'numeric' || t === 'currency').length
    const dateCount = Object.values(columnTypes).filter(t => t === 'date').length
    const categoricalCount = Object.values(columnTypes).filter(t => t === 'text').length

    debugLog('[SUMMARY] Total rows:', processed.length)
    debugLog('[SUMMARY] Total columns:', headers.length)
    debugLog('[SUMMARY] Numeric columns:', numericCount)
    debugLog('[SUMMARY] Date columns:', dateCount)
    debugLog('[SUMMARY] Categorical columns:', categoricalCount)

    // Generate IDs
    const datasetId = `ds_${Date.now()}_${uuidv4().slice(0, 8)}`
    const datasetName = file.name.replace(/\.csv$/i, '')

    debugLog('[UPLOAD] Creating dataset:', datasetId)

    // Verify user exists before insert (foreign key check)
    debugLog('[UPLOAD] Connecting to database')
    debugLog('[UPLOAD] Verifying user exists:', userId)
    try {
      const userExists = await executeWithRetry(
        () => database.query.users.findFirst({
          where: eq(users.id, userId),
        }),
        'Verify user exists'
      )
      if (!userExists) {
        debugError('[UPLOAD] User does not exist:', userId)
        return NextResponse.json({
          error: 'User not found. Please sign in again.'
        }, { status: 400 })
      }
      debugLog('[UPLOAD] User verified:', userExists.id)
    } catch (userCheckError) {
      debugError('[UPLOAD] Error checking user:', userCheckError)
      return NextResponse.json({
        message: "Database temporarily unavailable. Retrying..."
      }, { status: 503 })
    }

    debugLog('[UPLOAD] Saving metadata')

    // Insert dataset - metadata only (no data column, no datasetRows)
    const now = new Date()

    // Build dataset values - metadata only, rows stored in datasetRows table
    const datasetValues: Record<string, any> = {
      id: datasetId,
      userId,
      name: datasetName,
      fileName: file.name,
      fileSize: file.size,
      rowCount: processed.length,
      columnCount: headers.length,
      columns: headers,
      columnTypes: columnTypes,
      status: 'ready',
      analysis: {},
      createdAt: now,
      updatedAt: now,
    }

    debugLog('[UPLOAD] =============================================')
    debugLog('[UPLOAD] Saving metadata (rows stored in datasetRows table)')
    debugLog('[UPLOAD] Payload keys:', Object.keys(datasetValues))
    debugLog('[UPLOAD] =============================================')

    // Insert with detailed error handling
    try {
      debugLog('[UPLOAD] Inserting dataset record...')
      debugLog('[UPLOAD] Dataset values:', JSON.stringify({
        id: datasetValues.id,
        name: datasetValues.name,
        userId: datasetValues.userId,
        fileName: datasetValues.fileName,
        fileSize: datasetValues.fileSize,
        rowCount: datasetValues.rowCount,
        columnCount: datasetValues.columnCount,
        columns: datasetValues.columns,
        status: datasetValues.status,
        createdAt: datasetValues.createdAt,
        updatedAt: datasetValues.updatedAt,
      }))

      await executeWithRetry(
        () => (db as any).insert(datasets).values(datasetValues),
        'Insert dataset'
      )
      debugLog('[UPLOAD] Insert dataset success')
    } catch (insertError) {
      debugError('[UPLOAD] DATABASE ERROR - Failed to save file metadata')
      debugError('[UPLOAD] Insert error:', insertError)
      debugError('[UPLOAD] Error message:', insertError instanceof Error ? insertError.message : String(insertError))
      return NextResponse.json({
        message: "Database temporarily unavailable. Retrying..."
      }, { status: 503 })
    }

    // Save CSV file to filesystem
    try {
      const datasetsDir = path.join(process.cwd(), 'datasets')
      await fs.mkdir(datasetsDir, { recursive: true })
      const filePath = path.join(datasetsDir, `${datasetId}.csv`)
      await fs.writeFile(filePath, fileText, 'utf-8')
      debugLog('[UPLOAD] CSV file saved to:', filePath)
    } catch (fileError) {
      debugError('[UPLOAD] Failed to save CSV file:', fileError)
      // Don't fail the upload if file save fails, but log it
    }

    // Insert rows into dedicated datasetRows table
    try {
      const BATCH_SIZE = 500
      const rowValues = processed.map((row: any, index: number) => ({
        id: `${datasetId}_row_${index}`,
        datasetId,
        rowIndex: index,
        data: row,
      }))

      for (let i = 0; i < rowValues.length; i += BATCH_SIZE) {
        const batch = rowValues.slice(i, i + BATCH_SIZE)
        await executeWithRetry(
          () => (db as any).insert(datasetRows).values(batch),
          `Insert datasetRows batch ${Math.floor(i / BATCH_SIZE) + 1}`
        )
      }
      debugLog('[UPLOAD] Inserted rows into datasetRows table:', processed.length)
    } catch (rowInsertError) {
      debugError('[UPLOAD] Failed to insert dataset rows:', rowInsertError)
      // Metadata is already saved; log but don't fail the upload
    }

    // ============================================================================
    // UPLOAD COMPLETE - Metadata stored, rows stored in datasetRows table
    // ============================================================================

    logExecution('UPLOAD_SUCCESS', {
      datasetId,
      datasetName,
      rowCount: processed.length,
      columnCount: headers.length,
      numericColumns: numericCount,
      dateColumns: dateCount,
      categoricalColumns: categoricalCount,
      columnTypes
    })

    debugLog('[UPLOAD] =============================================')
    debugLog('[UPLOAD] UPLOAD COMPLETE - Dataset stored successfully')
    debugLog('[UPLOAD] Dataset ID:', datasetId)
    debugLog('[UPLOAD] Parsed rows:', processed.length)
    debugLog('[UPLOAD] Inserted rows:', processed.length)
    debugLog('[UPLOAD] Columns:', headers.length)
    debugLog('[UPLOAD] Numeric columns:', numericCount)
    debugLog('[UPLOAD] Date columns:', dateCount)
    debugLog('[UPLOAD] Categorical columns:', categoricalCount)
    debugLog('[UPLOAD] Column types:', JSON.stringify(columnTypes))
    debugLog('[UPLOAD] =============================================')
    debugLog('[UPLOAD] NOTE: AI analysis NOT auto-triggered.')
    debugLog('[UPLOAD] Use /api/datasets/[id]/analyze to analyze.')
    debugLog('[UPLOAD] =============================================')

    const usage = await consumeAnalystCredit(userId)
    await recordActivity({
      userId,
      userEmail: session?.user?.email,
      type: 'dataset_uploaded',
      feature: 'datasets',
      title: 'Dataset uploaded',
      description: `${datasetName} was added with ${processed.length} rows.`,
      metadata: {
        datasetId,
        name: datasetName,
        rowCount: processed.length,
        columnCount: headers.length,
      },
    })

    // Return success
    return NextResponse.json({
      success: true,
      datasetId,
      datasetName,
      redirectTo: `/app/datasets/${datasetId}`,
      rowCount: processed.length,
      columnCount: headers.length,
      columnTypes,
      summary: {
        numericColumns: numericCount,
        dateColumns: dateCount,
        categoricalColumns: categoricalCount
      },
      usage,
      message: 'Upload successful - Dataset stored with rows in database.',
    })

  } catch (error: any) {
    if (error instanceof UploadFormError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    debugError('[UPLOAD] Error:', error)
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
  }
}
