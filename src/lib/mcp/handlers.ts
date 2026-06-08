import { debugLog } from "@/lib/utils/debug";
import { getDb } from "@/lib/db";
import { datasets, datasetRows } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

import {
  getFaqsFromPayload,
  getNewsPostBySlug,
  getNewsPosts,
  type FaqItem,
  type NewsPostSummary,
} from "@/lib/payload/content";
import { allFaqCategories } from "@/lib/content/faq";

import type { PrecomputedMetrics } from "../utils/pipeline-types";
import type {
  CompareDatasetsOutput,
  CostBreakdownOutput,
  DatasetSchemaOutput,
  FaqItemOutput,
  GetFaqsOutput,
  GetNewsOutput,
  PrecomputedKpisOutput,
  ProfitMarginTrendOutput,
  ProfitabilitySummaryOutput,
  RevenueTrendsOutput,
  TopProductsOutput,
  TopRegionsOutput,
} from "./tools";

type ChartData = PrecomputedMetrics["chartData"];
type CostBreakdown = PrecomputedMetrics["costBreakdown"];

function getChartData(metrics: PrecomputedMetrics): Partial<ChartData> {
  return metrics.chartData ?? {};
}

function getCostBreakdown(metrics: PrecomputedMetrics): CostBreakdown {
  return (
    metrics.costBreakdown ?? {
      cogs: 0,
      marketingCost: 0,
      shippingCost: 0,
      refunds: 0,
      discount: 0,
      totalCost: metrics.totalCost ?? 0,
    }
  );
}

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

  const inferredTypes: Record<string, "string" | "number" | "date" | "boolean"> = {};
  const columns: string[] = [];

  if (detectedColumns) {
    if (detectedColumns.revenueColumn) {
      inferredTypes[detectedColumns.revenueColumn] = "number";
      columns.push(detectedColumns.revenueColumn);
    }
    if (detectedColumns.profitColumn) {
      inferredTypes[detectedColumns.profitColumn] = "number";
      columns.push(detectedColumns.profitColumn);
    }
    if (detectedColumns.costColumn) {
      inferredTypes[detectedColumns.costColumn] = "number";
      columns.push(detectedColumns.costColumn);
    }
    if (detectedColumns.dateColumn) {
      inferredTypes[detectedColumns.dateColumn] = "date";
      columns.push(detectedColumns.dateColumn);
    }
    if (detectedColumns.productColumn) {
      inferredTypes[detectedColumns.productColumn] = "string";
      columns.push(detectedColumns.productColumn);
    }
    if (detectedColumns.regionColumn) {
      inferredTypes[detectedColumns.regionColumn] = "string";
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
  metric: "revenue" | "profit" | "quantity" | "cost" = "revenue",
  limit: number = 10,
): TopRegionsOutput {
  const metrics = getAnalysisCache(datasetId);

  if (!metrics) {
    throw new Error(`No analysis found for dataset: ${datasetId}. Please run analysis first.`);
  }

  let rankedRows: { rank: number; name: string; value: number }[] = [];
  let totals = { metric: "revenue", value: 0 };

  if (metric === "revenue" || metric === "profit") {
    const chartData = getChartData(metrics);
    const data =
      metric === "revenue" ? (chartData.revenueByRegion ?? []) : (chartData.profitByRegion ?? []);

    const total = data.reduce((sum, item) => sum + item.value, 0);
    totals = { metric, value: total };

    rankedRows = data.slice(0, limit).map((item, index) => ({
      rank: index + 1,
      name: item.category,
      value: item.value,
    }));
  } else if (metric === "quantity" && metrics.productPerformance) {
    const data = metrics.productPerformance
      .filter((p) => p.quantity !== undefined)
      .map((p) => ({ category: p.name, value: p.quantity || 0 }))
      .sort((a, b) => b.value - a.value);

    const total = data.reduce((sum, item) => sum + item.value, 0);
    totals = { metric: "quantity", value: total };

    rankedRows = data.slice(0, limit).map((item, index) => ({
      rank: index + 1,
      name: item.category,
      value: item.value,
    }));
  }

  const sharePercentages: Record<string, number> = {};
  const totalValue = totals.value;
  rankedRows.forEach((row) => {
    sharePercentages[row.name] =
      totalValue > 0 ? Math.round((row.value / totalValue) * 1000) / 10 : 0;
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

export function getTopProducts(
  datasetId: string,
  metric: "revenue" | "profit" | "quantity" = "revenue",
  limit: number = 10,
): TopProductsOutput {
  const metrics = getAnalysisCache(datasetId);

  if (!metrics) {
    throw new Error(`No analysis found for dataset: ${datasetId}. Please run analysis first.`);
  }

  const chartData = getChartData(metrics);
  let rankedProducts: { rank: number; name: string; value: number; percentage: number }[] = [];
  let totals = { metric: "revenue", value: 0 };

  if (metric === "revenue") {
    const data = chartData.revenueByProduct ?? [];
    const total = data.reduce((sum, item) => sum + item.value, 0);
    totals = { metric: "revenue", value: total };
    rankedProducts = data.slice(0, limit).map((item, index) => ({
      rank: index + 1,
      name: item.category,
      value: item.value,
      percentage: total > 0 ? Math.round((item.value / total) * 1000) / 10 : 0,
    }));
  } else if (metric === "profit") {
    const data = chartData.profitByProduct ?? [];
    const total = data.reduce((sum, item) => sum + item.value, 0);
    totals = { metric: "profit", value: total };
    rankedProducts = data.slice(0, limit).map((item, index) => ({
      rank: index + 1,
      name: item.category,
      value: item.value,
      percentage: total > 0 ? Math.round((item.value / total) * 1000) / 10 : 0,
    }));
  } else if (metric === "quantity" && metrics.productPerformance) {
    const data = metrics.productPerformance
      .filter((p) => p.quantity !== undefined)
      .map((p) => ({ category: p.name, value: p.quantity || 0, percentage: p.percentage }))
      .sort((a, b) => b.value - a.value);
    const total = data.reduce((sum, item) => sum + item.value, 0);
    totals = { metric: "quantity", value: total };
    rankedProducts = data.slice(0, limit).map((item, index) => ({
      rank: index + 1,
      name: item.category,
      value: item.value,
      percentage: total > 0 ? Math.round((item.value / total) * 1000) / 10 : 0,
    }));
  }

  return {
    rankedProducts,
    totals,
    metadata: {
      datasetId,
      metric,
      computedAt: metrics.computedAt,
    },
  };
}

export function getCostBreakdownFromCache(datasetId: string): CostBreakdownOutput {
  const metrics = getAnalysisCache(datasetId);

  if (!metrics) {
    throw new Error(`No analysis found for dataset: ${datasetId}. Please run analysis first.`);
  }

  const costBreakdown = getCostBreakdown(metrics);
  const totalCost = costBreakdown.totalCost;

  const categories = [
    { category: "COGS", amount: costBreakdown.cogs },
    { category: "Marketing", amount: costBreakdown.marketingCost },
    { category: "Shipping", amount: costBreakdown.shippingCost },
    { category: "Refunds", amount: costBreakdown.refunds },
    { category: "Discounts", amount: costBreakdown.discount },
  ]
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .map((c) => ({
      ...c,
      percentage: totalCost > 0 ? Math.round((c.amount / totalCost) * 1000) / 10 : 0,
    }));

  return {
    totalCost,
    categories,
    metadata: {
      datasetId,
      computedAt: metrics.computedAt,
    },
  };
}

export function getProfitMarginTrend(datasetId: string): ProfitMarginTrendOutput {
  const metrics = getAnalysisCache(datasetId);

  if (!metrics) {
    throw new Error(`No analysis found for dataset: ${datasetId}. Please run analysis first.`);
  }

  return {
    totalRevenue: metrics.totalRevenue,
    totalExpenses: metrics.totalCost,
    netProfit: metrics.totalProfit,
    profitMargin: metrics.profitMargin || 0,
    growthRate: metrics.growthRate,
    growthTrend: metrics.growthTrend,
    growthMessage: metrics.growthMessage,
    metadata: {
      datasetId,
      computedAt: metrics.computedAt,
    },
  };
}

export async function compareDatasets(
  datasetIdA: string,
  datasetIdB: string,
): Promise<CompareDatasetsOutput> {
  const db = getDb();
  if (!db) {
    throw new Error("Database not available for dataset comparison.");
  }

  const [dsA, dsB] = await Promise.all([
    db.query.datasets.findFirst({ where: eq(datasets.id, datasetIdA), columns: { id: true, name: true, data: true } }),
    db.query.datasets.findFirst({ where: eq(datasets.id, datasetIdB), columns: { id: true, name: true, data: true } }),
  ]);

  if (!dsA) throw new Error(`Dataset not found: ${datasetIdA}`);
  if (!dsB) throw new Error(`Dataset not found: ${datasetIdB}`);

  const [rowsA, rowsB] = await Promise.all([
    db.query.datasetRows.findMany({
      where: eq(datasetRows.datasetId, datasetIdA),
      columns: { data: true },
      orderBy: [asc(datasetRows.rowIndex)],
    }),
    db.query.datasetRows.findMany({
      where: eq(datasetRows.datasetId, datasetIdB),
      columns: { data: true },
      orderBy: [asc(datasetRows.rowIndex)],
    }),
  ]);

  const dataA: Record<string, unknown>[] = (dsA.data as Record<string, unknown>[]) || rowsA.map((r) => r.data as Record<string, unknown>);
  const dataB: Record<string, unknown>[] = (dsB.data as Record<string, unknown>[]) || rowsB.map((r) => r.data as Record<string, unknown>);

  // Infer numeric columns from first rows of each dataset
  const numericColsA = dataA.length > 0
    ? Object.entries(dataA[0]).filter(([, v]) => typeof v === "number" || !isNaN(Number(v))).map(([k]) => k)
    : [];
  const numericColsB = dataB.length > 0
    ? Object.entries(dataB[0]).filter(([, v]) => typeof v === "number" || !isNaN(Number(v))).map(([k]) => k)
    : [];
  const commonNumeric = numericColsA.filter((col) => numericColsB.includes(col));

  // Aggregate sums for common numeric columns
  const sumA = (col: string) => dataA.reduce((s, r) => s + (Number(r[col]) || 0), 0);
  const sumB = (col: string) => dataB.reduce((s, r) => s + (Number(r[col]) || 0), 0);

  const metrics = commonNumeric.map((col) => {
    const valueA = sumA(col);
    const valueB = sumB(col);
    const absoluteChange = valueB - valueA;
    const changePercent = valueA !== 0 ? ((valueB - valueA) / Math.abs(valueA)) * 100 : 0;
    const trend: "up" | "down" | "stable" = changePercent > 3 ? "up" : changePercent < -3 ? "down" : "stable";
    return { metric: col, valueA, valueB, absoluteChange, changePercent, trend };
  });

  // Build matching columns metadata
  const allColumns = [...new Set([...Object.keys(dataA[0] || {}), ...Object.keys(dataB[0] || {})])];
  const matchingColumns = allColumns.map((col) => ({
    column: col,
    type: commonNumeric.includes(col) ? "numeric" : "categorical",
    inBoth: col in (dataA[0] || {}) && col in (dataB[0] || {}),
    matchPercent: col in (dataA[0] || {}) && col in (dataB[0] || {}) ? 100 : 0,
  }));

  const increases = metrics.filter((m) => m.trend === "up").length;
  const decreases = metrics.filter((m) => m.trend === "down").length;
  const summary = `Compared ${metrics.length} common metrics between ${dsA.name} and ${dsB.name}. ${increases > 0 ? `${increases} metric${increases > 1 ? "s" : ""} increased.` : ""} ${decreases > 0 ? `${decreases} metric${decreases > 1 ? "s" : ""} decreased.` : ""}`;

  return {
    datasetA: { id: dsA.id, name: dsA.name, rowCount: dataA.length },
    datasetB: { id: dsB.id, name: dsB.name, rowCount: dataB.length },
    matchingColumns,
    metrics,
    summary,
  };
}

export function getRevenueTrends(
  datasetId: string,
  dateGrain: "daily" | "weekly" | "monthly" | "quarterly" | "yearly" = "monthly",
  metric: "revenue" | "profit" | "quantity" = "revenue",
): RevenueTrendsOutput {
  const metrics = getAnalysisCache(datasetId);

  if (!metrics) {
    throw new Error(`No analysis found for dataset: ${datasetId}. Please run analysis first.`);
  }

  let trendRows: { period: string; value: number }[] = [];

  const chartData = getChartData(metrics);

  if (metric === "revenue") {
    trendRows = (chartData.revenueByMonth ?? []).map((m) => ({
      period: m.month,
      value: m.revenue,
    }));
  } else if (metric === "profit") {
    trendRows = (chartData.profitByMonth ?? []).map((m) => ({
      period: m.month,
      value: m.profit,
    }));
  }

  trendRows.sort((a, b) => a.period.localeCompare(b.period));

  const firstPeriod = trendRows.length > 0 ? trendRows[0] : null;
  const lastPeriod = trendRows.length > 0 ? trendRows[trendRows.length - 1] : null;

  let growthDirection: "up" | "down" | "stable" | "insufficient_data" = "insufficient_data";

  if (firstPeriod && lastPeriod && firstPeriod.value > 0) {
    const change = ((lastPeriod.value - firstPeriod.value) / firstPeriod.value) * 100;
    if (change > 5) {
      growthDirection = "up";
    } else if (change < -5) {
      growthDirection = "down";
    } else {
      growthDirection = "stable";
    }
  }

  let peakPeriod: { period: string; value: number } | null = null;
  let troughPeriod: { period: string; value: number } | null = null;

  if (trendRows.length > 0) {
    const sorted = [...trendRows].sort((a, b) => b.value - a.value);
    peakPeriod = { period: sorted[0].period, value: sorted[0].value };
    troughPeriod = {
      period: sorted[sorted.length - 1].period,
      value: sorted[sorted.length - 1].value,
    };
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

export async function getFaqs(
  category?: string,
  query?: string,
  limit: number = 20,
): Promise<GetFaqsOutput> {
  // Try Payload first, fall back to built-in static data
  try {
    const payloadResult = await getFaqsFromPayload(category, query, limit);
    if (payloadResult.faqs.length > 0) {
      return {
        faqs: payloadResult.faqs.map((f) => ({
          category: f.category,
          question: f.question,
          answer: f.answer,
          tag: f.tag || undefined,
        })),
        totalCount: payloadResult.totalCount,
        categories: payloadResult.categories,
      };
    }
  } catch {
    // Fall through to static data
  }

  let faqs: FaqItemOutput[] = allFaqCategories.flatMap((cat) =>
    cat.items.map((item) => ({
      category: cat.category,
      question: item.q,
      answer: item.a,
      tag: item.tag,
    })),
  );

  if (category) {
    const catLower = category.toLowerCase();
    faqs = faqs.filter((f) => f.category.toLowerCase() === catLower);
  }

  if (query) {
    const qLower = query.toLowerCase();
    faqs = faqs.filter(
      (f) =>
        f.question.toLowerCase().includes(qLower) ||
        f.answer.toLowerCase().includes(qLower),
    );
  }

  const categories = [
    ...new Set(allFaqCategories.map((c) => c.category)),
  ];

  return {
    faqs: faqs.slice(0, limit),
    totalCount: faqs.length,
    categories,
  };
}

export async function getNews(
  slug?: string,
  query?: string,
  limit: number = 10,
  includeContent: boolean = false,
): Promise<GetNewsOutput> {
  const normalizedSlug = slug?.trim();
  let posts: NewsPostSummary[];

  if (normalizedSlug) {
    const post = await getNewsPostBySlug(normalizedSlug);
    posts = post ? [post] : [];
  } else {
    posts = await getNewsPosts(50);
  }

  const normalizedQuery = query?.trim().toLowerCase();
  const matchingPosts = normalizedQuery
    ? posts.filter((post) =>
        [post.title, post.summary, post.content].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        ),
      )
    : posts;

  return {
    news: matchingPosts.slice(0, limit).map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      summary: post.summary,
      publishedAt: post.publishedAt,
      url: `/news/${post.slug}`,
      ...(includeContent ? { content: post.content } : {}),
    })),
    totalCount: matchingPosts.length,
  };
}

export function getProfitabilitySummary(datasetId: string): ProfitabilitySummaryOutput {
  const metrics = getAnalysisCache(datasetId);

  if (!metrics) {
    throw new Error(`No analysis found for dataset: ${datasetId}. Please run analysis first.`);
  }

  const costBreakdown = getCostBreakdown(metrics);
  const chartData = getChartData(metrics);

  const topCostCategories = [
    { category: "COGS", amount: costBreakdown.cogs, percentage: 0 },
    { category: "Marketing", amount: costBreakdown.marketingCost, percentage: 0 },
    { category: "Shipping", amount: costBreakdown.shippingCost, percentage: 0 },
    { category: "Refunds", amount: costBreakdown.refunds, percentage: 0 },
    { category: "Discounts", amount: costBreakdown.discount, percentage: 0 },
  ]
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const totalCost = costBreakdown.totalCost;
  topCostCategories.forEach((c) => {
    c.percentage = totalCost > 0 ? Math.round((c.amount / totalCost) * 1000) / 10 : 0;
  });

  const revenueByRegion = (chartData.revenueByRegion ?? []).map((item) => ({
    region: item.category,
    revenue: item.value,
    percentage: item.percentage,
  }));

  const revenueByProduct = (chartData.revenueByProduct ?? []).map((item) => ({
    product: item.category,
    revenue: item.value,
    percentage: item.percentage,
  }));

  const revenueVsExpenses = (chartData.revenueByMonth ?? []).map((m) => ({
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
