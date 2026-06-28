import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export function parseCSVFileBrowser(file: File): Promise<{
  rows: any[]
  columns: string[]
  rowCount: number
  columnCount: number
}> {
  return new Promise((resolve, reject) => {
    const fileName = file.name.toLowerCase()
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
    
    // Handle Excel files
    if (isExcel) {
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