import { debugLog, debugError, debugWarn } from "@/lib/debug"

import {
  DatasetSchemaOutput,
  PrecomputedKpisOutput,
  TopRegionsOutput,
  RevenueTrendsOutput,
  ProfitabilitySummaryOutput,
} from './tools';
import { PrecomputedMetrics } from '../pipeline-types';

interface MCPCache {
  schema?: DatasetSchemaOutput;
  kpis?: PrecomputedKpisOutput;
  topRegions?: TopRegionsOutput;
  revenueTrends?: RevenueTrendsOutput;
  profitability?: ProfitabilitySummaryOutput;
  metrics?: PrecomputedMetrics;
}

const mcpCache: Map<string, MCPCache> = new Map();

export function setAnalysisCache(datasetId: string, metrics: PrecomputedMetrics): void {
  mcpCache.set(datasetId, { metrics });
  debugLog(`[MCP] Cached analysis for dataset: ${datasetId}`);
}

export function getAnalysisCache(datasetId: string): PrecomputedMetrics | undefined {
  return mcpCache.get(datasetId)?.metrics;
}

export function getDatasetSchema(datasetId: string): DatasetSchemaOutput {
  const metrics = getAnalysisCache(datasetId);
  
  if (!metrics) {
    throw new Error(`No analysis found for dataset: ${datasetId}. Please run analysis first.`);
  }

  const detectedColumns = metrics.detectedColumns;
  
  const inferredTypes: Record<string, 'string' | 'number' | 'date' | 'boolean'> = {};
  const columns: string[] = [];
  
  if (metrics.detectedColumns) {
    if (detectedColumns.revenueColumn) {
      inferredTypes[detectedColumns.revenueColumn] = 'number';
      columns.push(detectedColumns.revenueColumn);
    }
    if (detectedColumns.profitColumn) {
      inferredTypes[detectedColumns.profitColumn] = 'number';
      columns.push(detectedColumns.profitColumn);
    }
    if (detectedColumns.costColumn) {
      inferredTypes[detectedColumns.costColumn] = 'number';
      columns.push(detectedColumns.costColumn);
    }
    if (detectedColumns.dateColumn) {
      inferredTypes[detectedColumns.dateColumn] = 'date';
      columns.push(detectedColumns.dateColumn);
    }
    if (detectedColumns.productColumn) {
      inferredTypes[detectedColumns.productColumn] = 'string';
      columns.push(detectedColumns.productColumn);
    }
    if (detectedColumns.regionColumn) {
      inferredTypes[detectedColumns.regionColumn] = 'string';
      columns.push(detectedColumns.regionColumn);
    }
  }

  return {
    columns,
    inferredTypes,
    rowCount: metrics.fullDatasetRowCount,
    dateColumns: detectedColumns?.dateColumn ? [detectedColumns.dateColumn] : [],
    businessFields: {
      revenue: detectedColumns?.revenueColumn || undefined,
      cost: detectedColumns?.costColumn || undefined,
      profit: detectedColumns?.profitColumn || undefined,
      product: detectedColumns?.productColumn || undefined,
      region: detectedColumns?.regionColumn || undefined,
      category: detectedColumns?.regionColumn || undefined,
    },
  };
}

export function getPrecomputedKpis(datasetId: string): PrecomputedKpisOutput {
  const metrics = getAnalysisCache(datasetId);
  
  if (!metrics) {
    throw new Error(`No analysis found for dataset: ${datasetId}. Please run analysis first.`);
  }

  const topRegion = metrics.topRegions?.[0];
  const topProduct = metrics.topProducts?.[0];

  return {
    totalRevenue: metrics.totalRevenue,
    totalExpenses: metrics.totalCost,
    grossProfit: metrics.totalProfit,
    netProfit: metrics.totalProfit,
    margin: metrics.profitMargin || 0,
    topRegion: topRegion ? { name: topRegion.name, value: topRegion.revenue } : null,
    topProduct: topProduct ? { name: topProduct.name, value: topProduct.revenue } : null,
    rowCount: metrics.fullDatasetRowCount,
  };
}

export function getTopRegions(
  datasetId: string,
  metric: 'revenue' | 'profit' | 'quantity' | 'cost' = 'revenue',
  limit: number = 10
): TopRegionsOutput {
  const metrics = getAnalysisCache(datasetId);
  
  if (!metrics) {
    throw new Error(`No analysis found for dataset: ${datasetId}. Please run analysis first.`);
  }

  let rankedRows: { rank: number; name: string; value: number }[] = [];
  let totals = { metric: 'revenue', value: 0 };

  if (metric === 'revenue' || metric === 'profit') {
    const data = metric === 'revenue' 
      ? metrics.chartData.revenueByRegion 
      : metrics.chartData.profitByRegion;
    
    const total = data.reduce((sum, item) => sum + item.value, 0);
    totals = { metric, value: total };
    
    rankedRows = data.slice(0, limit).map((item, index) => ({
      rank: index + 1,
      name: item.category,
      value: item.value,
    }));
  } else if (metric === 'quantity' && metrics.productPerformance) {
    const data = metrics.productPerformance
      .filter(p => p.quantity !== undefined)
      .map(p => ({ category: p.name, value: p.quantity || 0 }))
      .sort((a, b) => b.value - a.value);
    
    const total = data.reduce((sum, item) => sum + item.value, 0);
    totals = { metric: 'quantity', value: total };
    
    rankedRows = data.slice(0, limit).map((item, index) => ({
      rank: index + 1,
      name: item.category,
      value: item.value,
    }));
  }

  const sharePercentages: Record<string, number> = {};
  const totalValue = totals.value;
  rankedRows.forEach(row => {
    sharePercentages[row.name] = totalValue > 0 
      ? Math.round((row.value / totalValue) * 1000) / 10 
      : 0;
  });

  return {
    rankedRows,
    totals,
    sharePercentages,
    metadata: {
      datasetId,
      metric,
      computedAt: metrics.computedAt,
    },
  };
}

export function getRevenueTrends(
  datasetId: string,
  dateGrain: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' = 'monthly',
  metric: 'revenue' | 'profit' | 'quantity' = 'revenue'
): RevenueTrendsOutput {
  const metrics = getAnalysisCache(datasetId);
  
  if (!metrics) {
    throw new Error(`No analysis found for dataset: ${datasetId}. Please run analysis first.`);
  }

  let trendRows: { period: string; value: number }[] = [];
  
  if (metric === 'revenue') {
    trendRows = metrics.chartData.revenueByMonth.map(m => ({
      period: m.month,
      value: m.revenue,
    }));
  } else if (metric === 'profit') {
    trendRows = metrics.chartData.profitByMonth.map(m => ({
      period: m.month,
      value: m.profit,
    }));
  }

  trendRows.sort((a, b) => a.period.localeCompare(b.period));

  const firstPeriod = trendRows.length > 0 ? trendRows[0] : null;
  const lastPeriod = trendRows.length > 0 ? trendRows[trendRows.length - 1] : null;

  let growthDirection: 'up' | 'down' | 'stable' | 'insufficient_data' = 'insufficient_data';
  
  if (firstPeriod && lastPeriod && firstPeriod.value > 0) {
    const change = ((lastPeriod.value - firstPeriod.value) / firstPeriod.value) * 100;
    if (change > 5) {
      growthDirection = 'up';
    } else if (change < -5) {
      growthDirection = 'down';
    } else {
      growthDirection = 'stable';
    }
  }

  let peakPeriod: { period: string; value: number } | null = null;
  let troughPeriod: { period: string; value: number } | null = null;
  
  if (trendRows.length > 0) {
    const sorted = [...trendRows].sort((a, b) => b.value - a.value);
    peakPeriod = { period: sorted[0].period, value: sorted[0].value };
    troughPeriod = { period: sorted[sorted.length - 1].period, value: sorted[sorted.length - 1].value };
  }

  return {
    trendRows,
    firstPeriod,
    lastPeriod,
    growthDirection,
    peakPeriod,
    troughPeriod,
    metadata: {
      datasetId,
      dateGrain,
      metric,
      computedAt: metrics.computedAt,
    },
  };
}

export function getProfitabilitySummary(datasetId: string): ProfitabilitySummaryOutput {
  const metrics = getAnalysisCache(datasetId);
  
  if (!metrics) {
    throw new Error(`No analysis found for dataset: ${datasetId}. Please run analysis first.`);
  }

  const costBreakdown = metrics.costBreakdown;
  
  const topCostCategories = [
    { category: 'COGS', amount: costBreakdown.cogs, percentage: 0 },
    { category: 'Marketing', amount: costBreakdown.marketingCost, percentage: 0 },
    { category: 'Shipping', amount: costBreakdown.shippingCost, percentage: 0 },
    { category: 'Refunds', amount: costBreakdown.refunds, percentage: 0 },
    { category: 'Discounts', amount: costBreakdown.discount, percentage: 0 },
  ]
    .filter(c => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const totalCost = costBreakdown.totalCost;
  topCostCategories.forEach(c => {
    c.percentage = totalCost > 0 ? Math.round((c.amount / totalCost) * 1000) / 10 : 0;
  });

  const revenueByRegion = metrics.chartData.revenueByRegion.map(item => ({
    region: item.category,
    revenue: item.value,
    percentage: item.percentage,
  }));

  const revenueByProduct = metrics.chartData.revenueByProduct.map(item => ({
    product: item.category,
    revenue: item.value,
    percentage: item.percentage,
  }));

  const revenueVsExpenses = metrics.chartData.revenueByMonth.map(m => ({
    period: m.month,
    revenue: m.revenue,
    expenses: m.revenue - m.profit,
    profit: m.profit,
  }));

  return {
    totalRevenue: metrics.totalRevenue,
    totalExpenses: metrics.totalCost,
    netProfit: metrics.totalProfit,
    profitMargin: metrics.profitMargin || 0,
    topCostCategories,
    revenueByRegion,
    revenueByProduct,
    revenueVsExpenses,
  };
}
