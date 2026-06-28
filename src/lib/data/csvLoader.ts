/**
 * CSV/Excel Loader
 * 
 * Parses CSV and Excel files.
 * Used by the dataset engine for CSV/Excel processing.
 */

import Papa from 'papaparse'
import * as XLSX from 'xlsx'

/**
 * Parse CSV file from file path (Node.js)
 * @param filePath - Path to the CSV or Excel file
 */
export function parseCSVFile(filePath: string): {
  rows: any[]
  columns: string[]
  rowCount: number
  columnCount: number
} {
  const fs = require('fs')
  const file = fs.readFileSync(filePath, 'utf8')
  
  // Check if file is Excel
  if (filePath.endsWith('.xlsx') || filePath.endsWith('.xls')) {
    const workbook = XLSX.read(file, { type: 'buffer' })
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
    
    if (json.length === 0) return {
      rows: [],
      columns: [],
      rowCount: 0,
      columnCount: 0
    }
    
    const columns = json[0] as string[]
    const rows = json.slice(1).map((row) => {
      const obj: Record<string, any> = {}
      columns.forEach((col, i) => {
        obj[col] = row[i]
      })
      return obj
    })
    
    return {
      rows,
      columns,
      rowCount: rows.length,
      columnCount: columns.length
    }
  }
  
  // Parse CSV
  const parsed = Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true
  })
  
  const columns = parsed.meta.fields || []
  
  return {
    rows: parsed.data,
    columns,
    rowCount: parsed.data.length,
    columnCount: columns.length
  }
}

/**
 * Parse CSV/Excel from string content
 * @param csvContent - CSV or Excel string content
 * @param isExcel - Whether the content is Excel (base64)
 */
export function parseCSVString(csvContent: string, isExcel?: boolean): {
  rows: any[]
  columns: string[]
  rowCount: number
  columnCount: number
} {
  if (isExcel) {
    const workbook = XLSX.read(csvContent, { type: 'base64' })
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
    
    if (json.length === 0) return {
      rows: [],
      columns: [],
      rowCount: 0,
      columnCount: 0
    }
    
    const columns = json[0] as string[]
    const rows = json.slice(1).map((row) => {
      const obj: Record<string, any> = {}
      columns.forEach((col, i) => {
        obj[col] = row[i]
      })
      return obj
    })
    
    return {
      rows,
      columns,
      rowCount: rows.length,
      columnCount: columns.length
    }
  }
  
  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true
  })
  
  const columns = parsed.meta.fields || []
  
  return {
    rows: parsed.data,
    columns,
    rowCount: parsed.data.length,
    columnCount: columns.length
  }
}

/**
 * Parse CSV/Excel from File object (Browser)
 * @param file - File object from input
 */
export function parseCSVFileBrowser(file: File): Promise<{
  rows: any[]
  columns: string[]
  rowCount: number
  columnCount: number
}> {
  return new Promise((resolve, reject) => {
    const fileName = file.name.toLowerCase()
    
    // Handle Excel files
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = e.target?.result
          const workbook = XLSX.read(data, { type: 'binary' })
          const firstSheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[firstSheetName]
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
          
          if (json.length === 0) {
            resolve({
              rows: [],
              columns: [],
              rowCount: 0,
              columnCount: 0
            })
            return
          }
          
          const columns = json[0] as string[]
          const rows = json.slice(1).map((row) => {
            const obj: Record<string, any> = {}
            columns.forEach((col, i) => {
              obj[col] = row[i]
            })
            return obj
          })
          
          resolve({
            rows,
            columns,
            rowCount: rows.length,
            columnCount: columns.length
          })
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = (error) => reject(error)
      reader.readAsBinaryString(file)
      return
    }
    
    // Handle CSV files
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        const columns = results.meta.fields || []
        resolve({
          rows: results.data,
          columns,
          rowCount: results.data.length,
          columnCount: columns.length
        })
      },
      error: (error) => {
        reject(error)
      }
    })
  })
}

/**
 * Validate CSV data
 * @param data - Parsed CSV data
 */
export function validateCSVData(data: {
  rows: any[];
  columns: string[];
  rowCount: number;
  columnCount: number;
}): { valid: boolean; error?: string } {
  if (!data.rows || data.rows.length === 0) {
    return { valid: false, error: 'Dataset contains no rows' };
  }

  if (!data.columns || data.columns.length === 0) {
    return { valid: false, error: 'Dataset contains no columns' };
  }

  return { valid: true };
}

export interface AggregatedMetrics {
  rowCount: number
  numericMetrics: Record<string, {
    sum: number
    count: number
    min: number
    max: number
    avg: number
  }>
  categoryMetrics: Record<string, {
    values: Record<string, number>
    topValues: { value: string; count: number }[]
  }>
  missingValueCounts: Record<string, number>
}

export interface StreamingParseResult {
  columns: string[]
  columnCount: number
  rowCount: number
  previewRows: any[]
  aggregatedMetrics: AggregatedMetrics | null
  exceedsLimit: boolean
  limit: number
}

const PREVIEW_ROW_COUNT = 100

export async function parseCSVStreaming(
  file: File,
  rowLimit: number,
  onProgress?: (rowCount: number) => void
): Promise<StreamingParseResult> {
  const fileName = file.name.toLowerCase()
  const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')

  if (isExcel) {
    return parseExcelStreaming(file, rowLimit, onProgress)
  }

  return new Promise((resolve, reject) => {
    const columns: string[] = []
    let columnCount = 0
    let rowCount = 0
    const previewRows: any[] = []
    const aggregatedMetrics: AggregatedMetrics = {
      rowCount: 0,
      numericMetrics: {},
      categoryMetrics: {},
      missingValueCounts: {},
    }
    let headersFound = false

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      step: (results, parser) => {
        if (!headersFound && results.meta.fields) {
          columns.push(...results.meta.fields)
          columnCount = columns.length
          headersFound = true
          for (const col of columns) {
            aggregatedMetrics.numericMetrics[col] = { sum: 0, count: 0, min: Infinity, max: -Infinity, avg: 0 }
            aggregatedMetrics.categoryMetrics[col] = { values: {}, topValues: [] }
            aggregatedMetrics.missingValueCounts[col] = 0
          }
        }

        if (results.data && Object.keys(results.data).length > 0) {
          rowCount++
          aggregatedMetrics.rowCount = rowCount

          if (previewRows.length < PREVIEW_ROW_COUNT) {
            previewRows.push(results.data)
          }

          for (const col of columns) {
            const rowData = results.data as Record<string, unknown>
            const value: unknown = rowData[col]
            if (value === null || value === undefined || value === '') {
              aggregatedMetrics.missingValueCounts[col] = (aggregatedMetrics.missingValueCounts[col] || 0) + 1
              continue
            }

            const numValue = typeof value === 'number' ? value : parseFloat(String(value))
            if (!isNaN(numValue) && isFinite(numValue)) {
              const metrics = aggregatedMetrics.numericMetrics[col]
              metrics.sum += numValue
              metrics.count++
              metrics.min = Math.min(metrics.min, numValue)
              metrics.max = Math.max(metrics.max, numValue)
              metrics.avg = metrics.sum / metrics.count
            } else {
              const strValue = String(value)
              const catMetrics = aggregatedMetrics.categoryMetrics[col]
              catMetrics.values[strValue] = (catMetrics.values[strValue] || 0) + 1
            }
          }

          if (onProgress && rowCount % 1000 === 0) {
            onProgress(rowCount)
          }
        }

        if (rowLimit > 0 && rowCount >= rowLimit) {
          parser.abort()
        }
      },
      complete: () => {
        for (const col of columns) {
          const catMetrics = aggregatedMetrics.categoryMetrics[col]
          if (catMetrics && Object.keys(catMetrics.values).length > 0) {
            catMetrics.topValues = Object.entries(catMetrics.values)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([value, count]) => ({ value, count }))
          }
        }

        resolve({
          columns,
          columnCount,
          rowCount,
          previewRows,
          aggregatedMetrics,
          exceedsLimit: rowLimit > 0 && rowCount > rowLimit,
          limit: rowLimit,
        })
      },
      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`))
      },
    })
  })
}

async function parseExcelStreaming(
  file: File,
  rowLimit: number,
  onProgress?: (rowCount: number) => void
): Promise<StreamingParseResult> {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const firstSheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[firstSheetName]

  const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

  if (json.length === 0) {
    return {
      columns: [],
      columnCount: 0,
      rowCount: 0,
      previewRows: [],
      aggregatedMetrics: null,
      exceedsLimit: false,
      limit: rowLimit,
    }
  }

  const columns = json[0].map(String)
  const columnCount = columns.length
  const dataRows = json.slice(1)

  const aggregatedMetrics: AggregatedMetrics = {
    rowCount: 0,
    numericMetrics: {},
    categoryMetrics: {},
    missingValueCounts: {},
  }

  for (const col of columns) {
    aggregatedMetrics.numericMetrics[col] = { sum: 0, count: 0, min: Infinity, max: -Infinity, avg: 0 }
    aggregatedMetrics.categoryMetrics[col] = { values: {}, topValues: [] }
    aggregatedMetrics.missingValueCounts[col] = 0
  }

  const previewRows: any[] = []
  const actualRowLimit = rowLimit > 0 ? Math.min(rowLimit, dataRows.length) : dataRows.length

    for (let i = 0; i < dataRows.length; i++) {
    const row: any[] = dataRows[i]
    if (i < actualRowLimit) {
      const rowObj: Record<string, any> = {}
      columns.forEach((col, idx) => {
        rowObj[col] = row[idx]
      })
      if (previewRows.length < PREVIEW_ROW_COUNT) {
        previewRows.push(rowObj)
      }
    }

    aggregatedMetrics.rowCount = i + 1

    for (let j = 0; j < columns.length; j++) {
      const col = columns[j]
      const value: unknown = row[j]

      if (value === null || value === undefined || value === '') {
        aggregatedMetrics.missingValueCounts[col] = (aggregatedMetrics.missingValueCounts[col] || 0) + 1
        continue
      }

      const numValue = typeof value === 'number' ? value : parseFloat(String(value))
      if (!isNaN(numValue) && isFinite(numValue)) {
        const metrics = aggregatedMetrics.numericMetrics[col]
        metrics.sum += numValue
        metrics.count++
        metrics.min = Math.min(metrics.min, numValue)
        metrics.max = Math.max(metrics.max, numValue)
        metrics.avg = metrics.sum / metrics.count
      } else {
        const strValue = String(value)
        const catMetrics = aggregatedMetrics.categoryMetrics[col]
        catMetrics.values[strValue] = (catMetrics.values[strValue] || 0) + 1
      }
    }

    if (onProgress && (i + 1) % 1000 === 0) {
      onProgress(i + 1)
    }
  }

  for (const col of columns) {
    const catMetrics = aggregatedMetrics.categoryMetrics[col]
    if (catMetrics && Object.keys(catMetrics.values).length > 0) {
      catMetrics.topValues = Object.entries(catMetrics.values)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([value, count]) => ({ value, count }))
    }
  }

  return {
    columns,
    columnCount,
    rowCount: aggregatedMetrics.rowCount,
    previewRows,
    aggregatedMetrics,
    exceedsLimit: rowLimit > 0 && aggregatedMetrics.rowCount > rowLimit,
    limit: rowLimit,
  }
}

export function computePrecomputedMetrics(rows: any[], columns: string[]): AggregatedMetrics {
  const metrics: AggregatedMetrics = {
    rowCount: rows.length,
    numericMetrics: {},
    categoryMetrics: {},
    missingValueCounts: {},
  }

  for (const col of columns) {
    metrics.numericMetrics[col] = { sum: 0, count: 0, min: Infinity, max: -Infinity, avg: 0 }
    metrics.categoryMetrics[col] = { values: {}, topValues: [] }
    metrics.missingValueCounts[col] = 0
  }

  for (const row of rows) {
    for (const col of columns) {
      const value = row[col]
      if (value === null || value === undefined || value === '') {
        metrics.missingValueCounts[col] = (metrics.missingValueCounts[col] || 0) + 1
        continue
      }

      const numValue = typeof value === 'number' ? value : parseFloat(String(value))
      if (!isNaN(numValue) && isFinite(numValue)) {
        const m = metrics.numericMetrics[col]
        m.sum += numValue
        m.count++
        m.min = Math.min(m.min, numValue)
        m.max = Math.max(m.max, numValue)
        m.avg = m.sum / m.count
      } else {
        const strValue = String(value)
        const catMetrics = metrics.categoryMetrics[col]
        catMetrics.values[strValue] = (catMetrics.values[strValue] || 0) + 1
      }
    }
  }

  for (const col of columns) {
    const catMetrics = metrics.categoryMetrics[col]
    if (catMetrics && Object.keys(catMetrics.values).length > 0) {
      catMetrics.topValues = Object.entries(catMetrics.values)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([value, count]) => ({ value, count }))
    }
  }

  return metrics
}
