/**
 * Business Skill Engine
 *
 * Routes questions to appropriate business expert skills.
 * Implements intent detection and skill routing for professional analysis.
 */

import { debugLog } from "@/lib/utils/debug"

// ============================================================================
// Intent Types
// ============================================================================

export type BusinessIntent =
  | 'retail'
  | 'inventory'
  | 'sales'
  | 'marketing'
  | 'accounting'
  | 'finance'
  | 'business'
  | 'investment'
  | 'startup'
  | 'hr'
  | 'manufacturing'
  | 'operations'
  | 'forecasting'
  | 'risk'
  | 'compliance'
  | 'pricing'
  | 'supply_chain'
  | 'customer_success'
  | 'strategy'
  | 'product'
  | 'multiple'
  | 'general'

export interface DetectedIntents {
  primary: BusinessIntent
  secondary?: BusinessIntent[]
  confidence: number
}

// ============================================================================
// Intent Detection
// ============================================================================

const INTENT_PATTERNS: Record<BusinessIntent, RegExp[]> = {
  retail: [/retail|store|shop|ecommerce|e-commerce|point of sale|pos/i],
  inventory: [/inventory|stock|warehouse|sku|product|item|supply/i],
  sales: [/sales|revenue|turnover|deal|opportunity|pipeline/i],
  marketing: [/marketing|campaign|roi|cac|ltv|acquisition|conversion/i],
  accounting: [/accounting|invoice|vat|tax|bookkeep|balance sheet|profit/i],
  finance: [/finance|cash flow|margin|profitability|break.?even|roi/i],
  business: [/business|swot|opportunity|strategy|market|competitor/i],
  investment: [/investment|investor|valuation|funding|equity|shareholder/i],
  startup: [/startup|mrr|arr|burn rate|runway|churn|saas/i],
  hr: [/hr|hiring|employee|salary|payroll|recruitment/i],
  manufacturing: [/manufactur|production|factory|assembly|quality control/i],
  operations: [/operation|process|efficiency|workflow|backoffice/i],
  forecasting: [/forecast|predict|trend|future|projection|estimate/i],
  risk: [/risk|compliance|audit|fraud|safety|regulat/i],
  compliance: [/compliance|audit|tax|regulat|governance/i],
  pricing: [/pricing|price|discount|margin|markup|premium/i],
  supply_chain: [/supply|logistics|vendor|supplier|fulfillment|delivery/i],
  customer_success: [/customer|client|retention|churn|satisfaction|nps/i],
  strategy: [/strategy|growth|expansion|plan|roadmap|initiative/i],
  product: [/product|feature|roadmap|launch|develop|innovation/i],
  multiple: [/and|both|also/i],
  general: [/^$/], // Default fallback
}

export function detectBusinessIntents(question: string): DetectedIntents {
  const lowerQuestion = question.toLowerCase()
  const detected: BusinessIntent[] = []
  let maxConfidence = 0

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    let matches = 0
    for (const pattern of patterns) {
      if (pattern.test(lowerQuestion)) {
        matches++
      }
    }
    if (matches > 0) {
      const confidence = matches / patterns.length
      if (confidence > maxConfidence) {
        maxConfidence = confidence
      }
      detected.push(intent as BusinessIntent)
    }
  }

  if (detected.length === 0) {
    return { primary: 'general', confidence: 0.5 }
  }

  // Remove 'multiple' and 'general' from the detected intents for primary classification
  const primaryIntents = detected.filter(i => i !== 'multiple' && i !== 'general')

  if (primaryIntents.length === 0) {
    return { primary: 'general', confidence: maxConfidence }
  }

  // Determine primary intent (first detected, or 'general' if none)
  const primary = primaryIntents[0] || 'general'
  const secondary = primaryIntents.length > 1 ? primaryIntents.slice(1) : undefined

  return {
    primary,
    secondary,
    confidence: Math.max(maxConfidence, 0.5),
  }
}

// ============================================================================
// Skill Definitions
// ============================================================================

export interface BusinessSkill {
  id: string
  name: string
  role: string // e.g., "CFO", "Retail Director", "Supply Chain Manager"
  intents: BusinessIntent[]
  analyze: (context: SkillContext) => SkillAnalysisResult
}

export interface SkillContext {
  question: string
  datasetId?: string
  rows: any[]
  columns: string[]
  precomputedAnalysis?: any
  businessProfile?: {
    industry?: string
    country?: string
    currency?: string
    companySize?: string
    businessType?: string
    fiscalYear?: string
    taxSettings?: any
    goals?: string[]
  }
}

export interface SkillAnalysisResult {
  intent: BusinessIntent
  skillId: string
  expert: string
  executiveSummary: string
  businessImpact: string
  evidence: string[]
  risks: string[]
  opportunities: string[]
  recommendations: {
    action: string
    reason: string
    financialImpact?: string
    priority?: 'high' | 'medium' | 'low'
  }[]
  financialImpact?: string
  suggestedNextQuestions: string[]
}

// ============================================================================
// Finance Skill (CFO Perspective)
// ============================================================================

export const financeSkill: BusinessSkill = {
  id: 'finance',
  name: 'Financial Analysis',
  role: 'CFO',
  intents: ['finance', 'accounting', 'investment', 'business'],

  analyze: (context: SkillContext): SkillAnalysisResult => {
    const { precomputedAnalysis } = context
    const kpis = precomputedAnalysis?.kpis

    const totalRevenue = kpis?.totalRevenue ?? 0
    const totalProfit = kpis?.totalProfit ?? 0
    const profitMargin = kpis?.profitMargin ?? 0

    const hasLoss = profitMargin < 0
    const hasLowMargin = profitMargin > 0 && profitMargin < 5

    return {
      intent: 'finance',
      skillId: 'finance',
      expert: 'CFO',
      executiveSummary: hasLoss
        ? 'The business is currently operating at a loss'
        : hasLowMargin
          ? 'The business operates with tight margins'
          : 'The business maintains profitable operations',
      businessImpact: `Every €1 of revenue generates ${profitMargin > 0 ? `€${(profitMargin / 100).toFixed(2)}` : 'a loss'} in net profit.`,
      evidence: [
        `Total revenue: ${formatCurrency(totalRevenue)}`,
        `Net profit: ${formatCurrency(totalProfit)}`,
        `Profit margin: ${profitMargin > 0 ? profitMargin.toFixed(1) : 'N/A'}%`,
      ],
      risks: hasLoss
        ? ['Operating at a loss - cash flow sustainability risk']
        : hasLowMargin
          ? ['Low margin leaves little room for error', 'Cost increases could push to unprofitability']
          : [],
      opportunities: hasLowMargin
        ? ['Margin optimization could significantly improve profitability']
        : ['Strong profitability supports reinvestment opportunities'],
      recommendations: hasLoss
        ? [
            {
              action: 'Conduct immediate cost optimization review',
              reason: 'Business is losing money',
              priority: 'high',
            },
          ]
        : hasLowMargin
          ? [
              {
                action: 'Negotiate better supplier rates',
                reason: 'Reduce COGS to improve margin',
                financialImpact: `Potential improvement of ${((profitMargin + 2) - profitMargin).toFixed(1)} percentage points`,
                priority: 'high',
              },
            ]
          : [],
      financialImpact: hasLoss
        ? `Current monthly burn: ${formatCurrency(Math.abs(totalProfit))}`
        : `Annual profit potential: ${formatCurrency(totalProfit * 12)} at current run rate`,
      suggestedNextQuestions: [
        'What is driving the profitability?',
        'Which products have the highest margins?',
        'Where can we optimize costs?',
      ],
    }
  },
}

// ============================================================================
// Retail Skill (Retail Director Perspective)
// ============================================================================

export const retailSkill: BusinessSkill = {
  id: 'retail',
  name: 'Retail Analytics',
  role: 'Retail Director',
  intents: ['retail', 'inventory', 'sales', 'product'],

  analyze: (context: SkillContext): SkillAnalysisResult => {
    const { precomputedAnalysis, question } = context
    const kpis = precomputedAnalysis?.kpis
    const breakdowns = precomputedAnalysis?.breakdowns

    const isDiscountQuestion = /discount/i.test(question)
    const topProducts = kpis?.topProducts ?? []
    const worstProducts = kpis?.worstProducts ?? []

    return {
      intent: 'retail',
      skillId: 'retail',
      expert: 'Retail Director',
      executiveSummary: isDiscountQuestion
        ? `${worstProducts.length} products may need markdown pricing`
        : `Top performers account for significant revenue share`,
      businessImpact: topProducts.length > 0
        ? `${topProducts[0]?.name ?? 'Top product'} drives ${(topProducts[0]?.percentage ?? 0).toFixed(1)}% of revenue`
        : 'No product performance data available',
      evidence: topProducts.slice(0, 3).map((p: { name: string; revenue: number; percentage: number }) => `${p.name}: ${formatCurrency(p.revenue)} (${p.percentage}%)`),
      risks: worstProducts.length > 0
        ? [`${worstProducts.length} products with negative profit margins tying up working capital`]
        : [],
      opportunities: topProducts.length > 0
        ? [`Expand ${topProducts[0]?.name ?? 'top product'} availability`, 'Optimize underperforming products']
        : [],
      recommendations: isDiscountQuestion && worstProducts.length > 0
        ? [
            {
              action: `Apply 15-20% discount to ${worstProducts.slice(0, 5).map((p: { name: string }) => p.name).join(', ')}`,
              reason: 'Clear slow-moving inventory and recover working capital',
              priority: 'high',
            },
          ]
        : topProducts.length > 0
          ? [
              {
                action: `Focus inventory on ${topProducts[0]?.name ?? 'top product'}`,
                reason: 'Highest revenue contribution',
                priority: 'medium',
              },
            ]
          : [],
      financialImpact: worstProducts.length > 0
        ? `Recovering €${worstProducts.reduce((sum: number, p: { profit: number }) => sum + Math.abs(p.profit), 0).toLocaleString()} in tied-up capital`
        : topProducts.length > 0
          ? `Capitalizing on ${formatCurrency(topProducts[0]?.revenue ?? 0)} revenue opportunity`
          : undefined,
      suggestedNextQuestions: [
        'Which SKUs should be discounted?',
        'What is our inventory turnover?',
        'Which products have the best margins?',
      ],
    }
  },
}

// ============================================================================
// Business Skill (Business Consultant Perspective)
// ============================================================================

export const businessSkill: BusinessSkill = {
  id: 'business',
  name: 'Business Strategy',
  role: 'Business Consultant',
  intents: ['business', 'strategy', 'operations', 'general'],

  analyze: (context: SkillContext): SkillAnalysisResult => {
    const { precomputedAnalysis } = context
    const kpis = precomputedAnalysis?.kpis
    const topProducts = kpis?.topProducts ?? []
    const topRegions = kpis?.topRegions ?? []
    const growthTrend = kpis?.growthTrend

    return {
      intent: 'business',
      skillId: 'business',
      expert: 'Business Consultant',
      executiveSummary: growthTrend === 'down'
        ? 'Business performance is declining'
        : growthTrend === 'up'
          ? 'Business is growing'
          : 'Business performance is stable',
      businessImpact: topRegions.length > 0
        ? `Market concentration in ${topRegions[0]?.name ?? 'top region'} represents ${topRegions[0]?.percentage.toFixed(1) ?? 0}% of revenue`
        : 'Market diversification appears balanced',
      evidence: [
        `Growth trend: ${growthTrend ?? 'stable'}`,
        `Total products tracked: ${topProducts.length}`,
        `Total regions served: ${topRegions.length}`,
      ],
      risks: topRegions.length > 0 && topRegions[0]?.percentage > 50
        ? ['High market concentration risk']
        : [],
      opportunities: topProducts.length > 0
        ? [`Expand ${topProducts[0]?.name ?? 'top product'} to new markets`]
        : [],
      recommendations: growthTrend === 'down'
        ? [
            {
              action: 'Investigate root cause of decline',
              reason: 'Revenue declining signals need for intervention',
              priority: 'high',
            },
          ]
        : [
            {
              action: 'Develop market expansion plan',
              reason: 'Diversify revenue sources',
              priority: 'medium',
            },
          ],
      financialImpact: undefined,
      suggestedNextQuestions: [
        'What is our competitive position?',
        'Where are the growth opportunities?',
        'What risks should we monitor?',
      ],
    }
  },
}

// ============================================================================
// Skill Engine - Routes to appropriate skills
// ============================================================================

export class BusinessSkillEngine {
  private skills: BusinessSkill[] = [
    financeSkill,
    retailSkill,
    businessSkill,
  ]

  detectIntent(question: string): DetectedIntents {
    return detectBusinessIntents(question)
  }

  selectSkill(intent: BusinessIntent): BusinessSkill | null {
    const skill = this.skills.find(s => s.intents.includes(intent))
    return skill ?? financeSkill // Default to finance
  }

  analyze(context: SkillContext): SkillAnalysisResult | null {
    const intents = this.detectIntent(context.question)
    const skill = this.selectSkill(intents.primary)

    if (!skill) {
      return null
    }

    return skill.analyze(context)
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined || isNaN(value)) return '€0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export const skillEngine = new BusinessSkillEngine()