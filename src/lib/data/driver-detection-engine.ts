/**
 * ============================================================================
 * DRIVER DETECTION ENGINE
 * ============================================================================
 * Automatically identifies the main causes behind business metric changes.
 * Uses contribution analysis to determine WHY a KPI changed, not just WHAT changed.
 * 
 * This engine receives precomputed metrics and outputs structured driver data
 * that can be used by the UI and AI insight layer.
 * ============================================================================
 */

import type {
  PrecomputedMetrics,
  MetricDriver,
  DriverContribution,
  DriverDetectionResult,
  DriverDetectionConfig,
  RegionalMetric,
  ProductMetric,
} from './pipeline-types';
import { DEFAULT_DRIVER_CONFIG } from '../utils/pipeline-types';

/**
 * Main function to detect drivers from precomputed metrics
 * Uses aggregated data only - no raw dataset scanning required
 */
export function detectDrivers(
  metrics: PrecomputedMetrics,
  config: Partial<DriverDetectionConfig> = {}
): DriverDetectionResult {
  const cfg = { ...DEFAULT_DRIVER_CONFIG, ...config };
  
  const drivers: MetricDriver[] = [];
  
  // Analyze revenue drivers
  const revenueDrivers = analyzeRevenueDrivers(metrics, cfg);
  if (revenueDrivers) {
    drivers.push(revenueDrivers);
  }
  
  // Analyze profit drivers
  const profitDrivers = analyzeProfitDrivers(metrics, cfg);
  if (profitDrivers) {
    drivers.push(profitDrivers);
  }
  
  // Analyze margin drivers
  const marginDrivers = analyzeMarginDrivers(metrics, cfg);
  if (marginDrivers) {
    drivers.push(marginDrivers);
  }
  
  // Analyze growth drivers
  if (metrics.growthValid && metrics.growthRate !== null) {
    const growthDrivers = analyzeGrowthDrivers(metrics, cfg);
    if (growthDrivers) {
      drivers.push(growthDrivers);
    }
  }
  
  // Generate summary
  const summary = generateDriverSummary(drivers);
  
  return {
    datasetId: metrics.datasetId,
    analyzedAt: new Date().toISOString(),
    hasSignificantChanges: drivers.some(d => d.significance === 'high'),
    drivers,
    summary,
  };
}

/**
 * Analyze revenue drivers from regional and product performance
 */
function analyzeRevenueDrivers(
  metrics: PrecomputedMetrics,
  cfg: DriverDetectionConfig
): MetricDriver | null {
  const totalRevenue = metrics.totalRevenue;
  
  // Get regional breakdown
  const regionalDrivers = calculateRegionalDrivers(metrics, totalRevenue, cfg);
  
  // Get product breakdown  
  const productDrivers = calculateProductDrivers(metrics, totalRevenue, cfg);
  
  // Combine drivers
  const allDrivers: DriverContribution[] = [
    ...regionalDrivers,
    ...productDrivers,
  ];
  
  // Sort by absolute contribution and take top drivers
  allDrivers.sort((a, b) => Math.abs(b.percentage) - Math.abs(a.percentage));
  const topDrivers = allDrivers.slice(0, cfg.maxDriversPerMetric);
  
  // Filter by significance threshold
  const significantDrivers = topDrivers.filter(
    d => Math.abs(d.percentage) >= cfg.significanceThreshold ||
         Math.abs(d.value) >= cfg.minContributionValue
  );
  
  if (significantDrivers.length === 0) {
    return null;
  }
  
  // Calculate overall change direction
  const totalChange = significantDrivers.reduce((sum, d) => sum + d.value, 0);
  const direction = totalChange > 0 ? 'up' : totalChange < 0 ? 'down' : 'stable';
  
  return {
    metric: 'revenue',
    change: totalChange,
    changePercent: totalRevenue > 0 ? (totalChange / totalRevenue) * 100 : 0,
    direction,
    drivers: significantDrivers,
    significance: getSignificance(totalChange, totalRevenue),
  };
}

/**
 * Calculate regional revenue drivers
 */
function calculateRegionalDrivers(
  metrics: PrecomputedMetrics,
  totalRevenue: number,
  cfg: DriverDetectionConfig
): DriverContribution[] {
  if (!metrics.regionalPerformance || metrics.regionalPerformance.length === 0) {
    return [];
  }
  
  return metrics.regionalPerformance.map((region: RegionalMetric) => {
    const contribution = (region.revenue / totalRevenue) * 100;
    return {
      type: 'region' as const,
      name: region.name,
      value: region.revenue,
      percentage: contribution,
      currentValue: region.revenue,
    };
  });
}

/**
 * Calculate product revenue drivers
 */
function calculateProductDrivers(
  metrics: PrecomputedMetrics,
  totalRevenue: number,
  cfg: DriverDetectionConfig
): DriverContribution[] {
  if (!metrics.productPerformance || metrics.productPerformance.length === 0) {
    return [];
  }
  
  return metrics.productPerformance.map((product: ProductMetric) => ({
    type: 'product' as const,
    name: product.name,
    value: product.revenue,
    percentage: (product.revenue / totalRevenue) * 100,
    currentValue: product.revenue,
  }));
}

/**
 * Analyze profit drivers
 */
function analyzeProfitDrivers(
  metrics: PrecomputedMetrics,
  cfg: DriverDetectionConfig
): MetricDriver | null {
  const totalProfit = metrics.totalProfit;
  const totalRevenue = metrics.totalRevenue;
  
  if (totalProfit === 0) {
    return null;
  }
  
  // Get regional profit breakdown
  let drivers: DriverContribution[] = [];
  
  if (metrics.regionalPerformance) {
    drivers = metrics.regionalPerformance
      .filter((r: RegionalMetric) => r.profit !== 0)
      .map((region: RegionalMetric) => ({
        type: 'region' as const,
        name: region.name,
        value: region.profit,
        percentage: totalProfit !== 0 ? (region.profit / totalProfit) * 100 : 0,
        currentValue: region.profit,
      }));
  }
  
  // Get product profit breakdown
  if (metrics.productPerformance) {
    const productDrivers = metrics.productPerformance
      .filter((p: ProductMetric) => p.profit !== 0)
      .map((product: ProductMetric) => ({
        type: 'product' as const,
        name: product.name,
        value: product.profit,
        percentage: totalProfit !== 0 ? (product.profit / totalProfit) * 100 : 0,
        currentValue: product.profit,
      }));
    
    drivers = [...drivers, ...productDrivers];
  }
  
  // Sort and filter
  drivers.sort((a, b) => Math.abs(b.percentage) - Math.abs(a.percentage));
  const topDrivers = drivers.slice(0, cfg.maxDriversPerMetric);
  
  const significantDrivers = topDrivers.filter(
    d => Math.abs(d.percentage) >= cfg.significanceThreshold ||
         Math.abs(d.value) >= cfg.minContributionValue
  );
  
  if (significantDrivers.length === 0) {
    return null;
  }
  
  const totalChange = significantDrivers.reduce((sum, d) => sum + d.value, 0);
  const direction = totalChange > 0 ? 'up' : totalChange < 0 ? 'down' : 'stable';
  
  return {
    metric: 'profit',
    change: totalChange,
    changePercent: totalRevenue > 0 ? (totalChange / totalRevenue) * 100 : 0,
    direction,
    drivers: significantDrivers,
    significance: getSignificance(totalChange, totalProfit),
  };
}

/**
 * Analyze margin drivers
 */
function analyzeMarginDrivers(
  metrics: PrecomputedMetrics,
  cfg: DriverDetectionConfig
): MetricDriver | null {
  const margin = metrics.profitMargin;
  
  if (margin === null || margin === undefined) {
    return null;
  }
  
  // Analyze margin by product
  let drivers: DriverContribution[] = [];
  
  if (metrics.productPerformance) {
    drivers = metrics.productPerformance
      .filter((p: ProductMetric) => p.margin !== null && p.margin !== undefined)
      .map((product: ProductMetric) => ({
        type: 'product' as const,
        name: product.name,
        value: product.margin || 0,
        percentage: (product.percentage || 0), // Use revenue share as proxy
        currentValue: product.margin || 0,
      }));
  }
  
  // Sort by margin impact (revenue share * margin)
  drivers.sort((a, b) => Math.abs(b.percentage) - Math.abs(a.percentage));
  const topDrivers = drivers.slice(0, cfg.maxDriversPerMetric);
  
  if (topDrivers.length === 0) {
    return null;
  }
  
  const direction = margin > 0 ? 'up' : margin < 0 ? 'down' : 'stable';
  
  return {
    metric: 'margin',
    change: margin,
    changePercent: margin, // Margin is already a percentage
    direction,
    drivers: topDrivers,
    significance: Math.abs(margin) >= 10 ? 'high' : Math.abs(margin) >= 5 ? 'medium' : 'low',
  };
}

/**
 * Analyze growth drivers from time-based data
 */
function analyzeGrowthDrivers(
  metrics: PrecomputedMetrics,
  cfg: DriverDetectionConfig
): MetricDriver | null {
  const growthRate = metrics.growthRate;
  
  if (growthRate === null || growthRate === undefined || !metrics.chartData?.revenueByMonth) {
    return null;
  }
  
  const monthlyData = metrics.chartData.revenueByMonth;
  
  if (monthlyData.length < 2) {
    return null;
  }
  
  // Analyze month-over-month changes
  const monthChanges: DriverContribution[] = [];
  
  for (let i = 1; i < monthlyData.length; i++) {
    const current = monthlyData[i].revenue;
    const previous = monthlyData[i - 1].revenue;
    const change = current - previous;
    
    monthChanges.push({
      type: 'time_period',
      name: monthlyData[i].month,
      value: change,
      percentage: previous > 0 ? (change / previous) * 100 : 0,
      currentValue: current,
      previousValue: previous,
    });
  }
  
  // Sort by absolute change
  monthChanges.sort((a, b) => Math.abs(b.percentage) - Math.abs(a.percentage));
  
  // Get worst performing months (biggest negative changes)
  const negativeDrivers = monthChanges
    .filter(d => d.value < 0)
    .slice(0, Math.floor(cfg.maxDriversPerMetric / 2));
  
  const positiveDrivers = monthChanges
    .filter(d => d.value > 0)
    .slice(0, Math.floor(cfg.maxDriversPerMetric / 2));
  
  const drivers = [...negativeDrivers, ...positiveDrivers];
  
  if (drivers.length === 0) {
    return null;
  }
  
  const direction = growthRate > 0 ? 'up' : growthRate < 0 ? 'down' : 'stable';
  
  return {
    metric: 'growth',
    change: growthRate,
    changePercent: growthRate,
    direction,
    drivers,
    significance: Math.abs(growthRate) >= 20 ? 'high' : Math.abs(growthRate) >= 10 ? 'medium' : 'low',
  };
}

/**
 * Determine significance level based on change magnitude
 */
function getSignificance(change: number, total: number): 'high' | 'medium' | 'low' {
  const percentChange = total !== 0 ? Math.abs(change / total) * 100 : 0;
  
  if (percentChange >= 20) return 'high';
  if (percentChange >= 10) return 'medium';
  return 'low';
}

/**
 * Generate human-readable summary of drivers
 */
function generateDriverSummary(drivers: MetricDriver[]): string {
  if (drivers.length === 0) {
    return 'No significant drivers detected.';
  }
  
  const summaries: string[] = [];
  
  for (const driver of drivers) {
    if (driver.drivers.length === 0) continue;
    
    const topDriver = driver.drivers[0];
    const direction = driver.direction === 'up' ? 'increased' : driver.direction === 'down' ? 'decreased' : 'remained stable';
    
    summaries.push(
      `${driver.metric.charAt(0).toUpperCase() + driver.metric.slice(1)} ${direction} by ${formatPercent(driver.changePercent)}, primarily driven by ${topDriver.name} (${formatPercent(topDriver.percentage)} contribution).`
    );
  }
  
  return summaries.join(' ');
}

/**
 * Format percentage for display
 */
function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number): string {
  const sign = value >= 0 ? '' : '-';
  const absValue = Math.abs(value);
  
  if (absValue >= 1000000) {
    return `${sign}$${(absValue / 1000000).toFixed(2)}M`;
  }
  if (absValue >= 1000) {
    return `${sign}$${(absValue / 1000).toFixed(1)}K`;
  }
  return `${sign}$${absValue.toFixed(2)}`;
}

/**
 * Get top N drivers for a specific metric
 */
export function getTopDrivers(
  result: DriverDetectionResult,
  metric: string,
  limit: number = 3
): DriverContribution[] {
  const metricDriver = result.drivers.find(d => d.metric === metric);
  if (!metricDriver) return [];
  
  return metricDriver.drivers.slice(0, limit);
}

/**
 * Check if there are any significant negative drivers
 */
export function hasNegativeDrivers(result: DriverDetectionResult): boolean {
  return result.drivers.some(d => 
    d.drivers.some(driver => driver.value < 0)
  );
}

/**
 * Get all negative drivers across all metrics
 */
export function getNegativeDrivers(result: DriverDetectionResult): Array<{
  metric: string;
  driver: DriverContribution;
}> {
  const negatives: Array<{ metric: string; driver: DriverContribution }> = [];
  
  for (const metricDriver of result.drivers) {
    for (const driver of metricDriver.drivers) {
      if (driver.value < 0) {
        negatives.push({ metric: metricDriver.metric, driver });
      }
    }
  }
  
  return negatives.sort((a, b) => a.driver.value - b.driver.value);
}
