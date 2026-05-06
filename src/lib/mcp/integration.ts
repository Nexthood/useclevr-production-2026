import { debugLog, debugError, debugWarn } from "@/lib/debug"

import { invokeTool, setAnalysisCache } from './server';
import { PrecomputedMetrics } from '../pipeline-types';

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
   
4. getRevenueTrends - Get revenue-over-time data
   Input: { datasetId: "${datasetId}", dateGrain: "monthly", metric: "revenue" }
   
5. getProfitabilitySummary - Get profitability analysis
   Input: { datasetId: "${datasetId}" }

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
  availableColumns: string[]
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
  
  const isProfitabilityQuestion = questionLower.includes('profitability') ||
    questionLower.includes('cost') ||
    questionLower.includes('expense');

  if (isKPIQuestion || isRegionQuestion || isTrendQuestion || isProfitabilityQuestion) {
    usedMCPTools = true;

    if (isKPIQuestion) {
      const kpis = await getTrustedKPIs(datasetId);
      if (kpis) mcpToolResults.kpis = kpis;
    }

    if (isRegionQuestion) {
      const regions = await getTrustedTopRegions(datasetId, 'revenue', 10);
      if (regions) mcpToolResults.topRegions = regions;
    }

    if (isTrendQuestion) {
      const trends = await getTrustedRevenueTrends(datasetId, 'monthly', 'revenue');
      if (trends) mcpToolResults.revenueTrends = trends;
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

export { mcpTools, getToolByName } from './tools';
export { listTools, listResources, getResource } from './server';
