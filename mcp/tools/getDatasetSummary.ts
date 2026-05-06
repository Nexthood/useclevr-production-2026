import { MCPTool } from '../types';

export const getDatasetSummaryTool: MCPTool = {
  name: 'getDatasetSummary',
  description: 'Get summary information about a dataset',
  inputSchema: {
    type: 'object',
    properties: {
      datasetId: { type: 'string', description: 'The dataset ID' },
    },
    required: ['datasetId'],
  },
};

let cachedDatasetId: string | null = null;
let cachedData: unknown[] | null = null;
let cachedColumns: string[] | null = null;

export function cacheDataset(id: string, data: unknown[], columns: string[]): void {
  cachedDatasetId = id;
  cachedData = data;
  cachedColumns = columns;
}

export async function handleGetDatasetSummary(params: unknown): Promise<{
  datasetId: string;
  filename: string;
  rowCount: number;
  columnCount: number;
  detectedMetrics: string[];
  detectedDimensions: string[];
  currencyInfo: { detected: boolean; symbol?: string };
  dateCoverage: { start: string | null; end: string | null };
  analysisReady: boolean;
}> {
  if (!params || typeof params !== 'object') {
    return {
      datasetId: '',
      filename: '',
      rowCount: 0,
      columnCount: 0,
      detectedMetrics: [],
      detectedDimensions: [],
      currencyInfo: { detected: false },
      dateCoverage: { start: null, end: null },
      analysisReady: false,
    };
  }

  const { datasetId } = params as { datasetId?: string };
  const safeDatasetId = datasetId || '';
  
  if (cachedDatasetId !== safeDatasetId || !cachedData || !cachedColumns) {
    return {
      datasetId: safeDatasetId,
      filename: '',
      rowCount: 0,
      columnCount: 0,
      detectedMetrics: [],
      detectedDimensions: [],
      currencyInfo: { detected: false },
      dateCoverage: { start: null, end: null },
      analysisReady: false,
    };
  }

  const cols = cachedColumns;
  const metrics: string[] = [];
  const dimensions: string[] = [];
  let currencySymbol: string | undefined;
  let dateValues: string[] = [];

  for (const col of cols) {
    const sample = cachedData.slice(0, 100).map((row: any) => row[col]);
    const lowerCol = col.toLowerCase();

    if (lowerCol.includes('revenue') || lowerCol.includes('sales') || lowerCol.includes('amount') || 
        lowerCol.includes('profit') || lowerCol.includes('cost') || lowerCol.includes('price')) {
      metrics.push(col);
    }

    if (lowerCol.includes('region') || lowerCol.includes('country') || lowerCol.includes('product') ||
        lowerCol.includes('category') || lowerCol.includes('customer')) {
      dimensions.push(col);
    }

    if (lowerCol.includes('currency') || lowerCol.includes('symbol')) {
      const uniqueVals = [...new Set(sample.filter(Boolean))];
      if (uniqueVals.length > 0) {
        const val = String(uniqueVals[0]);
        if (val.includes('$') || val.includes('USD') || val.includes('EUR')) {
          currencySymbol = val.includes('$') ? '$' : val.substring(0, 3);
        }
      }
    }

    if (lowerCol.includes('date') || lowerCol.includes('time') || lowerCol.includes('month') || lowerCol.includes('year')) {
      const dateVals = sample.filter((v: unknown) => v && String(v).match(/\d{4}/));
      dateValues.push(...dateVals.slice(0, 50).map(String));
    }
  }

  let startDate: string | null = null;
  let endDate: string | null = null;
  if (dateValues.length > 0) {
    const sorted = [...dateValues].sort();
    startDate = sorted[0] || null;
    endDate = sorted[sorted.length - 1] || null;
  }

  return {
    datasetId: safeDatasetId,
    filename: safeDatasetId,
    rowCount: cachedData.length,
    columnCount: cols.length,
    detectedMetrics: metrics,
    detectedDimensions: dimensions,
    currencyInfo: { detected: !!currencySymbol, symbol: currencySymbol },
    dateCoverage: { start: startDate, end: endDate },
    analysisReady: cachedData.length > 0 && cols.length > 0,
  };
}