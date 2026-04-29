import { debugLog, debugError, debugWarn } from "@/lib/debug"

// app/api/public/ai/route.ts
// UseClevr AI Data API - External application access
// Endpoints: analyze, investigate, predict, compare

import { NextResponse } from 'next/server';
import { validateAPIKey, hasAPIPermission } from '@/lib/api-key-auth';
import { investigateDataset } from '@/lib/investigation-autopilot';
import { generatePredictions } from '@/lib/predictive-engine';
import { compareDatasets } from '@/lib/dataset-comparator';
import { buildDatasetIntelligence, DatasetRecord } from '@/lib/dataset-intelligence';
import { generateSQLQuery } from '@/lib/ai-query-generator';
import { executeDuckDBQuery } from '@/lib/investigation-autopilot';

// ============================================================================
// AUTHENTICATION
// ============================================================================

async function authenticateRequest(request: Request, requiredPermission: string) {
  const apiKey = request.headers.get('x-api-key');
  
  if (!apiKey) {
    return { error: 'API key required. Include "x-api-key" header.', status: 401 };
  }
  
  const key = await validateAPIKey(apiKey);
  if (!key) {
    return { error: 'Invalid API key', status: 401 };
  }
  
  if (!hasAPIPermission(key, requiredPermission)) {
    return { error: 'Insufficient permissions', status: 403 };
  }
  
  return { key, error: null };
}

// ============================================================================
// MAIN ROUTER
// ============================================================================

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;
    
    switch (action) {
      case 'analyze':
        return handleAnalyze(body);
      case 'investigate':
        return handleInvestigate(body);
      case 'predict':
        return handlePredict(body);
      case 'compare':
        return handleCompare(body);
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: analyze, investigate, predict, compare' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    debugError('[AI-API] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================================================
// ANALYZE ENDPOINT
// ============================================================================

async function handleAnalyze(body: { action: string; dataset: unknown[]; question: string }) {
  const { dataset, question } = body;
  
  if (!dataset || !question) {
    return NextResponse.json(
      { error: 'Required: dataset (array) and question (string)' },
      { status: 400 }
    );
  }
  
  const intelligence = buildDatasetIntelligence(dataset as DatasetRecord[]);
  const sql = await generateSQLQuery(question, intelligence);
  
  let results: Record<string, unknown>[] = [];
  try {
    results = executeDuckDBQuery(sql, dataset as Record<string, unknown>[]);
  } catch (e) {
    debugWarn('[AI-API] Query execution failed:', e);
  }
  
  return NextResponse.json({
    success: true,
    question,
    sql,
    results: results.slice(0, 100),
    result_count: results.length,
    columns: intelligence.schema.columns.map(c => c.name),
    row_count: dataset.length
  });
}

// ============================================================================
// INVESTIGATE ENDPOINT
// ============================================================================

async function handleInvestigate(body: { action: string; dataset: unknown[] }) {
  const { dataset } = body;
  
  if (!dataset || !Array.isArray(dataset)) {
    return NextResponse.json(
      { error: 'Required: dataset (array of objects)' },
      { status: 400 }
    );
  }
  
  const result = await investigateDataset('api-investigation', dataset as Record<string, unknown>[]);
  
  return NextResponse.json({
    success: true,
    findings: result.findings,
    details: result.details,
    queries: result.queries.map(q => ({ name: q.name, description: q.description })),
    metadata: result.metadata
  });
}

// ============================================================================
// PREDICT ENDPOINT
// ============================================================================

async function handlePredict(body: { action: string; dataset: unknown[] }) {
  const { dataset } = body;
  
  if (!dataset || !Array.isArray(dataset)) {
    return NextResponse.json(
      { error: 'Required: dataset (array of objects)' },
      { status: 400 }
    );
  }
  
  const predictions = await generatePredictions('api-prediction', dataset as Record<string, unknown>[]);
  
  return NextResponse.json({
    success: true,
    predictions: predictions.predictions,
    insights: predictions.insights,
    metadata: { row_count: dataset.length }
  });
}

// ============================================================================
// COMPARE ENDPOINT
// ============================================================================

async function handleCompare(body: { action: string; dataset1: unknown[]; dataset2: unknown[]; dataset1_name?: string; dataset2_name?: string }) {
  const { dataset1, dataset2, dataset1_name, dataset2_name } = body;
  
  if (!dataset1 || !dataset2 || !Array.isArray(dataset1) || !Array.isArray(dataset2)) {
    return NextResponse.json(
      { error: 'Required: dataset1 and dataset2 (both arrays)' },
      { status: 400 }
    );
  }
  
  const result = await compareDatasets(
    { id: 'ds1', name: dataset1_name || 'Dataset 1', data: dataset1 as Record<string, unknown>[] },
    { id: 'ds2', name: dataset2_name || 'Dataset 2', data: dataset2 as Record<string, unknown>[] }
  );
  
  return NextResponse.json({
    success: true,
    summary: result.summary,
    metrics: result.metrics,
    narrative: result.narrative,
    matching_columns: result.matchingColumns
  });
}

// ============================================================================
// API INFO
// ============================================================================

export async function GET() {
  return NextResponse.json({
    name: 'UseClevr AI Data API',
    version: '1.0.0',
    endpoints: {
      POST: {
        '/api/public/ai': {
          analyze: { description: 'Ask question about dataset', body: { dataset: 'array', question: 'string' } },
          investigate: { description: 'Auto-investigate dataset', body: { dataset: 'array' } },
          predict: { description: 'Generate predictions', body: { dataset: 'array' } },
          compare: { description: 'Compare two datasets', body: { dataset1: 'array', dataset2: 'array', dataset1_name: 'string', dataset2_name: 'string' } }
        }
      }
    },
    authentication: { header: 'x-api-key', format: 'useclever_<key_id>_<key>' }
  });
}
