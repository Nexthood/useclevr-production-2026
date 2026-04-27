// app/api/datasets/[id]/suggestions/route.ts
// Get smart question suggestions for a dataset

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { datasets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { buildDatasetIntelligence, generateSuggestions, DatasetRecord } from '@/lib/dataset-intelligence';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('[SUGGESTIONS] Getting suggestions for dataset:', id);

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

    console.log('[SUGGESTIONS] Generated', suggestions.length, 'suggestions');

    return NextResponse.json({
      suggestions,
      datasetId: id,
      datasetName: dataset.name
    });

  } catch (error: any) {
    console.error('[SUGGESTIONS] Error:', error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
