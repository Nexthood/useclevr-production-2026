/**
 * Analysis API Route
 *
 * Main endpoint for AI data analysis.
 * Pipeline:
 * 1. Receive user question
 * 2. Generate SQL query using Query Engine
 * 3. Execute SQL query on dataset
 * 4. Return query result
 * 5. Pass result to LLM
 * 6. Generate explanation
 *
 * Error handling:
 * - SQL failures return error message
 * - Empty results return "No matching data found"
 * - LLM failures still return query results
 * - Never crashes the UI
 */

import { debugError, debugLog, debugWarn } from "@/lib/utils/debug";
import { generateAnalysisPrompt } from "@/lib/ai/llmAdapter";
import { auth } from "@/lib/auth/auth";
import { isBuiltinUserId } from "@/lib/auth/builtin-users";
import { getDatasetInfo, loadDataJS, runQueryJS } from "@/lib/data/datasetEngine";
import { db } from "@/lib/db";
import { datasetRows, datasets } from "@/lib/db/schema";
import { analyzeWithMCP, buildMCPToolsPrompt, initializeMCPContext } from "@/lib/mcp/integration";
import { detectChartType, detectMetricColumn, generateQuery } from "@/lib/query/engine";
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits";
import { analyzeRequestSchema, validateOrError } from "@/lib/validation";
import type { PrecomputedMetrics } from "@/lib/utils/pipeline-types";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { and, eq } from "drizzle-orm";

// Generate business insights from query results without LLM
function generateBusinessInsights(result: any[], question: string): { insight: string; explanation: string; recommendation: string } {
  if (!result || result.length === 0) {
    return { insight: "No data available", explanation: "The query returned no results.", recommendation: "Try a different question." };
  }

  const data = result;
  const questionLower = question.toLowerCase();
  const isRevenue = questionLower.includes('revenue') || questionLower.includes('sales');
  const isRegion = questionLower.includes('region') || questionLower.includes('country');
  const isTrend = questionLower.includes('trend') || questionLower.includes('growth');

  try {
    const sampleRow = data[0];
    const keys = Object.keys(sampleRow);
    const numKey = keys.find(k => typeof sampleRow[k] === 'number');
    const catKey = keys.find(k => typeof sampleRow[k] === 'string');

    if (!numKey || !catKey) {
      return { insight: "Data analysis complete", explanation: `Found ${data.length} data points.`, recommendation: "Review the data for insights." };
    }

    const aggregated: Record<string, { value: number; count: number }> = {};
    data.forEach((row: any) => {
      const category = row[catKey];
      const value = row[numKey];
      if (!aggregated[category]) aggregated[category] = { value: 0, count: 0 };
      aggregated[category].value += typeof value === 'number' ? value : 0;
      aggregated[category].count += 1;
    });

    const sorted = Object.entries(aggregated).sort((a, b) => b[1].value - a[1].value);
    const total = sorted.reduce((sum, item) => sum + item[1].value, 0);
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];

  if (isRevenue || isRegion) {
    const topPct = ((top[1].value / total) * 100).toFixed(1);
    return {
      insight: `${top[0]} generates the majority of revenue`,
      explanation: `${top[0]} accounts for ${topPct}% of total revenue.`,
      recommendation: `Increase focus on ${top[0]} while developing growth strategies for other segments.`
    };
  }

    if (isTrend) {
      const firstVal = data[0] ? (data[0][numKey] || 0) : 0;
      const lastVal = data[data.length - 1] ? (data[data.length - 1][numKey] || 0) : 0;
      const change = parseFloat(((lastVal - firstVal) / (firstVal || 1) * 100).toFixed(1));
      const direction = change >= 0 ? 'increased' : 'declined';
      const growthDecline = change >= 0 ? 'positive growth' : 'declining performance';
      return {
        insight: `Revenue ${direction} over the analyzed period`,
        explanation: `Revenue ${direction} by ${Math.abs(change)}% between the first and last recorded periods, indicating ${growthDecline}.`,
        recommendation: change >= 0 ? "Capitalize on growth momentum by increasing marketing investment and expanding sales team." : "Review pricing strategy and product-market fit to reverse the declining trend."
      };
    }

    return {
      insight: `${top[0]} dominates the category`,
      explanation: `${top[0]} leads with ${top[1].value.toLocaleString()}, vs ${bottom[0]} at ${bottom[1].value.toLocaleString()}.`,
      recommendation: `Analyze what drives ${top[0]} success and apply those learnings to improve other categories.`
    };
  } catch {
    return { insight: "Analysis complete", explanation: `Processed ${data.length} data points.`, recommendation: "Review the data." };
  }
}

// Clean AI output to remove SQL queries and technical text
function cleanInsight(text: string): string {
  if (!text) return '';

  // Normalize dates in various formats to "Month DD, YYYY"
  // Handle YYYY-MM-DD format
  text = text.replace(/(\d{4})-(\d{2})-(\d{2})/g, (_, y, m, d) => {
    try {
      const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return `${y}-${m}-${d}`;
    }
  });

  // Handle YYYYMMDD or YYYY MM DD or YYYY\nMM\nDD (split dates)
  text = text.replace(/(\d{4})\s*(\d{2})\s*(\d{2})/g, (_, y, m, d) => {
    try {
      const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return `${y}-${m}-${d}`;
    }
  });

  return text
    .replace(/SELECT[\s\S]*?FROM\s+\w+/gi, '')
    .replace(/Found\s+\d+\s+records.*?\n?/gi, '')
    .replace(/Analysis\s+of\s+\d+\s+data\s+points/gi, '')
    .replace(/Top results:/gi, '')
    .replace(/Query:/gi, '')
    .replace(/KEY TAKEAWAYS:/gi, '')
    .replace(/SQL|sql/gi, '')
    .replace(/FROM dataset/gi, '')
    .replace(/LIMIT \d+/gi, '')
    .replace(/GROUP BY/gi, '')
    .replace(/WHERE/gi, '')
    .replace(/JOIN/gi, '')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

// Store dataset in memory (for the session)
let currentDataset: any[] = [];
let currentColumns: string[] = [];
let datasetLoaded = false;

export async function POST(request: Request) {
  debugLog('\n========== ANALYZE REQUEST ==========');

  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      debugError('[ANALYZE] Failed to parse request body:', parseError);
      return Response.json({
        success: false,
        error: "Invalid request format",
        answer: "Please provide a valid question.",
        insight: "Request error",
        explanation: "The request could not be parsed.",
        recommendation: "Try again with a valid question.",
        data: [],
        chartType: "table",
      });
    }

    const parseResult = validateOrError(analyzeRequestSchema, body);
    if (!parseResult.success) {
      return Response.json({
        success: false,
        error: parseResult.error,
        answer: "Please upload a dataset first.",
        insight: "No dataset",
        explanation: "The assistant needs CSV data to answer questions.",
        recommendation: "Upload a file before asking the assistant.",
        data: [],
        chartType: "table",
      });
    }

    const { question, datasetId, data, columns, analysis: precomputedAnalysis } = parseResult.data;

    debugLog('[ANALYZE] Question:', question);
    debugLog('[ANALYZE] Dataset ID:', datasetId);

    // ============================================================================
    // USAGE LIMIT CHECK - Check for free tier limits
    // ============================================================================
    const session = await auth();
    const userId = session?.user?.id;

    // If datasetId provided but no precomputedAnalysis/data, fetch from DB
    let analysisToUse = precomputedAnalysis;
    if (datasetId && !data && !precomputedAnalysis) {
      const storedDataset = await db.query.datasets.findFirst({
        where: and(eq(datasets.id, datasetId), eq(datasets.userId, userId || '')),
      });
      if (storedDataset) {
        analysisToUse = storedDataset.analysis as Record<string, unknown> | null;
        debugLog('[ANALYZE] Loaded precomputedAnalysis from DB');
      }
    }

    // Initialize MCP context if precomputed analysis is available
    if (analysisToUse && datasetId) {
      try {
        initializeMCPContext(datasetId, analysisToUse as unknown as PrecomputedMetrics);
        debugLog('[ANALYZE] MCP context initialized for dataset:', datasetId);
      } catch (mcpError) {
        debugLog('[ANALYZE] MCP initialization skipped:', mcpError);
      }
    }

    // Only check limits for persisted customer users
    if (userId && !isBuiltinUserId(userId)) {
      try {
        const usage = await getAnalystCreditUsage(userId);
        if (usage.limitReached) {
          debugLog('[ANALYZE] REJECTED: Free limit reached');
          return Response.json({
            success: false,
            error: 'Free limit reached',
            message: 'You\'ve used your 2 included Analyst credits. Subscribe to Pro or top up your balance to continue.',
            upgradeRequired: true,
            analysisCount: usage.analysisCount,
            creditsRemaining: 0,
          });
        }
      } catch (profileError: any) {
        // Log the DB error but do NOT block the analyze request
        debugError('[ANALYZE] Profile query failed:', profileError?.message || profileError);
        // Continue without blocking - usage tracking is secondary
      }
    }

    // Check if data was provided directly
    if (data && Array.isArray(data) && data.length > 0) {
      debugLog('[ANALYZE] Loading dataset into memory...');
      try {
        loadDataJS(data);
        currentDataset = data;
        currentColumns = columns || Object.keys(data[0] || {});
        datasetLoaded = true;
        debugLog('[ANALYZE] Dataset loaded:', getDatasetInfo());
      } catch (loadError) {
        debugError('[ANALYZE] Failed to load data:', loadError);
        return Response.json({
          success: false,
          error: "Failed to load dataset",
          answer: "There was a problem loading your dataset.",
          insight: "Data loading failed",
          explanation: "The dataset could not be processed.",
          recommendation: "Try uploading the file again.",
          data: [],
          chartType: "table",
        });
      }
    } else if (datasetId && session?.user?.id) {
      debugLog('[ANALYZE] Loading dataset from database...');
      try {
        const storedDataset = await db.query.datasets.findFirst({
          where: and(eq(datasets.id, datasetId), eq(datasets.userId, session.user.id)),
        });

        if (!storedDataset) {
          return Response.json({
            success: false,
            error: "Dataset not found",
            answer: "I could not find that dataset.",
            insight: "Dataset unavailable",
            explanation: "The selected dataset could not be loaded for this account.",
            recommendation: "Select another dataset or upload a new file.",
            data: [],
            chartType: "table",
          });
        }

        // Pass precomputed metrics to frontend for unified KPI context
        const precomputedMetrics = (storedDataset as any).precomputedMetrics;
        const precomputedAnalysis = (storedDataset as any).analysis;
        
        let storedData = (storedDataset.data as Record<string, unknown>[]) || [];

        if (storedData.length === 0) {
          const rows = await db.query.datasetRows.findMany({
            where: eq(datasetRows.datasetId, datasetId),
            columns: { data: true },
            orderBy: (rows, { asc }) => [asc(rows.rowIndex)],
          });
          storedData = rows.map((row) => row.data as Record<string, unknown>);
        }

        if (storedData.length > 0) {
          loadDataJS(storedData);
          currentDataset = storedData;
          currentColumns = (storedDataset.columns as string[]) || Object.keys(storedData[0] || {});
          datasetLoaded = true;
          // Initialize MCP context with precomputed metrics
          if (precomputedAnalysis && precomputedMetrics) {
            try {
              initializeMCPContext(datasetId, precomputedMetrics as unknown as PrecomputedMetrics);
              debugLog('[ANALYZE] MCP context initialized with precomputed metrics');
            } catch (mcpErr) {
              debugLog('[ANALYZE] MCP context init skipped:', mcpErr);
            }
          }
          debugLog('[ANALYZE] Stored dataset loaded:', getDatasetInfo());
        }
      } catch (loadError) {
        debugError('[ANALYZE] Failed to load stored dataset:', loadError);
        return Response.json({
          success: false,
          error: "Failed to load dataset",
          answer: "There was a problem loading your dataset.",
          insight: "Data loading failed",
          explanation: "The selected dataset could not be prepared for analysis.",
          recommendation: "Try another dataset or refresh the page.",
          data: [],
          chartType: "table",
        });
      }
    }

    // Check if dataset is loaded
    if (!datasetLoaded || currentDataset.length === 0) {
      debugLog('[ANALYZE] No dataset loaded');
      return Response.json({
        success: false,
        error: "No dataset loaded",
        answer: "No dataset loaded. Please upload a dataset first.",
        insight: "No data available",
        explanation: "Please upload a CSV file to analyze.",
        recommendation: "Upload a dataset to get started.",
        data: [],
        chartType: "table",
      });
    }

    // Get available columns
    let availableColumns: string[] = columns || currentColumns;
    if (availableColumns.length === 0) {
      availableColumns = Object.keys(currentDataset[0] || {});
    }
    debugLog('[ANALYZE] Available columns:', availableColumns.length);

    // Step 1: Generate SQL query
    let sqlQuery: string;
    try {
      debugLog('[ANALYZE] Generating SQL query...');
      sqlQuery = await generateQuery(question, availableColumns);
      debugLog('[ANALYZE] Generated SQL:', sqlQuery);
    } catch (genError) {
      debugError('[ANALYZE] Query generation failed:', genError);
      // Fallback to simple query
      sqlQuery = 'SELECT * FROM dataset LIMIT 50';
      debugLog('[ANALYZE] Using fallback query:', sqlQuery);
    }

    // Step 2: Execute SQL query
    let result: any[] = [];
    let queryError: string | null = null;

    try {
      debugLog('[ANALYZE] Executing query...');
      result = runQueryJS(sqlQuery);
      debugLog('[ANALYZE] Query returned:', result.length, 'rows');
    } catch (execError: any) {
      queryError = execError?.message || 'Unknown query error';
      debugError('[ANALYZE] Query execution failed:', queryError);

      // Try simpler fallback query
      try {
        debugLog('[ANALYZE] Trying fallback query...');
        result = runQueryJS('SELECT * FROM dataset LIMIT 10');
        debugLog('[ANALYZE] Fallback returned:', result.length, 'rows');
        queryError = null; // Fallback worked
      } catch (fallbackError: any) {
        debugError('[ANALYZE] Fallback query also failed:', fallbackError);
        return Response.json({
          success: false,
          error: "Query execution failed: " + queryError,
          answer: "Sorry, I couldn't understand that question.",
          insight: "Query error",
          explanation: "The question could not be converted to a valid query.",
          recommendation: "Try asking about 'revenue', 'products', 'regions', or 'trends'.",
          data: [],
          chartType: "table",
        });
      }
    }

    // Step 3: Check if results are empty
    if (!result || result.length === 0) {
      debugLog('[ANALYZE] No matching data found');
      return Response.json({
        success: true,
        answer: "No matching data found in the dataset.",
        insight: "No results",
        explanation: "The query returned no results. Try rephrasing your question.",
        recommendation: "Try a more general question or check your dataset.",
        data: [],
        chartType: "table",
      });
    }

    // Step 4: Determine chart type and metric
    const chartType = detectChartType(sqlQuery, result);
    const metricColumn = detectMetricColumn(result);
    debugLog('[ANALYZE] Chart type:', chartType, '| Metric:', metricColumn);

    // Step 5: Generate LLM explanation (but always return results)
    let answer = "";
    let insight = "";
    let explanation = "";
    let recommendation = "";
    let llmError: string | null = null;

    // Always format at least some answer from the data
    const formatDataAnswer = () => {
      if (result.length === 1) {
        const entries = Object.entries(result[0]);
        return entries.slice(0, 5).map(([k, v]) => `${k}: ${v}`).join(', ');
      }
      const firstRow = result[0];
      const metric = metricColumn || Object.keys(firstRow).find(k => typeof firstRow[k] === 'number');
      const label = Object.keys(firstRow).find(k => typeof firstRow[k] === 'string') || 'name';
      return `${result.length} results. Top: ${firstRow[label as string] || 'N/A'} = ${firstRow[metric as string] || 'N/A'}`;
    };

    try {
      debugLog('[ANALYZE] Calling Google AI (Gemini) for response...');

      const model = google("gemini-2.5-flash");

      let mcpToolsPrompt = '';
      if (datasetId && precomputedAnalysis) {
        mcpToolsPrompt = buildMCPToolsPrompt(datasetId);
      }

      const prompt = generateAnalysisPrompt(question, result, availableColumns, precomputedAnalysis) + mcpToolsPrompt;

      try {
        const { text } = await generateText({
          model,
          prompt,
        });
        answer = text;
        debugLog('[ANALYZE] Gemini response received');

        const parts = answer.split('\n\n');
        for (const part of parts) {
          if (part.startsWith('INSIGHT')) {
            insight = part.replace('INSIGHT', '').trim();
          } else if (part.startsWith('EXPLANATION')) {
            explanation = part.replace('EXPLANATION', '').trim();
          } else if (part.startsWith('RECOMMENDATION')) {
            recommendation = part.replace('RECOMMENDATION', '').trim();
          }
        }

        insight = cleanInsight(insight);
        explanation = cleanInsight(explanation);
        recommendation = cleanInsight(recommendation);

        if (!insight) insight = formatDataAnswer();
        if (!explanation) explanation = 'Based on the query results.';
        if (!recommendation) recommendation = 'Review the data for actionable insights.';
      } catch (llmRunError: any) {
        llmError = llmRunError?.message || 'Gemini execution failed';
        debugWarn('[ANALYZE] Gemini failed:', llmError);
        debugLog('[ANALYZE] Falling back to data-based analysis');
      }
    } catch (llmCheckError: any) {
      llmError = llmCheckError?.message || 'AI check failed';
      debugError('[ANALYZE] AI check failed:', llmError);
      debugLog('[ANALYZE] Falling back to data-based analysis');
    }

    // If LLM failed or not available, generate business insights from the data
    // Use precomputed analysis if available for unified context
    if (!answer || llmError) {
      debugLog('[ANALYZE] Using fallback response (LLM unavailable or failed)');

      // Try MCP-based analysis first if dataset is available
      if (datasetId && analysisToUse) {
        try {
          const mcpResult = await analyzeWithMCP(
            question,
            datasetId,
            result,
            availableColumns
          );

          if (mcpResult.usedMCPTools && mcpResult.answer) {
            debugLog('[ANALYZE] Using MCP-based analysis');
            answer = mcpResult.answer;
            insight = mcpResult.insight;
            explanation = mcpResult.explanation;
            recommendation = mcpResult.recommendation;

            insight = cleanInsight(insight);
            explanation = cleanInsight(explanation);
            recommendation = cleanInsight(recommendation);
          }
        } catch (mcpError) {
          debugLog('[ANALYZE] MCP analysis failed, using precomputed KPIs:', mcpError);
        }
      }

      // If still no answer, use precomputed KPIs
      if (!answer && analysisToUse && (analysisToUse as any).kpis) {
        const kpis = (analysisToUse as any).kpis;

        // Generate insights based on unified KPIs
        const totalRevenue = kpis.totalRevenue ?? 0;
        const topProduct = kpis.topProducts?.[0];
        const topRegion = kpis.topRegions?.[0];

        insight = topRegion
          ? `${topRegion.name} leads with ${topRegion.percentage?.toFixed(1)}% of revenue`
          : 'Revenue analysis complete';
        explanation = `Total revenue is ${totalRevenue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}. ${topProduct ? `Top product: ${topProduct.name} (${topProduct.percentage?.toFixed(1)}% of revenue)` : ''}`;
        recommendation = topRegion
          ? `Focus on ${topRegion.name} while developing strategies for other regions.`
          : 'Review all segments for growth opportunities.';
        answer = `INSIGHT\n${insight}\n\nKEY TAKEAWAYS\n${explanation}\n\nRECOMMENDATION\n${recommendation}`;
      } else if (!answer && datasetId && !datasetLoaded) {
        // No dataset loaded but datasetId was provided
        answer = "The requested information is not available in this dataset.";
        insight = "Data unavailable";
        explanation = "I could not load the dataset for analysis.";
        recommendation = "Select a valid dataset or check your connection.";
      } else {
        // Fallback to query-based analysis
        const insights = generateBusinessInsights(result, question);
        insight = insights.insight;
        explanation = insights.explanation;
        recommendation = insights.recommendation;
        answer = `INSIGHT\n${insight}\n\nKEY TAKEAWAYS\n${explanation}\n\nRECOMMENDATION\n${recommendation}`;
      }

      // Clean the output
      insight = cleanInsight(insight);
      explanation = cleanInsight(explanation);
      recommendation = cleanInsight(recommendation);
    }

    // Step 6: Return response (ALWAYS includes data)
    debugLog('[ANALYZE] Returning response with', result.length, 'rows');
    debugLog('========== ANALYZE COMPLETE ==========\n');

    return Response.json({
      success: true,
      answer,
      insight,
      explanation,
      recommendation,
      data: result,
      chartType,
      metricColumn,
      columns: availableColumns,
    });

  } catch (error: any) {
    debugError('[ANALYZE] FATAL ERROR:', error);
    debugError('[ANALYZE] Stack:', error?.stack);

    // NEVER crash the UI - always return valid response
    return Response.json({
      success: false,
      error: error?.message || 'Unknown error',
      answer: "An error occurred while analyzing the data. Please try again.",
      insight: "Analysis failed",
      explanation: "There was an unexpected error processing your request.",
      recommendation: "Try rephrasing your question or refreshing the page.",
      data: [],
      chartType: "table",
    });
  }
}

// Reset dataset (for testing)
export async function DELETE() {
  currentDataset = [];
  currentColumns = [];
  datasetLoaded = false;
  return Response.json({ message: "Dataset cleared" });
}
