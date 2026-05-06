import { debugLog, debugError, debugWarn } from "@/lib/debug"

/**
 * LLM Adapter
 * 
 * Connects to local Ollama instance for LLM inference.
 * Uses DeepSeek model for business analysis.
 */

export interface LLMRequest {
  model: string;
  prompt: string;
  stream?: boolean;
}

export interface LLMResponse {
  response: string;
  done: boolean;
}

/**
 * Run the LLM with a prompt
 * @param prompt - The prompt to send to the LLM
 * @param model - Model name (default: deepseek-coder)
 * @returns The LLM response
 */
export async function runLLM(
  prompt: string, 
  model: string = 'deepseek-coder'
): Promise<string> {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      } as LLMRequest),
    });

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status}`);
    }

    const data: LLMResponse = await response.json();
    return data.response;
  } catch (error) {
    debugError('[LLMAdapter] Error running LLM:', error);
    throw error;
  }
}

/**
 * Generate an analysis prompt for the LLM
 * UNIFIED: Now accepts precomputed analysis to ensure AI uses same data as dashboard
 */
export function generateAnalysisPrompt(
  question: string,
  result: any[],
  columns: string[],
  precomputedAnalysis?: {
    kpis?: {
      totalRevenue?: number | null
      totalProfit?: number | null
      profitMargin?: number | null
      topProducts?: { name: string; revenue: number; percentage: number }[]
      topRegions?: { name: string; revenue: number; percentage: number }[]
      growthPercentage?: number | null
      growthTrend?: 'up' | 'down' | 'stable' | null
    }
    breakdowns?: {
      revenueByProduct?: Record<string, number>
      revenueByRegion?: Record<string, number>
    }
  } | null
): string {
  // Build unified context from precomputed analysis
  let unifiedContext = '';
  
  if (precomputedAnalysis?.kpis) {
    const { kpis, breakdowns } = precomputedAnalysis;
    const totalRevenue = kpis.totalRevenue ?? 0;
    const totalProfit = kpis.totalProfit ?? 0;
    const profitMargin = kpis.profitMargin ?? 0;
    
    const growthPct = kpis.growthPercentage ?? null;
    unifiedContext = `
UNIFIED DATASET ANALYSIS (Same as Dashboard):
- Total Revenue: ${totalRevenue > 0 ? totalRevenue.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : 'N/A'}
- Total Profit: ${totalProfit > 0 ? totalProfit.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : 'N/A'}
- Profit Margin: ${profitMargin > 0 ? profitMargin + '%' : 'N/A'}
- Growth: ${growthPct !== null ? ((growthPct >= 0 ? '+' : '') + growthPct + '%') : 'N/A'}

TOP PRODUCTS (from same analysis as dashboard):
${kpis.topProducts?.slice(0, 5).map(p => `- ${p.name}: ${p.revenue?.toLocaleString() || 0} (${p.percentage?.toFixed(1) || 0}%)`).join('\n') || 'N/A'}

TOP REGIONS (from same analysis as dashboard):
${kpis.topRegions?.slice(0, 5).map(r => `- ${r.name}: ${r.revenue?.toLocaleString() || 0} (${r.percentage?.toFixed(1) || 0}%)`).join('\n') || 'N/A'}

IMPORTANT: Use these exact values when answering. Do not recalculate - use the provided KPIs.
`;
  }

  return `
You are an expert AI business analyst. Your task is to analyze dataset query results and provide clear insights.

User question:
${question}

${unifiedContext}

Dataset columns:
${columns.join(', ')}

Query result:
${JSON.stringify(result, null, 2)}

Respond with the following format:

INSIGHT
[One sentence summarizing the key finding - use the KPIs above if relevant]

EXPLANATION
[A brief explanation of why this pattern exists in the data]

RECOMMENDATION
[An actionable step the user should take based on this analysis]

If no data is returned or the result is empty, respond with:
"No matching data found in the dataset."
`;
}

/**
 * Check if Ollama is running
 */
export async function checkOllamaStatus(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get available models from Ollama
 */
export async function getAvailableModels(): Promise<string[]> {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.models?.map((m: any) => m.name) || [];
  } catch {
    return [];
  }
}
