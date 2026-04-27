import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { datasets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { analyzeCSV, DatasetRecord, CSVAnalysisResult } from "@/lib/csv-analyzer";
import { analyzeDataset, DatasetAnalysis, generateAIExecutiveSummary } from "@/lib/dataset-analyzer";
import { detectBusinessColumns, analyzeBusinessData } from "@/lib/business-columns";

// ============================================================================
// DATASET ANALYZER - Deterministic, Read-only from Database
// ============================================================================
// This module handles:
// 1. Reading dataset from database (single source of truth)
// 2. Deterministic CSV analysis (no AI parsing)
// 3. Loop detection safeguards
//
// IMPORTANT: This reads from stored dataset, no AI parsing or tool execution.
// ============================================================================

// ============================================================================
// EXECUTION SAFEGUARDS - Prevent loops
// ============================================================================

const analyzeLog: Map<string, { count: number; lastTime: number }> = new Map();
const MAX_ANALYZE_COUNT = 3;
const ANALYZE_TIMEOUT_MS = 60000; // 60 seconds

/**
 * Check for analyze loops
 */
function checkAnalyzeLoop(datasetId: string): { allowed: boolean; message?: string } {
  const now = Date.now();
  const existing = analyzeLog.get(datasetId);
  
  if (existing) {
    if (now - existing.lastTime > ANALYZE_TIMEOUT_MS) {
      analyzeLog.set(datasetId, { count: 1, lastTime: now });
      return { allowed: true };
    }
    
    if (existing.count >= MAX_ANALYZE_COUNT) {
      return { 
        allowed: false, 
        message: `Analysis blocked: Dataset ${datasetId} analyzed ${MAX_ANALYZE_COUNT}+ times recently. Please wait before re-analyzing.` 
      };
    }
    
    analyzeLog.set(datasetId, { count: existing.count + 1, lastTime: now });
  } else {
    analyzeLog.set(datasetId, { count: 1, lastTime: now });
  }
  
  return { allowed: true };
}

/**
 * Log analysis execution
 */
function logAnalyzeExecution(action: string, details: Record<string, any>) {
  console.log(`[ANALYZE] ${action}:`, JSON.stringify({
    ...details,
    timestamp: new Date().toISOString()
  }));
}

// ============================================================================
// Type Definitions
// ============================================================================

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ErrorResponse {
  error: string;
  details?: string;
}

interface AnalysisRequestBody {
  limit?: number;
  includeSample?: boolean;
}

// ============================================================================
// API Route Handler
// ============================================================================

export async function POST(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<CSVAnalysisResult | ErrorResponse>> {
  try {
    const { id }: { id: string } = await params;

    console.log('[ANALYZE] Received dataset ID:', id);

    if (!id || typeof id !== "string" || id.trim() === "") {
      return NextResponse.json<ErrorResponse>(
        { error: "Invalid dataset ID" },
        { status: 400 }
      );
    }

    // ============================================================================
    // SAFEGUARD: Check for analyze loops
    // ============================================================================
    const loopCheck = checkAnalyzeLoop(id);
    if (!loopCheck.allowed) {
      logAnalyzeExecution('LOOP_DETECTED', { datasetId: id });
      return NextResponse.json<ErrorResponse>(
        { error: loopCheck.message ?? 'Analysis temporarily limited. Please retry shortly.' },
        { status: 429 }
      );
    }

    // ============================================================================
    // ANALYSIS INITIATED - Log execution
    // ============================================================================
    logAnalyzeExecution('ANALYSIS_INITIATED', { datasetId: id });

    // Accept any valid ID format (UUID, ds_xxx format, etc.)
    console.log('[ANALYZE] Processing dataset ID:', id);

    let userId: string | null = null;

    const authHeader: string | null = request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token: string = authHeader.slice(7);
      if (token) {
        userId = token;
      }
    }

    if (!userId) {
      const session: unknown = await auth();
      const sessionData = session as { user?: { id?: string } | null };
      userId = sessionData?.user?.id ?? null;
    }

    // Allow anonymous access for testing
    const isDemoMode = process.env.DEMO_MODE === "true" || !userId;
    const effectiveUserId = userId || "demo-user";

    if (!userId && !isDemoMode) {
      return NextResponse.json<ErrorResponse>(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    let body: AnalysisRequestBody = {};
    const contentType: string | null = request.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      try {
        body = await request.json() as AnalysisRequestBody;
      } catch {
        return NextResponse.json<ErrorResponse>(
          { error: "Invalid JSON in request body" },
          { status: 400 }
        );
      }
    }

    // Use full dataset for analysis (no limit - analyze ALL rows)
    const limit: number = body.limit ?? -1; // -1 means no limit

    const dataset: unknown = await db.query.datasets.findFirst({
      where: eq(datasets.id, id),
    });

    if (!dataset) {
      return NextResponse.json<ErrorResponse>(
        { error: "Dataset not found" },
        { status: 404 }
      );
    }

    const datasetData = dataset as {
      id: string;
      name: string;
      status: string;
      rowCount: number;
      columnCount: number;
      columns: string[];
      columnTypes: Record<string, string>;
      data: DatasetRecord[];
    };

    console.log('[ANALYZE] Dataset found:', {
      id: datasetData.id,
      name: datasetData.name,
      status: datasetData.status,
      rowCount: datasetData.rowCount,
      columnCount: datasetData.columnCount,
      columnTypes: datasetData.columnTypes
    });

    // Accept analysis on processing, ready, or completed datasets
    if (datasetData.status !== "completed" && datasetData.status !== "processing" && datasetData.status !== "ready") {
      console.log('[ANALYZE] Invalid status:', datasetData.status);
      return NextResponse.json<ErrorResponse>(
        { error: "Dataset is not ready for analysis", details: `Current status: ${datasetData.status}` },
        { status: 422 }
      );
    }

    // Read data from dataset.data column (single source of truth)
    // Use all data for analysis (limit === -1 means no limit)
    const allData = (datasetData as any).data || [];
    const data: DatasetRecord[] = limit > 0 ? allData.slice(0, limit) : allData;
    
    // DEBUG: Log detailed query info
    console.log('[DEBUG] Query params id:', id);
    console.log('[DEBUG] Dataset ID from DB:', datasetData.id);
    console.log('[DEBUG] IDs match:', id === datasetData.id);
    console.log('[DEBUG] Rows found:', data.length, 'out of', datasetData.rowCount, 'expected');
    console.log('[DEBUG] First row sample:', data.length > 0 ? JSON.stringify(data[0]) : 'none');

    // If we have rowCount but no actual rows, log error
    if (data.length === 0 && datasetData.rowCount > 0) {
      console.error('[DEBUG] FATAL: Dataset has rowCount=%d but 0 rows in data!', datasetData.rowCount);
      return NextResponse.json<ErrorResponse & { _debug?: any }>(
        { 
          error: "Data inconsistency: Dataset shows rows but data column is empty",
          details: `Expected ${datasetData.rowCount} rows but found 0`,
          _debug: {
            requestedId: id,
            actualId: datasetData.id,
            idsMatch: id === datasetData.id
          }
        },
        { status: 500 }
      );
    }

    if (data.length === 0 && datasetData.rowCount === 0) {
      console.log('[ANALYZE] No data available yet - dataset still processing');
      return NextResponse.json<ErrorResponse>(
        { error: "Dataset is still processing", details: "No data rows have been uploaded yet" },
        { status: 422 }
      );
    }

    // Use the comprehensive CSV analyzer (async for FX rate fetching)
    const analysis: CSVAnalysisResult = await analyzeCSV(data);

    // NEW: Run Executive KPI Engine
    const executiveAnalysis: DatasetAnalysis = analyzeDataset(data);
    console.log('[ANALYZE] Executive KPI Engine completed:', {
      totalRows: executiveAnalysis.totalRows,
      totalColumns: executiveAnalysis.totalColumns,
      revenueColumn: executiveAnalysis.revenueColumn,
      totalRevenue: executiveAnalysis.totalRevenue,
      topCategory: executiveAnalysis.topCategory,
      growthPercentage: executiveAnalysis.growthPercentage
    });

    // Compute metrics directly from data (single source of truth)
    // Use full rowCount for total_rows, not limited data length
    analysis.total_rows = datasetData.rowCount;
    analysis.total_columns = data.length > 0 ? Object.keys(data[0]).length : 0;

    // Detect numeric columns directly from data
    const numericCols: string[] = [];
    const dateCols: string[] = [];
    const colTypes: Record<string, string> = {};
    if (data.length > 0) {
      const cols = Object.keys(data[0]);
      for (const col of cols) {
        // Check for numeric
        const hasNumeric = data.some(r => {
          const val = r[col];
          return typeof val === 'number' || 
            (typeof val === 'string' && !isNaN(parseFloat(val)) && isFinite(parseFloat(val)));
        });
        if (hasNumeric) {
          numericCols.push(col);
          colTypes[col] = 'numeric';
        }
        
        // Check for date (only if not already detected as numeric)
        if (!hasNumeric) {
          const hasDate = data.some(r => {
            const val = r[col];
            return typeof val === 'string' && !isNaN(Date.parse(val));
          });
          if (hasDate) {
            dateCols.push(col);
            colTypes[col] = 'date';
          } else {
            colTypes[col] = 'text';
          }
        }
      }
    }

    analysis.numeric_columns = numericCols;
    analysis.date_columns = dateCols;
    analysis.column_types = colTypes;

    // Compute duplicates
    const duplicateCount = data.length - new Set(data.map(r => JSON.stringify(r))).size;
    if (!analysis.data_quality) {
      analysis.data_quality = { missing_counts: {}, duplicates: 0, warnings: [] };
    }
    analysis.data_quality.duplicates = duplicateCount;

    console.log('[ANALYZE] Computed from data - rows:', analysis.total_rows, 'cols:', analysis.total_columns, 'numeric:', numericCols.length, 'dates:', dateCols.length);

    // Add executive KPI analysis to the result
    (analysis as any).executive_analysis = executiveAnalysis;
    (analysis as any).kpi_summary = {
      totalRevenue: executiveAnalysis.totalRevenue,
      avgRevenue: executiveAnalysis.avgRevenue,
      topCategory: executiveAnalysis.topCategory,
      growthPercentage: executiveAnalysis.growthPercentage,
      growthTrend: executiveAnalysis.growthTrend,
      revenueColumn: executiveAnalysis.revenueColumn,
      dateRange: executiveAnalysis.dateRange
    };

    // NEW: Run Business Column Detection & KPI Engine
    console.log('[ANALYZE] Running Business Column Detection...');
    const detectedColumns = detectBusinessColumns(data);
    console.log('[ANALYZE] Detected columns:', {
      revenueColumn: detectedColumns.revenueColumn,
      profitColumn: detectedColumns.profitColumn,
      costColumn: detectedColumns.costColumn,
      dateColumn: detectedColumns.dateColumn,
      productColumn: detectedColumns.productColumn,
      regionColumn: detectedColumns.regionColumn
    });

    // Run Business KPI Analysis
    const businessAnalysis = analyzeBusinessData(data, detectedColumns);
    console.log('[ANALYZE] Business analysis complete:', {
      totalRevenue: businessAnalysis.kpis.totalRevenue,
      totalProfit: businessAnalysis.kpis.totalProfit,
      profitMargin: businessAnalysis.kpis.profitMargin,
      topRegions: businessAnalysis.kpis.topRegions.length,
      topProducts: businessAnalysis.kpis.topProducts.length,
      growthValid: businessAnalysis.kpis.growthValid,
      growthMessage: businessAnalysis.kpis.growthMessage
    });

    // Add business analysis to result
    (analysis as any).business_analysis = {
      kpis: businessAnalysis.kpis,
      breakdowns: businessAnalysis.breakdowns,
      risks: businessAnalysis.risks,
      insights: businessAnalysis.insights,
      recommendations: businessAnalysis.recommendations,
      detectedColumns
    };

    // Generate AI Executive Summary - USE business_analysis data for accurate KPIs
    // This ensures Executive Summary matches the KPI cards
    try {
      // Merge business_analysis data into executiveAnalysis for the summary
      const enrichedAnalysis = {
        ...executiveAnalysis,
        totalRevenue: businessAnalysis.kpis.totalRevenue ?? executiveAnalysis.totalRevenue,
        topProducts: businessAnalysis.kpis.topProducts,
        topRegions: businessAnalysis.kpis.topRegions,
        detectedColumns: detectedColumns,
        growthValid: businessAnalysis.kpis.growthValid,
        growthPercentage: businessAnalysis.kpis.growthPercentage
      };
      const aiSummary = await generateAIExecutiveSummary(enrichedAnalysis);
      (analysis as any).ai_summary = aiSummary;
      console.log('[ANALYZE] AI Executive Summary generated');
    } catch (aiError) {
      console.error('[ANALYZE] Failed to generate AI summary:', aiError);
      (analysis as any).ai_summary = null;
    }

    // Save analysis result to database for persistence
    try {
      await db.update(datasets)
        .set({ 
          analysis: analysis as any,
          updatedAt: new Date()
        })
        .where(eq(datasets.id, id));
      console.log('[ANALYZE] Analysis saved to database for dataset:', id);
    } catch (saveError) {
      console.error('[ANALYZE] Failed to save analysis to database:', saveError);
      // Continue anyway - we still want to return the analysis result
    }

    return NextResponse.json<CSVAnalysisResult>(analysis);
  } catch (error) {
    console.error("Dataset analysis error:", error);

    if (error instanceof Error) {
      if (error.message.includes("P2025")) {
        return NextResponse.json<ErrorResponse>(
          { error: "Dataset not found" },
          { status: 404 }
        );
      }
      if (error.message.includes("P2002")) {
        return NextResponse.json<ErrorResponse>(
          { error: "Duplicate record error" },
          { status: 400 }
        );
      }
      if (error.message.includes("P2003")) {
        return NextResponse.json<ErrorResponse>(
          { error: "Foreign key constraint error" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json<ErrorResponse>(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
