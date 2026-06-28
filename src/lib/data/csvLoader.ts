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
