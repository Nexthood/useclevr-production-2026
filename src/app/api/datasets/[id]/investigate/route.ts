import { debugError, debugLog } from "@/lib/utils/debug";
import { auth } from '@/lib/auth/auth';

// app/api/datasets/[id]/investigate/route.ts
// AI Investigation Autopilot - automatically analyze dataset and generate findings
// Uses DuckDB for all calculations, AI only generates explanations

import { findSimilarDatasets, storeDatasetMemory } from '@/lib/data/dataset-memory';
import { db } from '@/lib/db';
import { datasetRows, datasets } from '@/lib/db/schema';
import { investigateDataset } from '@/lib/utils/investigation-autopilot';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    debugLog('[INVESTIGATE] Starting investigation for dataset:', id);

    // Get dataset
    const dataset = await db.query.datasets.findFirst({
      where: and(eq(datasets.id, id), eq(datasets.userId, session.user.id)),
    });

    if (!dataset) {
      return NextResponse.json(
        { error: 'Dataset not found' },
        { status: 404 }
      );
    }

    let data = (dataset.data as Record<string, unknown>[]) || [];
    if (data.length === 0) {
      const rows = await db.query.datasetRows.findMany({
        where: eq(datasetRows.datasetId, id),
        columns: { data: true },
        orderBy: (rows, { asc }) => [asc(rows.rowIndex)],
      });
      data = rows.map((row) => row.data as Record<string, unknown>);
    }
    
    if (data.length === 0) {
      return NextResponse.json(
        { error: 'Dataset has no data' },
        { status: 400 }
      );
    }

    debugLog('[INVESTIGATE] Analyzing', data.length, 'rows using DuckDB...');

    // Run investigation with DuckDB
    const result = await investigateDataset(id, data, session.user.id);

    debugLog('[INVESTIGATE] Found', result.findings.length, 'findings');
    debugLog('[INVESTIGATE] Executed', result.queries.length, 'DuckDB queries');

    // Store dataset memory for future comparisons
    storeDatasetMemory(id, dataset.name || 'Unknown', data);

    // Find similar datasets
    const similarityResult = await findSimilarDatasets(data, dataset.name || 'Unknown', session.user.id);

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
