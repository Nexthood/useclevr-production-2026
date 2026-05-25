/**
 * Dataset service - handles dataset analysis orchestration
 * P-294: Service layer extraction for dataset operations
 */

import { analyzeDataset } from '../data/dataset-analyzer'

export class DatasetService {
  async analyzeDataset(datasetId: string, options: Record<string, unknown>) {
    const rows = (options.data as any[]) || []
    return analyzeDataset(rows)
  }

  async getDatasetData(datasetId: string) {
    return { id: datasetId, rows: [] }
  }
}

export const datasetService = new DatasetService()