import { debugLog, debugError, debugWarn } from "@/lib/debug"

// app/api/datasets/[id]/investigate/route.ts
// AI Investigation Autopilot - automatically analyze dataset and generate findings
// Uses DuckDB for all calculations, AI only generates explanations

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { datasets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { investigateDataset } from '@/lib/investigation-autopilot';
import { storeDatasetMemory, findSimilarDatasets } from '@/lib/dataset-memory';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    debugLog('[INVESTIGATE] Starting investigation for dataset:', id);

    // Get dataset
    const dataset = await db.query.datasets.findFirst({
      where: eq(datasets.id, id),
    });

    if (!dataset) {
      return NextResponse.json(
        { error: 'Dataset not found' },
        { status: 404 }
      );
    }

    const data = (dataset.data as Record<string, unknown>[]) || [];
    
    if (data.length === 0) {
      return NextResponse.json(
        { error: 'Dataset has no data' },
        { status: 400 }
      );
    }

    debugLog('[INVESTIGATE] Analyzing', data.length, 'rows using DuckDB...');

    // Run investigation with DuckDB
    const result = await investigateDataset(id, data);

    debugLog('[INVESTIGATE] Found', result.findings.length, 'findings');
    debugLog('[INVESTIGATE] Executed', result.queries.length, 'DuckDB queries');

    // Store dataset memory for future comparisons
    storeDatasetMemory(id, dataset.name || 'Unknown', data);

    // Find similar datasets
    const similarityResult = await findSimilarDatasets(data, dataset.name || 'Unknown');

    return NextResponse.json({
      success: true,
      findings: result.findings,
      details: result.details,
      queries: result.queries,
      similarity: similarityResult,
      metadata: result.metadata
    });

  } catch (error: any) {
    debugError('[INVESTIGATE] Error:', error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
