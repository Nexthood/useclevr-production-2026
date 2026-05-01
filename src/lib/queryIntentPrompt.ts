// ============================================================================
// Query Intent Generator - LLM Prompt Templates
// ============================================================================
// This module provides prompt templates for generating structured query intents
// from natural language questions. The LLM must NOT compute numbers - it only
// generates the query structure.
//
// STRICT REQUIREMENTS:
// - LLM NEVER computes, estimates, infers, or assumes numerical results
// - LLM ONLY generates structured query intent JSON
// - LLM ONLY explains verified results returned from backend
// - EVERY analytical question MUST go through query-intent generation
// ============================================================================

import type { DatasetSchema, WhitelistedOperation } from './queryEngine';

// ============================================================================
// Prompt Templates
// ============================================================================

/**
 * System prompt for query intent generation - STRICT MODE
 */
export const QUERY_INTENT_SYSTEM_PROMPT = `You are a STRICT query intent generator for a verified analytics engine.

🚨 ABSOLUTE RULES - NEVER VIOLATE:

1. You MUST respond with ONLY a valid JSON object. No markdown, no explanations outside JSON.
2. You MUST NEVER compute, estimate, infer, or assume any numerical results.
3. You MUST ALWAYS generate structured query intent for analytical questions.
4. You MUST use exact column names from the provided schema.
5. You MUST extract filters from questions when conditions are mentioned.
6. If the question cannot be computed, you MUST return operation: null.

🔐 MANDATORY QUERY INTENT FORMAT:

{
  "operation": "COUNT | COUNT_DISTINCT | SUM | GROUP_BY | TOP_N | null",
  "metric": "REVENUE | PROFIT | null",
  "table": "dataset",
  "columns": ["<column_name>"],
  "filters": [
    {
      "column": "<column_name>",
      "operator": "= | != | < | > | <= | >= | IN",
      "value": "<filter_value>"
    }
  ],
  "group_by": [],
  "order_by": [],
  "limit": null,
  "reason": "<if operation is null, explain why question cannot be computed>"
}

AVAILABLE OPERATIONS:
- COUNT: Total row count (no columns needed)
- COUNT_DISTINCT: Count unique values (requires: columns with column name)
- SUM: Sum of numeric column (requires: columns with numeric column name)
- GROUP_BY: Group and aggregate (requires: group_by with grouping column, columns with value column)
- TOP_N: Top N most frequent (requires: columns with column name, optional limit)

DERIVED METRICS (Server-Side Only - Do NOT construct formulas):
- REVENUE: Automatically computed as Units_Sold * Unit_Price
- PROFIT: Automatically computed as (Units_Sold * Unit_Price) - (Units_Sold * Unit_Cost) - Shipping_Cost
- Use "metric": "REVENUE" or "metric": "PROFIT" instead of manual formulas

🚨 UNIVERSAL CSV HANDLING - ALWAYS COMPUTE:
- For ANY question about profit, margin, ROAS, CAC, LTV:
  - Use available columns (revenue, sales, amount, total, order_value)
  - Use available cost columns (cost, cogs, expense)
  - If NO cost column → use estimated cost = revenue * 0.30 (30% default COGS)
  - If NO ad_spend → use estimated cost = revenue * 0.15 (15% for ROAS)
- NEVER refuse with "no column" or "need data" - always compute using proxies
- If TRULY impossible (no revenue/price at all) → say only: "Calculation not possible – missing key columns"

FILTER OPERATORS:
- =: equal to
- !=: not equal to
- <: less than
- >: greater than
- <=: less than or equal
- >=: greater than or equal
- IN: in list (comma-separated values)

FILTER EXTRACTION RULES:
- ALWAYS extract filters when question contains conditions (e.g., "for Software products", "in 2024", "with status Active")
- Map natural language to operators: "is"=eq, "is not"=ne, "more than"=gt, "less than"=lt, "at least"=gte, "at most"=lte
- Extract category/product type/region/date filters from questions
- Never answer analytical questions without structured intent - ALWAYS generate JSON

COLUMN REQUIREMENTS:
- ONLY use columns that exist in the provided schema
- ONLY use numeric columns for SUM, AVG
- NEVER reference columns not in the schema
- NEVER assume what data exists in the dataset

IF QUESTION IS NOT ANALYTICAL (greeting, clarification, etc.):
{
  "operation": null,
  "table": "dataset",
  "metric": null,
  "columns": [],
  "filters": [],
  "group_by": [],
  "order_by": [],
  "limit": null,
  "reason": "non-analytical question"
}

IF QUESTION CANNOT BE COMPUTED (missing column, ambiguous, etc.):
{
  "operation": null,
  "table": "dataset",
  "metric": null,
  "columns": [],
  "filters": [],
  "group_by": [],
  "order_by": [],
  "limit": null,
  "reason": "<specific reason why cannot compute>"
}`;

/**
 * Generates the user prompt with schema context
 */
export function generateQueryIntentPrompt(
  schema: DatasetSchema,
  userQuestion: string
): string {
  const columnInfo = schema.columns
    .map((col) => {
      const type = schema.columnTypes[col] || 'text';
      return `  - ${col} (${type})`;
    })
    .join('\n');

  return `DATASET: ${schema.name}
TOTAL ROWS: ${schema.rowCount}

COLUMNS:
${columnInfo}

USER QUESTION:
${userQuestion}

Generate a query intent JSON to answer this question. Remember: respond with ONLY the JSON object, no markdown, no explanation outside the JSON.`;
}

/**
 * System prompt for explanation generation (after verified result)
 */
export const EXPLANATION_SYSTEM_PROMPT = `You are an explanation engine for data analytics results.

🚨 STRICT RESPONSE RULES - ALWAYS FOLLOW:

1. Format numbers with thousand separators.
   Example: 74403 → 74,403

2. Percentages must have maximum 2 decimal places.
   Example: 24.68178696894002% → 24.68%

3. If user asks for TOP result, return only the single best result.
   Do NOT list all items unless explicitly asked for ranking.

4. Never display technical database terms.
   Replace: group_by → grouped by
   Replace: records → items
   Replace: dataset rows → items
   Replace: aggregation → analysis

Your job is to explain what the verified result means in plain language.
Do not speculate. Do not add context not provided in the result.

If the result contains "data" array, extract exact values from each item.
If the result is a single value, state it exactly as provided.`;

/**
 * Generates the explanation prompt with verified result
 */
export function generateExplanationPrompt(
  verifiedResult: {
    success: boolean;
    computed_value?: number | Record<string, number> | Array<{ name: string; value: number }>;
    column?: string;
    operation?: string;
    row_count?: number;
    metadata?: {
      total_rows?: number;
      unique_values?: number;
    };
    error?: {
      code: string;
      message: string;
      userMessage: string;
    };
  },
  originalQuestion: string
): string {
  if (!verifiedResult.success) {
    return `ORIGINAL QUESTION:
${originalQuestion}

ERROR:
${verifiedResult.error?.userMessage || 'An error occurred during computation'}

Explain to the user that the computation could not be completed and suggest they try a different question.`;
  }

  return `ORIGINAL QUESTION:
${originalQuestion}

VERIFIED RESULT:
${JSON.stringify({
    computed_value: verifiedResult.computed_value,
    column: verifiedResult.column,
    operation: verifiedResult.operation,
    row_count: verifiedResult.row_count,
    metadata: verifiedResult.metadata,
  }, null, 2)}

Generate a clear, concise explanation of this result. Use the exact numbers provided. Do not compute or estimate anything.`;
}

// ============================================================================
// Query Intent Parser
// ============================================================================

/**
 * Parses the LLM response to extract query intent
 */
export function parseQueryIntentResponse(
  response: string
): { success: true; intent: QueryIntentResponse } | { success: false; error: string } {
  try {
    // Remove markdown code blocks if present
    let cleaned = response.trim();
    
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    
    cleaned = cleaned.trim();
    
    const parsed = JSON.parse(cleaned);
    
    // Validate required fields
    if (!parsed.operation) {
      return { success: false, error: 'Missing required field: operation' };
    }
    
    return { success: true, intent: parsed };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Query intent response structure from LLM - STRICT FORMAT
 */
export interface QueryIntentResponse {
  operation: WhitelistedOperation | null;
  table: string;
  metric?: string; // Optional metric for derived calculations
  columns: string[];
  filters: Array<{ column: string; operator: string; value: string | number }>;
  group_by: string[];
  order_by: Array<{ column: string; direction: 'ASC' | 'DESC' }>;
  limit: number | null;
  reason?: string; // Required when operation is null
}

// ============================================================================
// Question Pattern Matching (Fallback)
// ============================================================================

/**
 * Common question patterns and their corresponding operations
 */
const QUESTION_PATTERNS: Array<{
  pattern: RegExp;
  operation: WhitelistedOperation;
  extractColumn?: (match: RegExpMatchArray) => string | null;
}> = [
  {
    pattern: /how many\s+(\w+)\s+(?:are there|do we have|exist)/i,
    operation: 'COUNT_DISTINCT',
    extractColumn: (match) => match[1],
  },
  {
    pattern: /count (?:of |the )?(?:unique |distinct )?(\w+)/i,
    operation: 'COUNT_DISTINCT',
    extractColumn: (match) => match[1],
  },
  {
    pattern: /number of\s+(\w+)/i,
    operation: 'COUNT_DISTINCT',
    extractColumn: (match) => match[1],
  },
  {
    pattern: /total\s+(\w+)/i,
    operation: 'sum',
    extractColumn: (match) => match[1],
  },
  {
    pattern: /sum\s+(?:of\s+)?(?:the\s+)?(\w+)/i,
    operation: 'sum',
    extractColumn: (match) => match[1],
  },
  {
    pattern: /average\s+(?:of\s+)?(?:the\s+)?(\w+)/i,
    operation: 'avg',
    extractColumn: (match) => match[1],
  },
  {
    pattern: /avg\s+(?:of\s+)?(?:the\s+)?(\w+)/i,
    operation: 'avg',
    extractColumn: (match) => match[1],
  },
  {
    pattern: /(?:what is the |)maximum\s+(?:of\s+)?(?:the\s+)?(\w+)/i,
    operation: 'max',
    extractColumn: (match) => match[1],
  },
  {
    pattern: /(?:what is the |)minimum\s+(?:of\s+)?(?:the\s+)?(\w+)/i,
    operation: 'min',
    extractColumn: (match) => match[1],
  },
  {
    pattern: /highest\s+(\w+)/i,
    operation: 'max',
    extractColumn: (match) => match[1],
  },
  {
    pattern: /lowest\s+(\w+)/i,
    operation: 'min',
    extractColumn: (match) => match[1],
  },
  {
    pattern: /top\s+(\d+)\s+(\w+)/i,
    operation: 'top_n',
    extractColumn: (match) => match[2],
  },
  {
    pattern: /(?:how many rows|total rows|row count)/i,
    operation: 'count',
  },
];

/**
 * Attempts to extract query intent from question using pattern matching
 * This is a fallback when LLM is unavailable
 */
export function extractIntentFromPatterns(
  question: string,
  schema: DatasetSchema
): QueryIntentResponse | null {
  for (const { pattern, operation, extractColumn } of QUESTION_PATTERNS) {
    const match = question.match(pattern);
    
    if (match) {
      let column: string | undefined;
      
      if (extractColumn) {
        const extracted = extractColumn(match);
        if (extracted) {
          // Try to match extracted column name to actual column
          const lowerExtracted = extracted.toLowerCase();
          const matchedColumn = schema.columns.find(
            (col) =>
              col.toLowerCase() === lowerExtracted ||
              col.toLowerCase().includes(lowerExtracted) ||
              lowerExtracted.includes(col.toLowerCase())
          );
          
          if (matchedColumn) {
            column = matchedColumn;
          }
        }
      }
      
      // For operations requiring a column, check if we found one
      const requiresColumn = ['COUNT_DISTINCT', 'sum', 'avg', 'min', 'max', 'top_n'];
      if (requiresColumn.includes(operation) && !column) {
        continue; // Try next pattern
      }
      
      const intent: QueryIntentResponse = {
        operation,
        table: 'dataset',
        columns: column ? [column] : [],
        filters: [],
        group_by: [],
        order_by: [],
        limit: operation === 'top_n' && match[1] ? parseInt(match[1], 10) || 10 : null,
      };
      
      // Add limit for top_n
      if (operation === 'top_n' && match[1]) {
        intent.limit = parseInt(match[1], 10) || 10;
      }
      
      return intent;
    }
  }
  
  return null;
}

// ============================================================================
// Column Name Matching
// ============================================================================

/**
 * Finds the best matching column name from schema
 */
export function findBestColumnMatch(
  searchTerm: string,
  schema: DatasetSchema,
  preferredType?: 'numeric' | 'text' | 'date'
): string | null {
  const lowerSearch = searchTerm.toLowerCase();
  
  // First try exact match
  const exactMatch = schema.columns.find(
    (col) => col.toLowerCase() === lowerSearch
  );
  if (exactMatch) return exactMatch;
  
  // Then try contains match
  const containsMatch = schema.columns.find(
    (col) => col.toLowerCase().includes(lowerSearch) || lowerSearch.includes(col.toLowerCase())
  );
  if (containsMatch) return containsMatch;
  
  // Try word boundary match
  const words = lowerSearch.split(/[\s_-]+/);
  for (const word of words) {
    if (word.length < 3) continue;
    
    const wordMatch = schema.columns.find((col) => {
      const colLower = col.toLowerCase();
      return colLower.includes(word) || word.includes(colLower);
    });
    
    if (wordMatch) {
      // Check type preference
      if (preferredType && schema.columnTypes[wordMatch] !== preferredType) {
        continue;
      }
      return wordMatch;
    }
  }
  
  // If preferred type specified, try to find any column of that type
  if (preferredType) {
    const typeMatch = schema.columns.find(
      (col) => schema.columnTypes[col] === preferredType
    );
    if (typeMatch) return typeMatch;
  }
  
  return null;
}

/**
 * Detects revenue/sales column automatically
 */
export function detectRevenueColumn(schema: DatasetSchema): string | null {
  const revenuePatterns = [
    /revenue/i,
    /sales/i,
    /total.*value/i,
    /amount/i,
    /income/i,
    /turnover/i,
  ];
  
  for (const pattern of revenuePatterns) {
    const match = schema.columns.find((col) => pattern.test(col));
    if (match && schema.columnTypes[match] === 'numeric') {
      return match;
    }
  }
  
  return null;
}

/**
 * Detects grouping column (country, region, product, etc.)
 */
export function detectGroupingColumn(
  question: string,
  schema: DatasetSchema
): string | null {
  const lowerQuestion = question.toLowerCase();
  
  const groupingPatterns: Array<{ pattern: RegExp; columnPattern: RegExp }> = [
    { pattern: /by\s+country/i, columnPattern: /country/i },
    { pattern: /by\s+region/i, columnPattern: /region/i },
    { pattern: /by\s+product/i, columnPattern: /product/i },
    { pattern: /by\s+category/i, columnPattern: /category/i },
    { pattern: /by\s+channel/i, columnPattern: /channel/i },
    { pattern: /by\s+(\w+)/i, columnPattern: /$1/i }, // Dynamic match
  ];
  
  for (const { pattern, columnPattern } of groupingPatterns) {
    const match = lowerQuestion.match(pattern);
    if (match) {
      const columnMatch = schema.columns.find((col) =>
        columnPattern.test(col)
      );
      if (columnMatch) return columnMatch;
    }
  }
  
  return null;
}
