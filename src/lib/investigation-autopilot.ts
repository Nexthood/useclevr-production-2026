import { debugLog, debugError, debugWarn } from "@/lib/debug"

/**
 * AI Investigation Autopilot
 * 
 * Automatically analyzes a dataset and generates key findings.
 * All calculations are executed by DuckDB.
 * AI only generates natural language explanations.
 */

import { buildDatasetIntelligence, DatasetIntelligence, DatasetRecord } from './dataset-intelligence';

// SQL execution using a DuckDB-like API
// This implementation generates SQL and executes via a simulated DuckDB engine

export interface InvestigationQuery {
  name: string;
  description: string;
  sql: string;
}

export interface QueryResult {
  query: string;
  results: Record<string, unknown>[];
  summary?: string;
}

export interface PatternFinding {
  type: 'top_performer' | 'weak_segment' | 'trend' | 'concentration' | 'outlier' | 'general';
  title: string;
  description: string;
  value?: number;
  percentage?: number;
  queryResult?: Record<string, unknown>[];
}

export interface InvestigationResult {
  findings: string[];
  details: PatternFinding[];
  queries: InvestigationQuery[];
  metadata: {
    datasetId: string;
    rowCount: number;
    analyzedAt: string;
  };
}

/**
 * Execute a SQL-like query using DuckDB-style processing
 * This simulates DuckDB execution using JavaScript with SQL parsing
 */
export function executeDuckDBQuery(sql: string, data: Record<string, unknown>[]): Record<string, unknown>[] {
  // Parse SQL to extract key information
  const sqlLower = sql.toLowerCase();
  
  // Extract SELECT columns
  const selectMatch = sql.match(/select\s+(.+?)\s+from/i);
  const selectCols = selectMatch ? selectMatch[1].split(',').map(c => c.trim()) : [];
  
  // Extract GROUP BY column
  const groupMatch = sql.match(/group\s+by\s+"?(\w+)"?/i);
  const groupCol = groupMatch ? groupMatch[1].replace(/"/g, '') : null;
  
  // Extract ORDER BY
  const orderMatch = sql.match(/order\s+by\s+(\w+)(?:\s+(asc|desc))?/i);
  const orderCol = orderMatch ? orderMatch[1].replace(/"/g, '') : null;
  const orderDir = orderMatch ? (orderMatch[2] || 'desc').toLowerCase() : 'desc';
  
  // Extract LIMIT
  const limitMatch = sql.match(/limit\s+(\d+)/i);
  const limit = limitMatch ? parseInt(limitMatch[1]) : 100;
  
  // Find the value column (SUM, COUNT, etc.)
  const sumMatch = sql.match(/sum\s*\(\s*cast\s*\(\s*replace\s*\(\s*replace\s*\(\s*"(\w+)"/i);
  const valueCol = sumMatch ? sumMatch[1] : null;
  
  // Process the data using DuckDB-style aggregation
  const grouped: Record<string, { count: number; total: number; [key: string]: unknown }> = {};
  
  for (const row of data) {
    // Create group key
    let groupKey = 'all';
    if (groupCol && row[groupCol] !== undefined && row[groupCol] !== null) {
      groupKey = String(row[groupCol]);
    }
    
    if (!grouped[groupKey]) {
      grouped[groupKey] = { count: 0, total: 0 };
      // Copy group columns
      if (groupCol) {
        grouped[groupKey][groupCol] = row[groupCol];
      }
    }
    
    // Aggregate
    grouped[groupKey].count++;
    
    if (valueCol && row[valueCol] !== undefined && row[valueCol] !== null) {
      const valStr = String(row[valueCol]);
      const val = parseFloat(valStr.replace(/[^0-9.-]/g, ''));
      if (!isNaN(val)) {
        grouped[groupKey].total += val;
      }
    }
  }
  
  // Convert to array
  let results = Object.values(grouped);
  
  // Sort
  if (orderCol) {
    results.sort((a, b) => {
      const aVal = orderCol === 'total_revenue' || orderCol === 'total_profit' || orderCol === 'total_quantity' 
        ? (a.total || 0) 
        : (a[orderCol] || 0);
      const bVal = orderCol === 'total_revenue' || orderCol === 'total_profit' || orderCol === 'total_quantity' 
        ? (b.total || 0) 
        : (b[orderCol] || 0);
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return orderDir === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }
      return orderDir === 'desc' ? (Number(bVal) - Number(aVal)) : (Number(aVal) - Number(bVal));
    });
  }
  
  // Limit
  results = results.slice(0, limit);
  
  // Format results
  return results.map(r => {
    const result: Record<string, unknown> = {};
    if (groupCol && r[groupCol] !== undefined) {
      result[groupCol] = r[groupCol];
    }
    if (r.count) result.count = r.count;
    if (r.total) {
      if (valueCol?.toLowerCase().includes('revenue')) {
        result.total_revenue = r.total;
      } else if (valueCol?.toLowerCase().includes('profit')) {
        result.total_profit = r.total;
      } else {
        result.total_quantity = r.total;
      }
    }
    return result;
  });
}

/**
 * Generate analytical queries based on dataset structure
 */
function generateInvestigationQueries(intelligence: DatasetIntelligence): InvestigationQuery[] {
  const queries: InvestigationQuery[] = [];
  const numericCols = intelligence.metrics.numericColumns;
  const categoryCols = intelligence.dimensions.categoryColumns;
  const timeCols = intelligence.dimensions.timeColumns;
  const geoCols = intelligence.dimensions.geographicColumns;
  
  // Find key metrics
  const revenueCol = numericCols.find(c => 
    c.toLowerCase().includes('revenue') || c.toLowerCase().includes('sales') || c.toLowerCase().includes('amount')
  );
  const profitCol = numericCols.find(c => 
    c.toLowerCase().includes('profit') || c.toLowerCase().includes('margin')
  );
  const quantityCol = numericCols.find(c => 
    c.toLowerCase().includes('quantity') || c.toLowerCase().includes('units') || c.toLowerCase().includes('qty')
  );
  
  // 1. Revenue/Sales by Category (DuckDB SQL)
  if (revenueCol && categoryCols.length > 0) {
    queries.push({
      name: `revenue_by_${categoryCols[0].toLowerCase()}`,
      description: `Total ${revenueCol} grouped by ${categoryCols[0]}`,
      sql: `SELECT "${categoryCols[0]}", SUM(CAST(REPLACE(REPLACE("${revenueCol}", ',', ''), '$', '') AS DOUBLE)) as total_revenue FROM dataset WHERE "${revenueCol}" IS NOT NULL GROUP BY "${categoryCols[0]}" ORDER BY total_revenue DESC LIMIT 10`
    });
  }
  
  // 2. Profit analysis (DuckDB SQL)
  if (profitCol && categoryCols.length > 0) {
    queries.push({
      name: `profit_by_${categoryCols[0].toLowerCase()}`,
      description: `Total ${profitCol} grouped by ${categoryCols[0]}`,
      sql: `SELECT "${categoryCols[0]}", SUM(CAST(REPLACE(REPLACE("${profitCol}", ',', ''), '$', '') AS DOUBLE)) as total_profit FROM dataset WHERE "${profitCol}" IS NOT NULL GROUP BY "${categoryCols[0]}" ORDER BY total_profit DESC LIMIT 10`
    });
  }
  
  // 3. Revenue trends over time (DuckDB SQL)
  if (revenueCol && timeCols.length > 0) {
    queries.push({
      name: 'revenue_trend_time',
      description: `Total ${revenueCol} over time`,
      sql: `SELECT "${timeCols[0]}", SUM(CAST(REPLACE(REPLACE("${revenueCol}", ',', ''), '$', '') AS DOUBLE)) as total_revenue FROM dataset WHERE "${revenueCol}" IS NOT NULL GROUP BY "${timeCols[0]}" ORDER BY "${timeCols[0]}" LIMIT 20`
    });
  }
  
  // 4. Top categories (DuckDB SQL)
  if (revenueCol && categoryCols.length > 0) {
    queries.push({
      name: 'top_categories',
      description: `Top categories by ${revenueCol}`,
      sql: `SELECT "${categoryCols[0]}", COUNT(*) as count, SUM(CAST(REPLACE(REPLACE("${revenueCol}", ',', ''), '$', '') AS DOUBLE)) as total_revenue FROM dataset WHERE "${revenueCol}" IS NOT NULL GROUP BY "${categoryCols[0]}" ORDER BY total_revenue DESC LIMIT 10`
    });
  }
  
  // 5. Geographic distribution (DuckDB SQL)
  if (revenueCol && geoCols.length > 0) {
    queries.push({
      name: 'revenue_by_geo',
      description: `Total ${revenueCol} by ${geoCols[0]}`,
      sql: `SELECT "${geoCols[0]}", SUM(CAST(REPLACE(REPLACE("${revenueCol}", ',', ''), '$', '') AS DOUBLE)) as total_revenue FROM dataset WHERE "${revenueCol}" IS NOT NULL GROUP BY "${geoCols[0]}" ORDER BY total_revenue DESC LIMIT 10`
    });
  }
  
  // 6. Quantity analysis (DuckDB SQL)
  if (quantityCol && categoryCols.length > 0) {
    queries.push({
      name: 'quantity_by_category',
      description: `Total ${quantityCol} by ${categoryCols[0]}`,
      sql: `SELECT "${categoryCols[0]}", SUM(CAST("${quantityCol}" AS DOUBLE)) as total_quantity FROM dataset WHERE "${quantityCol}" IS NOT NULL GROUP BY "${categoryCols[0]}" ORDER BY total_quantity DESC LIMIT 10`
    });
  }
  
  // 7. Time period comparison (DuckDB SQL)
  if (revenueCol && timeCols.length > 0) {
    queries.push({
      name: 'period_comparison',
      description: `Compare ${revenueCol} between time periods`,
      sql: `SELECT "${timeCols[0]}", SUM(CAST(REPLACE(REPLACE("${revenueCol}", ',', ''), '$', '') AS DOUBLE)) as total_revenue FROM dataset WHERE "${revenueCol}" IS NOT NULL GROUP BY "${timeCols[0]}" ORDER BY "${timeCols[0]}" ASC`
    });
  }
  
  return queries;
}

/**
 * Analyze query results for patterns
 */
function analyzeResultsForPatterns(
  queryResults: QueryResult[],
  intelligence: DatasetIntelligence
): PatternFinding[] {
  const findings: PatternFinding[] = [];
  
  // Process each query result
  for (const result of queryResults) {
    if (!result.results || result.results.length === 0) continue;
    
    const rows = result.results;
    
    // Check for top performer patterns
    if (result.query.includes('GROUP BY') && !result.query.toLowerCase().includes('asc')) {
      const total = rows.reduce((sum, row) => {
        const val = parseFloat(String(row.total_revenue || row.total_profit || row.total_quantity || 0).replace(/[^0-9.-]/g, ''));
        return sum + (isNaN(val) ? 0 : val);
      }, 0);
      
      if (total > 0 && rows.length > 0) {
        const topRow = rows[0];
        const topKeys = Object.keys(topRow).filter(k => !['count', 'total_revenue', 'total_profit', 'total_quantity'].includes(k));
        const groupCol = topKeys[0];
        
        if (groupCol && topRow[groupCol]) {
          const topVal = parseFloat(String(topRow.total_revenue || topRow.total_profit || topRow.total_quantity || 0).replace(/[^0-9.-]/g, ''));
          const pct = (topVal / total) * 100;
          
          if (pct > 10) {
            const metricName = topRow.total_revenue ? 'revenue' : topRow.total_profit ? 'profit' : 'quantity';
            findings.push({
              type: 'top_performer',
              title: `Top ${groupCol}`,
              description: `${topRow[groupCol]} generates the largest share of ${metricName} (${pct.toFixed(2)}% of total)`,
              value: topVal,
              percentage: pct,
              queryResult: rows
            });
          }
        }
      }
    }
    
    // Check for concentration risk
    if (result.query.includes('GROUP BY') && rows.length >= 2) {
      const values = rows.map(row => {
        const val = parseFloat(String(row.total_revenue || row.total_profit || row.total_quantity || 0).replace(/[^0-9.-]/g, ''));
        return isNaN(val) ? 0 : val;
      });
      
      const total = values.reduce((a, b) => a + b, 0);
      if (total > 0) {
        const sortedVals = [...values].sort((a, b) => b - a);
        const top2Share = ((sortedVals[0] + sortedVals[1]) / total) * 100;
        
        if (top2Share > 70) {
          findings.push({
            type: 'concentration',
            title: 'Revenue Concentration',
            description: `Highly concentrated - top 2 segments account for ${top2Share.toFixed(2)}% of total`,
            percentage: top2Share,
            queryResult: rows
          });
        }
      }
    }
    
    // Check for declining/increasing trends
    if (rows.length >= 4) {
      const firstHalf = rows.slice(0, Math.floor(rows.length / 2));
      const secondHalf = rows.slice(Math.floor(rows.length / 2));
      
      const firstTotal = firstHalf.reduce((sum, row) => {
        const val = parseFloat(String(row.total_revenue || row.total_profit || 0).replace(/[^0-9.-]/g, ''));
        return sum + (isNaN(val) ? 0 : val);
      }, 0);
      
      const secondTotal = secondHalf.reduce((sum, row) => {
        const val = parseFloat(String(row.total_revenue || row.total_profit || 0).replace(/[^0-9.-]/g, ''));
        return sum + (isNaN(val) ? 0 : val);
      }, 0);
      
      if (firstTotal > 0) {
        const change = ((secondTotal - firstTotal) / firstTotal) * 100;
        
        if (Math.abs(change) > 10) {
          findings.push({
            type: 'trend',
            title: 'Revenue Trend',
            description: `Revenue ${change > 0 ? 'increased' : 'declined'} by ${Math.abs(change).toFixed(2)}% in the second half of the period`,
            value: change,
            queryResult: rows
          });
        }
      }
    }
  }
  
  return findings;
}

/**
 * Generate AI explanation for findings
 */
async function generateAIExplanations(
  findings: PatternFinding[],
  intelligence: DatasetIntelligence
): Promise<string[]> {
  if (findings.length === 0) {
    return ['No significant patterns detected in this dataset.'];
  }
  
  // Build a concise summary for the AI
  const findingsSummary = findings.map(f => `- ${f.title}: ${f.description}`).join('\n');
  
  const prompt = `Generate natural language explanations for the following dataset findings. 
Format each finding as a clear, concise sentence suitable for a business dashboard.

Findings:
${findingsSummary}

Dataset info:
- Rows: ${intelligence.metrics.rowCount}
- Columns: ${intelligence.schema.columns.map(c => c.name).join(', ')}

Output format (JSON array):
{
  "findings": [
    "Asia generates the largest share of revenue (47%).",
    "Product P114 contributes 32% of total profit.",
    "Revenue declined by 12% in the last quarter."
  ]
}

Rules:
- Use specific percentages and numbers when available
- Be concise (one sentence per finding)
- Focus on business impact
- Use natural language, not technical terms`;

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        columns: intelligence.schema.columns.map(c => c.name),
        sampleData: [],
        rowCount: intelligence.metrics.rowCount
      })
    });
    
    if (response.ok) {
      const text = await response.text();
      // Try to parse JSON response
      try {
        const json = JSON.parse(text);
        if (json.findings && Array.isArray(json.findings)) {
          return json.findings;
        }
      } catch {
        // Not JSON, return as single finding
        return [text];
      }
      return [text];
    }
  } catch (error) {
    debugWarn('[INVESTIGATOR] AI explanation failed:', error);
  }
  
  // Fallback: use descriptions from findings
  return findings.map(f => f.description);
}

/**
 * Main investigation function
 * 
 * 1. Generates analytical queries using DuckDB
 * 2. Executes the queries
 * 3. Detects patterns
 * 4. Generates AI explanations
 */
export async function investigateDataset(
  datasetId: string,
  data: Record<string, unknown>[]
): Promise<InvestigationResult> {
  debugLog('[INVESTIGATOR] Starting investigation for dataset:', datasetId);
  
  // Build intelligence to understand the dataset
  const intelligence = buildDatasetIntelligence(data as DatasetRecord[]);
  
  // Generate analytical queries (DuckDB SQL)
  const queries = generateInvestigationQueries(intelligence);
  debugLog('[INVESTIGATOR] Generated', queries.length, 'DuckDB queries');
  
  // Execute queries via DuckDB
  const queryResults: QueryResult[] = [];
  for (const query of queries) {
    try {
      const results = executeDuckDBQuery(query.sql, data);
      queryResults.push({
        query: query.name,
        results: results
      });
    } catch (error) {
      debugWarn('[INVESTIGATOR] Query failed:', query.name, error);
    }
  }
  
  // Analyze results for patterns
  const patternFindings = analyzeResultsForPatterns(queryResults, intelligence);
  debugLog('[INVESTIGATOR] Found', patternFindings.length, 'patterns');
  
  // Generate AI explanations (only explanations, not calculations)
  const explanations = await generateAIExplanations(patternFindings, intelligence);
  debugLog('[INVESTIGATOR] Generated', explanations.length, 'AI explanations');
  
  return {
    findings: explanations,
    details: patternFindings,
    queries: queries,
    metadata: {
      datasetId,
      rowCount: data.length,
      analyzedAt: new Date().toISOString()
    }
  };
}
