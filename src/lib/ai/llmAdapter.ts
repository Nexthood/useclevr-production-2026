import { fetchOllamaModels, generateOllamaCompletion } from "@/lib/ai/ollama-client";
import { debugError, debugLog } from "@/lib/utils/debug";
import { skillEngine, calculateBusinessHealthScore, type SkillContext, type SkillAnalysisResult, type BusinessIntent } from "@/lib/business/skill-engine";
import { getCompanySetup } from "@/lib/business/company-setup-store";

/**
 * LLM Adapter
 *
 * Connects to local Ollama instance for LLM inference.
 * Uses DeepSeek model for business analysis.
 * Transformed into a Business Expert Platform with multiple expert skills.
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
    return await generateOllamaCompletion({
      model,
      prompt,
      stream: false,
    });
  } catch (error) {
    debugError('[LLMAdapter] Error running LLM:', error);
    throw error;
  }
}

/**
 * Generate a consulting-quality analysis prompt for the LLM
 * Uses Business Skill Engine for expert perspectives
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
  } | null,
  businessProfile?: {
    industry?: string
    country?: string
    currency?: string
    companySize?: string
    businessType?: string
    fiscalYear?: string
    goals?: string[]
  } | null,
  skillResult?: SkillAnalysisResult | null
): string {
  // Build unified context from precomputed analysis
  let unifiedContext = '';

  if (precomputedAnalysis?.kpis) {
    const { kpis } = precomputedAnalysis;
    const totalRevenue = kpis.totalRevenue ?? 0;
    const totalProfit = kpis.totalProfit ?? 0;
    const profitMargin = kpis.profitMargin ?? 0;

    const growthPct = kpis.growthPercentage ?? null;
    unifiedContext = `
UNIFIED DATASET ANALYSIS (Same as Dashboard):
- Total Revenue: ${totalRevenue > 0 ? formatCurrency(totalRevenue, businessProfile?.currency) : 'N/A'}
- Total Profit: ${totalProfit !== null ? formatCurrency(totalProfit, businessProfile?.currency) : 'N/A'}
- Profit Margin: ${profitMargin !== null ? profitMargin + '%' : 'N/A'}
- Growth: ${growthPct !== null ? ((growthPct >= 0 ? '+' : '') + growthPct + '%') : 'N/A'}

TOP PRODUCTS (from same analysis as dashboard):
${kpis.topProducts?.slice(0, 5).map(p => `- ${p.name}: ${formatCurrency(p.revenue, businessProfile?.currency)} (${p.percentage?.toFixed(1) || 0}%)`).join('\n') || 'N/A'}

TOP REGIONS (from same analysis as dashboard):
${kpis.topRegions?.slice(0, 5).map(r => `- ${r.name}: ${formatCurrency(r.revenue, businessProfile?.currency)} (${r.percentage?.toFixed(1) || 0}%)`).join('\n') || 'N/A'}

IMPORTANT: Use these exact values when answering. Do not recalculate - use the provided KPIs.
`;
  }

  // Add expert perspective from skill engine
  let expertContext = '';
  if (skillResult) {
    const confidenceScore = skillResult.confidence?.score ?? 0;
    const confidenceLabel = confidenceScore >= 80 ? 'High confidence' :
      confidenceScore >= 60 ? 'Medium confidence' : 'Low confidence';

    expertContext = `
EXPERT PERSPECTIVE (${skillResult.expert}):
- Executive Summary: ${skillResult.executiveSummary}
- Business Impact: ${skillResult.businessImpact}
- Evidence: ${skillResult.evidence.join('; ')}
- Risks: ${skillResult.risks.join('; ') || 'None identified'}
- Opportunities: ${skillResult.opportunities.join('; ') || 'None identified'}
- Financial Impact: ${skillResult.financialImpact || 'Not quantified'}
- Confidence: ${confidenceScore}% - ${skillResult.confidence?.explanation || confidenceLabel}

YOUR TASK: Explain these business insights professionally using the verified KPIs above.
Support every recommendation with evidence from the data.
Rank recommendations by priority (Critical/High/Medium/Low).
`;
  }

  // Add business health score if available
  let healthContext = '';
  const healthScore = skillResult ? calculateBusinessHealthScore({
    question,
    datasetId: undefined,
    rows: [],
    columns: [],
    precomputedAnalysis,
    businessProfile: businessProfile ?? undefined,
  }) : null;

  if (healthScore && healthScore.overall < 100) {
    healthContext = `
BUSINESS HEALTH SCORE: ${healthScore.overall}/100
- Financial Health: ${healthScore.financialHealth}%
- Growth Potential: ${healthScore.growthPotential}%
- Risk Exposure: ${healthScore.riskExposure}%
Primary improvement: ${healthScore.improvements[0]}
`;
  }
  

  // Add business profile context if available
  let profileContext = '';
  if (businessProfile?.industry || businessProfile?.country) {
    profileContext = `
BUSINESS PROFILE:
- Industry: ${businessProfile.industry || 'Not specified'}
- Location: ${businessProfile.country || 'Not specified'}
- Currency: ${businessProfile.currency || 'EUR'}
- Company Size: ${businessProfile.companySize || 'Not specified'}

Adapt recommendations to this business context.
`;
  }

  return `
You are an elite business consultant from a top-tier advisory firm, speaking directly to a business leader.

${healthContext}
${expertContext}

User question:
${question}

${unifiedContext}

${profileContext}

Dataset columns:
${columns.join(', ')}

Query result:
${JSON.stringify(result, null, 2)}

Respond with the following format:

INSIGHT
[One concise sentence capturing the key business finding - reference verified KPIs]

EXPLANATION
[Why this pattern exists. What is the business impact? Support with data.]

RECOMMENDATION
[Specific, actionable step. What should happen next? Prioritize if multiple actions.]

Requirements:
- Professional consulting tone
- Executive summary first
- Use exact numbers from verified KPIs
- No generic AI phrasing
- Action-oriented
`;
}

function formatCurrency(value: number, currency?: string): string {
  if (value === null || value === undefined || isNaN(value)) return '€0'
  const curr = currency || 'EUR'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: curr,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Check if Ollama is running
 */
export async function checkOllamaStatus(): Promise<boolean> {
  try {
    await fetchOllamaModels();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get available models from Ollama
 */
export async function getAvailableModels(): Promise<string[]> {
  try {
    const models = await fetchOllamaModels();
    return models.map((model) => model.name);
  } catch {
    return [];
  }
}
