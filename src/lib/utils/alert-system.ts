/**
 * AI Alert System
 * 
 * Monitors dataset metrics and generates alerts for significant changes.
 * Uses DuckDB-style aggregations for calculations.
 */

import { buildDatasetIntelligence, DatasetIntelligence, DatasetRecord } from '../data/dataset-intelligence';

export type AlertType = 
  | 'revenue_drop'
  | 'revenue_spike'
  | 'profit_drop'
  | 'profit_spike'
  | 'margin_change'
  | 'outlier_detected'
  | 'data_quality';

export type AlertSeverity = 'high' | 'medium' | 'low';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  metric: string;
  currentValue: number;
  previousValue: number;
  percentChange: number;
  timestamp: string;
}

export interface AlertResult {
  alerts: Alert[];
  summary: string;
  metadata: {
    datasetId: string;
    analyzedAt: string;
    periodComparison: string;
  };
}

/**
 * Generate alerts by analyzing dataset metrics
 */
export async function generateAlerts(
  datasetId: string,
  data: Record<string, unknown>[]
): Promise<AlertResult> {
  const alerts: Alert[] = [];
  const intelligence = buildDatasetIntelligence(data as DatasetRecord[]);
  
  // Get columns
  const timeCols = intelligence.dimensions.timeColumns;
  const numericCols = intelligence.metrics.numericColumns;
  const categoricalCols = intelligence.dimensions.categoryColumns;
  
  // Find key metrics
  const revenueCol = numericCols.find(c => 
    c.toLowerCase().includes('revenue') || c.toLowerCase().includes('sales')
  );
  const profitCol = numericCols.find(c => 
    c.toLowerCase().includes('profit')
  );
  const quantityCol = numericCols.find(c => 
    c.toLowerCase().includes('quantity') || c.toLowerCase().includes('units')
  );
  
  const timeCol = timeCols[0] || 
    intelligence.schema.columns.find(c => 
      c.name.toLowerCase().includes('date') || c.name.toLowerCase().includes('month')
    )?.name;
  
  // Analyze each metric
  if (revenueCol) {
    const alert = await analyzeMetricAlerts(
      data,
      revenueCol,
      timeCol,
      'Revenue',
      {
        dropThreshold: -15,    // Alert if drops more than 15%
        spikeThreshold: 30,   // Alert if spikes more than 30%
      }
    );
    alerts.push(...alert);
  }
  
  if (profitCol) {
    const alert = await analyzeMetricAlerts(
      data,
      profitCol,
      timeCol,
      'Profit',
      {
        dropThreshold: -20,   // Alert if drops more than 20%
        spikeThreshold: 50,   // Alert if spikes more than 50%
      }
    );
    alerts.push(...alert);
  }
  
  if (quantityCol) {
    const alert = await analyzeMetricAlerts(
      data,
      quantityCol,
      timeCol,
      'Quantity',
      {
        dropThreshold: -25,
        spikeThreshold: 40,
      }
    );
    alerts.push(...alert);
  }
  
  // Check for profit margin changes
  if (revenueCol && profitCol) {
    const marginAlerts = analyzeMarginChanges(data, revenueCol, profitCol, timeCol);
    alerts.push(...marginAlerts);
  }
  
  // Detect outliers
  for (const col of numericCols.slice(0, 3)) {
    const outlierAlerts = detectOutliers(data, col);
    if (outlierAlerts.length > 0) {
      alerts.push(...outlierAlerts);
    }
  }
  
  // Generate summary
  const summary = await generateAlertSummary(alerts);
  
  return {
    alerts,
    summary,
    metadata: {
      datasetId,
      analyzedAt: new Date().toISOString(),
      periodComparison: timeCol ? 'period-over-period' : 'overall'
    }
  };
}

/**
 * Analyze metric for drops and spikes
 */
async function analyzeMetricAlerts(
  data: Record<string, unknown>[],
  metricCol: string,
  timeCol: string | undefined,
  metricName: string,
  thresholds: { dropThreshold: number; spikeThreshold: number }
): Promise<Alert[]> {
  const alerts: Alert[] = [];
  
  if (timeCol) {
    // Period-over-period comparison
    const timeData = aggregateByTime(data, timeCol, metricCol);
    
    if (timeData.length >= 2) {
      const current = timeData[timeData.length - 1].value;
      const previous = timeData[timeData.length - 2].value;
      
      if (previous > 0) {
        const percentChange = ((current - previous) / previous) * 100;
        
        if (percentChange < thresholds.dropThreshold) {
          alerts.push({
            id: `${metricCol}_drop`,
            type: 'revenue_drop',
            severity: Math.abs(percentChange) > 30 ? 'high' : 'medium',
            message: `${metricName} dropped by ${Math.abs(percentChange).toFixed(2)}% compared to the previous period`,
            metric: metricCol,
            currentValue: current,
            previousValue: previous,
            percentChange,
            timestamp: new Date().toISOString()
          });
        } else if (percentChange > thresholds.spikeThreshold) {
          alerts.push({
            id: `${metricCol}_spike`,
            type: 'revenue_spike',
            severity: percentChange > 50 ? 'high' : 'medium',
            message: `${metricName} spiked by ${percentChange.toFixed(2)}% compared to the previous period`,
            metric: metricCol,
            currentValue: current,
            previousValue: previous,
            percentChange,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  } else {
    // Overall comparison (split data in half)
    const mid = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, mid);
    const secondHalf = data.slice(mid);
    
    const firstSum = aggregateSum(firstHalf, metricCol);
    const secondSum = aggregateSum(secondHalf, metricCol);
    
    if (firstSum > 0) {
      const percentChange = ((secondSum - firstSum) / firstSum) * 100;
      
      if (percentChange < thresholds.dropThreshold) {
        alerts.push({
          id: `${metricCol}_drop`,
          type: 'revenue_drop',
          severity: Math.abs(percentChange) > 30 ? 'high' : 'medium',
          message: `${metricName} dropped by ${Math.abs(percentChange).toFixed(2)}% compared to first half`,
          metric: metricCol,
          currentValue: secondSum,
          previousValue: firstSum,
          percentChange,
          timestamp: new Date().toISOString()
        });
      } else if (percentChange > thresholds.spikeThreshold) {
        alerts.push({
          id: `${metricCol}_spike`,
          type: 'revenue_spike',
          severity: percentChange > 50 ? 'high' : 'medium',
          message: `${metricName} increased by ${percentChange.toFixed(2)}% compared to first half`,
          metric: metricCol,
          currentValue: secondSum,
          previousValue: firstSum,
          percentChange,
          timestamp: new Date().toISOString()
        });
      }
    }
  }
  
  return alerts;
}

/**
 * Analyze profit margin changes
 */
function analyzeMarginChanges(
  data: Record<string, unknown>[],
  revenueCol: string,
  profitCol: string,
  timeCol: string | undefined
): Alert[] {
  const alerts: Alert[] = [];
  
  if (timeCol) {
    const timeData = aggregateByTimeWithMargin(data, timeCol, revenueCol, profitCol);
    
    if (timeData.length >= 2) {
      const currentMargin = timeData[timeData.length - 1].margin;
      const previousMargin = timeData[timeData.length - 2].margin;
      
      const marginChange = currentMargin - previousMargin;
      
      if (Math.abs(marginChange) > 5) {
        alerts.push({
          id: 'margin_change',
          type: 'margin_change',
          severity: Math.abs(marginChange) > 10 ? 'high' : 'medium',
          message: `Profit margin ${marginChange > 0 ? 'improved' : 'declined'} by ${Math.abs(marginChange).toFixed(2)} percentage points`,
          metric: 'profit_margin',
          currentValue: currentMargin,
          previousValue: previousMargin,
          percentChange: previousMargin > 0 ? (marginChange / previousMargin) * 100 : 0,
          timestamp: new Date().toISOString()
        });
      }
    }
  }
  
  return alerts;
}

/**
 * Detect outliers in data
 */
function detectOutliers(
  data: Record<string, unknown>[],
  col: string
): Alert[] {
  const alerts: Alert[] = [];
  
  const values = data
    .map(row => parseFloat(String(row[col]).replace(/[^0-9.-]/g, '')))
    .filter(v => !isNaN(v) && v > 0);
  
  if (values.length < 10) return [];
  
  // Calculate IQR
  values.sort((a, b) => a - b);
  const q1 = values[Math.floor(values.length * 0.25)];
  const q3 = values[Math.floor(values.length * 0.75)];
  const iqr = q3 - q1;
  const upperBound = q3 + 1.5 * iqr;
  const lowerBound = q1 - 1.5 * iqr;
  
  const outliers = values.filter(v => v > upperBound || v < lowerBound);
  const outlierPercent = (outliers.length / values.length) * 100;
  
  if (outlierPercent > 5) {
    alerts.push({
      id: `${col}_outliers`,
      type: 'outlier_detected',
      severity: outlierPercent > 15 ? 'high' : 'medium',
      message: `${outliers.length} unusual ${col} values detected (${outlierPercent.toFixed(2)}% of data)`,
      metric: col,
      currentValue: outliers.length,
      previousValue: values.length,
      percentChange: outlierPercent,
      timestamp: new Date().toISOString()
    });
  }
  
  return alerts;
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
 * Aggregate by time with margin calculation
 */
function aggregateByTimeWithTime(
  data: Record<string, unknown>[],
  timeCol: string,
  valueCol: string
): { time: string; value: number }[] {
  const sorted = [...data].sort((a, b) => 
    String(a[timeCol]).localeCompare(String(b[timeCol]))
  );
  
  const groups: Record<string, number> = {};
  for (const row of sorted) {
    const time = String(row[timeCol] || 'Unknown');
    const value = parseFloat(String(row[valueCol]).replace(/[^0-9.-]/g, '')) || 0;
    groups[time] = (groups[time] || 0) + value;
  }
  
  return Object.entries(groups)
    .map(([time, value]) => ({ time, value }))
    .slice(-12);
}

function aggregateByTime(
  data: Record<string, unknown>[],
  timeCol: string,
  valueCol: string
): { time: string; value: number }[] {
  return aggregateByTimeWithTime(data, timeCol, valueCol);
}

function aggregateByTimeWithMargin(
  data: Record<string, unknown>[],
  timeCol: string,
  revenueCol: string,
  profitCol: string
): { time: string; revenue: number; profit: number; margin: number }[] {
  const sorted = [...data].sort((a, b) => 
    String(a[timeCol]).localeCompare(String(b[timeCol]))
  );
  
  const groups: Record<string, { revenue: number; profit: number }> = {};
  for (const row of sorted) {
    const time = String(row[timeCol] || 'Unknown');
    const revenue = parseFloat(String(row[revenueCol]).replace(/[^0-9.-]/g, '')) || 0;
    const profit = parseFloat(String(row[profitCol]).replace(/[^0-9.-]/g, '')) || 0;
    
    if (!groups[time]) groups[time] = { revenue: 0, profit: 0 };
    groups[time].revenue += revenue;
    groups[time].profit += profit;
  }
  
  return Object.entries(groups)
    .map(([time, vals]) => ({
      time,
      revenue: vals.revenue,
      profit: vals.profit,
      margin: vals.revenue > 0 ? (vals.profit / vals.revenue) * 100 : 0
    }))
    .slice(-12);
}

/**
 * Generate alert summary using AI
 */
async function generateAlertSummary(alerts: Alert[]): Promise<string> {
  if (alerts.length === 0) {
    return 'No alerts detected. All metrics are within normal ranges.';
  }
  
  const highSeverity = alerts.filter(a => a.severity === 'high').length;
  const mediumSeverity = alerts.filter(a => a.severity === 'medium').length;
  const lowSeverity = alerts.filter(a => a.severity === 'low').length;
  
  if (highSeverity > 0) {
    return `⚠️ ${highSeverity} high-priority alert${highSeverity > 1 ? 's' : ''} require attention.`;
  }
  
  if (mediumSeverity > 0) {
    return `ℹ️ ${mediumSeverity} medium-priority alert${mediumSeverity > 1 ? 's' : ''} detected.`;
  }
  
  return `✓ ${lowSeverity} low-priority notification${lowSeverity > 1 ? 's' : ''}.`;
}
