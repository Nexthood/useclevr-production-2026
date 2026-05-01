import { z } from 'zod';

export const GetDatasetSchemaInput = z.object({
  datasetId: z.string(),
});

export type GetDatasetSchemaInput = z.infer<typeof GetDatasetSchemaInput>;

export interface DatasetSchemaOutput {
  columns: string[];
  inferredTypes: Record<string, 'string' | 'number' | 'date' | 'boolean'>;
  rowCount: number;
  dateColumns: string[];
  businessFields?: {
    revenue?: string;
    cost?: string;
    profit?: string;
    product?: string;
    region?: string;
    category?: string;
  };
}

export const GetPrecomputedKpisInput = z.object({
  datasetId: z.string(),
});

export type GetPrecomputedKpisInput = z.infer<typeof GetPrecomputedKpisInput>;

export interface PrecomputedKpisOutput {
  totalRevenue: number;
  totalExpenses: number;
  grossProfit: number;
  netProfit: number;
  margin: number;
  topRegion: { name: string; value: number } | null;
  topProduct: { name: string; value: number } | null;
  rowCount: number;
}

export const GetTopRegionsInput = z.object({
  datasetId: z.string(),
  metric: z.enum(['revenue', 'profit', 'quantity', 'cost']).default('revenue'),
  limit: z.number().min(1).max(20).default(10),
});

export type GetTopRegionsInput = z.infer<typeof GetTopRegionsInput>;

export interface TopRegionsOutput {
  rankedRows: { rank: number; name: string; value: number }[];
  totals: { metric: string; value: number };
  sharePercentages: Record<string, number>;
  metadata: {
    datasetId: string;
    metric: string;
    computedAt: string;
  };
}

export const GetRevenueTrendsInput = z.object({
  datasetId: z.string(),
  dateGrain: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']).default('monthly'),
  metric: z.enum(['revenue', 'profit', 'quantity']).default('revenue'),
});

export type GetRevenueTrendsInput = z.infer<typeof GetRevenueTrendsInput>;

export interface RevenueTrendsOutput {
  trendRows: { period: string; value: number }[];
  firstPeriod: { period: string; value: number } | null;
  lastPeriod: { period: string; value: number } | null;
  growthDirection: 'up' | 'down' | 'stable' | 'insufficient_data';
  peakPeriod: { period: string; value: number } | null;
  troughPeriod: { period: string; value: number } | null;
  metadata: {
    datasetId: string;
    dateGrain: string;
    metric: string;
    computedAt: string;
  };
}

export const GetProfitabilitySummaryInput = z.object({
  datasetId: z.string(),
});

export type GetProfitabilitySummaryInput = z.infer<typeof GetProfitabilitySummaryInput>;

export interface ProfitabilitySummaryOutput {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  topCostCategories: { category: string; amount: number; percentage: number }[];
  revenueByRegion: { region: string; revenue: number; percentage: number }[];
  revenueByProduct: { product: string; revenue: number; percentage: number }[];
  revenueVsExpenses?: { period: string; revenue: number; expenses: number; profit: number }[];
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: z.ZodType<any>;
  outputSchema: any;
}

export const mcpTools: MCPTool[] = [
  {
    name: 'getDatasetSchema',
    description: 'Returns the trusted dataset structure including columns, inferred types, row count, date columns, and mapped business fields.',
    inputSchema: GetDatasetSchemaInput,
    outputSchema: {} as DatasetSchemaOutput,
  },
  {
    name: 'getPrecomputedKpis',
    description: 'Returns trusted precomputed KPI values including total revenue, expenses, profit, margin, and top performers.',
    inputSchema: GetPrecomputedKpisInput,
    outputSchema: {} as PrecomputedKpisOutput,
  },
  {
    name: 'getTopRegions',
    description: 'Returns normalized ranked region/country data with totals and share percentages for visualization.',
    inputSchema: GetTopRegionsInput,
    outputSchema: {} as TopRegionsOutput,
  },
  {
    name: 'getRevenueTrends',
    description: 'Returns normalized revenue-over-time data with trend metadata including growth direction, peak, and trough periods.',
    inputSchema: GetRevenueTrendsInput,
    outputSchema: {} as RevenueTrendsOutput,
  },
  {
    name: 'getProfitabilitySummary',
    description: 'Returns trusted profitability results including revenue, expenses, net profit, margin, and breakdowns by region and product.',
    inputSchema: GetProfitabilitySummaryInput,
    outputSchema: {} as ProfitabilitySummaryOutput,
  },
];

export function getToolByName(name: string): MCPTool | undefined {
  return mcpTools.find(tool => tool.name === name);
}
