import { debugError, debugLog } from "@/lib/utils/debug";

// app/api/datasets/[id]/suggestions/route.ts
// Get smart question suggestions for a dataset

import type { DatasetRecord } from '@/lib/data/dataset-intelligence';
import { buildDatasetIntelligence, generateSuggestions } from '@/lib/data/dataset-intelligence';
import { db } from '@/lib/db';
import { datasets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    debugLog('[SUGGESTIONS] Getting suggestions for dataset:', id);

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
      return NextResponse.json({
        suggestions: []
      });
    }

    // Build intelligence
    const intelligence = buildDatasetIntelligence(data as DatasetRecord[]);
    
    // Generate suggestions
    const suggestions = generateSuggestions(intelligence);

    debugLog('[SUGGESTIONS] Generated', suggestions.length, 'suggestions');

    return NextResponse.json({
      suggestions,
      datasetId: id,
      datasetName: dataset.name
    });

  } catch (error: any) {
    debugError('[SUGGESTIONS] Error:', error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
