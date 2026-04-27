/**
 * Query Engine
 * 
 * Generates SQL queries based on user questions.
 * Uses pattern matching to identify common analysis requests.
 * Now uses actual column names from the dataset.
 */

import { getTableColumns, getDatasetInfo } from './datasetEngine';

/**
 * Generate a SQL query based on user question
 * @param question - User's natural language question
 * @param columns - Available columns in the dataset
 * @returns Generated SQL query
 */
export async function generateQuery(question: string, columns: string[] = []): Promise<string> {
  const q = question.toLowerCase();
  
  // If no columns provided, get them from dataset
  if (columns.length === 0) {
    try {
      columns = await getTableColumns();
    } catch {
      columns = [];
    }
  }
  
  console.log('[QueryEngine] Available columns:', columns);
  
  // Detect actual column names in the dataset
  const revenueCol = columns.find(c => /revenue|income|sales/i.test(c)) || 'net_revenue';
  const profitCol = columns.find(c => /profit|earnings|net.*income/i.test(c));
  const costCol = columns.find(c => /cost|expense|cogs/i.test(c));
  const regionCol = columns.find(c => /region|territory|area/i.test(c)) || 'region';
  const countryCol = columns.find(c => /country/i.test(c)) || 'country';
  const productCol = columns.find(c => /product|item|sku/i.test(c)) || 'product_category';
  const customerCol = columns.find(c => /customer|client/i.test(c));
  const dateCol = columns.find(c => /date|month|year|time/i.test(c)) || 'order_date';
  const quantityCol = columns.find(c => /quantity|qty/i.test(c)) || 'quantity';
  
  // Detect if we have these metrics
  const hasRevenue = columns.some(c => /revenue|income|sales/i.test(c));
  const hasProfit = columns.some(c => /profit|earnings|net.*income/i.test(c));
  const hasCost = columns.some(c => /cost|expense|cogs/i.test(c));
  const hasRegion = columns.some(c => /region|territory|area/i.test(c));
  const hasCountry = columns.some(c => /country/i.test(c));
  const hasProduct = columns.some(c => /product|item|sku|category/i.test(c));
  const hasCustomer = columns.some(c => /customer|client/i.test(c));
  const hasDate = columns.some(c => /date|month|year|time/i.test(c));
  
  // Most profitable / top revenue by region
  if (/most.*profitable|top.*region|top.*area|best.*region/i.test(q)) {
    if (hasRegion && hasRevenue) {
      return `
        SELECT ${regionCol}, SUM(${revenueCol}) AS total_revenue
        FROM dataset
        GROUP BY ${regionCol}
        ORDER BY total_revenue DESC
        LIMIT 10
      `;
    }
    if (hasCountry && hasRevenue) {
      return `
        SELECT ${countryCol}, SUM(${revenueCol}) AS total_revenue
        FROM dataset
        GROUP BY ${countryCol}
        ORDER BY total_revenue DESC
        LIMIT 10
      `;
    }
  }
  
  // Revenue/profit by region
  if (/by region|per region|revenue.*region|profit.*region/i.test(q)) {
    if (hasRegion && hasRevenue) {
      return `
        SELECT ${regionCol}, SUM(${revenueCol}) AS total_revenue
        FROM dataset
        GROUP BY ${regionCol}
        ORDER BY total_revenue DESC
      `;
    }
  }
  
  // Revenue/profit trends over time
  if (/trend|growth|over time|by month|by year/i.test(q)) {
    const timeCol = columns.find(c => /month/i.test(c)) || columns.find(c => /date/i.test(c));
    const metricCol = hasRevenue ? revenueCol : (hasProfit ? profitCol : null);
    
    if (timeCol && metricCol) {
      return `
        SELECT ${timeCol}, SUM(${metricCol}) AS ${metricCol}
        FROM dataset
        GROUP BY ${timeCol}
        ORDER BY ${timeCol}
      `;
    }
  }
  
  // Top performing products
  if (/top.*product|best.*product|most.*sold|top.*item|by product/i.test(q)) {
    if (hasProduct && hasRevenue) {
      return `
        SELECT ${productCol}, SUM(${revenueCol}) AS total_revenue
        FROM dataset
        GROUP BY ${productCol}
        ORDER BY total_revenue DESC
        LIMIT 10
      `;
    }
    if (hasProduct) {
      return `
        SELECT ${productCol}, COUNT(*) AS count
        FROM dataset
        GROUP BY ${productCol}
        ORDER BY count DESC
        LIMIT 10
      `;
    }
  }
  
  // Customer analysis
  if (/customer|client|segment/i.test(q)) {
    if (customerCol && hasRevenue) {
      return `
        SELECT ${customerCol}, SUM(${revenueCol}) AS total_revenue
        FROM dataset
        GROUP BY ${customerCol}
        ORDER BY total_revenue DESC
        LIMIT 20
      `;
    }
  }
  
  // Summary statistics - total revenue
  if (/summary|overview|total|total revenue|how much/i.test(q)) {
    if (hasRevenue) {
      return `SELECT SUM(${revenueCol}) AS total_revenue FROM dataset`;
    }
  }
  
  // Average / mean
  if (/average|mean|avg/i.test(q)) {
    if (hasRevenue) {
      return `SELECT AVG(${revenueCol}) AS avg_revenue FROM dataset`;
    }
  }
  
  // Count
  if (/how many|count|number of/i.test(q)) {
    return `SELECT COUNT(*) AS total_count FROM dataset`;
  }
  
  // Worst / underperforming
  if (/worst|lowest|underperform|declin/i.test(q)) {
    if (hasProduct && hasRevenue) {
      return `
        SELECT ${productCol}, SUM(${revenueCol}) AS total_revenue
        FROM dataset
        GROUP BY ${productCol}
        ORDER BY total_revenue ASC
        LIMIT 10
      `;
    }
    if (hasRegion && hasRevenue) {
      return `
        SELECT ${regionCol}, SUM(${revenueCol}) AS total_revenue
        FROM dataset
        GROUP BY ${regionCol}
        ORDER BY total_revenue ASC
        LIMIT 10
      `;
    }
  }
  
  // Distribution / breakdown by region
  if (/breakdown|distribution|composition|by country|by region/i.test(q)) {
    if (hasRegion) {
      return `
        SELECT ${regionCol}, SUM(${revenueCol || quantityCol}) AS value
        FROM dataset
        GROUP BY ${regionCol}
        ORDER BY value DESC
      `;
    }
    if (hasCountry) {
      return `
        SELECT ${countryCol}, SUM(${revenueCol || quantityCol}) AS value
        FROM dataset
        GROUP BY ${countryCol}
        ORDER BY value DESC
      `;
    }
    if (hasProduct) {
      return `
        SELECT ${productCol}, COUNT(*) AS count
        FROM dataset
        GROUP BY ${productCol}
        ORDER BY count DESC
      `;
    }
  }
  
  // Acquisition channel analysis
  if (/channel|source|acquisition|utm/i.test(q)) {
    const channelCol = columns.find(c => /channel|source|utm/i.test(c));
    if (channelCol && hasRevenue) {
      return `
        SELECT ${channelCol}, SUM(${revenueCol}) AS total_revenue
        FROM dataset
        GROUP BY ${channelCol}
        ORDER BY total_revenue DESC
      `;
    }
  }
  
  // Default: return sample data
  return `SELECT * FROM dataset LIMIT 50`;
}

/**
 * Generate a simple aggregation query
 */
export function generateAggregationQuery(
  groupBy: string, 
  aggregate: string, 
  metric: string,
  limit: number = 10
): string {
  const aggFunc = aggregate.toUpperCase();
  
  return `
    SELECT ${groupBy}, ${aggFunc}(${metric}) AS value
    FROM dataset
    GROUP BY ${groupBy}
    ORDER BY value DESC
    LIMIT ${limit}
  `;
}

/**
 * Detect chart type based on query result
 */
export function detectChartType(query: string, result: any[]): 'bar' | 'line' | 'pie' | 'table' {
  const q = query.toLowerCase();
  
  // Line chart for time trends
  if (/trend|over time|month|year|growth|increase/i.test(q)) {
    return 'line';
  }
  
  // Pie chart for distribution/breakdown (when few categories)
  if ((/distribution|breakdown|composition|percentage/i.test(q)) && result.length <= 8) {
    return 'pie';
  }
  
  // Bar chart for comparisons (top/bottom lists)
  if (/top|most|best|worst|lowest|by region|by product/i.test(q)) {
    return 'bar';
  }
  
  // Default to bar for ranking queries
  if (/order by.*desc|order by.*asc/i.test(q) && result.length <= 15) {
    return 'bar';
  }
  
  // Default to table for complex queries
  return 'table';
}

/**
 * Determine the primary metric column from results
 */
export function detectMetricColumn(result: any[]): string | null {
  if (!result || result.length === 0) return null;
  
  const firstRow = result[0];
  const columns = Object.keys(firstRow);
  
  // Look for common metric names
  const metricNames = ['revenue', 'profit', 'sales', 'amount', 'total', 'count', 'value', 'sum'];
  
  for (const col of columns) {
    const lowerCol = col.toLowerCase();
    if (metricNames.some(m => lowerCol.includes(m))) {
      return col;
    }
  }
  
  // Return the first numeric column
  for (const col of columns) {
    const val = firstRow[col];
    if (typeof val === 'number') {
      return col;
    }
  }
  
  return columns[columns.length - 1];
}

// ---------------------------------------------------------------------------
// Back-compat export surface expected by existing imports
// Minimal shims to satisfy TypeScript without altering runtime flows.
// ---------------------------------------------------------------------------

// Dataset schema shape expected by queryIntentPrompt
export type DatasetSchema = {
  name: string;
  rowCount: number;
  columns: string[];
  // Basic typing categories used by query intent helpers
  columnTypes: Record<string, 'numeric' | 'text' | 'date' | string>;
};

// Supported operation names referenced by prompt/parser utilities
export type WhitelistedOperation =
  | 'COUNT'
  | 'COUNT_DISTINCT'
  | 'SUM'
  | 'GROUP_BY'
  | 'TOP_N'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'top_n'
  | 'count';

/** Lightweight intent type placeholder for callers that import the type only */
export type QueryIntent = unknown;

/**
 * Heuristic to decide if a question requires computation.
 * Mirrors keyword logic used at call sites; safe, side-effect free.
 */
export function requiresComputation(question: string): boolean {
  const analyticalKeywords = [
    'how many', 'how much', 'total', 'sum', 'average', 'avg', 'mean',
    'highest', 'lowest', 'maximum', 'minimum', 'max', 'min', 'top',
    'bottom', 'most', 'least', 'count', 'number of', 'percentage',
    'profit', 'revenue', 'sales', 'margin', 'region', 'country',
    'product', 'category', 'segment', 'channel'
  ];
  const q = (question || '').toLowerCase();
  return analyticalKeywords.some(k => q.includes(k));
}

/**
 * Minimal schema helper for callers expecting a dataset schema.
 * Returns detected columns from the in-memory dataset engine.
 */
export async function getDatasetSchema(_datasetId?: string): Promise<{ columns: string[] }> {
  const columns = await getTableColumns();
  return { columns };
}

/**
 * Simple query pipeline shim: builds a query string from a question and returns it.
 * This preserves callers that expect an object with `sql` and `result` fields.
 */
export async function executeQueryPipeline(question: string, columns: string[] = []): Promise<{ sql: string; result: any[] }> {
  const sql = await generateQuery(question, columns);
  return { sql, result: [] };
}
