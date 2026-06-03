import { debugError, debugLog } from "@/lib/utils/debug";

import type { PrecomputedMetrics } from '../utils/pipeline-types';
import { invokeTool, setAnalysisCache } from './server';

export interface MCPToolContext {
  datasetId: string;
  question: string;
}

export function initializeMCPContext(datasetId: string, metrics: PrecomputedMetrics): void {
  setAnalysisCache(datasetId, metrics);
  debugLog(`[MCP-INTEGRATION] Initialized MCP context for dataset: ${datasetId}`);
}

export function buildMCPToolsPrompt(datasetId: string): string {
  return `
AVAILABLE MCP TOOLS (Use these for accurate data):

1. getDatasetSchema - Get dataset structure
   Input: { datasetId: "${datasetId}" }

2. getPrecomputedKpis - Get trusted KPI values
   Input: { datasetId: "${datasetId}" }

3. getTopRegions - Get ranked region data
   Input: { datasetId: "${datasetId}", metric: "revenue", limit: 10 }

4. getTopProducts - Get ranked product data
   Input: { datasetId: "${datasetId}", metric: "revenue", limit: 10 }

5. getRevenueTrends - Get revenue-over-time data
   Input: { datasetId: "${datasetId}", dateGrain: "monthly", metric: "revenue" }

6. getProfitabilitySummary - Get profitability analysis
   Input: { datasetId: "${datasetId}" }

7. getCostBreakdown - Get cost breakdown by category
   Input: { datasetId: "${datasetId}" }

8. getProfitMarginTrend - Get profit margin and growth trend
   Input: { datasetId: "${datasetId}" }

9. compareDatasets - Compare two datasets by ID
   Input: { datasetIdA: "${datasetId}", datasetIdB: "<other-dataset-id>" }

IMPORTANT:
- Use these tools to get accurate data values
- Do NOT invent numbers or metrics
- If a tool returns no data, honestly say so
- Always use the exact values from tool outputs
`;
}

export async function callMCPToolSafely(
  toolName: string,
  input: Record<string, any>
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const result = await invokeTool({ name: toolName, input });

    if (result.success) {
      return { success: true, data: result.result };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error: any) {
    debugError(`[MCP-INTEGRATION] Tool call failed: ${toolName}`, error);
    return { success: false, error: error?.message || 'Tool call failed' };
  }
}

export async function getTrustedKPIs(datasetId: string): Promise<any> {
  const result = await callMCPToolSafely('getPrecomputedKpis', { datasetId });
  return result.success ? result.data : null;
}

export async function getTrustedSchema(datasetId: string): Promise<any> {
  const result = await callMCPToolSafely('getDatasetSchema', { datasetId });
  return result.success ? result.data : null;
}

export async function getTrustedTopRegions(datasetId: string, metric = 'revenue', limit = 10): Promise<any> {
  const result = await callMCPToolSafely('getTopRegions', { datasetId, metric, limit });
  return result.success ? result.data : null;
}

export async function getTrustedCostBreakdown(datasetId: string): Promise<any> {
  const result = await callMCPToolSafely('getCostBreakdown', { datasetId });
  return result.success ? result.data : null;
}

export async function getTrustedProfitMarginTrend(datasetId: string): Promise<any> {
  const result = await callMCPToolSafely('getProfitMarginTrend', { datasetId });
  return result.success ? result.data : null;
}

export async function getTrustedComparison(datasetIdA: string, datasetIdB: string): Promise<any> {
  const result = await callMCPToolSafely('compareDatasets', { datasetIdA, datasetIdB });
  return result.success ? result.data : null;
}

export async function getTrustedTopProducts(
  datasetId: string,
  metric = 'revenue',
  limit = 10
): Promise<any> {
  const result = await callMCPToolSafely('getTopProducts', { datasetId, metric, limit });
  return result.success ? result.data : null;
}

export async function getTrustedRevenueTrends(
  datasetId: string,
  dateGrain = 'monthly',
  metric = 'revenue'
): Promise<any> {
  const result = await callMCPToolSafely('getRevenueTrends', { datasetId, dateGrain, metric });
  return result.success ? result.data : null;
}

export async function getTrustedProfitability(datasetId: string): Promise<any> {
  const result = await callMCPToolSafely('getProfitabilitySummary', { datasetId });
  return result.success ? result.data : null;
}

export interface AnalysisWithMCPResult {
  answer: string;
  insight: string;
  explanation: string;
  recommendation: string;
  data: any[];
  chartType: string;
  usedMCPTools: boolean;
  mcpToolResults?: Record<string, any>;
}

export async function analyzeWithMCP(
  question: string,
  datasetId: string,
  queryResult: any[],
  _availableColumns: string[]
): Promise<AnalysisWithMCPResult> {
  debugLog(`[MCP-INTEGRATION] Analyzing with MCP tools for dataset: ${datasetId}`);

  const mcpToolResults: Record<string, any> = {};
  let usedMCPTools = false;

  const questionLower = question.toLowerCase();
  const isKPIQuestion = questionLower.includes('total') ||
    questionLower.includes('revenue') ||
    questionLower.includes('profit') ||
    questionLower.includes('margin');

  const isRegionQuestion = questionLower.includes('region') ||
    questionLower.includes('country') ||
    questionLower.includes('top');

  const isTrendQuestion = questionLower.includes('trend') ||
    questionLower.includes('growth') ||
    questionLower.includes('over time') ||
    questionLower.includes('month');

  const isProductQuestion = questionLower.includes('product') ||
    questionLower.includes('item') ||
    questionLower.includes('sku') ||
    questionLower.includes('best seller') ||
    questionLower.includes('top selling');

  const isCostQuestion = questionLower.includes('cost breakdown') ||
    questionLower.includes('cost category') ||
    questionLower.includes('spend') ||
    questionLower.includes('expense category');

  const isProfitMarginQuestion = questionLower.includes('profit margin') ||
    questionLower.includes('margin analysis') ||
    questionLower.includes('growth trend') ||
    questionLower.includes('profit trend');

  const isProfitabilityQuestion = questionLower.includes('profitability') ||
    questionLower.includes('cost') ||
    questionLower.includes('expense');

  if (isKPIQuestion || isRegionQuestion || isProductQuestion || isCostQuestion || isProfitMarginQuestion || isTrendQuestion || isProfitabilityQuestion) {
    usedMCPTools = true;

    if (isKPIQuestion) {
      const kpis = await getTrustedKPIs(datasetId);
      if (kpis) mcpToolResults.kpis = kpis;
    }

    if (isRegionQuestion) {
      const regions = await getTrustedTopRegions(datasetId, 'revenue', 10);
      if (regions) mcpToolResults.topRegions = regions;
    }

    if (isProductQuestion) {
      const products = await getTrustedTopProducts(datasetId, 'revenue', 10);
      if (products) mcpToolResults.topProducts = products;
    }

    if (isTrendQuestion) {
      const trends = await getTrustedRevenueTrends(datasetId, 'monthly', 'revenue');
      if (trends) mcpToolResults.revenueTrends = trends;
    }

    if (isCostQuestion) {
      const cost = await getTrustedCostBreakdown(datasetId);
      if (cost) mcpToolResults.costBreakdown = cost;
    }

    if (isProfitMarginQuestion) {
      const marginTrend = await getTrustedProfitMarginTrend(datasetId);
      if (marginTrend) mcpToolResults.profitMarginTrend = marginTrend;
    }

    if (isProfitabilityQuestion) {
      const profitability = await getTrustedProfitability(datasetId);
      if (profitability) mcpToolResults.profitability = profitability;
    }
  }

  let answer = '';
  let insight = '';
  let explanation = '';
  let recommendation = '';

  if (usedMCPTools && Object.keys(mcpToolResults).length > 0) {
    debugLog(`[MCP-INTEGRATION] Using MCP tool results for analysis`);

    const kpis = mcpToolResults.kpis;
    const regions = mcpToolResults.topRegions;
    const products = mcpToolResults.topProducts;
    const costBreakdown = mcpToolResults.costBreakdown;
    const profitMarginTrend = mcpToolResults.profitMarginTrend;
    const trends = mcpToolResults.revenueTrends;
    const profitability = mcpToolResults.profitability;

    if (kpis) {
      const revenue = kpis.totalRevenue ?? 0;
      const profit = kpis.netProfit ?? 0;
      const margin = kpis.margin ?? 0;

      insight = `Total revenue is ${formatCurrency(revenue)} with ${formatCurrency(profit)} net profit (${margin}% margin)`;
      explanation = kpis.topRegion
        ? `${kpis.topRegion.name} is the top region. ${kpis.topProduct ? kpis.topProduct.name + ' is the top product.' : ''}`
        : 'Based on precomputed KPI analysis.';
      recommendation = 'Review regional performance to identify growth opportunities.';
    }

    if (regions && regions.rankedRows?.length > 0) {
      const top = regions.rankedRows[0];
      insight = `${top.name} leads with ${formatCurrency(top.value)} (${regions.sharePercentages?.[top.name] || 0}% of total)`;
      explanation = `${regions.rankedRows.slice(0, 3).map((r: any) => `${r.name}: ${formatCurrency(r.value)}`).join(', ')}`;
      recommendation = `Focus on ${top.name} while developing strategies for other regions.`;
    }

    if (products && products.rankedProducts?.length > 0) {
      const top = products.rankedProducts[0];
      insight = `${top.name} is the top product with ${formatCurrency(top.value)} (${top.percentage}% share)`;
      explanation = `${products.rankedProducts.slice(0, 3).map((r: any) => `${r.name}: ${formatCurrency(r.value)}`).join(', ')}`;
      recommendation = `Maximize ${top.name} while developing other products.`;
    }

    if (trends) {
      const direction = trends.growthDirection;
      const first = trends.firstPeriod;
      const last = trends.lastPeriod;

      if (direction === 'up') {
        insight = `Revenue grew from ${formatCurrency(first?.value || 0)} to ${formatCurrency(last?.value || 0)}`;
        explanation = `${trends.trendRows?.length || 0} periods analyzed. Peak: ${trends.peakPeriod?.period} at ${formatCurrency(trends.peakPeriod?.value || 0)}`;
        recommendation = 'Capitalize on growth momentum with increased investment.';
      } else if (direction === 'down') {
        insight = `Revenue declined from ${formatCurrency(first?.value || 0)} to ${formatCurrency(last?.value || 0)}`;
        explanation = 'Review pricing strategy and product-market fit.';
        recommendation = 'Investigate root causes of decline and develop recovery plan.';
      }
    }

    if (costBreakdown && costBreakdown.categories?.length > 0) {
      const top = costBreakdown.categories[0];
      insight = `Top cost category is ${top.category} at ${formatCurrency(top.amount)} (${top.percentage}% of total)`;
      explanation = `Total costs: ${formatCurrency(costBreakdown.totalCost)}. ${costBreakdown.categories.slice(0, 3).map((c: any) => `${c.category}: ${formatCurrency(c.amount)} (${c.percentage}%)`).join(', ')}`;
      recommendation = `Review ${top.category} for cost optimization opportunities.`;
    }

    if (profitMarginTrend) {
      const margin = profitMarginTrend.profitMargin;
      const trend = profitMarginTrend.growthTrend;
      insight = `Profit margin is ${margin}% with ${trend === 'up' ? 'positive' : trend === 'down' ? 'declining' : 'stable'} growth trend`;
      explanation = `Revenue: ${formatCurrency(profitMarginTrend.totalRevenue)} | Expenses: ${formatCurrency(profitMarginTrend.totalExpenses)} | Net profit: ${formatCurrency(profitMarginTrend.netProfit)}`;
      recommendation = trend === 'up' ? 'Maintain growth trajectory with strategic investment.' : trend === 'down' ? 'Review cost structure and pricing strategy.' : 'Explore new growth opportunities.';
    }

    if (profitability) {
      insight = `Profitability: ${formatCurrency(profitability.netProfit)} margin (${profitability.profitMargin}%)`;
      explanation = `Revenue: ${formatCurrency(profitability.totalRevenue)} | Expenses: ${formatCurrency(profitability.totalExpenses)}`;
      recommendation = 'Review cost structure for optimization opportunities.';
    }

    answer = `INSIGHT\n${insight}\n\nEXPLANATION\n${explanation}\n\nRECOMMENDATION\n${recommendation}`;
  }

  return {
    answer,
    insight,
    explanation,
    recommendation,
    data: queryResult,
    chartType: 'table',
    usedMCPTools,
    mcpToolResults: usedMCPTools ? mcpToolResults : undefined,
  };
}

function formatCurrency(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export { getResource, listResources, listTools } from './server';
export { getToolByName, mcpTools } from './tools';
