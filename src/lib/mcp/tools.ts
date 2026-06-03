import { z } from "zod";

export const GetDatasetSchemaInput = z.object({
  datasetId: z.string(),
});

export type GetDatasetSchemaInput = z.infer<typeof GetDatasetSchemaInput>;

export interface DatasetSchemaOutput {
  columns: string[];
  inferredTypes: Record<string, "string" | "number" | "date" | "boolean">;
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
  metric: z.enum(["revenue", "profit", "quantity", "cost"]).default("revenue"),
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
  dateGrain: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]).default("monthly"),
  metric: z.enum(["revenue", "profit", "quantity"]).default("revenue"),
});

export type GetRevenueTrendsInput = z.infer<typeof GetRevenueTrendsInput>;

export interface RevenueTrendsOutput {
  trendRows: { period: string; value: number }[];
  firstPeriod: { period: string; value: number } | null;
  lastPeriod: { period: string; value: number } | null;
  growthDirection: "up" | "down" | "stable" | "insufficient_data";
  peakPeriod: { period: string; value: number } | null;
  troughPeriod: { period: string; value: number } | null;
  metadata: {
    datasetId: string;
    dateGrain: string;
    metric: string;
    computedAt: string;
  };
}

export const GetTopProductsInput = z.object({
  datasetId: z.string(),
  metric: z.enum(["revenue", "profit", "quantity"]).default("revenue"),
  limit: z.number().min(1).max(50).default(10),
});

export type GetTopProductsInput = z.infer<typeof GetTopProductsInput>;

export interface TopProductsOutput {
  rankedProducts: { rank: number; name: string; value: number; percentage: number }[];
  totals: { metric: string; value: number };
  metadata: {
    datasetId: string;
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

export const GetCostBreakdownInput = z.object({
  datasetId: z.string(),
});

export type GetCostBreakdownInput = z.infer<typeof GetCostBreakdownInput>;

export interface CostBreakdownOutput {
  totalCost: number;
  categories: { category: string; amount: number; percentage: number }[];
  metadata: {
    datasetId: string;
    computedAt: string;
  };
}

export const GetProfitMarginTrendInput = z.object({
  datasetId: z.string(),
});

export type GetProfitMarginTrendInput = z.infer<typeof GetProfitMarginTrendInput>;

export interface ProfitMarginTrendOutput {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  growthRate: number | null;
  growthTrend: "up" | "down" | "stable" | null;
  growthMessage: string;
  metadata: {
    datasetId: string;
    computedAt: string;
  };
}

export const CompareDatasetsInput = z.object({
  datasetIdA: z.string(),
  datasetIdB: z.string(),
});

export type CompareDatasetsInput = z.infer<typeof CompareDatasetsInput>;

export interface CompareDatasetsOutput {
  datasetA: { id: string; name: string; rowCount: number };
  datasetB: { id: string; name: string; rowCount: number };
  matchingColumns: { column: string; type: string; inBoth: boolean; matchPercent: number }[];
  metrics: {
    metric: string;
    valueA: number;
    valueB: number;
    absoluteChange: number;
    changePercent: number;
    trend: "up" | "down" | "stable";
  }[];
  summary: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  outputSchema: unknown;
}

export const mcpTools: MCPTool[] = [
  {
    name: "getDatasetSchema",
    description:
      "Returns the trusted dataset structure including columns, inferred types, row count, date columns, and mapped business fields.",
    inputSchema: GetDatasetSchemaInput,
    outputSchema: {} as DatasetSchemaOutput,
  },
  {
    name: "getPrecomputedKpis",
    description:
      "Returns trusted precomputed KPI values including total revenue, expenses, profit, margin, and top performers.",
    inputSchema: GetPrecomputedKpisInput,
    outputSchema: {} as PrecomputedKpisOutput,
  },
  {
    name: "getTopRegions",
    description:
      "Returns normalized ranked region/country data with totals and share percentages for visualization.",
    inputSchema: GetTopRegionsInput,
    outputSchema: {} as TopRegionsOutput,
  },
  {
    name: "getCostBreakdown",
    description:
      "Returns cost breakdown by category with amounts and percentage shares of total cost.",
    inputSchema: GetCostBreakdownInput,
    outputSchema: {} as CostBreakdownOutput,
  },
  {
    name: "getProfitMarginTrend",
    description:
      "Returns profit margin and growth trend analysis including revenue, expenses, net profit, margin percentage, and growth direction.",
    inputSchema: GetProfitMarginTrendInput,
    outputSchema: {} as ProfitMarginTrendOutput,
  },
  {
    name: "compareDatasets",
    description:
      "Compares two datasets by ID and returns matching columns, metric differences, percentage changes, and a summary.",
    inputSchema: CompareDatasetsInput,
    outputSchema: {} as CompareDatasetsOutput,
  },
  {
    name: "getTopProducts",
    description:
      "Returns ranked product data with revenue, profit, or quantity breakdowns and share percentages for visualization.",
    inputSchema: GetTopProductsInput,
    outputSchema: {} as TopProductsOutput,
  },
  {
    name: "getRevenueTrends",
    description:
      "Returns normalized revenue-over-time data with trend metadata including growth direction, peak, and trough periods.",
    inputSchema: GetRevenueTrendsInput,
    outputSchema: {} as RevenueTrendsOutput,
  },
  {
    name: "getProfitabilitySummary",
    description:
      "Returns trusted profitability results including revenue, expenses, net profit, margin, and breakdowns by region and product.",
    inputSchema: GetProfitabilitySummaryInput,
    outputSchema: {} as ProfitabilitySummaryOutput,
  },
];

export function getToolByName(name: string): MCPTool | undefined {
  return mcpTools.find((tool) => tool.name === name);
}
