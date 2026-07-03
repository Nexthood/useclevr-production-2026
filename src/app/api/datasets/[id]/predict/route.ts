import { debugError, debugLog } from "@/lib/utils/debug";
import { auth } from '@/lib/auth/auth';

// app/api/datasets/[id]/predict/route.ts
// Predictive Insight Engine - detect trends and generate forward-looking insights

import { generatePredictions } from '@/lib/business/predictive-engine';
import { findAccessibleDataset, loadDatasetData } from '@/lib/data/dataset-access';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    debugLog('[PREDICT] Generating predictions for dataset:', id);

    const { dataset, dbUnavailable } = await findAccessibleDataset(id, session.user.id, session.user.role);

    if (dbUnavailable) {
      debugError('[PREDICT] Database unavailable while loading dataset', { datasetId: id });
      return NextResponse.json(
        { error: 'Database is temporarily unavailable. Please try again shortly.' },
        { status: 503 }
      );
    }

    if (!dataset) {
      return NextResponse.json(
        { error: 'Dataset not found' },
        { status: 404 }
      );
    }

    const data = await loadDatasetData(id, dataset);
    
    if (data.length === 0) {
      return NextResponse.json(
        { error: 'Dataset has no data' },
        { status: 400 }
      );
    }

    debugLog('[PREDICT] Analyzing', data.length, 'rows for predictions');

    // Generate predictions
    const result = await generatePredictions(id, data, session.user.id);

    debugLog('[PREDICT] Generated', result.predictions.length, 'predictions and', result.insights.length, 'insights');

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error: unknown) {
    debugError('[PREDICT] Forecast generation failed', {
      datasetId: id,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Forecast could not be generated because of a system error.' },
      { status: 500 }
    );
  }
}
