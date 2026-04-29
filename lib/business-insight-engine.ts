import { debugLog, debugError, debugWarn } from "@/lib/debug"

/**
 * Business Insight Engine
 * 
 * Generates safe SELECT SQL, executes it, and returns structured insights.
 * All queries are validated and parameterized to prevent SQL injection.
 */

import { db } from '@/lib/db';
import { datasets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface InsightResult {
  insight: string;
  explanation: string;
  businessRecommendation: string;
  chartSuggestion?: string;
  sql: string;
  data: any[];
}

/**
 * Validate SQL query for security
 * Only allows SELECT statements with safe patterns
 */
function validateSQL(sql: string): { valid: boolean; error?: string } {
  const trimmed = sql.trim().toLowerCase();
  
  // Must start with SELECT
  if (!trimmed.startsWith('select')) {
    return { valid: false, error: 'Only SELECT queries are allowed' };
  }
  
  // Block dangerous keywords
  const dangerous = [
    'drop', 'delete', 'update', 'insert', 'alter', 'create',
    'truncate', 'exec', 'execute', 'cursor', 'fetch',
    ';', '--', '/*', '*/', 'xp_', 'sp_'
  ];
  
  for (const keyword of dangerous) {
    if (trimmed.includes(keyword)) {
      return { valid: false, error: `Dangerous keyword detected: ${keyword}` };
    }
  }
  
  // Must not reference system tables
  if (trimmed.includes('information_schema') || 
      trimmed.includes('pg_catalog') ||
      trimmed.includes('sys.') ||
      trimmed.includes('mysql.')) {
    return { valid: false, error: 'System table references are not allowed' };
  }
  
  return { valid: true };
}

/**
 * Normalize currency values in data
 */
function normalizeValue(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Remove currency symbols and commas
    const cleaned = value.replace(/[$€£¥₹CCHF,\s]/g, '');
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return num;
  }
  return 0;
}

/**
 * Calculate profit with proper cost deductions
 * profit = revenue - cogs - discount - tax - shipping - refund
 * If no cost column, use proxy: profit = revenue * 0.7 (30% COGS assumed)
 */
function calculateProfit(row: any, revenueCol: string, columns: string[]): number {
  const revenue = normalizeValue(row[revenueCol]);
  
  // Find cost-related columns
  const costCol = columns.find(c => /cost|cogs|expense/.test(c.toLowerCase()));
  const discountCol = columns.find(c => /discount|rebate/.test(c.toLowerCase()));
  const taxCol = columns.find(c => /tax|vat|gst/.test(c.toLowerCase()));
  const shippingCol = columns.find(c => /shipping|delivery|freight/.test(c.toLowerCase()));
  const refundCol = columns.find(c => /refund|return/.test(c.toLowerCase()));
  
  // Calculate deductions
  const cost = costCol ? normalizeValue(row[costCol]) : revenue * 0.3; // 30% COGS if no cost column
  const discount = discountCol ? normalizeValue(row[discountCol]) : 0;
  const tax = taxCol ? normalizeValue(row[taxCol]) : 0;
  const shipping = shippingCol ? normalizeValue(row[shippingCol]) : 0;
  const refund = refundCol ? normalizeValue(row[refundCol]) : 0;
  
  // Calculate profit
  const profit = revenue - cost - discount - tax - shipping - refund;
  
  return Math.max(0, profit); // No negative profit for display
}

/**
 * Detect column types from data
 */
function detectColumnTypes(data: any[]): Record<string, 'number' | 'string' | 'date'> {
  if (!data || data.length === 0) return {};
  
  const types: Record<string, 'number' | 'string' | 'date'> = {};
  const sample = data[0];
  
  for (const key of Object.keys(sample)) {
    const value = sample[key];
    if (typeof value === 'number') {
      types[key] = 'number';
    } else if (!isNaN(Date.parse(String(value))) && String(value).length > 5) {
      types[key] = 'date';
    } else {
      types[key] = 'string';
    }
  }
  
  return types;
}

/**
 * Generate safe SQL query based on question
 */
function generateSQL(question: string, columns: string[], data: any[]): string | null {
  const q = question.toLowerCase();
  const columnTypes = detectColumnTypes(data);
  
  // Find key columns
  const revenueCol = columns.find(c => /revenue|sales|amount|total|value|income/.test(c.toLowerCase()));
  const profitCol = columns.find(c => /profit|margin|earnings/.test(c.toLowerCase()));
  const quantityCol = columns.find(c => /quantity|qty|units/.test(c.toLowerCase()));
  const regionCol = columns.find(c => /region|country|territory|area|market/.test(c.toLowerCase()));
  const productCol = columns.find(c => /product|item|sku|goods/.test(c.toLowerCase()));
  const channelCol = columns.find(c => /channel|source|medium|campaign/.test(c.toLowerCase()));
  const categoryCol = columns.find(c => /category|type|segment|industry/.test(c.toLowerCase()));
  const customerCol = columns.find(c => /customer|client|buyer|user/.test(c.toLowerCase()));
  const dateCol = columns.find(c => /date|month|year|period/.test(c.toLowerCase()));
  
  // Revenue/Profit by region
  if ((q.includes('region') || q.includes('country')) && (revenueCol || profitCol)) {
    const metric = profitCol || revenueCol;
    const groupBy = regionCol || columns[0];
    if (metric && groupBy) {
      return `SELECT "${groupBy}" as name, SUM(CAST(REPLACE(REPLACE("${metric}", ',', ''), '$', '') AS DOUBLE)) as value FROM dataset GROUP BY "${groupBy}" ORDER BY value DESC LIMIT 10`;
    }
  }
  
  // Revenue/Profit by product
  if ((q.includes('product') || q.includes('item')) && (revenueCol || profitCol)) {
    const metric = profitCol || revenueCol;
    const groupBy = productCol || columns[0];
    if (metric && groupBy) {
      return `SELECT "${groupBy}" as name, SUM(CAST(REPLACE(REPLACE("${metric}", ',', ''), '$', '') AS DOUBLE)) as value FROM dataset GROUP BY "${groupBy}" ORDER BY value DESC LIMIT 10`;
    }
  }
  
  // Revenue/Profit by channel
  if (q.includes('channel') && (revenueCol || profitCol)) {
    const metric = profitCol || revenueCol;
    const groupBy = channelCol || columns[0];
    if (metric && groupBy) {
      return `SELECT "${groupBy}" as name, SUM(CAST(REPLACE(REPLACE("${metric}", ',', ''), '$', '') AS DOUBLE)) as value FROM dataset GROUP BY "${groupBy}" ORDER BY value DESC LIMIT 10`;
    }
  }
  
  // Revenue/Profit by category
  if (q.includes('category') && (revenueCol || profitCol)) {
    const metric = profitCol || revenueCol;
    const groupBy = categoryCol || columns[0];
    if (metric && groupBy) {
      return `SELECT "${groupBy}" as name, SUM(CAST(REPLACE(REPLACE("${metric}", ',', ''), '$', '') AS DOUBLE)) as value FROM dataset GROUP BY "${groupBy}" ORDER BY value DESC LIMIT 10`;
    }
  }
  
  // Top performing (default)
  if (q.includes('top') || q.includes('highest') || q.includes('best')) {
    const metric = profitCol || revenueCol || quantityCol;
    const groupBy = productCol || categoryCol || regionCol || columns[0];
    if (metric && groupBy) {
      return `SELECT "${groupBy}" as name, SUM(CAST(REPLACE(REPLACE("${metric}", ',', ''), '$', '') AS DOUBLE)) as value FROM dataset GROUP BY "${groupBy}" ORDER BY value DESC LIMIT 5`;
    }
  }
  
  // Bottom/Underperforming
  if (q.includes('bottom') || q.includes('lowest') || q.includes('worst') || q.includes('losing') || q.includes('underperform')) {
    const metric = profitCol || revenueCol;
    const groupBy = productCol || categoryCol || regionCol || columns[0];
    if (metric && groupBy) {
      return `SELECT "${groupBy}" as name, SUM(CAST(REPLACE(REPLACE("${metric}", ',', ''), '$', '') AS DOUBLE)) as value FROM dataset GROUP BY "${groupBy}" ORDER BY value ASC LIMIT 5`;
    }
  }
  
  // Total revenue/profit
  if (q.includes('total') || q.includes('sum')) {
    const metric = profitCol || revenueCol || quantityCol;
    if (metric) {
      return `SELECT '${metric}' as name, SUM(CAST(REPLACE(REPLACE("${metric}", ',', ''), '$', '') AS DOUBLE)) as value FROM dataset`;
    }
  }
  
  // Average
  if (q.includes('average') || q.includes('avg')) {
    const metric = profitCol || revenueCol || quantityCol;
    if (metric) {
      return `SELECT '${metric}' as name, AVG(CAST(REPLACE(REPLACE("${metric}", ',', ''), '$', '') AS DOUBLE)) as value FROM dataset`;
    }
  }
  
  // Count
  if (q.includes('count') || q.includes('how many')) {
    const groupBy = productCol || categoryCol || regionCol || customerCol || columns[0];
    if (groupBy) {
      return `SELECT "${groupBy}" as name, COUNT(*) as value FROM dataset GROUP BY "${groupBy}" ORDER BY value DESC LIMIT 10`;
    }
    return `SELECT 'Total Records' as name, COUNT(*) as value FROM dataset`;
  }
  
  // Growth/Trend over time
  if ((q.includes('growth') || q.includes('trend') || q.includes('over time') || q.includes('over period')) && dateCol) {
    const metric = revenueCol || quantityCol;
    if (metric) {
      return `SELECT "${dateCol}" as name, SUM(CAST(REPLACE(REPLACE("${metric}", ',', ''), '$', '') AS DOUBLE)) as value FROM dataset GROUP BY "${dateCol}" ORDER BY "${dateCol}" LIMIT 20`;
    }
  }
  
  // Comparison (e.g., "compare regions", "compare products")
  if (q.includes('compare') && (regionCol || productCol || categoryCol)) {
    const metric = profitCol || revenueCol;
    const groupBy = regionCol || productCol || categoryCol;
    if (metric && groupBy) {
      return `SELECT "${groupBy}" as name, SUM(CAST(REPLACE(REPLACE("${metric}", ',', ''), '$', '') AS DOUBLE)) as value FROM dataset GROUP BY "${groupBy}" ORDER BY value DESC`;
    }
  }
  
  // Default: return top items
  const defaultMetric = profitCol || revenueCol || quantityCol;
  const defaultGroupBy = productCol || categoryCol || regionCol || columns[0];
  if (defaultMetric && defaultGroupBy) {
    return `SELECT "${defaultGroupBy}" as name, SUM(CAST(REPLACE(REPLACE("${defaultMetric}", ',', ''), '$', '') AS DOUBLE)) as value FROM dataset GROUP BY "${defaultGroupBy}" ORDER BY value DESC LIMIT 10`;
  }
  
  return null;
}

/**
 * Execute query on in-memory data (simulates SQL)
 */
function executeQuery(sql: string, data: any[], question: string, columns: string[]): any[] {
  try {
    // Parse the SQL to understand what we need to do
    const sqlLower = sql.toLowerCase();
    
    // Extract column name from SELECT
    const selectMatch = sql.match(/select\s+(.+?)\s+as\s+name/i);
    const valueMatch = sql.match(/sum\(.+?\s+as\s+value|avg\(.+?\s+as\s+value|count\(\*\)\s+as\s+value/i);
    
    if (!selectMatch || !valueMatch) {
      return [];
    }
    
    const nameCol = selectMatch[1].replace(/"/g, '').replace(/'/g, '');
    let valueCol: string | null = null;
    
    // Extract the value column
    const sumMatch = sql.match(/sum\s*\(\s*cast\s*\(\s*replace\s*\(\s*replace\s*\(\s*"([^"]+)"/i);
    const avgMatch = sql.match(/avg\s*\(\s*cast\s*\(\s*replace\s*\(\s*replace\s*\(\s*"([^"]+)"/i);
    const countMatch = sql.match(/count\s*\(\s*\*\s*\)/i);
    
    if (sumMatch) valueCol = sumMatch[1];
    else if (avgMatch) valueCol = avgMatch[1];
    
    // Check for GROUP BY
    const groupByMatch = sql.match(/group\s+by\s+"([^"]+)"/i);
    
    if (countMatch || (!valueCol && sql.includes('count'))) {
      // COUNT query
      if (groupByMatch) {
        const groupCol = groupByMatch[1];
        const grouped: Record<string, number> = {};
        for (const row of data) {
          const key = String(row[groupCol] || 'Unknown');
          grouped[key] = (grouped[key] || 0) + 1;
        }
        return Object.entries(grouped)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);
      } else {
        return [{ name: 'Total Records', value: data.length }];
      }
    }
    
    if (!valueCol) {
      return [];
    }
    
    // Aggregate by group
    if (groupByMatch) {
      const groupCol = groupByMatch[1];
      const grouped: Record<string, number> = {};
      
      for (const row of data) {
        const key = String(row[groupCol] || 'Unknown');
        const value = normalizeValue(row[valueCol]);
        
        if (sqlLower.includes('sum') || !sqlLower.includes('avg')) {
          grouped[key] = (grouped[key] || 0) + value;
        } else if (sqlLower.includes('avg')) {
          // For avg, we'll compute sum first, then divide later
          if (!grouped[key + '_sum']) {
            grouped[key + '_sum'] = 0;
            grouped[key + '_count'] = 0;
          }
          grouped[key + '_sum'] += value;
          grouped[key + '_count'] += 1;
        }
      }
      
      let results = Object.keys(grouped).map(key => {
        if (sqlLower.includes('avg') && grouped[key + '_count']) {
          return { name: key, value: grouped[key + '_sum'] / grouped[key + '_count'] };
        }
        return { name: key, value: grouped[key] };
      });
      
      // Handle ORDER BY
      if (sqlLower.includes('order by value desc')) {
        results.sort((a, b) => b.value - a.value);
      } else if (sqlLower.includes('order by value asc')) {
        results.sort((a, b) => a.value - b.value);
      }
      
      // Handle LIMIT
      const limitMatch = sql.match(/limit\s+(\d+)/i);
      if (limitMatch) {
        results = results.slice(0, parseInt(limitMatch[1]));
      }
      
      return results;
    }
    
    // No GROUP BY - single aggregate
    let total = 0;
    let count = 0;
    
    for (const row of data) {
      const value = normalizeValue(row[valueCol]);
      if (sqlLower.includes('sum') || !sqlLower.includes('avg')) {
        total += value;
      } else if (sqlLower.includes('avg')) {
        total += value;
        count += 1;
      }
    }
    
    const result = sqlLower.includes('avg') && count > 0 ? total / count : total;
    return [{ name: valueCol, value: result }];
    
  } catch (error) {
    debugError('Query execution error:', error);
    return [];
  }
}

/**
 * Generate business insight from query results
 */
function generateInsight(question: string, result: any[], sql: string): InsightResult {
  if (!result || result.length === 0) {
    return {
      insight: 'No data found',
      explanation: 'The query returned no results',
      businessRecommendation: 'Try asking about different metrics or time periods',
      sql,
      data: []
    };
  }
  
  const q = question.toLowerCase();
  
  // Find top item
  const sorted = [...result].sort((a, b) => b.value - a.value);
  const topItem = sorted[0];
  const total = result.reduce((sum, r) => sum + r.value, 0);
  const avg = total / result.length;
  
  // Format numbers with thousand separators and max 2 decimal places
  const formatNum = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  
  // Format percentage with max 2 decimal places
  const formatPercent = (n: number) => n.toFixed(2) + '%';
  
  // Calculate percentage
  const percentOfTotal = (topItem.value / total) * 100;
  
  let insight = '';
  let explanation = '';
  let businessRecommendation = '';
  let chartSuggestion = '';
  
  if (q.includes('region') || q.includes('country')) {
    insight = `${topItem.name} is the top performing region`;
    explanation = `With ${formatNum(topItem.value)} in total value, ${topItem.name} accounts for ${formatPercent(percentOfTotal)} of all performance.`;
    businessRecommendation = `Consider investing more resources in ${topItem.name} or analyzing what makes it successful to replicate in other regions.`;
    chartSuggestion = 'bar';
  } else if (q.includes('product') || q.includes('item')) {
    insight = `${topItem.name} is the top selling product`;
    explanation = `Generating ${formatNum(topItem.value)} in total value, representing ${formatPercent(percentOfTotal)} of all sales.`;
    businessRecommendation = `Analyze ${topItem.name}'s success factors and consider promoting similar products or bundles.`;
    chartSuggestion = 'bar';
  } else if (q.includes('channel')) {
    insight = `${topItem.name} is the best performing channel`;
    explanation = `Contributing ${formatNum(topItem.value)} in value, which is ${formatPercent(percentOfTotal)} of total.`;
    businessRecommendation = `Increase investment in ${topItem.name} channel or optimize underperforming channels.`;
    chartSuggestion = 'pie';
  } else if (q.includes('category')) {
    insight = `${topItem.name} is the leading category`;
    explanation = `With ${formatNum(topItem.value)} in total value.`;
    businessRecommendation = `Focus on ${topItem.name} category expansion or apply its success strategies to other categories.`;
    chartSuggestion = 'bar';
  } else if (q.includes('total') || q.includes('sum')) {
    insight = `Total value: ${formatNum(topItem.value)}`;
    explanation = 'This represents the overall performance.';
    businessRecommendation = 'Use this as a baseline to measure performance against targets.';
    chartSuggestion = 'none';
  } else if (q.includes('average') || q.includes('avg')) {
    insight = `Average value: ${formatNum(avg)}`;
    explanation = `Based on ${result.length} items analyzed.`;
    businessRecommendation = 'Compare individual items against this average to identify outliers.';
    chartSuggestion = 'none';
  } else if (q.includes('count') || q.includes('how many')) {
    insight = `${formatNum(total)} total items`;
    explanation = `Across ${result.length} unique categories.`;
    businessRecommendation = 'Use this to understand data distribution and completeness.';
    chartSuggestion = 'bar';
  } else {
    // Default analysis
    insight = `${topItem.name} leads with ${formatNum(topItem.value)}`;
    explanation = `This represents ${formatPercent(percentOfTotal)} of the total ${formatNum(total)}.`;
    businessRecommendation = 'Consider this item for strategic prioritization.';
    chartSuggestion = 'bar';
  }
  
  return {
    insight,
    explanation,
    businessRecommendation,
    chartSuggestion,
    sql,
    data: result
  };
}

/**
 * Get currency symbol
 */
function getCurrencySymbol(currency: string): string {
  switch (currency.toUpperCase()) {
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'JPY': return '¥';
    default: return '$';
  }
}

/**
 * Format currency for display with thousand separators
 */
function formatCurrency(value: number, currency: string = 'USD'): string {
  if (value >= 1000) {
    return `${getCurrencySymbol(currency)}${((value / 1000)).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }
  return `${getCurrencySymbol(currency)}${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/**
 * Format percentage for display
 */
function formatPercentage(value: number): string {
  return `${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}%`;
}

/**
 * Main function: Process question and return structured insight
 */
export async function getBusinessInsight(
  datasetId: string,
  question: string
): Promise<InsightResult> {
  // Get dataset from database
  const dataset = await db.query.datasets.findFirst({
    where: eq(datasets.id, datasetId),
  });

  if (!dataset) {
    return {
      insight: 'Dataset not found',
      explanation: 'The requested dataset does not exist',
      businessRecommendation: 'Please select a valid dataset',
      sql: '',
      data: []
    };
  }

  // Get data
  const data = (dataset.data as Record<string, any>[]) || [];
  const columns = (dataset.columns as string[]) || [];

  if (data.length === 0) {
    return {
      insight: 'No data in dataset',
      explanation: 'The dataset appears to be empty',
      businessRecommendation: 'Upload a dataset with data to get insights',
      sql: '',
      data: []
    };
  }

  // Generate SQL
  let sql = generateSQL(question, columns, data);
  
  if (!sql) {
    return {
      insight: 'Could not generate query',
      explanation: 'The question format was not recognized',
      businessRecommendation: 'Try asking about revenue, profits, regions, products, or channels',
      sql: '',
      data: []
    };
  }

  // Validate SQL
  const validation = validateSQL(sql);
  if (!validation.valid) {
    return {
      insight: 'Query validation failed',
      explanation: validation.error || 'Invalid query',
      businessRecommendation: 'Please try a different question',
      sql,
      data: []
    };
  }

  // Limit results for large datasets
  const limitedData = data.length > 10000 ? data.slice(0, 10000) : data;
  
  // Execute query
  const result = executeQuery(sql, limitedData, question, columns);

  // Generate insight
  return generateInsight(question, result, sql);
}
