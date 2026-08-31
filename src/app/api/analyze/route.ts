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
import {
  generateWithUniversalAiAdapter,
  getUseClevrCloudFallbackAllowed,
  isLocalAiUnavailableError,
  logDefaultCloudFallback,
  logUniversalAiResponse,
} from "@/lib/ai/universal-ai-adapter";
import { checkRateLimit } from "@/lib/utils/rate-limiter";
import { generateAnalysisPrompt } from "@/lib/ai/llmAdapter";
import { auth } from "@/lib/auth/auth";
import { isSuperAdminUserId } from "@/lib/auth/builtin-users";
import { analyzeBusinessData, detectBusinessColumns } from "@/lib/business/business-columns";
import { buildProfileCalculationLayer } from "@/lib/business/company-calculation-context";
import { buildBusinessProfileContext } from "@/lib/business/company-setup";
import { getCompanySetup } from "@/lib/business/company-setup-store";
import { skillEngine } from "@/lib/business/skill-engine";
import { buildBusinessSemanticProfile, buildBusinessSemanticPromptBlock } from "@/lib/data/business-semantics";
import { getBusinessModelPromptContext, resolveBusinessModel, type BusinessModel } from "@/lib/data/business-model";
import { runQueryJS } from "@/lib/data/datasetEngine";
import { db } from "@/lib/db";
import { datasetRows, datasets, profiles } from "@/lib/db/schema";
import { analyzeWithMCP, buildMCPToolsPrompt, initializeMCPContext } from "@/lib/mcp/integration";
import { detectChartType, detectMetricColumn, generateQuery } from "@/lib/data/queryEngine";
import { analyzeRequestSchema, validateOrError } from "@/lib/validation";
import type { PrecomputedMetrics } from "@/lib/utils/pipeline-types";
import {
  generateMockAnalysisText,
  isMockAIMode,
  MOCK_AI_MODEL_NAME,
  MOCK_AI_PROVIDER_NAME,
} from "@/lib/ai/mock-ai";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { and, eq } from "drizzle-orm";
import { createTrace, getCurrentPromptVersion } from "@/lib/ai/ai-trace";
import { ghostModeTraceMessage, normalizeGhostMode } from "@/lib/ai/ghost-mode";
import { finalizeCredits, isUnlimitedCreditRole, releaseCredits, reserveCredits } from "@/lib/billing/credit-engine";
import { checkSpendingLimits } from "@/lib/billing/credit-account-service";
import { estimateUsageFromText } from "@/lib/billing/provider-usage";
import { checkActionEnforcement, logAiCost, incrementDailyRequestCount } from "@/lib/billing/usage-enforcement";

type AiProviderStatus = {
  label: string;
  state: "connection_healthy" | "fallback_active" | "provider_unavailable" | "offline_active" | "local_unavailable";
  message: string;
  fallbackActive: boolean;
};

// Generate business insights from query results without LLM
function generateBusinessInsights(result: Record<string, unknown>[], question: string): { insight: string; explanation: string; recommendation: string } {
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
    data.forEach((row: Record<string, unknown>) => {
      const category = String(row[catKey] ?? "");
      const value = Number(row[numKey] ?? 0);
      if (!aggregated[category]) aggregated[category] = { value: 0, count: 0 };
      aggregated[category].value += value;
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
      const firstVal = data[0] ? Number(data[0][numKey] ?? 0) : 0;
      const lastVal = data[data.length - 1] ? Number(data[data.length - 1][numKey] ?? 0) : 0;
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

export async function POST(request: Request) {
  debugLog('\n========== ANALYZE REQUEST ==========');

  const requestStart = Date.now();
  const mockAIMode = isMockAIMode()
  let traceProvider = mockAIMode ? MOCK_AI_PROVIDER_NAME : "gemini-cloud"
  let traceModel = mockAIMode ? MOCK_AI_MODEL_NAME : "gemini-2.5-flash"
  let providerStatus: AiProviderStatus = mockAIMode
    ? {
        label: MOCK_AI_PROVIDER_NAME,
        state: "connection_healthy" as const,
        message: "Connection healthy",
        fallbackActive: false,
      }
    : {
        label: "Cloud fallback",
        state: "connection_healthy" as const,
        message: "Connection healthy",
        fallbackActive: false,
      }
  let traceError: string | null = null
  let traceResponseContent = ""
  let traceQuestion = ""
  let traceDatasetId: string | null = null
  let traceUserId: string | null = null
  let creditOperationId: string | null = null
  let reservedAnalysisCredits = 0
  let isGhostMode = false

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

    const { question, datasetId, data, columns, analysis: precomputedAnalysis, ghostMode } = parseResult.data;
    isGhostMode = normalizeGhostMode(ghostMode)
    traceQuestion = question
    traceDatasetId = datasetId || null

    debugLog('[ANALYZE] Ghost Mode question metadata:', {
      datasetId,
      questionLength: question.length,
      ghostMode: isGhostMode,
    });

    // ============================================================================
    // RATE LIMIT - 30 analyses per minute per user
    // ============================================================================
    const session = await auth();
    const userId = session?.user?.id;
    const userEmail = session?.user?.email;
    const userRole = session?.user?.role ?? null;
    traceUserId = userId || null

    const hasUnlimitedCredits = Boolean(userId && (isSuperAdminUserId(userId) || isUnlimitedCreditRole(userRole)));

    if (!userId) {
      return Response.json({
        success: false,
        error: "Unauthorized",
        answer: "Please sign in to analyze a dataset.",
        insight: "Sign-in required",
        explanation: "Dataset analysis is available only to signed-in users.",
        recommendation: "Sign in and select one of your datasets.",
        data: [],
        chartType: "table",
      }, { status: 401 });
    }

    if (!checkRateLimit(`analyze:${userId || "anonymous"}`, 30, 60_000)) {
      return Response.json({
        success: false,
        error: "Rate limit exceeded",
        answer: "Too many requests. Please wait a moment before asking another question.",
        insight: "Rate limited",
        explanation: "You've reached the analysis rate limit.",
        recommendation: "Wait a minute and try again.",
        data: [],
        chartType: "table",
      }, { status: 429 });
    }

    // ============================================================================
    // CREDIT & ENFORCEMENT CHECK - Check credits and usage limits
    // ============================================================================
    let subscriptionTier = "free"

    if (userId) {
      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, userId),
      })
      subscriptionTier = profile?.subscriptionTier || "free"
    }

    const effectiveUserId = userId
    const allowUseclevrCloudFallback = effectiveUserId
      ? await getUseClevrCloudFallbackAllowed(effectiveUserId)
      : true

    if (effectiveUserId && !hasUnlimitedCredits) {
      const spendingLimitCheck = await checkSpendingLimits(effectiveUserId)
      if (spendingLimitCheck.blocked) {
        await logAiCost({
          userId: effectiveUserId,
          subscriptionPlan: subscriptionTier,
          provider: "system",
          model: "system",
          actionType: "dataset_analysis",
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostEur: 0,
          creditsCharged: 0,
          requestStatus: "blocked",
          errorMessage: spendingLimitCheck.reason,
        })
        return Response.json({
          success: false,
          error: spendingLimitCheck.reason || "Spending limit reached.",
          answer: "Your spending limit has been reached.",
          insight: "Spending limit reached",
          explanation: spendingLimitCheck.reason || "Upgrade your plan or adjust your spending limits.",
          recommendation: "Visit settings to adjust spending limits or upgrade your plan.",
          data: [],
          chartType: "table",
          upgradeRequired: true,
          remainingCredits: 0,
        }, { status: 402 })
      }

      const operationId = `analysis:${effectiveUserId}:${crypto.randomUUID()}`
      const reservation = await reserveCredits({
        userId: effectiveUserId,
        operationId,
        idempotencyKey: request.headers.get("idempotency-key") || operationId,
        feature: "standard_analysis",
        source: "api",
        role: userRole,
        email: userEmail,
        metadata: { datasetId: datasetId || null },
      })
      if (!reservation.success) {
        await logAiCost({
          userId: effectiveUserId,
          subscriptionPlan: subscriptionTier,
          provider: "system",
          model: "system",
          actionType: "dataset_analysis",
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostEur: 0,
          creditsCharged: 0,
          requestStatus: "blocked",
          errorMessage: reservation.error,
        })
        return Response.json({
          success: false,
          error: "Insufficient credits",
          answer: "You don't have enough AI credits for this analysis.",
          insight: "Credit limit reached",
          explanation: reservation.error || "Upgrade your plan or purchase more credits.",
          recommendation: "Visit the subscription page to upgrade.",
          data: [],
          chartType: "table",
          upgradeRequired: true,
          remainingCredits: reservation.availableCredits,
        }, { status: 402 })
      }
      creditOperationId = operationId
      reservedAnalysisCredits = reservation.reservedCredits

      const enforcementCheck = hasUnlimitedCredits
        ? { allowed: true }
        : await checkActionEnforcement(effectiveUserId, "dataset_analysis", userRole, userEmail)
      if (!enforcementCheck.allowed) {
        await releaseCredits(operationId, "usage_limit_blocked")
        await logAiCost({
          userId: effectiveUserId,
          subscriptionPlan: subscriptionTier,
          provider: "system",
          model: "system",
          actionType: "dataset_analysis",
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostEur: 0,
          creditsCharged: 0,
          requestStatus: "blocked",
          errorMessage: enforcementCheck.reason,
        })
        return Response.json({
          success: false,
          error: enforcementCheck.reason || "Usage limit reached",
          answer: "You've reached a usage limit for this action.",
          insight: "Usage limit",
          explanation: enforcementCheck.upgradeMessage || "Upgrade your plan for higher limits.",
          recommendation: "Visit the subscription page to upgrade.",
          data: [],
          chartType: "table",
          upgradeRequired: true,
          usage: enforcementCheck.currentUsage,
        }, { status: 402 })
      }

      await incrementDailyRequestCount(effectiveUserId)
    }

    // ============================================================================
    // USAGE LIMIT CHECK - Check for free tier limits
    // ============================================================================

    // If datasetId provided but no precomputedAnalysis/data, fetch from DB
    let analysisToUse = precomputedAnalysis;
    if (datasetId && !data && !precomputedAnalysis) {
      let storedDataset;
      if (effectiveUserId) {
        storedDataset = await db.query.datasets.findFirst({
          where: and(eq(datasets.id, datasetId), eq(datasets.userId, effectiveUserId)),
        });
      }
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

    let requestDataset: Record<string, unknown>[] = [];
    let requestColumns: string[] = [];
    let requestBusinessModel: BusinessModel = "generic";
    let requestDatasetType: string | null = null;
    let requestDatasetName: string | null = null;

    // Persisted dataset IDs always load owner-scoped server data.
    if (datasetId) {
      debugLog('[ANALYZE] Loading dataset from database...');
      try {
        let storedDataset;
        if (effectiveUserId) {
          storedDataset = await db.query.datasets.findFirst({
            where: and(eq(datasets.id, datasetId), eq(datasets.userId, effectiveUserId)),
          });
        }

        if (!storedDataset) {
          return Response.json({
            success: false,
            error: "Dataset not found",
            answer: "I could not find that dataset.",
            insight: "Dataset unavailable",
            explanation: "The selected dataset does not exist or belongs to another account.",
            recommendation: "Select one of your datasets or upload a new file.",
            data: [],
            chartType: "table",
          }, { status: 404 });
        }

        const precomputedMetrics = storedDataset.precomputedMetrics;
        const precomputedAnalysis = storedDataset.analysis;
        requestDataset = (storedDataset.data as Record<string, unknown>[]) || [];

        if (requestDataset.length === 0) {
          const rows = await db.query.datasetRows.findMany({
            where: eq(datasetRows.datasetId, datasetId),
            columns: { data: true },
            orderBy: (rows, { asc }) => [asc(rows.rowIndex)],
          });
          requestDataset = rows.map((row) => row.data as Record<string, unknown>);
        }

        requestColumns = (storedDataset.columns as string[]) || Object.keys(requestDataset[0] || {});
        requestDatasetType = storedDataset.datasetType;
        requestDatasetName = storedDataset.name;
        requestBusinessModel = resolveBusinessModel({
          explicit: storedDataset.businessModel,
          uploadSource:
            precomputedAnalysis && typeof precomputedAnalysis === "object"
              ? String((precomputedAnalysis as Record<string, unknown>).uploadSource || "")
              : "",
          datasetType: storedDataset.datasetType,
          columns: requestColumns,
          datasetName: storedDataset.name,
          analysis: precomputedAnalysis,
        });

        if (precomputedAnalysis && precomputedMetrics) {
          try {
            initializeMCPContext(datasetId, precomputedMetrics as unknown as PrecomputedMetrics);
            debugLog('[ANALYZE] MCP context initialized with precomputed metrics');
          } catch (mcpErr) {
            debugLog('[ANALYZE] MCP context init skipped:', mcpErr);
          }
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
        }, { status: 500 });
      }
    } else if (data && Array.isArray(data) && data.length > 0) {
      debugLog('[ANALYZE] Loading dataset into memory...');
      try {
        requestDataset = data;
        requestColumns = columns || Object.keys(data[0] || {});
        requestDatasetType =
          precomputedAnalysis && typeof precomputedAnalysis === "object"
            ? String((precomputedAnalysis as Record<string, unknown>).datasetType || (precomputedAnalysis as Record<string, unknown>).dataset_type || "")
            : null;
        requestBusinessModel = resolveBusinessModel({
          explicit:
            precomputedAnalysis && typeof precomputedAnalysis === "object"
              ? String((precomputedAnalysis as Record<string, unknown>).businessModel || (precomputedAnalysis as Record<string, unknown>).business_model || "")
              : "",
          columns: requestColumns,
          analysis: precomputedAnalysis,
        });
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
    }

    // Check if dataset is loaded
    if (requestDataset.length === 0) {
      debugLog('[ANALYZE] No dataset loaded');
      return Response.json({
        success: false,
        error: "No dataset loaded",
        answer: "No dataset loaded. Please upload a dataset first.",
        insight: "No data available",
        explanation: "Please upload a CSV or Excel file to analyze.",
        recommendation: "Upload a dataset to get started.",
        data: [],
        chartType: "table",
      });
    }

    // Get available columns
    let availableColumns: string[] = requestColumns;
    if (availableColumns.length === 0) {
      availableColumns = Object.keys(requestDataset[0] || {});
    }
    debugLog('[ANALYZE] Available columns:', availableColumns.length);
    const businessSemanticProfile = buildBusinessSemanticProfile({
      datasetId: datasetId || "request_dataset",
      datasetType: requestDatasetType || requestBusinessModel,
      businessModel: requestBusinessModel,
      datasetName: requestDatasetName,
      columns: availableColumns,
      rows: requestDataset,
    });

    // Step 1: Generate SQL query
    let sqlQuery: string;
    try {
      debugLog('[ANALYZE] Generating SQL query...');
      sqlQuery = await generateQuery(question, availableColumns);
      debugLog('[ANALYZE] Generated SQL metadata:', {
        generatedSql: Boolean(sqlQuery),
        sqlLength: sqlQuery.length,
        columnCount: availableColumns.length,
      });
    } catch (genError) {
      debugError('[ANALYZE] Query generation failed:', {
        name: genError instanceof Error ? genError.name : "NonError",
        message: genError instanceof Error ? genError.message : String(genError),
      });
      // Fallback to simple query
      sqlQuery = 'SELECT * FROM dataset LIMIT 50';
      debugLog('[ANALYZE] Using fallback query metadata:', {
        fallbackSql: true,
        sqlLength: sqlQuery.length,
      });
    }

    // Step 2: Execute SQL query
    let result: Record<string, unknown>[] = [];
    let queryError: string | null = null;

    try {
      debugLog('[ANALYZE] Executing query...');
      result = runQueryJS(sqlQuery, requestDataset);
      debugLog('[ANALYZE] Query returned:', result.length, 'rows');
    } catch (execError: any) {
      queryError = execError?.message || 'Unknown query error';
      debugError('[ANALYZE] Query execution failed:', queryError);

      // Try simpler fallback query
      try {
        debugLog('[ANALYZE] Trying fallback query...');
        result = runQueryJS('SELECT * FROM dataset LIMIT 10', requestDataset);
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
       let mcpToolsPrompt = '';
       if (datasetId && precomputedAnalysis) {
         mcpToolsPrompt = buildMCPToolsPrompt(datasetId);
       }

       let businessProfilePrompt = "";
        let skillResult = null;
        try {
          const businessProfile = effectiveUserId ? await getCompanySetup(effectiveUserId) : null;

         // Run Skill Engine analysis for expert perspective
         if (datasetId && (analysisToUse ?? precomputedAnalysis)) {
           const skillContext = {
             question,
             datasetId,
             rows: requestDataset,
             columns: availableColumns,
             precomputedAnalysis: analysisToUse ?? precomputedAnalysis,
             businessProfile: businessProfile ? {
               industry: businessProfile.companyInfo.industry,
               country: businessProfile.companyInfo.country || businessProfile.companyInfo.countryOfRegistration,
               currency: businessProfile.currencySettings.primaryCurrency,
               companySize: businessProfile.companyInfo.companySize || businessProfile.companyInfo.employeeCount,
               businessType: businessProfile.companyInfo.businessType,
               fiscalYear: businessProfile.companyInfo.fiscalYearStart,
               goals: [businessProfile.businessGoals.growthTarget, businessProfile.businessGoals.profitTarget].filter(Boolean),
             } : undefined,
           };
           skillResult = skillEngine.analyze(skillContext);
           debugLog('[ANALYZE] Skill engine result:', skillResult?.expert);
         }

          businessProfilePrompt = businessProfile ? `\n\nBUSINESS PROFILE CONTEXT\nUse only these user-confirmed business profile values. Do not assume missing business data. If a value is missing, say it is missing and explain how that limits confidence.\n${buildBusinessProfileContext(businessProfile)}\n` : "";
          const contextSource = (analysisToUse ?? precomputedAnalysis) as {
            business_analysis?: {
              businessProfileContext?: unknown;
            };
          } | null | undefined;
          let profileCalculationLayer = contextSource?.business_analysis?.businessProfileContext;
          if (!profileCalculationLayer && requestDataset.length > 0 && businessProfile) {
            const detectedColumns = detectBusinessColumns(requestDataset);
            const businessAnalysis = analyzeBusinessData(requestDataset, detectedColumns);
            const kpisWithCosts = businessAnalysis.kpis as typeof businessAnalysis.kpis & {
              totalCost?: number | null;
            };
            const datasetCosts =
              typeof kpisWithCosts.totalCost === "number"
                ? kpisWithCosts.totalCost
                : typeof businessAnalysis.kpis.totalRevenue === "number" && typeof businessAnalysis.kpis.totalProfit === "number"
                  ? businessAnalysis.kpis.totalRevenue - businessAnalysis.kpis.totalProfit
                  : null;
            profileCalculationLayer = buildProfileCalculationLayer({
              setup: businessProfile,
              rows: requestDataset,
              revenue: businessAnalysis.kpis.totalRevenue,
              datasetCosts,
            });
          }
         if (profileCalculationLayer) {
           businessProfilePrompt += `\nPROFILE-ADJUSTED CALCULATION LAYER\nUse this uploaded-data + Business Profile calculation layer for tax, margin, payroll, fixed-cost, insurance, forecast, cash-flow, and recommendation answers. If warnings or conflicts exist, show them clearly and ask the user to confirm which value should be used before treating the final calculation as definitive.\n${JSON.stringify(profileCalculationLayer, null, 2)}\n`;
         }
       } catch (businessProfileError) {
         debugWarn('[ANALYZE] Business profile context skipped:', businessProfileError);
       }

       const businessModelPrompt = `\n\nSTRICT BUSINESS MODEL CONTEXT\n${getBusinessModelPromptContext(requestBusinessModel)}\nThe assistant must not return KPIs from another business model unless the current dataset columns explicitly support them.\n`;
       const semanticPrompt = buildBusinessSemanticPromptBlock(businessSemanticProfile);
       const prompt = generateAnalysisPrompt(question, result, availableColumns, analysisToUse ?? precomputedAnalysis, null, skillResult) + businessModelPrompt + semanticPrompt + businessProfilePrompt + mcpToolsPrompt;

      try {
        let text: string | null = null;
        let byoAiFailed = false;

        if (!mockAIMode) {
          try {
            const byoAiResult = effectiveUserId ? await generateWithUniversalAiAdapter(effectiveUserId, prompt) : null;
            if (byoAiResult) {
              text = byoAiResult.text;
              traceProvider = byoAiResult.providerName;
              traceModel = byoAiResult.modelName;
              providerStatus = {
                label: providerStatusLabel(byoAiResult.providerType, byoAiResult.providerName),
                state: byoAiResult.mode === "local-only" ? "offline_active" : byoAiResult.fallbackUsed ? "fallback_active" : "connection_healthy",
                message: byoAiResult.mode === "local-only" ? "Offline mode active" : byoAiResult.route === "local" ? "Local AI active" : byoAiResult.fallbackUsed ? "Cloud fallback active" : "Connection healthy",
                fallbackActive: byoAiResult.fallbackUsed,
              };
              logUniversalAiResponse(byoAiResult);
            }
          } catch (byoAiError) {
            if (isLocalAiUnavailableError(byoAiError)) {
              if (creditOperationId) {
                await releaseCredits(creditOperationId, "local_ai_unavailable")
              }
              providerStatus = {
                label: "Offline mode",
                state: "local_unavailable",
                message: "Local provider unavailable",
                fallbackActive: false,
              };
              traceError = byoAiError instanceof Error ? byoAiError.message : "Local provider unavailable";
              return Response.json({
                success: false,
                error: "Local provider unavailable",
                answer: "Offline mode is enabled, but your local AI provider is not reachable.",
                insight: "Local AI unavailable",
                explanation: "UseClevr did not send this dataset to cloud AI because Offline mode is enabled.",
                recommendation: "Start your local AI provider, switch to Auto mode, or switch to Cloud only mode.",
                data: result,
                chartType,
                providerStatus,
              });
            }
            providerStatus = {
              label: "Cloud fallback",
              state: "fallback_active",
              message: "Provider unavailable",
              fallbackActive: true,
            };
            byoAiFailed = true;
            logDefaultCloudFallback(effectiveUserId || "demo", byoAiError);
          }
        }

        if (!text && !mockAIMode && effectiveUserId && !allowUseclevrCloudFallback) {
          if (creditOperationId) {
            await releaseCredits(creditOperationId, "cloud_fallback_disabled")
          }
          providerStatus = {
            label: "Hybrid AI",
            state: "provider_unavailable",
            message: "Cloud fallback disabled",
            fallbackActive: false,
          };
          traceError = byoAiFailed ? "Cloud fallback disabled after provider failure" : "Cloud fallback disabled";
          return Response.json({
            success: false,
            error: "Cloud fallback disabled",
            answer: "UseClevr Cloud fallback is disabled. Please check AI provider settings.",
            insight: "AI provider unavailable",
            explanation: "UseClevr did not send this dataset to cloud AI because cloud fallback is disabled.",
            recommendation: "Enable UseClevr Cloud fallback, connect a working provider, or switch to Cloud only mode.",
            data: result,
            chartType,
            providerStatus,
          }, { status: 503 });
        }

        debugLog(
          text
            ? "[ANALYZE] Using BYOAI response"
            : mockAIMode
              ? "[ANALYZE] Calling Mock AI for response..."
              : "[ANALYZE] Calling Google AI (Gemini) for response...",
        );
        text =
          text ||
          (mockAIMode
            ? await generateMockAnalysisText({ question, resultRows: result })
            : (await generateText({
                model: google("gemini-2.5-flash"),
                prompt,
              })).text);
        if (!mockAIMode && traceProvider !== "gemini-cloud" && !text) {
          traceProvider = "gemini-cloud";
          traceModel = "gemini-2.5-flash";
        }
        answer = text;
        if (mockAIMode) {
          debugLog("[ANALYZE] Mock AI response received");
        } else if (traceProvider === "gemini-cloud") {
          debugLog("[ANALYZE] Gemini response received");
        }

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
      } else if (!answer && datasetId && requestDataset.length === 0) {
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

    traceResponseContent = answer || ""

    let savedTraceId: string | null = null

    // Save trace before returning so the UI can attach feedback to the real trace.
    if (traceUserId && !isGhostMode) {
      const latencyMs = Date.now() - requestStart
      const trace = await createTrace({
        userId: traceUserId,
        datasetId: traceDatasetId,
        prompt: question,
        response: traceResponseContent.slice(0, 5000),
        providerName: traceProvider,
        modelName: traceModel,
        promptVersion: getCurrentPromptVersion(),
        latencyMs,
        tokenCount: 0,
        estimatedCostUsd: 0,
      })
      savedTraceId = trace?.id ?? null
    } else if (traceUserId && isGhostMode) {
      debugLog("[ANALYZE] Ghost Mode active; skipping AI interaction content trace", {
        userId: traceUserId,
        datasetId: traceDatasetId,
      })
    }

      // Finalize credits only for successful AI-backed analysis; ordinary provider errors release reservations.
    if (traceUserId) {
      if (!hasUnlimitedCredits && !llmError) {
        const deductionResult = creditOperationId
          ? await finalizeCredits({
              operationId: creditOperationId,
              actualCredits: reservedAnalysisCredits,
              actualUsage: estimateUsageFromText({
                provider: traceProvider.toLowerCase().includes("gemini") ? "google" : traceProvider.toLowerCase().includes("ollama") ? "ollama" : "openai",
                model: traceModel,
                prompt: question,
                output: answer,
              }),
              metadata: { datasetId: traceDatasetId || null },
            })
          : { success: true, remainingCredits: 0, creditsDeducted: 0 }

        const latencyMs = Date.now() - requestStart
        await logAiCost({
          userId: traceUserId,
          subscriptionPlan: subscriptionTier,
          provider: traceProvider.toLowerCase().includes("gemini") ? "google" : traceProvider.toLowerCase().includes("ollama") ? "ollama" : "openai",
          model: traceModel,
          actionType: "dataset_analysis",
          inputTokens: Math.ceil(question.length / 4),
          outputTokens: Math.ceil(answer.length / 4),
          estimatedCostEur: 0.001,
          creditsCharged: deductionResult.creditsDeducted || 10,
          requestStatus: "success",
          datasetId: traceDatasetId || undefined,
          latencyMs,
        })
      } else if (creditOperationId && llmError) {
        await releaseCredits(creditOperationId, "ai_provider_failed")
      }
    }

    const responseBody = {
      success: true,
      answer,
      insight,
      explanation,
      recommendation,
      data: result,
      chartType,
      metricColumn,
      columns: availableColumns,
      traceId: savedTraceId,
      ghostMode: isGhostMode,
      privacyWarning: isGhostMode ? ghostModeTraceMessage() : undefined,
      providerName: traceProvider,
      modelName: traceModel,
      providerStatus,
    }

    debugLog('[ANALYZE] Returning response with', result.length, 'rows');
    debugLog('========== ANALYZE COMPLETE ==========\n');

    return Response.json(responseBody);

  } catch (error: any) {
    traceError = error?.message || "Unknown error"
    if (creditOperationId) {
      await releaseCredits(creditOperationId, "analysis_request_failed")
    }

    debugError('[ANALYZE] FATAL ERROR:', error);
    debugError('[ANALYZE] Stack:', error?.stack);

    if (traceUserId && !isGhostMode) {
      const latencyMs = Date.now() - requestStart
      createTrace({
        userId: traceUserId,
        datasetId: traceDatasetId,
        prompt: traceQuestion,
        response: traceError || "",
        providerName: traceProvider,
        modelName: traceModel,
        promptVersion: getCurrentPromptVersion(),
        latencyMs,
        error: traceError,
      })
    } else if (traceUserId && isGhostMode) {
      debugLog("[ANALYZE] Ghost Mode active; skipping failed AI interaction content trace", {
        userId: traceUserId,
        datasetId: traceDatasetId,
      })
    }

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
      ghostMode: isGhostMode,
      privacyWarning: isGhostMode ? ghostModeTraceMessage() : undefined,
    });
  }
}

function providerStatusLabel(providerType: string, providerName: string) {
  if (providerType === "ollama") return "Ollama";
  if (providerType === "lm-studio") return "LM Studio";
  if (providerType === "openai-compatible") return "OpenAI Compatible";
  if (providerType === "azure-openai") return "Azure OpenAI";
  if (providerType === "google-gemini") return "Google Gemini";
  if (providerType === "openai") return "OpenAI";
  if (providerType === "anthropic") return "Anthropic";
  return providerName || "AI Provider";
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({ message: "Analysis requests use request-scoped dataset state." });
}
