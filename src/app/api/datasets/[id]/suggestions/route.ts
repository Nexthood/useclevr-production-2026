import { debugError, debugLog } from "@/lib/utils/debug";
import { auth } from '@/lib/auth/auth';

// app/api/datasets/[id]/suggestions/route.ts
// Get smart question suggestions for a dataset

import type { DatasetRecord } from '@/lib/data/dataset-intelligence';
import {
  buildDatasetIntelligence,
  detectDatasetTypeFromColumns,
  fallbackSuggestionsForBusinessModel,
  fallbackSuggestionsForDatasetType,
  generateSuggestions,
} from '@/lib/data/dataset-intelligence';
import { resolveBusinessModel } from '@/lib/data/business-model';
import { db } from '@/lib/db';
import { datasetRows, datasets } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    debugLog('[SUGGESTIONS] Getting suggestions for dataset:', id);

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
    
    const columns = Array.isArray(dataset.columns) ? dataset.columns : [];
    const datasetType = detectDatasetTypeFromColumns(columns, dataset.name);
    const businessModel = resolveBusinessModel({
      explicit: dataset.businessModel,
      uploadSource:
        dataset.analysis && typeof dataset.analysis === "object"
          ? String((dataset.analysis as Record<string, unknown>).uploadSource || "")
          : "",
      datasetType: dataset.datasetType,
      columns,
      datasetName: dataset.name,
      analysis: dataset.analysis,
    });
    const businessModelFallback = fallbackSuggestionsForBusinessModel(businessModel);

    if (data.length === 0) {
      return NextResponse.json({
        suggestions: businessModelFallback,
        datasetId: id,
        datasetName: dataset.name,
        datasetType,
        businessModel,
        fallback: true,
      });
    }

    // Build intelligence
    const intelligence = buildDatasetIntelligence(data as DatasetRecord[]);
    
    // Generate suggestions
    const suggestions = generateSuggestions(intelligence, dataset.name);
    const safeSuggestions = suggestions.length >= 10
      ? suggestions
      : [...new Set([...suggestions, ...businessModelFallback, ...fallbackSuggestionsForDatasetType(datasetType)])].slice(0, 12);

    debugLog('[SUGGESTIONS] Generated', safeSuggestions.length, 'suggestions');

    return NextResponse.json({
      suggestions: safeSuggestions,
      datasetId: id,
      datasetName: dataset.name,
      datasetType,
      businessModel,
    });

  } catch (error: any) {
    debugError('[SUGGESTIONS] Error:', error.message);
    return NextResponse.json({
      suggestions: fallbackSuggestionsForDatasetType('Generic'),
      error: error.message,
      fallback: true,
    });
  }
}
