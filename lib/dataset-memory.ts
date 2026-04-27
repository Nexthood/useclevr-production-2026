/**
 * AI Dataset Memory
 * 
 * Stores previous dataset intelligence and detects similar datasets.
 * Uses schema-based similarity detection.
 */

import { buildDatasetIntelligence, DatasetIntelligence, DatasetRecord } from './dataset-intelligence';

export interface DatasetMemory {
  id: string;
  name: string;
  schema: {
    columns: string[];
    numericColumns: string[];
    categoricalColumns: string[];
    dateColumns: string[];
  };
  metrics: {
    rowCount: number;
    columnCount: number;
  };
  storedAt: string;
}

export interface SimilarityResult {
  similarDataset: DatasetMemory | null;
  similarityScore: number;
  insight: string;
  comparison?: {
    metric: string;
    changePercent: number;
    direction: 'up' | 'down';
  };
}

// In-memory store (use database in production)
const datasetMemories = new Map<string, DatasetMemory>();

/**
 * Store dataset intelligence in memory
 */
export function storeDatasetMemory(
  datasetId: string,
  datasetName: string,
  data: Record<string, unknown>[]
): DatasetMemory {
  const intelligence = buildDatasetIntelligence(data as DatasetRecord[]);
  
  const memory: DatasetMemory = {
    id: datasetId,
    name: datasetName,
    schema: {
      columns: intelligence.schema.columns.map(c => c.name),
      numericColumns: intelligence.metrics.numericColumns,
      categoricalColumns: intelligence.dimensions.categoryColumns,
      dateColumns: intelligence.dimensions.timeColumns
    },
    metrics: {
      rowCount: data.length,
      columnCount: intelligence.schema.columns.length
    },
    storedAt: new Date().toISOString()
  };
  
  datasetMemories.set(datasetId, memory);
  
  console.log('[MEMORY] Stored intelligence for dataset:', datasetName);
  
  return memory;
}

/**
 * Get stored memory for a dataset
 */
export function getDatasetMemory(datasetId: string): DatasetMemory | null {
  return datasetMemories.get(datasetId) || null;
}

/**
 * List all stored memories
 */
export function listDatasetMemories(): DatasetMemory[] {
  return Array.from(datasetMemories.values());
}

/**
 * Find similar datasets based on schema
 */
export async function findSimilarDatasets(
  data: Record<string, unknown>[],
  currentDatasetName: string
): Promise<SimilarityResult> {
  // Build intelligence for current dataset
  const intelligence = buildDatasetIntelligence(data as DatasetRecord[]);
  
  const currentColumns = new Set(intelligence.schema.columns.map(c => c.name));
  const currentNumeric = new Set(intelligence.metrics.numericColumns);
  
  let bestMatch: DatasetMemory | null = null;
  let bestScore = 0;
  
  // Compare with all stored memories
  for (const memory of datasetMemories.values()) {
    const storedColumns = new Set(memory.schema.columns);
    const storedNumeric = new Set(memory.schema.numericColumns);
    
    // Calculate schema similarity
    const columnIntersection = [...currentColumns].filter(c => storedColumns.has(c)).length;
    const columnUnion = new Set([...currentColumns, ...storedColumns]).size;
    const columnSimilarity = columnUnion > 0 ? columnIntersection / columnUnion : 0;
    
    // Calculate numeric column similarity
    const numericIntersection = [...currentNumeric].filter(c => storedNumeric.has(c)).length;
    const numericUnion = new Set([...currentNumeric, ...storedNumeric]).size;
    const numericSimilarity = numericUnion > 0 ? numericIntersection / numericUnion : 0;
    
    // Weighted score
    const score = (columnSimilarity * 0.6) + (numericSimilarity * 0.4);
    
    if (score > bestScore && score > 0.3) {
      bestScore = score;
      bestMatch = memory;
    }
  }
  
  // If no similar dataset found
  if (!bestMatch || bestScore < 0.3) {
    return {
      similarDataset: null,
      similarityScore: 0,
      insight: 'No similar datasets found in memory.'
    };
  }
  
  // Generate insight about the comparison
  const insight = await generateSimilarityInsight(
    currentDatasetName,
    bestMatch,
    intelligence,
    bestScore
  );
  
  return {
    similarDataset: bestMatch,
    similarityScore: bestScore,
    insight
  };
}

/**
 * Generate AI-powered insight about similarity
 */
async function generateSimilarityInsight(
  currentName: string,
  similar: DatasetMemory,
  intelligence: DatasetIntelligence,
  score: number
): Promise<string> {
  const similarityPercent = (score * 100).toFixed(2);
  
  // Get column names as strings
  const currentColumnNames = intelligence.schema.columns.map(c => c.name);
  const similarColumnNames = similar.schema.columns;
  const commonColumns = currentColumnNames.filter(c => similarColumnNames.includes(c));
  
  // Generate prompt for AI
  const prompt = `Generate a brief comparison insight between two similar datasets:\n\n` +
    `Current dataset: ${currentName} (${intelligence.metrics.rowCount} rows)\n` +
    `Similar dataset: ${similar.name} (${similar.metrics.rowCount} rows)\n` +
    `Schema similarity: ${similarityPercent}%\n` +
    `Common columns: ${commonColumns.join(', ')}\n\n` +
    `Provide a 1-2 sentence insight about what this comparison might reveal.`;
  
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        columns: currentColumnNames,
        sampleData: [],
        rowCount: intelligence.metrics.rowCount
      })
    });
    
    if (response.ok) {
      return await response.text();
    }
  } catch {
    // Fallback
  }
  
  // Simple fallback insight
  return `Found similar dataset "${similar.name}" (${similarityPercent}% schema match). ` +
    `Both datasets share ${commonColumns.length} common columns: ${commonColumns.slice(0, 3).join(', ')}...`;
}

/**
 * Clear memory for a dataset
 */
export function clearDatasetMemory(datasetId: string): boolean {
  return datasetMemories.delete(datasetId);
}

/**
 * Clear all memories
 */
export function clearAllMemories(): void {
  datasetMemories.clear();
  console.log('[MEMORY] Cleared all stored memories');
}
