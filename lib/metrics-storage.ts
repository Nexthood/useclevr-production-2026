// ============================================================================
// PRECOMPUTED METRICS STORAGE - Single Source of Truth
// ============================================================================
// Stores all computed metrics for deterministic access by:
// - KPI cards
// - Charts
// - Executive summary
// - Recommendations
// - AI explanations
// ============================================================================

import { PrecomputedMetrics, AIInsightOutput } from './pipeline-types';

// ============================================================================
// IN-MEMORY CACHE (Use Redis in production)
// ============================================================================

// Primary storage - precomputed metrics
const metricsCache: Map<string, PrecomputedMetrics> = new Map();

// Secondary storage - AI insights
const aiInsightsCache: Map<string, AIInsightOutput> = new Map();

// ============================================================================
// METRICS STORAGE
// ============================================================================

/**
 * Store precomputed metrics
 */
export function storeMetrics(datasetId: string, metrics: PrecomputedMetrics): void {
  metricsCache.set(datasetId, metrics);
  console.log(`[STORAGE] Stored metrics for dataset ${datasetId}`);
}

/**
 * Get precomputed metrics
 */
export function getMetrics(datasetId: string): PrecomputedMetrics | null {
  return metricsCache.get(datasetId) || null;
}

/**
 * Check if metrics exist
 */
export function hasMetrics(datasetId: string): boolean {
  return metricsCache.has(datasetId);
}

/**
 * Delete metrics
 */
export function deleteMetrics(datasetId: string): boolean {
  const deleted = metricsCache.delete(datasetId);
  if (deleted) {
    console.log(`[STORAGE] Deleted metrics for dataset ${datasetId}`);
  }
  return deleted;
}

/**
 * Get all dataset IDs with stored metrics
 */
export function getAllMetricDatasetIds(): string[] {
  return Array.from(metricsCache.keys());
}

// ============================================================================
// AI INSIGHTS STORAGE
// ============================================================================

/**
 * Store AI insights
 */
export function storeAIInsights(datasetId: string, insights: AIInsightOutput): void {
  aiInsightsCache.set(datasetId, insights);
  console.log(`[STORAGE] Stored AI insights for dataset ${datasetId}`);
}

/**
 * Get AI insights
 */
export function getAIInsights(datasetId: string): AIInsightOutput | null {
  return aiInsightsCache.get(datasetId) || null;
}

/**
 * Check if AI insights exist
 */
export function hasAIInsights(datasetId: string): boolean {
  return aiInsightsCache.has(datasetId);
}

/**
 * Delete AI insights
 */
export function deleteAIInsights(datasetId: string): boolean {
  return aiInsightsCache.delete(datasetId);
}

// ============================================================================
// COMBINED STORAGE
// ============================================================================

/**
 * Store complete analysis results
 */
export function storeAnalysisResults(
  datasetId: string,
  metrics: PrecomputedMetrics,
  insights: AIInsightOutput
): void {
  storeMetrics(datasetId, metrics);
  storeAIInsights(datasetId, insights);
  console.log(`[STORAGE] Stored complete analysis for dataset ${datasetId}`);
}

/**
 * Get complete analysis results
 */
export function getAnalysisResults(datasetId: string): {
  metrics: PrecomputedMetrics | null;
  insights: AIInsightOutput | null;
} {
  return {
    metrics: getMetrics(datasetId),
    insights: getAIInsights(datasetId),
  };
}

// ============================================================================
// DATABASE INTEGRATION (For production - would use Redis or DB)
// ============================================================================

/**
 * Serialize metrics for database storage
 */
export function serializeMetrics(metrics: PrecomputedMetrics): string {
  return JSON.stringify(metrics);
}

/**
 * Deserialize metrics from database
 */
export function deserializeMetrics(data: string): PrecomputedMetrics | null {
  try {
    return JSON.parse(data) as PrecomputedMetrics;
  } catch (error) {
    console.error('[STORAGE] Failed to deserialize metrics:', error);
    return null;
  }
}

/**
 * Serialize AI insights for database storage
 */
export function serializeAIInsights(insights: AIInsightOutput): string {
  return JSON.stringify(insights);
}

/**
 * Deserialize AI insights from database
 */
export function deserializeAIInsights(data: string): AIInsightOutput | null {
  try {
    return JSON.parse(data) as AIInsightOutput;
  } catch (error) {
    console.error('[STORAGE] Failed to deserialize AI insights:', error);
    return null;
  }
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  metricsCount: number;
  insightsCount: number;
  totalDatasets: number;
} {
  return {
    metricsCount: metricsCache.size,
    insightsCount: aiInsightsCache.size,
    totalDatasets: metricsCache.size,
  };
}

/**
 * Clear all cached data
 */
export function clearAllCache(): void {
  metricsCache.clear();
  aiInsightsCache.clear();
  console.log('[STORAGE] Cleared all cached data');
}

/**
 * Clean up data for specific dataset
 */
export function cleanupDataset(datasetId: string): void {
  deleteMetrics(datasetId);
  deleteAIInsights(datasetId);
  console.log(`[STORAGE] Cleaned up dataset ${datasetId}`);
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate that metrics match expected structure
 */
export function validateMetricsStructure(data: any): data is PrecomputedMetrics {
  if (!data || typeof data !== 'object') return false;
  
  // Check required fields
  const requiredFields = [
    'datasetId',
    'analysisVersion',
    'computedAt',
    'fullDatasetRowCount',
    'totalRevenue',
    'totalProfit',
    'profitMargin',
    'topProducts',
    'topRegions',
    'chartData',
    'validationStatus',
  ];
  
  for (const field of requiredFields) {
    if (!(field in data)) {
      console.warn(`[STORAGE] Missing required field: ${field}`);
      return false;
    }
  }
  
  return true;
}

/**
 * Check if metrics are stale (older than specified hours)
 */
export function areMetricsStale(datasetId: string, maxAgeHours: number = 24): boolean {
  const metrics = getMetrics(datasetId);
  if (!metrics) return true;
  
  const computedAt = new Date(metrics.computedAt).getTime();
  const now = Date.now();
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  
  return (now - computedAt) > maxAgeMs;
}
