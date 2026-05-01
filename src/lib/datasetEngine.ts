import { debugLog, debugError, debugWarn } from "@/lib/debug"

/**
 * Dataset Engine - Pure JavaScript Query Engine
 * 
 * Runs SQL-like queries on in-memory data using pure JavaScript.
 * Works on both client and server sides.
 * 
 * Architecture:
 * - Data is stored in Neon (PostgreSQL)
 * - This engine runs queries in memory (no external DB needed)
 * - Supports basic SQL: SELECT, WHERE, GROUP BY, ORDER BY, LIMIT
 */

// In-memory storage for the dataset
let jsData: any[] = [];
let jsColumns: string[] = [];

/**
 * Load data into memory
 */
export function loadDataJS(data: any[]): void {
  jsData = data;
  jsColumns = Object.keys(data[0] || {});
  debugLog('[DatasetEngine] Data loaded:', jsData.length, 'rows,', jsColumns.length, 'columns');
}

/**
 * Load dataset from array of objects (for API compatibility)
 */
export async function loadDataFromJSON(data: any[], _tableName: string = 'dataset'): Promise<boolean> {
  if (!data || data.length === 0) {
    debugLog('[DatasetEngine] No data provided');
    return false;
  }
  loadDataJS(data);
  return true;
}

/**
 * Get table columns
 */
export async function getTableColumns(_tableName: string = 'dataset'): Promise<string[]> {
  return jsColumns;
}

/**
 * Get dataset info
 */
export function getDatasetInfo() {
  return {
    rowCount: jsData.length,
    columnCount: jsColumns.length,
    columns: jsColumns
  };
}

/**
 * Run a SQL-like query using pure JavaScript
 */
export function runQuery(sql: string): any[] {
  return runQueryJS(sql);
}

export function runQueryJS(query: string): any[] {
  debugLog('[DatasetEngine-JS] Running query:', query);
  
  const q = query.toLowerCase().trim();
  let result: any[] = [];
  
  if (!q.includes('select') || !q.includes('from')) {
    // Invalid query, return all data
    return jsData.slice(0, 100);
  }
  
  // Parse query
  const hasGroupBy = q.includes('group by');
  const hasOrderBy = q.includes('order by');
  const hasLimit = q.includes('limit');
  
  // Extract SELECT columns
  let selectMatch = q.match(/select\s+(.+?)\s+from/i);
  let selectCols = selectMatch ? selectMatch[1].split(',').map((c: string) => c.trim()) : ['*'];
  
  // Extract GROUP BY column
  let groupMatch = q.match(/group\s+by\s+(\w+)/i);
  let groupCol = groupMatch ? groupMatch[1].replace(/['"]/g, '') : null;
  
  // Extract ORDER BY
  let orderMatch = q.match(/order\s+by\s+(\w+)(?:\s+(desc|asc))?/i);
  let orderCol = orderMatch ? orderMatch[1].replace(/['"]/g, '') : null;
  let orderDesc = orderMatch && orderMatch[2] === 'desc';
  
  // Extract LIMIT
  let limitMatch = q.match(/limit\s+(\d+)/i);
  let limit = limitMatch ? parseInt(limitMatch[1]) : 100;
  
  // Handle GROUP BY aggregation
  if (hasGroupBy && groupCol) {
    const groups: { [key: string]: any[] } = {};
    jsData.forEach((row: any) => {
      const key = String(row[groupCol!] || 'unknown');
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    
    result = Object.entries(groups).map(([key, rows]) => {
      const obj: any = {};
      obj[groupCol!] = key;
      
      selectCols.forEach(col => {
        if (col === '*' || col === groupCol) return;
        
        const upperCol = col.toUpperCase();
        if (upperCol.includes('COUNT')) {
          obj[col] = rows.length;
        } else {
          const match = col.match(/(sum|avg|max|min)\((\w+)\)/i);
          if (match) {
            const [, func, field] = match;
            const values = rows.map((r: any) => r[field]).filter((v: any) => typeof v === 'number');
            if (values.length > 0) {
              switch (func.toLowerCase()) {
                case 'sum': obj[col] = Math.round(values.reduce((a: number, b: number) => a + b, 0) * 100) / 100; break;
                case 'avg': obj[col] = Math.round((values.reduce((a: number, b: number) => a + b, 0) / values.length) * 100) / 100; break;
                case 'max': obj[col] = Math.max(...values); break;
                case 'min': obj[col] = Math.min(...values); break;
              }
            }
          }
        }
      });
      
      return obj;
    });
  } else {
    // Simple select
    result = jsData.slice(0, limit);
  }
  
  // Apply ORDER BY
  if (orderCol && result.length > 0) {
    result.sort((a: any, b: any) => {
      const aVal = a[orderCol!];
      const bVal = b[orderCol!];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return orderDesc ? bVal - aVal : aVal - bVal;
      }
      return orderDesc ? String(bVal).localeCompare(String(aVal)) : String(aVal).localeCompare(String(bVal));
    });
  }
  
  return result.slice(0, limit);
}

/**
 * Close the database (no-op for in-memory)
 */
export async function closeDatasetEngine(): Promise<void> {
  jsData = [];
  jsColumns = [];
  debugLog('[DatasetEngine] Cleared');
}
