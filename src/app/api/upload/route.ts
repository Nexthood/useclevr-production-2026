import { debugError, debugLog } from "@/lib/debug"

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { datasets, users } from '@/lib/db/schema'
import { consumeAnalystCredit, requireAnalystCredit } from '@/lib/usage/analyst-credits'
import { eq } from 'drizzle-orm'
import { promises as fs } from 'fs'
import { NextResponse } from 'next/server'
import { parse } from 'papaparse'
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
function checkExecutionLoop(commandKey: string, args: string): { allowed: boolean; message?: string } {
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
 * Detect CSV delimiter by analyzing first few lines
 */
function detectDelimiter(text: string): string {
  const firstLines = text.split('\n').slice(0, 5).join('\n')

  const delimiters = [',', ';', '\t', '|']
  const counts = delimiters.map(d => ({
    delimiter: d,
    count: (firstLines.match(new RegExp(d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
  }))

  const best = counts.reduce((a, b) => a.count > b.count ? a : b)

  debugLog('[DELIMITER] Delimiter counts:', counts.map(c => `${c.delimiter}: ${c.count}`).join(', '))
  debugLog('[DELIMITER] Selected:', best.delimiter === '\t' ? 'tab' : best.delimiter)

  return best.delimiter
}

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
          where: eq((users as any).email, 'demo@useclever.app'),
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

    // Get file
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'Only CSV files allowed' }, { status: 400 })
    }

    debugLog('[UPLOAD] Parsing CSV')

    // Read file
    const fileBuffer = await file.arrayBuffer()
    const fileText = Buffer.from(fileBuffer).toString('utf-8')

    debugLog('[UPLOAD] File size:', file.size, 'bytes')
    debugLog('[UPLOAD] File text length:', fileText.length, 'chars')
    debugLog('[UPLOAD] First 200 chars:', fileText.slice(0, 200))

    // Detect delimiter
    const delimiter = detectDelimiter(fileText)

    // Parse CSV with robust options for handling messy files
    const parseResult = parse<any>(fileText, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: true,
      transformHeader: (h: string) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      delimiter: delimiter,
    });

    debugLog('Parsed rows:', parseResult.data.length, 'First row:', parseResult.data[0]);
    debugLog('[PARSER] Headers detected:', parseResult.meta.fields?.length || 0);

    const rawRows = parseResult.data as any[]
    const headers = parseResult.meta.fields || []

    // Validate
    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'CSV has no data rows' }, { status: 400 })
    }

    if (headers.length === 0) {
      return NextResponse.json({ error: 'CSV has no headers detected' }, { status: 400 })
    }

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

    // Build dataset values - includes full data
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
      data: processed, // Store full data in database
      status: 'ready',
      analysis: {},
      createdAt: now,
      updatedAt: now,
    }

    debugLog('[UPLOAD] =============================================')
    debugLog('[UPLOAD] Saving METADATA only (no data column)')
    debugLog('[UPLOAD] Payload keys:', Object.keys(datasetValues))
    debugLog('[UPLOAD] NOTE: Data processed in-memory, not stored in DB')
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

    // SKIP: datasetRows insertion - data is processed in-memory with DuckDB
    // Analysis will be done separately via /api/datasets/[id]/analyze
    debugLog('[UPLOAD] Skipping datasetRows insertion - data processed in-memory')

    // ============================================================================
    // UPLOAD COMPLETE - Metadata stored, data processed in-memory
    // ============================================================================
    // Data is processed with DuckDB for analysis
    // User must explicitly request analysis via /api/datasets/[id]/analyze
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
    debugLog('[UPLOAD] Inserted rows: 0 (metadata only)')
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
      message: 'Upload successful - Dataset stored in database. Use /api/datasets/[id]/analyze to analyze.',
    })

  } catch (error: any) {
    debugError('[UPLOAD] Error:', error)
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
  }
}
