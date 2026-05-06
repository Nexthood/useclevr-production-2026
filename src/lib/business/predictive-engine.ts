/**
 * Predictive Insight Engine
 * 
 * Detects trends and generates forward-looking insights.
 * Uses statistical analysis for predictions + AI for explanations.
 */

import { buildDatasetIntelligence, DatasetIntelligence, DatasetRecord } from '../data/dataset-intelligence';

export interface Prediction {
  id: string;
  metric: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  currentValue: number;
  predictedValue: number;
  percentChange: number;
  confidence: 'high' | 'medium' | 'low';
  timeframe: string;
}

export interface Insight {
  id: string;
  type: 'risk' | 'opportunity' | 'warning';
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
}

export interface PredictiveResult {
  predictions: Prediction[];
  insights: Insight[];
  summary: string;
  metadata: {
    datasetId: string;
    timeColumn: string;
    analyzedAt: string;
  };
}

/**
 * Generate predictive insights from dataset
 */
export async function generatePredictions(
  datasetId: string,
  data: Record<string, unknown>[]
): Promise<PredictiveResult> {
  const intelligence = buildDatasetIntelligence(data as DatasetRecord[]);
  const timeCols = intelligence.dimensions.timeColumns;
  const numericCols = intelligence.metrics.numericColumns;
  
  const predictions: Prediction[] = [];
  const insights: Insight[] = [];
  
  // Find time column
  const timeCol = timeCols[0] || 
    intelligence.schema.columns.find(c => 
      c.name.toLowerCase().includes('date') || 
      c.name.toLowerCase().includes('month') ||
      c.name.toLowerCase().includes('year')
    )?.name;
  
  if (!timeCol || numericCols.length === 0) {
    return {
      predictions: [],
      insights: [{
        id: 'no_time_data',
        type: 'warning',
        title: 'Insufficient Data for Prediction',
        description: 'Dataset lacks time series data. Predictions require date/time columns.',
        severity: 'low'
      }],
      summary: 'Unable to generate predictions - no time-based data detected.',
      metadata: {
        datasetId,
        timeColumn: timeCol || 'none',
        analyzedAt: new Date().toISOString()
      }
    };
  }
  
  // Get key metrics
  const revenueCol = numericCols.find(c => 
    c.toLowerCase().includes('revenue') || c.toLowerCase().includes('sales')
  );
  const profitCol = numericCols.find(c => c.toLowerCase().includes('profit'));
  const quantityCol = numericCols.find(c => 
    c.toLowerCase().includes('quantity') || c.toLowerCase().includes('units')
  );
  
  // Analyze each metric
  if (revenueCol) {
    const prediction = analyzeTrend(data, timeCol, revenueCol);
    if (prediction) {
      predictions.push(prediction);
      
      // Generate insight based on prediction
      if (prediction.trend === 'decreasing' && prediction.percentChange < -10) {
        insights.push({
          id: 'revenue_decline_risk',
          type: 'risk',
          title: 'Revenue Decline Risk',
          description: `${revenueCol} shows ${Math.abs(prediction.percentChange).toFixed(2)}% ${prediction.trend} trend. Next period predicted: ${prediction.predictedValue.toLocaleString()}`,
          severity: prediction.percentChange < -20 ? 'high' : 'medium'
        });
      } else if (prediction.trend === 'increasing' && prediction.percentChange > 10) {
        insights.push({
          id: 'revenue_growth_opportunity',
          type: 'opportunity',
          title: 'Growth Opportunity',
          description: `${revenueCol} showing strong ${prediction.trend} trend (+${prediction.percentChange.toFixed(2)}%). Capitalize on momentum.`,
          severity: 'medium'
        });
      }
    }
  }
  
  if (profitCol) {
    const prediction = analyzeTrend(data, timeCol, profitCol);
    if (prediction) {
      predictions.push(prediction);
      
      if (prediction.trend === 'decreasing' && prediction.percentChange < -15) {
        insights.push({
          id: 'profit_margin_concern',
          type: 'warning',
          title: 'Profitability Concern',
          description: `Profit trending ${prediction.trend} (${prediction.percentChange.toFixed(2)}%). Investigate cost structures.`,
          severity: 'high'
        });
      }
    }
  }
  
  if (quantityCol) {
    const prediction = analyzeTrend(data, timeCol, quantityCol);
    if (prediction) {
      predictions.push(prediction);
    }
  }
  
  // Detect concentration risks
  const concentrationRisks = detectConcentrationRisks(data, numericCols);
  insights.push(...concentrationRisks);
  
  // Generate summary
  const summary = await generatePredictionSummary(predictions, insights);
  
  return {
    predictions,
    insights,
    summary,
    metadata: {
      datasetId,
      timeColumn: timeCol,
      analyzedAt: new Date().toISOString()
    }
  };
}

/**
 * Analyze trend for a specific metric
 */
function analyzeTrend(
  data: Record<string, unknown>[],
  timeCol: string,
  valueCol: string
): Prediction | null {
  // Aggregate by time period
  const timeData = aggregateByTime(data, timeCol, valueCol);
  
  if (timeData.length < 3) {
    return null;
  }
  
  // Calculate trend using linear regression
  const n = timeData.length;
  const values = timeData.map(d => d.value);
  const times = timeData.map((_, i) => i);
  
  // Simple linear regression
  const sumX = times.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = times.reduce((acc, x, i) => acc + x * values[i], 0);
  const sumX2 = times.reduce((acc, x) => acc + x * x, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Calculate R-squared for confidence
  const meanY = sumY / n;
  const ssTotal = values.reduce((acc, y) => acc + Math.pow(y - meanY, 2), 0);
  const ssResidual = times.reduce((acc, x, i) => {
    const predicted = slope * x + intercept;
    return acc + Math.pow(values[i] - predicted, 2);
  }, 0);
  const rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;
  
  // Determine trend direction
  const avgValue = meanY;
  const slopePercent = avgValue > 0 ? (slope / avgValue) * 100 : 0;
  
  let trend: 'increasing' | 'decreasing' | 'stable';
  if (slopePercent > 3) {
    trend = 'increasing';
  } else if (slopePercent < -3) {
    trend = 'decreasing';
  } else {
    trend = 'stable';
  }
  
  // Predict next period
  const nextTime = n;
  const predictedValue = Math.max(0, slope * nextTime + intercept);
  const percentChange = avgValue > 0 ? ((predictedValue - avgValue) / avgValue) * 100 : 0;
  
  // Determine confidence
  let confidence: 'high' | 'medium' | 'low';
  if (rSquared > 0.7) {
    confidence = 'high';
  } else if (rSquared > 0.4) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }
  
  // Determine timeframe
  const timeframe = 'next period';
  
  return {
    id: `prediction_${valueCol}`,
    metric: valueCol,
    trend,
    currentValue: avgValue,
    predictedValue,
    percentChange,
    confidence,
    timeframe
  };
}

/**
 * Aggregate data by time period
 */
function aggregateByTime(
  data: Record<string, unknown>[],
  timeCol: string,
  valueCol: string
): { time: string; value: number }[] {
  // Sort by time
  const sorted = [...data].sort((a, b) => 
    String(a[timeCol]).localeCompare(String(b[timeCol]))
  );
  
  // Group by time value
  const groups: Record<string, number> = {};
  for (const row of sorted) {
    const time = String(row[timeCol] || 'Unknown');
    const value = parseFloat(String(row[valueCol]).replace(/[^0-9.-]/g, '')) || 0;
    groups[time] = (groups[time] || 0) + value;
  }
  
  return Object.entries(groups)
    .map(([time, value]) => ({ time, value }))
    .slice(-12); // Last 12 periods
}

/**
 * Detect concentration risks
 */
function detectConcentrationRisks(
  data: Record<string, unknown>[],
  numericCols: string[]
): Insight[] {
  const insights: Insight[] = [];
  const intelligence = buildDatasetIntelligence(data as DatasetRecord[]);
  const categoricalCols = intelligence.dimensions.categoryColumns;
  
  if (categoricalCols.length === 0) return insights;
  
  const revenueCol = numericCols.find(c => 
    c.toLowerCase().includes('revenue') || c.toLowerCase().includes('sales')
  );
  
  if (!revenueCol) return insights;
  
  const groupCol = categoricalCols[0];
  const agg: Record<string, number> = {};
  let total = 0;
  
  for (const row of data) {
    const key = String(row[groupCol] || 'Unknown');
    const val = parseFloat(String(row[revenueCol]).replace(/[^0-9.-]/g, '')) || 0;
    agg[key] = (agg[key] || 0) + val;
    total += val;
  }
  
  const sorted = Object.entries(agg)
    .map(([key, val]) => ({ key, pct: total > 0 ? (val / total) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct);
  
  // Check for high concentration
  if (sorted.length > 0 && sorted[0].pct > 60) {
    insights.push({
      id: 'concentration_risk',
      type: 'risk',
      title: 'Revenue Concentration Risk',
      description: `${sorted[0].key} accounts for ${sorted[0].pct.toFixed(2)}% of ${revenueCol}. High dependency on single category.`,
      severity: sorted[0].pct > 80 ? 'high' : 'medium'
    });
  }
  
  // Check for lack of diversity
  if (sorted.length < 3 && sorted[0].pct > 40) {
    insights.push({
      id: 'diversity_concern',
      type: 'warning',
      title: 'Limited Category Diversity',
      description: `Only ${sorted.length} categories detected. Consider expanding product/region portfolio.`,
      severity: 'low'
    });
  }
  
  return insights;
}

/**
 * Generate natural language summary using AI
 */
async function generatePredictionSummary(
  predictions: Prediction[],
  insights: Insight[]
): Promise<string> {
  if (predictions.length === 0 && insights.length === 0) {
    return 'Insufficient data for predictive analysis.';
  }
  
  const predictionTexts = predictions.map(p => 
    `- ${p.metric}: ${p.trend} trend (${p.percentChange >= 0 ? '+' : ''}${p.percentChange.toFixed(2)}%)`
  );
  
  const insightTexts = insights.map(i => 
    `- ${i.title}: ${i.description}`
  );
  
  const prompt = `Given these predictive analytics, provide a brief 2-3 sentence summary:\n\nPredictions:\n${predictionTexts.join('\n')}\n\nInsights:\n${insightTexts.join('\n')}\n\nSummary:`;
  
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        columns: [],
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
  
  // Simple fallback summary
  const risks = insights.filter(i => i.type === 'risk').length;
  const opportunities = insights.filter(i => i.type === 'opportunity').length;
  
  return `Analysis shows ${predictions.length} metric trends and ${insights.length} actionable insights. ` +
    `${risks > 0 ? `${risks} potential risks identified. ` : ''}` +
    `${opportunities > 0 ? `${opportunities} growth opportunities detected.` : ''}`;
}
