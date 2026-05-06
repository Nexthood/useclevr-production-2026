import { DatasetSchemaOutput, PrecomputedKpisOutput, TopRegionsOutput, RevenueTrendsOutput, ProfitabilitySummaryOutput } from './tools';
import { getAnalysisCache } from './handlers';

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export function getAvailableResources(datasetId: string): MCPResource[] {
  const metrics = getAnalysisCache(datasetId);
  
  if (!metrics) {
    return [];
  }

  return [
    {
      uri: `dataset://${datasetId}/schema`,
      name: 'Dataset Schema',
      description: 'Dataset structure including columns, types, and business field mappings',
      mimeType: 'application/json',
    },
    {
      uri: `dataset://${datasetId}/kpis`,
      name: 'Precomputed KPIs',
      description: 'Trusted KPI values including revenue, expenses, profit, margin, and top performers',
      mimeType: 'application/json',
    },
    {
      uri: `dataset://${datasetId}/top-regions`,
      name: 'Top Regions',
      description: 'Ranked region/country data with totals and share percentages',
      mimeType: 'application/json',
    },
    {
      uri: `dataset://${datasetId}/revenue-trends`,
      name: 'Revenue Trends',
      description: 'Revenue-over-time data with trend metadata',
      mimeType: 'application/json',
    },
    {
      uri: `dataset://${datasetId}/profitability`,
      name: 'Profitability Summary',
      description: 'Profitability analysis including revenue, expenses, net profit, and breakdowns',
      mimeType: 'application/json',
    },
  ];
}

export function readResource(uri: string): {
  content: any;
  mimeType: string;
} {
  const match = uri.match(/^dataset:\/\/([^/]+)\/(.+)$/);
  
  if (!match) {
    throw new Error(`Invalid resource URI: ${uri}`);
  }

  const [, datasetId, resourceType] = match;
  const metrics = getAnalysisCache(datasetId);
  
  if (!metrics) {
    throw new Error(`No analysis found for dataset: ${datasetId}`);
  }

  switch (resourceType) {
    case 'schema':
      return {
        content: {
          columns: Object.keys(metrics.detectedColumns || {}),
          rowCount: metrics.fullDatasetRowCount,
          dateColumns: metrics.detectedColumns?.dateColumn ? [metrics.detectedColumns.dateColumn] : [],
          businessFields: {
            revenue: metrics.detectedColumns?.revenueColumn,
            cost: metrics.detectedColumns?.costColumn,
            profit: metrics.detectedColumns?.profitColumn,
            product: metrics.detectedColumns?.productColumn,
            region: metrics.detectedColumns?.regionColumn,
          },
        },
        mimeType: 'application/json',
      };
    
    case 'kpis':
      return {
        content: {
          totalRevenue: metrics.totalRevenue,
          totalExpenses: metrics.totalCost,
          grossProfit: metrics.totalProfit,
          netProfit: metrics.totalProfit,
          margin: metrics.profitMargin,
          topRegion: metrics.topRegions?.[0],
          topProduct: metrics.topProducts?.[0],
          rowCount: metrics.fullDatasetRowCount,
        },
        mimeType: 'application/json',
      };
    
    case 'top-regions':
      return {
        content: {
          rankedRows: metrics.chartData.revenueByRegion.map((item, index) => ({
            rank: index + 1,
            name: item.category,
            value: item.value,
            percentage: item.percentage,
          })),
          totals: {
            metric: 'revenue',
            value: metrics.totalRevenue,
          },
        },
        mimeType: 'application/json',
      };
    
    case 'revenue-trends':
      return {
        content: {
          trendRows: metrics.chartData.revenueByMonth.map(m => ({
            period: m.month,
            revenue: m.revenue,
            profit: m.profit,
          })),
          firstPeriod: metrics.chartData.revenueByMonth[0]?.month || null,
          lastPeriod: metrics.chartData.revenueByMonth[metrics.chartData.revenueByMonth.length - 1]?.month || null,
          growthRate: metrics.growthRate,
          growthTrend: metrics.growthTrend,
        },
        mimeType: 'application/json',
      };
    
    case 'profitability':
      return {
        content: {
          totalRevenue: metrics.totalRevenue,
          totalExpenses: metrics.totalCost,
          netProfit: metrics.totalProfit,
          profitMargin: metrics.profitMargin,
          topCostCategories: [
            { category: 'COGS', amount: metrics.costBreakdown.cogs },
            { category: 'Marketing', amount: metrics.costBreakdown.marketingCost },
            { category: 'Shipping', amount: metrics.costBreakdown.shippingCost },
            { category: 'Refunds', amount: metrics.costBreakdown.refunds },
          ].filter(c => c.amount > 0),
          revenueByRegion: metrics.chartData.revenueByRegion,
          revenueByProduct: metrics.chartData.revenueByProduct,
        },
        mimeType: 'application/json',
      };
    
    default:
      throw new Error(`Unknown resource type: ${resourceType}`);
  }
}
