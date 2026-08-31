/**
 * Auto Dashboard Builder
 *
 * Automatically generates KPIs and charts based on dataset structure.
 * Uses DuckDB-style aggregations for data processing.
 */

import type { DatasetRecord } from './dataset-intelligence';
import {
  buildBusinessSemanticProfile,
  conceptColumn,
  profileSupportsMetric,
  type SemanticProfile,
} from './business-semantics';
import { buildDatasetIntelligence } from './dataset-intelligence';
import { findSemanticColumn, type DynamicDashboardDefinition, type SemanticBusinessModel } from './dataset-intelligence-engine';

export interface KPI {
  id: string;
  title: string;
  value: number | string;
  format: 'currency' | 'number' | 'percentage';
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number;
}

export interface ChartConfig {
  id: string;
  type: 'bar' | 'line' | 'pie' | 'area';
  title: string;
  xAxis: string;
  yAxis: string;
  data: { name: string; value: number }[];
}

export interface DashboardConfig {
  kpis: KPI[];
  charts: ChartConfig[];
  metadata: {
    datasetId: string;
    rowCount: number;
    businessModel: SemanticBusinessModel;
    semanticConfidence: number;
    semanticDashboard: DynamicDashboardDefinition;
    businessSemanticProfile: SemanticProfile;
    generatedAt: string;
  };
}

/**
 * Build an auto dashboard from dataset
 */
export function buildDashboard(
  datasetId: string,
  data: Record<string, unknown>[]
): DashboardConfig {
  const intelligence = buildDatasetIntelligence(data as DatasetRecord[]);
  const kpis: KPI[] = [];
  const charts: ChartConfig[] = [];

  const dims = intelligence.dimensions;
  const metrics = intelligence.metrics;
  const numericCols = metrics.numericColumns;
  const categoricalCols = dims.categoryColumns;
  const timeCols = dims.timeColumns;
  const geoCols = dims.geographicColumns;
  const semantic = intelligence.semanticMetadata;
  const businessSemanticProfile = buildBusinessSemanticProfile({
    datasetId,
    datasetType: semantic.businessModel.model,
    businessModel: semantic.businessModel.model,
    columns: Object.keys(data[0] || {}),
    rows: data,
  });

  // Get key columns
  const revenueCol = conceptColumn(businessSemanticProfile, "revenue") ||
    conceptColumn(businessSemanticProfile, "net_sales") ||
    conceptColumn(businessSemanticProfile, "gross_sales") ||
    conceptColumn(businessSemanticProfile, "subscription_revenue") ||
    (profileSupportsMetric(businessSemanticProfile, "Revenue") ? findSemanticColumn(semantic, ["Revenue"])?.columnName : undefined);
  const profitCol = profileSupportsMetric(businessSemanticProfile, "Net Profit")
    ? findSemanticColumn(semantic, ["Profit"])?.columnName || numericCols.find(c =>
    c.toLowerCase().includes('profit') || c.toLowerCase().includes('margin')
  )
    : undefined;
  const costCol = conceptColumn(businessSemanticProfile, "cogs") ||
    conceptColumn(businessSemanticProfile, "operating_expense") ||
    findSemanticColumn(semantic, ["Cost"])?.columnName || numericCols.find(c =>
    c.toLowerCase().includes('cost') || c.toLowerCase().includes('cogs')
  );
  const usersCol = findSemanticColumn(semantic, ["Users"])?.columnName || numericCols.find(c =>
    /^users?$|user_count|seats?/.test(c.toLowerCase().replace(/[^a-z0-9_]/g, '_'))
  );
  const orderCol = findSemanticColumn(semantic, ["Order"])?.columnName || categoricalCols.find(c =>
    c.toLowerCase().includes('order') || c.toLowerCase().includes('transaction')
  );

  // Generate KPIs
  // 1. Row count
  kpis.push({
    id: 'row_count',
    title: 'Total Records',
    value: data.length,
    format: 'number'
  });

  // 2. Total Revenue
  if (revenueCol) {
    const totalRevenue = aggregateSum(data, revenueCol);
    kpis.push({
      id: 'total_revenue',
      title: 'Total Revenue',
      value: totalRevenue,
      format: 'currency'
    });
  }
  if (!revenueCol && businessSemanticProfile.datasetType === "marketplace") {
    const gmvCol = conceptColumn(businessSemanticProfile, "gmv");
    if (gmvCol) {
      kpis.push({
        id: 'gmv',
        title: 'GMV',
        value: aggregateSum(data, gmvCol),
        format: 'currency'
      });
    }
  }

  // 3. Total Profit
  if (profitCol) {
    const totalProfit = aggregateSum(data, profitCol);
    kpis.push({
      id: 'total_profit',
      title: 'Total Profit',
      value: totalProfit,
      format: 'currency'
    });

    // 4. Profit Margin
    if (revenueCol) {
      const totalRevenue = aggregateSum(data, revenueCol);
      const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
      kpis.push({
        id: 'profit_margin',
        title: 'Profit Margin',
        value: margin,
        format: 'percentage'
      });
    }
  }
  if (!profitCol && revenueCol && costCol) {
    const totalRevenue = aggregateSum(data, revenueCol);
    const totalProfit = totalRevenue - aggregateSum(data, costCol);
    kpis.push({
      id: 'total_profit',
      title: 'Total Profit',
      value: totalProfit,
      format: 'currency'
    });
    kpis.push({
      id: 'profit_margin',
      title: 'Profit Margin',
      value: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
      format: 'percentage'
    });
  }

  if (usersCol) {
    kpis.push({
      id: 'total_users',
      title: 'Total Users',
      value: aggregateSum(data, usersCol),
      format: 'number'
    });
  }

  if (revenueCol && usersCol) {
    const totalUsers = aggregateSum(data, usersCol);
    kpis.push({
      id: 'average_revenue_per_user',
      title: 'Average Revenue per User',
      value: totalUsers > 0 ? aggregateSum(data, revenueCol) / totalUsers : 0,
      format: 'currency'
    });
  }

  // 5. Average Order Value
  if (revenueCol && orderCol) {
    const totalRevenue = aggregateSum(data, revenueCol);
    const orderCount = new Set(data.map((row) => String(row[orderCol] ?? '').trim()).filter(Boolean)).size;
    const aov = orderCount > 0 ? totalRevenue / orderCount : 0;
    kpis.push({
      id: 'avg_order_value',
      title: 'Avg Order Value',
      value: aov,
      format: 'currency'
    });
  }

  // Generate Charts
  // 1. Revenue by Category (bar chart)
  if (revenueCol && categoricalCols.length > 0) {
    const groupCol = findSemanticColumn(semantic, ["Category", "Product Category", "Product", "Customer", "Seller", "Merchant", "Buyer", "Company"])?.columnName || categoricalCols[0];
    const chartData = aggregateGroup(data, groupCol, revenueCol);
    charts.push({
      id: 'revenue_by_category',
      type: 'bar',
      title: `Revenue by ${groupCol}`,
      xAxis: groupCol,
      yAxis: revenueCol,
      data: chartData.slice(0, 10) // Top 10
    });
  }

  // 2. Revenue by Region (bar chart)
  if (revenueCol && geoCols.length > 0) {
    const groupCol = findSemanticColumn(semantic, ["Geography", "Country", "Region", "City"])?.columnName || geoCols[0];
    const chartData = aggregateGroup(data, groupCol, revenueCol);
    charts.push({
      id: 'revenue_by_region',
      type: 'bar',
      title: `Revenue by ${groupCol}`,
      xAxis: groupCol,
      yAxis: revenueCol,
      data: chartData.slice(0, 10)
    });
  }

  // 3. Time Series (line chart)
  if (revenueCol && timeCols.length > 0) {
    const timeCol = findSemanticColumn(semantic, ["Date"])?.columnName || timeCols[0];
    const chartData = aggregateTimeSeries(data, timeCol, revenueCol);
    charts.push({
      id: 'revenue_over_time',
      type: 'line',
      title: `Revenue Over Time`,
      xAxis: timeCol,
      yAxis: revenueCol,
      data: chartData
    });
  }

  if (revenueCol && semantic.businessModel.model === "SaaS") {
    const planCol = Object.keys(data[0] || {}).find((column) => /^plan$|subscription_plan|tier/i.test(column));
    const startupStageCol = Object.keys(data[0] || {}).find((column) => /startup_stage|^stage$/i.test(column));
    if (planCol) {
      charts.push({
        id: 'revenue_by_plan',
        type: 'bar',
        title: 'Revenue by Plan',
        xAxis: planCol,
        yAxis: revenueCol,
        data: aggregateGroup(data, planCol, revenueCol).slice(0, 10)
      });
    }
    if (startupStageCol) {
      charts.push({
        id: 'revenue_by_startup_stage',
        type: 'bar',
        title: 'Revenue by Startup Stage',
        xAxis: startupStageCol,
        yAxis: revenueCol,
        data: aggregateGroup(data, startupStageCol, revenueCol).slice(0, 10)
      });
    }
  }

  // 4. Top categorical dimension by revenue
  if (revenueCol) {
    const productCol = findSemanticColumn(semantic, ["Product", "SKU"])?.columnName || categoricalCols.find(c =>
      c.toLowerCase().includes('product') || c.toLowerCase().includes('item')
    );

    if (productCol) {
      const chartData = aggregateGroup(data, productCol, revenueCol);
      charts.push({
        id: 'top_products',
        type: 'bar',
        title: `Top 10 ${productCol}`,
        xAxis: productCol,
        yAxis: revenueCol,
        data: chartData.slice(0, 10)
      });
    }
  }

  // 5. Category Distribution (pie chart)
  if (revenueCol && categoricalCols.length > 1) {
    const groupCol = categoricalCols[1];
    const chartData = aggregateGroup(data, groupCol, revenueCol);
    charts.push({
      id: 'distribution',
      type: 'pie',
      title: `${revenueCol} Distribution by ${groupCol}`,
      xAxis: groupCol,
      yAxis: revenueCol,
      data: chartData.slice(0, 6)
    });
  }

  return {
    kpis,
    charts,
    metadata: {
      datasetId,
      rowCount: data.length,
      businessModel: semantic.businessModel.model,
      semanticConfidence: semantic.businessModel.confidence,
      semanticDashboard: semantic.dashboard,
      businessSemanticProfile,
      generatedAt: new Date().toISOString()
    }
  };
}

/**
 * Aggregate sum for a numeric column
 */
function aggregateSum(data: Record<string, unknown>[], col: string): number {
  return data.reduce((sum, row) => {
    const val = parseFloat(String(row[col]).replace(/[^0-9.-]/g, ''));
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
}

/**
 * Aggregate by category
 */
function aggregateGroup(
  data: Record<string, unknown>[],
  groupCol: string,
  valueCol: string
): { name: string; value: number }[] {
  const agg: Record<string, number> = {};

  for (const row of data) {
    const key = String(row[groupCol] || 'Unknown');
    const val = parseFloat(String(row[valueCol]).replace(/[^0-9.-]/g, '')) || 0;
    agg[key] = (agg[key] || 0) + val;
  }

  return Object.entries(agg)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Aggregate time series
 */
function aggregateTimeSeries(
  data: Record<string, unknown>[],
  timeCol: string,
  valueCol: string
): { name: string; value: number }[] {
  // Sort by time
  const sorted = [...data].sort((a, b) =>
    String(a[timeCol]).localeCompare(String(b[timeCol]))
  );

  const agg: Record<string, number> = {};

  for (const row of sorted) {
    const key = String(row[timeCol] || 'Unknown');
    const val = parseFloat(String(row[valueCol]).replace(/[^0-9.-]/g, '')) || 0;
    agg[key] = (agg[key] || 0) + val;
  }

  return Object.entries(agg)
    .map(([name, value]) => ({ name, value }))
    .slice(-12); // Last 12 periods
}

/**
 * Format KPI value for display
 */
export function formatKPIValue(kpi: KPI): string {
  if (kpi.format === 'currency') {
    const num = Number(kpi.value);
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(2)}K`;
    }
    return `$${num.toFixed(2)}`;
  }

  if (kpi.format === 'percentage') {
    return `${Number(kpi.value).toFixed(2)}%`;
  }

  if (kpi.format === 'number') {
    const num = Number(kpi.value);
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(2)}K`;
    }
    return num.toLocaleString();
  }

  return String(kpi.value);
}
