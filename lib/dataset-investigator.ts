/**
 * Dataset Investigator
 * 
 * Automatically analyzes a dataset and generates key findings using DuckDB.
 */

import { buildDatasetIntelligence, DatasetIntelligence, DatasetRecord } from './dataset-intelligence';

export interface Finding {
  type: 'top_performer' | 'weak_segment' | 'trend' | 'concentration' | 'outlier' | 'general';
  title: string;
  description: string;
  value?: number;
  percentage?: number;
}

export interface InvestigationResult {
  findings: string[];
  details: Finding[];
  metadata: {
    datasetId: string;
    rowCount: number;
    analyzedAt: string;
  };
}

/**
 * Analyze dataset using DuckDB and generate findings
 */
export async function investigateDataset(
  datasetId: string,
  data: Record<string, unknown>[]
): Promise<InvestigationResult> {
  const findings: Finding[] = [];
  const intelligence = buildDatasetIntelligence(data as DatasetRecord[]);
  const dims = intelligence.dimensions;
  const metrics = intelligence.metrics;
  const cols = intelligence.schema.columns;
  
  // Get key columns
  const numericCols = metrics.numericColumns;
  const categoricalCols = dims.categoryColumns;
  const timeCols = dims.timeColumns;
  const geoCols = dims.geographicColumns;
  
  // Key metrics
  const revenueCol = numericCols.find(c => 
    c.toLowerCase().includes('revenue') || c.toLowerCase().includes('sales') || c.toLowerCase().includes('amount')
  );
  const profitCol = numericCols.find(c => 
    c.toLowerCase().includes('profit') || c.toLowerCase().includes('margin')
  );
  const quantityCol = numericCols.find(c => 
    c.toLowerCase().includes('quantity') || c.toLowerCase().includes('units') || c.toLowerCase().includes('qty')
  );
  
  // 1. TOP PERFORMERS
  if (revenueCol && categoricalCols.length > 0) {
    const groupCol = categoricalCols[0];
    const topResult = analyzeTopPerformers(data, groupCol, revenueCol);
    if (topResult) {
      findings.push(topResult);
    }
  }
  
  if (profitCol && categoricalCols.length > 0) {
    const groupCol = categoricalCols[0];
    const topProfitResult = analyzeTopPerformers(data, groupCol, profitCol);
    if (topProfitResult) {
      findings.push({
        ...topProfitResult,
        type: 'top_performer',
        title: `Top ${groupCol} by ${profitCol}`
      });
    }
  }
  
  // 2. WEAK/LOW PERFORMERS
  if (revenueCol && categoricalCols.length > 0) {
    const groupCol = categoricalCols[0];
    const weakResult = analyzeWeakSegments(data, groupCol, revenueCol);
    if (weakResult) {
      findings.push(weakResult);
    }
  }
  
  // 3. TRENDS (if time column exists)
  if (timeCols.length > 0 && revenueCol) {
    const timeCol = timeCols[0];
    const trendResult = analyzeTrends(data, timeCol, revenueCol);
    if (trendResult) {
      findings.push(trendResult);
    }
  }
  
  // 4. CONCENTRATION RISKS
  if (revenueCol && categoricalCols.length > 0) {
    const groupCol = categoricalCols[0];
    const concentrationResult = analyzeConcentration(data, groupCol, revenueCol);
    if (concentrationResult) {
      findings.push(concentrationResult);
    }
  }
  
  // 5. OUTLIERS
  if (revenueCol) {
    const outlierResult = detectOutliers(data, revenueCol);
    if (outlierResult) {
      findings.push(outlierResult);
    }
  }
  
  // 6. GENERAL STATS
  const totalRevenue = revenueCol 
    ? data.reduce((sum, row) => sum + (parseFloat(String(row[revenueCol]).replace(/[^0-9.-]/g, '')) || 0), 0)
    : 0;
  
  if (totalRevenue > 0) {
    findings.push({
      type: 'general',
      title: 'Total Revenue',
      description: `Total ${revenueCol}: ${totalRevenue.toLocaleString()}`,
      value: totalRevenue
    });
  }
  
  findings.push({
    type: 'general',
    title: 'Dataset Size',
    description: `Dataset contains ${data.length.toLocaleString()} rows and ${cols.length} columns`
  });
  
  // Generate natural language explanations
  const findingsText = await generateFindingExplanations(findings, intelligence);
  
  return {
    findings: findingsText,
    details: findings,
    metadata: {
      datasetId,
      rowCount: data.length,
      analyzedAt: new Date().toISOString()
    }
  };
}

/**
 * Analyze top performing categories
 */
function analyzeTopPerformers(
  data: Record<string, unknown>[],
  groupCol: string,
  valueCol: string
): Finding | null {
  const agg: Record<string, number> = {};
  let total = 0;
  
  for (const row of data) {
    const key = String(row[groupCol] || 'Unknown');
    const val = parseFloat(String(row[valueCol]).replace(/[^0-9.-]/g, '')) || 0;
    agg[key] = (agg[key] || 0) + val;
    total += val;
  }
  
  if (Object.keys(agg).length === 0) return null;
  
  const sorted = Object.entries(agg)
    .map(([key, val]) => ({ key, val, pct: total > 0 ? (val / total) * 100 : 0 }))
    .sort((a, b) => b.val - a.val);
  
  const top = sorted[0];
  const groupName = groupCol.replace(/_/g, ' ');
  
  return {
    type: 'top_performer',
    title: `Top ${groupName}`,
    description: `${top.key} generates the largest share of ${valueCol.toLowerCase()} (${top.pct.toFixed(2)}% of total)`,
    value: top.val,
    percentage: top.pct
  };
}

/**
 * Analyze weak/low performing segments
 */
function analyzeWeakSegments(
  data: Record<string, unknown>[],
  groupCol: string,
  valueCol: string
): Finding | null {
  const agg: Record<string, number> = {};
  let total = 0;
  
  for (const row of data) {
    const key = String(row[groupCol] || 'Unknown');
    const val = parseFloat(String(row[valueCol]).replace(/[^0-9.-]/g, '')) || 0;
    agg[key] = (agg[key] || 0) + val;
    total += val;
  }
  
  if (Object.keys(agg).length === 0) return null;
  
  const sorted = Object.entries(agg)
    .map(([key, val]) => ({ key, val, pct: total > 0 ? (val / total) * 100 : 0 }))
    .sort((a, b) => a.val - b.val);
  
  const bottom = sorted[0];
  const groupName = groupCol.replace(/_/g, ' ');
  
  // Only report if it's meaningfully low (less than 10% of total)
  if (bottom.pct > 10) return null;
  
  return {
    type: 'weak_segment',
    title: `Lowest ${groupName}`,
    description: `${bottom.key} has the lowest ${valueCol.toLowerCase()} (${bottom.pct.toFixed(2)}% of total)`,
    value: bottom.val,
    percentage: bottom.pct
  };
}

/**
 * Analyze trends over time
 */
function analyzeTrends(
  data: Record<string, unknown>[],
  timeCol: string,
  valueCol: string
): Finding | null {
  // Group by time period
  const timeValues = data.map(row => row[timeCol]).filter(Boolean);
  if (timeValues.length === 0) return null;
  
  // Try to parse and sort by time
  const timeData: { time: string; value: number }[] = [];
  for (const row of data) {
    const timeVal = String(row[timeCol]);
    const numVal = parseFloat(String(row[valueCol]).replace(/[^0-9.-]/g, '')) || 0;
    timeData.push({ time: timeVal, value: numVal });
  }
  
  // Sort by time (basic string sorting for now)
  timeData.sort((a, b) => a.time.localeCompare(b.time));
  
  if (timeData.length < 2) return null;
  
  // Compare first half to second half
  const mid = Math.floor(timeData.length / 2);
  const firstHalf = timeData.slice(0, mid).reduce((sum, d) => sum + d.value, 0);
  const secondHalf = timeData.slice(mid).reduce((sum, d) => sum + d.value, 0);
  
  const change = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;
  
  if (Math.abs(change) < 5) return null; // Not significant
  
  const direction = change > 0 ? 'increased' : 'declined';
  const timeFrame = mid > 1 ? 'the second half of the period' : 'recent periods';
  
  return {
    type: 'trend',
    title: `${valueCol} Trend`,
    description: `${valueCol} ${direction} by ${Math.abs(change).toFixed(2)}% during ${timeFrame}`,
    value: change
  };
}

/**
 * Analyze concentration risk
 */
function analyzeConcentration(
  data: Record<string, unknown>[],
  groupCol: string,
  valueCol: string
): Finding | null {
  const agg: Record<string, number> = {};
  let total = 0;
  
  for (const row of data) {
    const key = String(row[groupCol] || 'Unknown');
    const val = parseFloat(String(row[valueCol]).replace(/[^0-9.-]/g, '')) || 0;
    agg[key] = (agg[key] || 0) + val;
    total += val;
  }
  
  if (Object.keys(agg).length < 2) return null;
  
  const sorted = Object.entries(agg)
    .map(([key, val]) => ({ key, pct: total > 0 ? (val / total) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct);
  
  // Check if top 2 account for more than 70% of total
  const top2Pct = sorted.slice(0, 2).reduce((sum, s) => sum + s.pct, 0);
  
  if (top2Pct > 70) {
    return {
      type: 'concentration',
      title: 'Revenue Concentration',
      description: `${valueCol} is highly concentrated - top 2 ${groupCol}s account for ${top2Pct.toFixed(2)}% of total`,
      percentage: top2Pct
    };
  }
  
  return null;
}

/**
 * Detect outliers in numeric data
 */
function detectOutliers(
  data: Record<string, unknown>[],
  valueCol: string
): Finding | null {
  const values = data
    .map(row => parseFloat(String(row[valueCol]).replace(/[^0-9.-]/g, '')))
    .filter(v => !isNaN(v) && v > 0);
  
  if (values.length < 10) return null;
  
  // Calculate IQR
  values.sort((a, b) => a - b);
  const q1 = values[Math.floor(values.length * 0.25)];
  const q3 = values[Math.floor(values.length * 0.75)];
  const iqr = q3 - q1;
  const upperBound = q3 + 1.5 * iqr;
  
  // Count outliers
  const outliers = values.filter(v => v > upperBound);
  const outlierPct = (outliers.length / values.length) * 100;
  
  if (outlierPct > 5) {
    return {
      type: 'outlier',
      title: 'Unusual Values Detected',
      description: `${outliers.length} rows (${outlierPct.toFixed(2)}%) have unusually high ${valueCol} values`,
      percentage: outlierPct
    };
  }
  
  return null;
}

/**
 * Use AI to generate natural language explanations for findings
 */
async function generateFindingExplanations(
  findings: Finding[],
  intelligence: DatasetIntelligence
): Promise<string[]> {
  if (findings.length === 0) {
    return ['No significant patterns detected in this dataset.'];
  }
  
  const findingsText = findings.map(f => `- ${f.description}`);
  const prompt = `Given these analytical findings about a dataset, provide short 1-sentence explanations for each finding:\n\n${findingsText.join('\n')}\n\nFormat each as a concise statement. Focus on business insights.`;
  
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        columns: intelligence.schema.columns.map(c => c.name),
        sampleData: [],
        rowCount: intelligence.metrics.rowCount
      })
    });
    
    if (!response.ok) {
      return findings.map(f => f.description);
    }
    
    const text = await response.text();
    // Parse response - extract lines
    const lines = text.split('\n')
      .filter(line => line.trim().length > 0)
      .slice(0, findings.length);
    
    return lines.length > 0 ? lines : findings.map(f => f.description);
  } catch {
    return findings.map(f => f.description);
  }
}
