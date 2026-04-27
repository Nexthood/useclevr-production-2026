// app/api/datasets/[id]/predict/route.ts
// Predictive Insight Engine - detect trends and generate forward-looking insights

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { datasets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generatePredictions } from '@/lib/predictive-engine';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('[PREDICT] Generating predictions for dataset:', id);

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

    console.log('[PREDICT] Analyzing', data.length, 'rows for predictions');

    // Generate predictions
    const result = await generatePredictions(id, data);

    console.log('[PREDICT] Generated', result.predictions.length, 'predictions and', result.insights.length, 'insights');

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error: any) {
    console.error('[PREDICT] Error:', error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
