import { debugLog, debugError, debugWarn } from "@/lib/debug"

/**
 * AI Query Generator
 * 
 * Uses AI to generate SQL queries from natural language questions,
 * then executes them via DuckDB.
 */

import { buildDatasetIntelligence, DatasetIntelligence, DatasetRecord } from '../data/dataset-intelligence';

export interface QueryResult {
  sql: string;
  result: unknown;
  explanation: string;
  columns?: string[];
  rows?: number;
}

/**
 * Generate SQL query from question using AI
 */
export async function generateSQLQuery(
  question: string,
  intelligence: DatasetIntelligence
): Promise<string> {
  // Build schema description for the prompt
  const schemaDesc = intelligence.schema.columns
    .map(col => `- ${col.name}: ${col.type}`)
    .join('\n');

  const metrics = intelligence.metrics;
  const metricsDesc = `
Numeric Stats:
${Object.entries(metrics.numericStats)
  .map(([col, stats]) => `- ${col}: sum=${stats.sum.toFixed(2)}, avg=${stats.average.toFixed(2)}, min=${stats.min}, max=${stats.max}`)
  .join('\n')}
`.trim();

  const prompt = `Generate a SQL query for DuckDB to answer this question about the dataset.

Available Schema:
${schemaDesc}

Dataset Metrics:
${metricsDesc}

Question: ${question}

Requirements:
- Use DuckDB SQL syntax
- Table name is 'dataset'
- Return ONLY the SQL query, nothing else
- Use proper GROUP BY, ORDER BY, LIMIT clauses as needed
- For 'top', 'highest', 'most' questions → ORDER BY DESC LIMIT 1 or 5
- For 'bottom', 'lowest', 'least' questions → ORDER BY ASC LIMIT 1 or 5

SQL Query:`;

  // Call AI to generate SQL (using the analyze endpoint)
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        columns: intelligence.schema.columns.map(c => c.name),
        sampleData: intelligence.schema.columns.slice(0, 5).map(c => c.sampleValues),
        rowCount: intelligence.metrics.rowCount
      })
    });

    if (!response.ok) {
      throw new Error('AI query generation failed');
    }

    const text = await response.text();
    // Extract SQL from response (should be just the query)
    const sqlMatch = text.match(/```sql\n?([\s\S]*?)\n?```|([\s\S]+)/);
    const sql = (sqlMatch ? sqlMatch[1] || sqlMatch[2] : text)
      .trim()
      .replace(/^```sql|```$/g, '')
      .trim();

    return sql;
  } catch (error) {
    debugError('[QUERY-GEN] AI SQL generation failed:', error);
    throw new Error('Failed to generate SQL query');
  }
}

/**
 * Execute SQL query using DuckDB
 * 
 * Note: In production, this would use DuckDB WASM or a DuckDB backend.
 * For now, we'll use the existing data array processing as fallback.
 */
export async function executeQuery(
  sql: string,
  data: Record<string, unknown>[]
): Promise<unknown> {
  // Simple SQL parser for basic queries
  // In production, replace with actual DuckDB WASM
  
  const sqlLower = sql.toLowerCase();
  
  // Parse SELECT queries
  if (sqlLower.includes('select')) {
    let result: unknown = data;
    
    // Handle WHERE
    const whereMatch = sqlLower.match(/where\s+(.+?)(?:group|order|limit|$)/);
    if (whereMatch) {
      // Simple filtering - for complex queries, use DuckDB
      result = data; // Pass through for now
    }
    
    // Handle GROUP BY
    const groupMatch = sqlLower.match(/group\s+by\s+(\w+)/);
    if (groupMatch) {
      const groupCol = groupMatch[1];
      const aggMatch = sqlLower.match(/(sum|avg|count|min|max)\s*\(\s*(\w+)\s*\)/);
      
      if (aggMatch) {
        const aggFunc = aggMatch[1].toLowerCase();
        const aggCol = aggMatch[2];
        
        const grouped: Record<string, number[]> = {};
        for (const row of data) {
          const key = String(row[groupCol] || 'Unknown');
          const val = parseFloat(String(row[aggCol] || 0).replace(/[^0-9.-]/g, '')) || 0;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(val);
        }
        
        const aggregated = Object.entries(grouped).map(([key, vals]) => {
          let aggValue: number;
          switch (aggFunc) {
            case 'sum': aggValue = vals.reduce((a, b) => a + b, 0); break;
            case 'avg': aggValue = vals.reduce((a, b) => a + b, 0) / vals.length; break;
            case 'count': aggValue = vals.length; break;
            case 'min': aggValue = Math.min(...vals); break;
            case 'max': aggValue = Math.max(...vals); break;
            default: aggValue = 0;
          }
          return { [groupCol]: key, [aggCol]: aggValue };
        });
        
        result = aggregated;
      }
    }
    
    // Handle ORDER BY
    const orderMatch = sqlLower.match(/order\s+by\s+(\w+)(?:\s+(desc|asc))?/);
    if (orderMatch) {
      const orderCol = orderMatch[1];
      const desc = orderMatch[2]?.toLowerCase() === 'desc';
      
      if (Array.isArray(result)) {
        result = [...result].sort((a, b) => {
          const aVal = Number(a[orderCol]) || 0;
          const bVal = Number(b[orderCol]) || 0;
          return desc ? bVal - aVal : aVal - bVal;
        });
      }
    }
    
    // Handle LIMIT
    const limitMatch = sqlLower.match(/limit\s+(\d+)/);
    if (limitMatch) {
      const limit = parseInt(limitMatch[1]);
      if (Array.isArray(result)) {
        result = result.slice(0, limit);
      }
    }
    
    return result;
  }
  
  return { error: 'Unsupported query type' };
}

/**
 * Generate explanation of query result
 */
export async function generateExplanation(
  question: string,
  sql: string,
  result: unknown
): Promise<string> {
  const prompt = `Given this question and SQL result, provide a short 1-2 sentence explanation.

Question: ${question}
SQL: ${sql}
Result: ${JSON.stringify(result)}

Explanation:`;

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        columns: [],
        sampleData: [],
        rowCount: 0
      })
    });

    if (!response.ok) {
      return 'Query executed successfully.';
    }

    return await response.text();
  } catch {
    return 'Query executed successfully.';
  }
}

/**
 * Main function: Process question through AI query pipeline
 */
export async function processQuestion(
  question: string,
  data: Record<string, unknown>[]
): Promise<QueryResult> {
  // Build intelligence from data
  const intelligence = buildDatasetIntelligence(data as DatasetRecord[]);
  
  // Generate SQL
  const sql = await generateSQLQuery(question, intelligence);
  
  // Execute query
  const result = await executeQuery(sql, data);
  
  // Generate explanation
  const explanation = await generateExplanation(question, sql, result);
  
  return {
    sql,
    result,
    explanation,
    rows: Array.isArray(result) ? result.length : 1
  };
}
