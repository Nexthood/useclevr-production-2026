/**
 * Dataset Comparison Engine
 * 
 * Compares two datasets and generates analysis of differences.
 * Uses DuckDB-style aggregations for calculations.
 */

import { buildDatasetIntelligence, DatasetIntelligence, DatasetRecord } from './dataset-intelligence';

export interface ComparisonMetric {
  metric: string;
  datasetA: string;
  datasetB: string;
  valueA: number;
  valueB: number;
  absoluteChange: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface MatchingColumn {
  column: string;
  type: 'numeric' | 'categorical' | 'date';
  inBoth: boolean;
  matchPercent: number;
}

export interface ComparisonResult {
  datasetA: { id: string; name: string; rowCount: number };
  datasetB: { id: string; name: string; rowCount: number };
  matchingColumns: MatchingColumn[];
  metrics: ComparisonMetric[];
  summary: string;
  narrative: string;
}

/**
 * Compare two datasets
 */
export async function compareDatasets(
  datasetA: { id: string; name: string; data: Record<string, unknown>[] },
  datasetB: { id: string; name: string; data: Record<string, unknown>[] }
): Promise<ComparisonResult> {
  const metrics: ComparisonMetric[] = [];
  
  // Build intelligence for both datasets
  const intelA = buildDatasetIntelligence(datasetA.data as DatasetRecord[]);
  const intelB = buildDatasetIntelligence(datasetB.data as DatasetRecord[]);
  
  // Find matching numeric columns
  const numericA = intelA.metrics.numericColumns;
  const numericB = intelB.metrics.numericColumns;
  
  // Find common numeric columns
  const commonNumeric = numericA.filter(col => numericB.includes(col));
  
  // Calculate comparison metrics for each common column
  for (const col of commonNumeric) {
    const valueA = aggregateSum(datasetA.data, col);
    const valueB = aggregateSum(datasetB.data, col);
    
    const absoluteChange = valueB - valueA;
    const changePercent = valueA !== 0 ? ((valueB - valueA) / Math.abs(valueA)) * 100 : 0;
    
    let trend: 'up' | 'down' | 'stable';
    if (changePercent > 3) trend = 'up';
    else if (changePercent < -3) trend = 'down';
    else trend = 'stable';
    
    metrics.push({
      metric: col,
      datasetA: datasetA.name,
      datasetB: datasetB.name,
      valueA,
      valueB,
      absoluteChange,
      changePercent,
      trend
    });
  }
  
  // Check for columns in dataset A but not B
  const onlyInA = numericA.filter(col => !numericB.includes(col));
  const onlyInB = numericB.filter(col => !numericA.includes(col));
  
  // Build matching columns info
  const allColumns = [...new Set([...intelA.schema.columns.map(c => c.name), ...intelB.schema.columns.map(c => c.name)])];
  const matchingColumns: MatchingColumn[] = allColumns.map(col => {
    const inA = intelA.schema.columns.find(c => c.name === col);
    const inB = intelB.schema.columns.find(c => c.name === col);
    
    return {
      column: col,
      type: (inA?.type || inB?.type || 'numeric') as 'numeric' | 'categorical' | 'date',
      inBoth: !!inA && !!inB,
      matchPercent: (inA && inB) ? 100 : 0
    };
  });
  
  // Generate summary
  const summary = generateComparisonSummary(metrics, datasetA.name, datasetB.name);
  
  // Generate AI narrative
  const narrative = await generateComparisonNarrative(metrics, datasetA.name, datasetB.name);
  
  return {
    datasetA: {
      id: datasetA.id,
      name: datasetA.name,
      rowCount: datasetA.data.length
    },
    datasetB: {
      id: datasetB.id,
      name: datasetB.name,
      rowCount: datasetB.data.length
    },
    matchingColumns,
    metrics,
    summary,
    narrative
  };
}

/**
 * Aggregate sum for a column
 */
function aggregateSum(data: Record<string, unknown>[], col: string): number {
  return data.reduce((sum, row) => {
    const val = parseFloat(String(row[col]).replace(/[^0-9.-]/g, ''));
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
}

/**
 * Calculate average
 */
function aggregateAvg(data: Record<string, unknown>[], col: string): number {
  const values = data
    .map(row => parseFloat(String(row[col]).replace(/[^0-9.-]/g, '')))
    .filter(v => !isNaN(v));
  
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Generate comparison summary
 */
function generateComparisonSummary(
  metrics: ComparisonMetric[],
  nameA: string,
  nameB: string
): string {
  if (metrics.length === 0) {
    return `No common metrics found between ${nameA} and ${nameB}.`;
  }
  
  const increases = metrics.filter(m => m.trend === 'up');
  const decreases = metrics.filter(m => m.trend === 'down');
  
  let summary = `Compared ${metrics.length} common metrics between ${nameA} and ${nameB}.`;
  
  if (increases.length > 0) {
    summary += ` ${increases.length} metric${increases.length > 1 ? 's' : ''} increased.`;
  }
  
  if (decreases.length > 0) {
    summary += ` ${decreases.length} metric${decreases.length > 1 ? 's' : ''} decreased.`;
  }
  
  return summary;
}

/**
 * Generate AI narrative explanation
 */
async function generateComparisonNarrative(
  metrics: ComparisonMetric[],
  nameA: string,
  nameB: string
): Promise<string> {
  if (metrics.length === 0) {
    return `No common metrics found for comparison between ${nameA} and ${nameB}.`;
  }
  
  const metricText = metrics.map(m => {
    const change = m.changePercent >= 0 ? `+${m.changePercent.toFixed(2)}%` : `${m.changePercent.toFixed(2)}%`;
    return `- ${m.metric}: ${m.valueA.toLocaleString()} → ${m.valueB.toLocaleString()} (${change})`;
  }).join('\n');
  
  const prompt = `Given this dataset comparison, provide a brief 2-3 sentence analysis:\n\n${nameA} vs ${nameB}:\n${metricText}\n\nAnalysis:`;
  
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        columns: metrics.map(m => m.metric),
        sampleData: [],
        rowCount: 0
      })
    });
    
    if (response.ok) {
      return await response.text();
    }
  } catch {
    // Fallback to simple summary
  }
  
  // Simple fallback
  const topIncrease = metrics
    .filter(m => m.trend === 'up')
    .sort((a, b) => b.changePercent - a.changePercent)[0];
  
  const topDecrease = metrics
    .filter(m => m.trend === 'down')
    .sort((a, b) => a.changePercent - b.changePercent)[0];
  
  let narrative = '';
  
  if (topIncrease) {
    narrative += `${topIncrease.metric} increased by ${topIncrease.changePercent.toFixed(2)}% from ${topIncrease.valueA.toLocaleString()} to ${topIncrease.valueB.toLocaleString()}. `;
  }
  
  if (topDecrease) {
    narrative += `${topDecrease.metric} decreased by ${Math.abs(topDecrease.changePercent).toFixed(2)}%.`;
  }
  
  return narrative || 'Mixed performance across metrics.';
}
