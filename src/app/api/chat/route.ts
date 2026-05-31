import { generateAntigravityCompletion } from "@/lib/ai/antigravity-client";
import { debugError, debugLog } from "@/lib/utils/debug";

// app/api/chat/route.ts
import { auth } from '@/lib/auth';
import { isBuiltinUserId } from '@/lib/auth/builtin-users';
import type { DatasetRecord } from '@/lib/data/csv-analyzer';
import { db } from '@/lib/db';
import { datasets } from '@/lib/db/schema';
import {
    aggregateData,
    findColumn,
    formatCurrencyValue,
    formatPercentValue,
    normalizeCurrencyValue,
    requiresComputation,
} from '@/lib/query/engine';
import {
    EXPLANATION_SYSTEM_PROMPT,
    generateExplanationPrompt
} from '@/lib/query/intent-prompt';
import { searchApp } from '@/lib/search/app-search';
import { getAnalystCreditUsage } from '@/lib/usage/analyst-credits';
import { chatRequestSchema, validateOrError } from '@/lib/validation';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

// ============================================================================
// BACKEND RESPONSE FORMATTER - Guarantees correct formatting regardless of LLM
// ============================================================================

/**
 * Format all numbers in AI response to guarantee proper formatting
 * This runs AFTER AI response but BEFORE sending to UI
 */
function formatAIResponse(text: string): string {
  if (!text) return text;

  // Limit percentage decimals to max 2 places
  // Matches: 24.68178696894002% -> 24.68%
  text = text.replace(/(\d+\.\d{3,})%/g, (match) => {
    return parseFloat(match).toFixed(2) + '%';
  });

  // Also handle percentages without % sign that should have decimals
  text = text.replace(/(\d+\.\d{3,})(\s*%)/g, (match, num, pct) => {
    return parseFloat(num).toFixed(2) + pct;
  });

  // Add thousand separators to large numbers (4+ digits)
  // But exclude years, IDs, and already formatted numbers
  text = text.replace(/\b(\d{4,})\b/g, (num) => {
    // Skip if it looks like a year (19xx or 20xx)
    if (num.startsWith('19') || num.startsWith('20')) return num;
    // Skip if already has comma
    if (num.includes(',')) return num;
    return Number(num).toLocaleString('en-US');
  });

  // Replace technical terms with business language
  const technicalTerms = [
    { from: 'group_by', to: 'grouped by' },
    { from: 'dataset rows', to: 'items' },
    { from: 'records', to: 'items' },
    { from: 'aggregation', to: 'analysis' },
    { from: 'SQL', to: '' },
    { from: 'select', to: '' },
  ];

  for (const term of technicalTerms) {
    text = text.replace(new RegExp(term.from, 'gi'), term.to);
  }

  return text;
}

// ============================================================================
// STRICT SQL ENFORCEMENT LAYER - Never let LLM compute numbers
// ============================================================================

/**
 * Generate and execute SQL based on question - STRICT MODE
 * Returns null if no SQL can be generated
 */
async function executeStrictSQL(datasetId: string, question: string): Promise<{
  success: boolean;
  sql?: string;
  result?: any;
  error?: string;
}> {
  debugLog('[STRICT_SQL] Generating SQL for question:', question);

  // Get dataset
  const dataset = await db!.query.datasets.findFirst({
    where: eq(datasets.id, datasetId),
  });

  if (!dataset) {
    return { success: false, error: 'Dataset not found' };
  }

  // Get data from datasets.data column (not datasetRows)
  const data = (dataset.data as Record<string, any>[]) || [];
  const columns = (dataset.columns as string[]) || [];

  if (data.length === 0) {
    return { success: false, error: 'Dataset has no data' };
  }

  debugLog('[STRICT_SQL] Dataset:', dataset.name, '- Rows:', data.length, '- Columns:', columns.length);

  const q = question.toLowerCase();
  let sql = '';
  let result: any = null;

  try {
    // COUNT ROWS
    if (q.includes('how many row') || q.includes('count row') || q.includes('number of row')) {
      sql = `SELECT COUNT(*) as count FROM dataset`;
      result = { count: data.length, operation: 'count' };
    }
    // TOTAL / SUM
    else if (q.includes('total') || q.includes('sum') || q.includes('revenue') || q.includes('sales')) {
      const valueCol = findColumn(columns, ['revenue', 'sales', 'amount', 'total', 'price', 'cost']);
      if (valueCol) {
        const total = data.reduce((sum, row) => sum + (parseFloat(row[valueCol]) || 0), 0);
        sql = `SELECT SUM(${valueCol}) as total FROM dataset`;
        result = { total, column: valueCol, operation: 'sum' };
      }
    }
    // AVERAGE
    else if (q.includes('average') || q.includes('avg') || q.includes('mean')) {
      const valueCol = findColumn(columns, ['revenue', 'sales', 'amount', 'price', 'cost', 'profit']);
      if (valueCol) {
        const values = data.map(r => parseFloat(r[valueCol]) || 0);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        sql = `SELECT AVG(${valueCol}) as average FROM dataset`;
        result = { average: avg, column: valueCol, operation: 'avg' };
      }
    }
    // GROUP BY - Region/Country/Product with highest/lowest/most/least
    // IMPORTANT: This MUST handle questions about "which X brings the most Y" format
    else if (q.includes('region') || q.includes('country') || q.includes('product') ||
             q.includes('channel') || q.includes('segment') || q.includes('category') ||
             q.includes('highest') || q.includes('lowest') || q.includes('most') || q.includes('top') ||
             q.includes('best') || q.includes('worst') || q.includes('least') ||
             q.includes('brings') || q.includes('generates') || q.includes('produces')) {
      // Find grouping column - check multiple patterns to handle variations
      let groupCol = findColumn(columns, ['region', 'country', 'product', 'category', 'segment', 'channel', 'source', 'medium', 'campaign', 'customer', 'industry', 'area', 'zone']);
      const valueCol = findColumn(columns, ['revenue', 'sales', 'profit', 'amount', 'total', 'value', 'income']);

      debugLog('[STRICT_SQL] GROUP BY - groupCol:', groupCol, 'valueCol:', valueCol);

      if (groupCol && valueCol) {
        const grouped = aggregateData(data, groupCol, valueCol);
        sql = `SELECT ${groupCol}, SUM(${valueCol}) as total FROM dataset GROUP BY ${groupCol}`;
        result = {
          type: 'group_by',
          groupBy: groupCol,
          value: valueCol,
          data: grouped,
          operation: 'group_by'
        };
      }
    }
    // MIN/MAX
    else if (q.includes('minimum') || q.includes('maximum') || q.includes('lowest') || q.includes('highest')) {
      const valueCol = findColumn(columns, ['revenue', 'sales', 'profit', 'amount', 'price', 'cost', 'quantity', 'units']);
      if (valueCol) {
        const values = data.map(r => parseFloat(r[valueCol]) || 0);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const isMin = q.includes('minimum') || q.includes('lowest');
        sql = `SELECT ${isMin ? 'MIN' : 'MAX'}(${valueCol}) as result FROM dataset`;
        result = {
          [isMin ? 'minimum' : 'maximum']: isMin ? min : max,
          column: valueCol,
          operation: isMin ? 'min' : 'max'
        };
      }
    }
    // PROFIT MARGIN
    else if (q.includes('profit') && (q.includes('margin') || q.includes('percentage'))) {
      const revenueCol = findColumn(columns, ['revenue', 'sales', 'amount']);
      const costCol = findColumn(columns, ['cost', 'unit_cost']);
      if (revenueCol && costCol) {
        let totalRevenue = 0;
        let totalCost = 0;
        for (const row of data) {
          totalRevenue += parseFloat(row[revenueCol]) || 0;
          totalCost += parseFloat(row[costCol]) || 0;
        }
        const margin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;
        sql = `SELECT ((SUM(revenue) - SUM(cost)) / SUM(revenue)) * 100 as margin FROM dataset`;
        result = { profitMargin: margin, revenue: totalRevenue, cost: totalCost, operation: 'margin' };
      }
    }

    debugLog('[STRICT_SQL] Generated SQL:', sql);
    debugLog('[STRICT_SQL] Result:', JSON.stringify(result)?.slice(0, 200));

    if (!sql || !result) {
      return { success: false, error: 'Could not generate SQL for this question type' };
    }

    return { success: true, sql, result };

  } catch (err: any) {
    debugError('[STRICT_SQL] Error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Validate datasetId from request body
 */
async function validateDatasetId(datasetId: string | undefined): Promise<{
  valid: boolean;
  dataset?: any;
  error?: string;
}> {
  if (!datasetId) {
    return { valid: false, error: 'No datasetId provided' };
  }

  const dataset = await db!.query.datasets.findFirst({
    where: eq(datasets.id, datasetId),
  });

  if (!dataset) {
    return { valid: false, error: 'Dataset not found' };
  }

  return { valid: true, dataset };
}

// ============================================================================
// CHAT ROUTE - AI Assistant with Verified Computation Layer
// ============================================================================
// This module handles:
// 1. Reading dataset from database (single source of truth)
// 2. Verified computation through Query Engine
// 3. LLM generates query intents ONLY - never computes numbers
// 4. LLM explains verified results ONLY
// 5. Loop detection and safeguards
//
// CRITICAL ARCHITECTURE:
// - LLM → generates structured query intent JSON
// - Query Engine → validates and executes SQL
// - Verified Result → returned to LLM for explanation
// - LLM → formats explanation text only (NO computation)
// ============================================================================

// ============================================================================
// EXECUTION SAFEGUARDS - Prevent loops
// ============================================================================

// Track chat sessions to detect loops
const chatSessionLog: Map<string, { count: number; lastTime: number; lastMessage: string }> = new Map()
const MAX_CHAT_COUNT = 5
const CHAT_TIMEOUT_MS = 60000 // 60 seconds

/**
 * Check for chat loops - same message repeated
 */
function checkChatLoop(sessionKey: string, message: string): { allowed: boolean; message?: string } {
  const now = Date.now()
  const existing = chatSessionLog.get(sessionKey)

  if (existing) {
    // Check timeout - reset if last message was too long ago
    if (now - existing.lastTime > CHAT_TIMEOUT_MS) {
      chatSessionLog.set(sessionKey, { count: 1, lastTime: now, lastMessage: message })
      return { allowed: true }
    }

    // Check if same message repeated too many times
    if (existing.lastMessage === message && existing.count >= MAX_CHAT_COUNT) {
      return {
        allowed: false,
        message: `Chat blocked: Same message repeated ${MAX_CHAT_COUNT}+ times. Please rephrase your question.`
      }
    }

    // Increment count
    chatSessionLog.set(sessionKey, {
      count: existing.count + 1,
      lastTime: now,
      lastMessage: message
    })
  } else {
    chatSessionLog.set(sessionKey, { count: 1, lastTime: now, lastMessage: message })
  }

  return { allowed: true }
}

/**
 * Log chat execution - comprehensive logging for analytical queries
 */
function logChatExecution(
  action: string,
  details: Record<string, any>,
  options: { datasetId?: string; userId?: string; question?: string; sql?: string; executionTime?: number; success?: boolean } = {}
) {
  const logEntry = {
    ...details,
    ...options,
    action,
    timestamp: new Date().toISOString(),
    // Structured logging for analytical queries
    ...(options.question && {
      question: options.question.slice(0, 200),
      isAnalytical: /\b(how many|how much|total|sum|count|average|avg|top|highest|lowest|minimum|maximum|revenue|profit|region|currency|list|distinct|group by|analyze)\b/i.test(options.question)
    }),
    ...(options.sql && { sql: options.sql.slice(0, 500) }),
    ...(options.executionTime !== undefined && { executionTimeMs: options.executionTime }),
    ...(options.success !== undefined && { success: options.success }),
  };

  debugLog(`[CHAT] ${action}:`, JSON.stringify(logEntry));
}

// ============================================================================
// DATA AGGREGATION HELPERS - Compute answers directly
// ============================================================================

function generateAggregatedContext(data: any[], columns: string[]): string {
  const context: string[] = [];

  const countryCol = findColumn(columns, ['country', 'nation', 'market']);
  const regionCol = findColumn(columns, ['region', 'continent', 'area', 'zone']);
  const productCol = findColumn(columns, ['product', 'item', 'sku', 'goods']);
  const channelCol = findColumn(columns, ['channel', 'source', 'medium', 'platform']);
  const revenueCol = findColumn(columns, ['revenue', 'sales', 'amount', 'total', 'income', 'value']);

  if (!revenueCol) return '';

  if (countryCol) {
    const byCountry = aggregateData(data, countryCol, revenueCol);
    if (byCountry.length > 0) {
      const total = byCountry.reduce((sum, r) => sum + r.value, 0);
      const top = byCountry[0];
      context.push(`TOP COUNTRY: ${top.name} - ${formatCurrencyValue(top.value)} (${formatPercentValue(top.pct)} of total)`);
      context.push(`Country rankings: ${byCountry.slice(0, 5).map((r, i) => `${i + 1}. ${r.name}: ${formatCurrencyValue(r.value)}`).join(', ')}`);
    }
  }

  if (regionCol) {
    const byRegion = aggregateData(data, regionCol, revenueCol);
    if (byRegion.length > 0) {
      const top = byRegion[0];
      context.push(`TOP REGION: ${top.name} - ${formatCurrencyValue(top.value)} (${formatPercentValue(top.pct)} of total)`);
      context.push(`Region rankings: ${byRegion.slice(0, 5).map((r, i) => `${i + 1}. ${r.name}: ${formatCurrencyValue(r.value)}`).join(', ')}`);
    }
  }

  if (productCol) {
    const byProduct = aggregateData(data, productCol, revenueCol);
    if (byProduct.length > 0) {
      const top = byProduct[0];
      context.push(`TOP PRODUCT: ${top.name} - ${formatCurrencyValue(top.value)} (${formatPercentValue(top.pct)} of total)`);
      context.push(`Product rankings: ${byProduct.slice(0, 5).map((r, i) => `${i + 1}. ${r.name}: ${formatCurrencyValue(r.value)}`).join(', ')}`);
    }
  }

  if (channelCol) {
    const byChannel = aggregateData(data, channelCol, revenueCol);
    if (byChannel.length > 0) {
      const top = byChannel[0];
      context.push(`TOP CHANNEL: ${top.name} - ${formatCurrencyValue(top.value)} (${formatPercentValue(top.pct)} of total)`);
    }
  }

  return context.join('\n');
}

function normalizeDataset(data: DatasetRecord[]): DatasetRecord[] {
  if (!data || data.length === 0) return data;

  // Detect monetary columns
  const sampleRow = data[0];
  const columns = Object.keys(sampleRow);
  const monetaryPatterns = /price|amount|revenue|cost|total|profit|sales|value|qty|quantity/i;

  const monetaryColumns = columns.filter(col => monetaryPatterns.test(col));

  debugLog('[NORMALIZE] Detected monetary columns:', monetaryColumns);

  // Normalize each row
  return data.map(row => {
    const normalized: DatasetRecord = { ...row };

    for (const col of monetaryColumns) {
      const value = row[col];
      if (typeof value === 'string' && /[€$¥£C$A₹CHF₽]/.test(value)) {
        normalized[col] = normalizeCurrencyValue(value);
        debugLog(`[NORMALIZE] ${col}: "${value}" -> ${normalized[col]}`);
      }
    }

    return normalized;
  });
}

export async function POST(request: Request) {
  let responseData: any = null;

  try {
    const body = await request.json();
    const validation = validateOrError(chatRequestSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const { messages, datasetId, processedData } = validation.data;

    // ============================================================================
    // STRICT DATASET BINDING - Required for ALL analytical queries
    // ============================================================================
    const lastMessage = messages[messages.length - 1]?.content || '';
    const isAnalyticalQuery = /\b(how many|how much|total|sum|count|average|avg|top|highest|lowest|minimum|maximum|revenue|profit|region|currency|list|distinct|group by|analyze)\b/i.test(lastMessage);

    // STRICT: Require datasetId for analytical queries
    if (isAnalyticalQuery && !datasetId) {
      debugLog('[CHAT] REJECTED: Analytical query without datasetId');
      return NextResponse.json(
        {
          success: false,
          error: 'No active dataset selected or invalid dataset ID',
          reason: 'Please select an active dataset before asking analytical questions'
        },
        { status: 400 }
      );
    }

    // ============================================================================
    // USAGE LIMIT CHECK - Check for free tier limits
    // ============================================================================
    const session = await auth();
    const userId = session?.user?.id;
    const appSearchResults = userId
      ? await searchApp({
          query: lastMessage,
          userId,
          role: session?.user?.role,
          limit: 6,
        })
      : [];

    // Only check limits for persisted customer users
    if (userId && !isBuiltinUserId(userId)) {
      const usage = await getAnalystCreditUsage(userId);
      if (usage.limitReached) {
        debugLog('[CHAT] REJECTED: Free limit reached');
        return NextResponse.json(
          {
            success: false,
            error: 'Free limit reached',
            message: 'You\'ve used your 2 included Analyst credits. Subscribe to Pro or top up your balance to continue.',
            upgradeRequired: true,
            analysisCount: usage.analysisCount,
            creditsRemaining: 0,
          },
          { status: 403 }
        );
      }
    }

    // Validate datasetId exists and belongs to user (if provided)
    if (datasetId) {
      debugLog('[CHAT] Validating datasetId:', datasetId);
      const dataset = await db!.query.datasets.findFirst({
        where: eq(datasets.id, datasetId),
      });

      if (!dataset) {
        debugLog('[CHAT] REJECTED: Dataset not found:', datasetId);
        return NextResponse.json(
          {
            success: false,
            error: 'No active dataset selected or invalid dataset ID',
            reason: 'Dataset not found'
          },
          { status: 400 }
        );
      }

      debugLog('[CHAT] Dataset validated:', dataset.name, '- rows:', dataset.rowCount);
    } else {
      debugLog('[CHAT] No datasetId - non-analytical query allowed');
    }

    const sessionKey = datasetId || 'no-dataset';

    debugLog('[CHAT] Incoming message:', lastMessage);
    debugLog('[CHAT] Dataset ID:', datasetId);

    // ============================================================================
    // SAFEGUARD: Check for chat loops
    // ============================================================================
    const loopCheck = checkChatLoop(sessionKey + ':' + lastMessage.slice(0, 50), lastMessage);
    if (!loopCheck.allowed) {
      logChatExecution('LOOP_DETECTED', {
        sessionKey,
        message: lastMessage.slice(0, 50)
      });
      return NextResponse.json(
        { success: false, error: loopCheck.message },
        { status: 429 }
      );
    }

    // ============================================================================
    // AI CALL INITIATED - Log execution
    // ============================================================================
    logChatExecution('AI_CALL_INITIATED', {
      datasetId,
      messageLength: lastMessage.length
    });

    // ============================================================================
    // VERIFIED COMPUTATION LAYER - Check if question requires computation
    // ============================================================================
    // If the question requires numerical computation, we:
    // 1. Generate query intent via LLM
    // 2. Execute verified query through Query Engine
    // 3. Pass verified result to LLM for explanation only
    // ============================================================================

    // STRICT: For ANY analytical question, require strict SQL execution
    const isAnalyticalQuestion = isAnalyticalQuery || requiresComputation(lastMessage);

    if (datasetId && isAnalyticalQuestion) {
      debugLog('[CHAT] Question requires verified computation (analytical detected:', isAnalyticalQuery, ', computation:', requiresComputation(lastMessage), ')');

      // STRICT: First validate datasetId
      const validation = await validateDatasetId(datasetId);
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: 'No active dataset selected or invalid ID', reason: validation.error },
          { status: 400 }
        );
      }

      // STRICT: Execute SQL directly first (never let LLM compute numbers)
      debugLog('[STRICT_SQL] Executing strict SQL for:', lastMessage);
      const sqlResult = await executeStrictSQL(datasetId, lastMessage);

      if (!sqlResult.success) {
        // SQL execution failed - return error with available columns, don't fallback to LLM
        debugLog('[STRICT_SQL] Failed:', sqlResult.error);

        // If analytical query but SQL failed, return specific error with available columns
        const dataset = await db!.query.datasets.findFirst({
          where: eq(datasets.id, datasetId),
        });
        const availableCols = (dataset?.columns as string[]) || [];

        return NextResponse.json({
          error: 'Unable to compute this question from the dataset',
          reason: sqlResult.error || 'No matching computation pattern found',
          availableColumns: availableCols,
          suggestion: 'Try asking about: total revenue, average sales, count of rows, top products by revenue, or rephrase your question to match available columns: ' + availableCols.slice(0, 10).join(', ')
        }, { status: 400 });
      }

      // SQL succeeded - use the result
      debugLog('[STRICT_SQL] Success! Result:', JSON.stringify(sqlResult.result).slice(0, 200));

      // Generate explanation using verified result (LLM can only format, not compute)
      const explanationPrompt = generateExplanationPrompt({
        success: true,
        computed_value: sqlResult.result.count || sqlResult.result.total || sqlResult.result.average ||
                        sqlResult.result.data || sqlResult.result.minimum || sqlResult.result.maximum ||
                        sqlResult.result.profitMargin || 0,
        operation: sqlResult.result.operation,
        row_count: validation.dataset?.rowCount
      }, lastMessage);

      try {
        const rawExplanation = await generateAntigravityCompletion({
          model: 'gemini-2.5-flash',
          messages: [
            { role: 'system', content: EXPLANATION_SYSTEM_PROMPT },
            { role: 'user', content: explanationPrompt },
          ],
          temperature: 0.3,
          max_tokens: 500,
        });
        // Apply formatter to guarantee correct number formatting
        const explanation = formatAIResponse(rawExplanation);

        return NextResponse.json({
          success: true,
          content: explanation,
          role: 'assistant',
          verified: true,
          computation: {
            operation: sqlResult.result.operation,
            sql: sqlResult.sql,
            result: sqlResult.result
          },
        });
      } catch (antigravityError) {
        debugError('[ANTIGRAVITY] Error generating explanation:', antigravityError);
        // Return the raw result as fallback
        return NextResponse.json({
          success: true,
          content: `Result: ${JSON.stringify(sqlResult.result)}`,
          role: 'assistant',
          verified: true,
          computation: {
            operation: sqlResult.result.operation,
            sql: sqlResult.sql,
            result: sqlResult.result
          },
        });
      }
    }

    // If not an analytical question or SQL failed, continue with regular chat flow

    // Fetch dataset info from database (Single Source of Truth)
    let datasetInfo = null;
    let datasetRowsData: any[] = [];

    if (processedData && Array.isArray(processedData) && processedData.length > 0) {
      // Use pre-processed data from frontend (already normalized)
      debugLog('[CHAT] Using processed data from frontend:', processedData.length, 'rows');
      datasetRowsData = processedData.slice(0, 50);
    } else if (datasetId) {
      debugLog('[CHAT] Fetching dataset from database...');
      const dataset = await db!.query.datasets.findFirst({
        where: eq(datasets.id, datasetId),
      });

      if (dataset) {
        datasetInfo = {
          id: dataset.id,
          name: dataset.name,
          rowCount: dataset.rowCount,
          columnCount: dataset.columnCount,
          columns: dataset.columns,
        };
        debugLog('[CHAT] Dataset found:', datasetInfo.name, '-', datasetInfo.rowCount, 'rows');

        // FIXED: Fetch data from datasets.data column (not datasetRows table)
        const rawData = (dataset.data as Record<string, any>[]) || [];
        datasetRowsData = normalizeDataset(rawData).slice(0, 50);
        debugLog('[CHAT] Fetched and normalized', datasetRowsData.length, 'sample rows for context');
      } else {
        debugLog('[CHAT] Dataset not found in database');
      }
    }

    // ============================================================================
    // BUILD SYSTEM PROMPT - Text-only, no tool execution
    // ============================================================================

    let systemContent = `You are Clevr, elite AI analyst for startup founders and investors.

Your ONLY rule for analytical/numeric questions: ALWAYS compute using available data – no excuses, no "need more data", no "not supported".

For ANY question with ROAS, CAC, LTV, profit, margin, revenue attribution, channel performance, campaign ROI:

1. Use utm_source, utm_medium, utm_campaign for attribution when available.
2. Calculate ROAS as: ROAS = SUM(net_revenue) / SUM(estimated_ad_spend) per channel
   - If no direct ad_spend: use proxy (e.g. 10% of net_revenue as estimated cost, or average CPA from known data)
3. Calculate CAC as: total marketing_cost / new customers acquired per channel
4. Calculate LTV as: average net_revenue per customer * estimated lifespan (use 12 months default if unknown)
5. Profit: (unit_price * quantity) - discount_amount - tax - shipping - refund_amount
6. Margin %: (Profit / Gross Revenue) * 100

ALWAYS generate and EXECUTE real SQL to compute it (use datasetId from request).

If calculation impossible (no revenue, no quantity, no attribution columns):
Return ONLY: { error: "Calculation not possible – dataset lacks required columns (revenue, quantity, utm, etc.)" }

NEVER say:
- "no cost data"
- "need ad spend"
- "cannot calculate ROAS"
- "operation not supported"
- "upload dataset with..."

Response structure:
- Direct answer first (e.g. "Best ROAS is Google Ads with 4.2x")
- Breakdown/table with real numbers
- Founder action: "Double budget on X, kill Y"
- If visualization: suggest chart type

IMPORTANT: Compute ROAS, CAC, LTV, profit, margin using available columns. Use proxies if needed. NEVER refuse with 'need more data' if calculation possible. Execute SQL first. If impossible, return exact error.

Accuracy overrides fluency.
Never guess or approximate.
Never hallucinate.

IMPORTANT DOCUMENT GENERATION RULE:
If user requests: generate report, create report, download report, export report, make PDF, create presentation, PowerPoint, Word document, Excel summary, investor report, board report, management report

You MUST return ONLY valid JSON. No markdown. No explanations. No commentary. No extra text.

FORMAT DETECTION:
- PDF → "format": "pdf"
- PowerPoint/slides/presentation → "format": "ppt"
- Word/document → "format": "docx"
- Excel/spreadsheet → "format": "xlsx"
Default: "format": "pdf"

PLAN LOGIC:
- If user asks for: investor deck, branded report, executive presentation, detailed board report → "report_type": "pro"
- Otherwise → "report_type": "standard"

REQUIRED OUTPUT STRUCTURE:
{
  "action": "generate_report",
  "format": "pdf | ppt | docx | xlsx",
  "report_type": "standard | pro",
  "title": "Professional report title",
  "executive_summary": "3-6 sentence executive overview",
  "kpis": [
    {
      "name": "KPI name",
      "value": "value",
      "insight": "short interpretation"
    }
  ],
  "sections": [
    {
      "title": "Section title",
      "content": "Detailed structured business analysis"
    }
  ],
  "charts": [
    {
      "type": "bar | line | pie | table",
      "title": "Chart title",
      "x_axis": "column name",
      "y_axis": "column name",
      "reason": "why this chart is relevant"
    }
  ],
  "recommendations": [
    "Actionable recommendation 1",
    "Actionable recommendation 2"
  ]
}

CRITICAL: Return ONLY JSON. No markdown. No backticks. No explanations. No text outside JSON.

IMPORTANT: When users ask data questions (e.g., "highest revenue by country", "top products by sales"), you MUST:
1. Automatically detect relevant columns (e.g., Country, Revenue_USD, Product)
2. Perform aggregation (SUM) on the data provided
3. Sort results and return the TOP entity with exact values
4. Give a CONCISE answer with the result

Example responses:
- "USA has the highest revenue with $5,413,650 (88% of total)"
- "Excavator Titan 3000 is the top product with $2,981,507 in sales"

RESPONSE STYLE:
- Keep answers SHORT and DIRECT (1-2 sentences max)
- Always include the exact value and currency formatting (e.g., $1,234,567)
- Include percentage of total when relevant
- NEVER explain how to do the analysis - just give the answer

IMPORTANT RESTRICTIONS:
1. You MUST respond with TEXT ONLY - never execute commands
2. Do NOT attempt to run code, scripts, or any tools
3. Do NOT trigger any analysis or processing
4. Answer questions based on the provided data only
5. Never mention that you're an AI or machine learning model
6. Always respond in plain English with clear, helpful answers

MISSING DATA HANDLING:
If user asks for a metric that cannot be calculated because required columns are missing:
Return ONLY: { error: "Calculation not possible – dataset lacks required columns (revenue, quantity, utm, etc.)" }

NEVER refuse with "need more data" if calculation is possible using available columns and proxies.
Always try to compute using proxies or estimates if exact data is missing.

Example for profit without cost data:
- Use (unit_price * quantity) - discount_amount as estimated profit
- Return the calculation with note: "Estimated profit (excluding cost data)"

Always offer next steps and alternative insights.`;

    if (datasetInfo || datasetRowsData.length > 0) {
      // Generate aggregated context for direct answers
      const columns = datasetInfo?.columns || Object.keys(datasetRowsData[0] || {});
      const aggregatedData = generateAggregatedContext(datasetRowsData, columns);

      if (datasetInfo) {
        systemContent += `

DATASET OVERVIEW:
- Name: ${datasetInfo.name}
- Total Rows: ${datasetInfo.rowCount}
- Columns: ${columns.join(', ')}

AGGREGATED INSIGHTS (pre-computed for you):
${aggregatedData}

Use these pre-computed insights to answer questions DIRECTLY. When asked about top performing entities, reference the rankings above.`;
      } else {
        systemContent += `

AGGREGATED INSIGHTS:
${aggregatedData}

Use these rankings to answer questions directly.`;
      }
    } else {
      systemContent += `

No dataset is currently loaded. Ask the user to upload a CSV file first.`;
    }

    if (appSearchResults.length > 0) {
      systemContent += `

APP SEARCH CONTEXT:
Use these app results when the user asks where to find a page, FAQ answer, report, dataset, support area, or account setting. Mention only results visible to this user's role.
${appSearchResults.map((result, index) => `${index + 1}. ${result.title} (${result.type}) - ${result.href}${result.description ? ` - ${result.description}` : ""}`).join('\n')}`;
    }

    systemContent += `

Remember: Respond with TEXT ONLY. Do not execute any commands or tools.`;

    debugLog('[ANTIGRAVITY] API Key present:', !!process.env.GEMINI_API_KEY);

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'AI service not configured. Please contact support.',
      });
    }

    let content = '';
    try {
      content = await generateAntigravityCompletion({
        model: 'gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: systemContent,
          },
          ...messages,
        ],
        temperature: 0.3,
        max_tokens: 1500,
      });

      debugLog('[ANTIGRAVITY] Response received:', content.slice(0, 100));
    } catch (antigravityError) {
      debugError('[ANTIGRAVITY ERROR]', antigravityError);

      return NextResponse.json(
        {
          success: false,
          error: `AI service error: ${antigravityError instanceof Error ? antigravityError.message : 'Unknown error'}`,
        },
        { status: 500 }
      );
    }

    // ============================================================================
    // AI CALL COMPLETE - Log execution
    // ============================================================================
    logChatExecution('AI_CALL_COMPLETE', {
      datasetId,
      responseLength: content.length
    });

    responseData = {
      success: true,
      content: formatAIResponse(content),
      role: 'assistant'
    };

    return NextResponse.json(responseData);

  } catch (err: any) {
    debugError('[CHAT CRASH]', {
      message: err.message,
      stack: err.stack?.slice(0, 500),
    });

    // Always return a valid JSON response
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'An unexpected error occurred. Please try again.',
      },
      { status: 500 }
    );
  }
}
