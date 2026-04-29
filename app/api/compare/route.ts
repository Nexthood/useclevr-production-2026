import { debugLog, debugError, debugWarn } from "@/lib/debug"

// app/api/compare/route.ts
// Dataset Comparison API

import { NextResponse } from 'next/server';
import { compareDatasets } from '@/lib/dataset-comparator';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { datasetA, datasetB } = body;
    
    if (!datasetA || !datasetB) {
      return NextResponse.json(
        { error: 'Both datasetA and datasetB are required' },
        { status: 400 }
      );
    }
    
    if (!datasetA.data || !datasetB.data) {
      return NextResponse.json(
        { error: 'Both datasets must include data' },
        { status: 400 }
      );
    }
    
    debugLog('[COMPARE] Comparing datasets:', datasetA.name, 'vs', datasetB.name);
    
    const result = await compareDatasets(
      { id: datasetA.id, name: datasetA.name, data: datasetA.data },
      { id: datasetB.id, name: datasetB.name, data: datasetB.data }
    );
    
    debugLog('[COMPARE] Found', result.metrics.length, 'comparable metrics');
    
    return NextResponse.json({
      success: true,
      ...result
    });
    
  } catch (error: any) {
    debugError('[COMPARE] Error:', error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
