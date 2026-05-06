import { debugLog, debugError, debugWarn } from "@/lib/debug"

import { executeTool, cacheDataset } from '../index';

let currentDatasetId: string | null = null;
let currentData: unknown[] | null = null;
let currentColumns: string[] | null = null;

export function setAnalyzeContext(datasetId: string, data: unknown[], columns: string[]): void {
  currentDatasetId = datasetId;
  currentData = data;
  currentColumns = columns;
  cacheDataset(datasetId, data, columns);
}

export async function getDatasetSummarySafe(datasetId: string): Promise<unknown> {
  if (!datasetId || typeof datasetId !== 'string') {
    return null;
  }
  try {
    return await executeTool('getDatasetSummary', { datasetId });
  } catch (error) {
    debugError('[MCP] getDatasetSummary failed:', error);
    return null;
  }
}

export function getAnalyzeMCPIntegration() {
  return {
    ping: () => ({ ok: true, tool: 'ping' }),
    getDatasetSummary: getDatasetSummarySafe,
  };
}