/**
 * CSV Loader
 * 
 * Parses CSV files using PapaParse.
 * Used by the dataset engine for CSV processing.
 */

import Papa from 'papaparse';

/**
 * Parse CSV file from file path (Node.js)
 * @param filePath - Path to the CSV file
 */
export function parseCSVFile(filePath: string): {
  rows: any[];
  columns: string[];
  rowCount: number;
  columnCount: number;
} {
  const fs = require('fs');
  const file = fs.readFileSync(filePath, 'utf8');
  
  const parsed = Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true
  });
  
  const columns = parsed.meta.fields || [];
  
  return {
    rows: parsed.data,
    columns,
    rowCount: parsed.data.length,
    columnCount: columns.length
  };
}

/**
 * Parse CSV from string content
 * @param csvContent - CSV string content
 */
export function parseCSVString(csvContent: string): {
  rows: any[];
  columns: string[];
  rowCount: number;
  columnCount: number;
} {
  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true
  });
  
  const columns = parsed.meta.fields || [];
  
  return {
    rows: parsed.data,
    columns,
    rowCount: parsed.data.length,
    columnCount: columns.length
  };
}

/**
 * Parse CSV from File object (Browser)
 * @param file - File object from input
 */
export function parseCSVFileBrowser(file: File): Promise<{
  rows: any[];
  columns: string[];
  rowCount: number;
  columnCount: number;
}> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        const columns = results.meta.fields || [];
        resolve({
          rows: results.data,
          columns,
          rowCount: results.data.length,
          columnCount: columns.length
        });
      },
      error: (error) => {
        reject(error);
      }
    });
  });
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
