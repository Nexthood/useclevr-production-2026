import Papa from 'papaparse';

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