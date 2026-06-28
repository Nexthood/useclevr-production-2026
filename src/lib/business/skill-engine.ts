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
    confidence?: {
      score: number
      explanation: string
    }
  }[]
  financialImpact?: string
  suggestedNextQuestions: string[]
  confidence?: {
    score: number
    explanation: string
  }
}

export interface BusinessHealthScore {
  overall: number
  financialHealth: number
  operationalHealth: number
  growthPotential: number
  riskExposure: number
  dataQuality: number
  inventoryHealth: number
  cashFlowStrength: number
  decisionReadiness: number
  explanation: string
  improvements: string[]
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
              confidence: {
                score: precomputedAnalysis?.kpis ? 95 : 70,
                explanation: precomputedAnalysis?.kpis
                  ? 'Critical action - verified by financial KPIs'
                  : 'Critical based on reported loss',
              },
            },
          ]
        : hasLowMargin
          ? [
              {
                action: 'Negotiate better supplier rates',
                reason: 'Reduce COGS to improve margin',
                financialImpact: `Potential improvement of ${((profitMargin + 2) - profitMargin).toFixed(1)} percentage points`,
                priority: 'high',
                confidence: {
                  score: precomputedAnalysis?.kpis ? 80 : 60,
                  explanation: precomputedAnalysis?.kpis
                    ? 'Based on margin analysis with clear improvement potential'
                    : 'Estimated based on typical cost structures',
                },
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
      confidence: {
        score: precomputedAnalysis?.kpis ? 90 : 60,
        explanation: precomputedAnalysis?.kpis
          ? 'High confidence - based on verified KPI calculations from your data'
          : 'Medium confidence - limited data available for analysis',
      },
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
              confidence: {
                score: precomputedAnalysis?.kpis ? 85 : 60,
                explanation: precomputedAnalysis?.kpis
                  ? 'Based on identified underperforming products'
                  : 'Estimated based on industry benchmarks',
              },
            },
          ]
        : topProducts.length > 0
          ? [
              {
                action: `Focus inventory on ${topProducts[0]?.name ?? 'top product'}`,
                reason: 'Highest revenue contribution',
                priority: 'medium',
                confidence: {
                  score: precomputedAnalysis?.kpis ? 75 : 50,
                  explanation: precomputedAnalysis?.kpis
                    ? 'Based on top product revenue data'
                    : 'Estimated based on typical product mix',
                },
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
      confidence: {
        score: precomputedAnalysis?.kpis ? 85 : 55,
        explanation: precomputedAnalysis?.kpis
          ? 'High confidence - based on product and revenue data'
          : 'Medium confidence - limited product data available',
      },
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
              confidence: {
                score: precomputedAnalysis?.kpis ? 90 : 65,
                explanation: precomputedAnalysis?.kpis
                  ? 'High priority intervention based on declining trend data'
                  : 'Medium confidence based on reported growth trend',
              },
            },
          ]
        : [
            {
              action: 'Develop market expansion plan',
              reason: 'Diversify revenue sources',
              priority: 'medium',
              confidence: {
                score: precomputedAnalysis?.kpis ? 70 : 50,
                explanation: precomputedAnalysis?.kpis
                  ? 'Based on market analysis and growth potential'
                  : 'Strategic recommendation to diversify risk',
              },
            },
          ],
      financialImpact: undefined,
      suggestedNextQuestions: [
        'What is our competitive position?',
        'Where are the growth opportunities?',
        'What risks should we monitor?',
      ],
      confidence: {
        score: precomputedAnalysis?.kpis ? 75 : 45,
        explanation: precomputedAnalysis?.kpis
          ? 'Medium confidence - strategic insights based on available data'
          : 'Lower confidence - limited data for strategic analysis',
      },
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

// ============================================================================
// Business Health Score Engine
// ============================================================================

export function calculateBusinessHealthScore(context: SkillContext): BusinessHealthScore {
  const { precomputedAnalysis, rows } = context
  const kpis = precomputedAnalysis?.kpis

  const profitMargin = kpis?.profitMargin ?? 0
  const totalRevenue = kpis?.totalRevenue ?? 0
  const growthTrend = kpis?.growthTrend
  const worstProducts = kpis?.worstProducts?.length ?? 0
  const topProducts = kpis?.topProducts?.length ?? 0

  // Financial Health (30% weight)
  const financialHealth = profitMargin < 0 ? 20 :
    profitMargin >= 15 ? 100 :
    profitMargin >= 5 ? 60 : 30

  // Growth Potential (20% weight)
  const growthPotential = growthTrend === 'up' ? 80 :
    growthTrend === 'down' ? 40 : 60

  // Risk Exposure (20% weight)
  const riskExposure = worstProducts > 5 ? 40 :
    worstProducts > 0 ? 60 : 100

  // Operational Health (15% weight) - based on data completeness
  const hasProducts = topProducts > 0 ? 100 : 50
  const hasRevenue = totalRevenue > 0 ? 100 : 0

  // Data Quality (15% weight)
  const dataQuality = rows.length >= 1000 ? 100 :
    rows.length >= 100 ? 70 :
    rows.length >= 10 ? 50 : 30

  // Overall weighted score
  const overall = Math.round(
    (financialHealth * 0.30) +
    (growthPotential * 0.20) +
    ((100 - riskExposure) * 0.20) +
    (hasProducts * 0.15) +
    (hasRevenue * 0.15)
  )

  // Determine primary improvement area
  const improvements: string[] = []
  if (profitMargin < 5) improvements.push('Improve profit margins through cost optimization')
  if (growthTrend === 'down') improvements.push('Reverse declining revenue trend')
  if (worstProducts > 0) improvements.push('Clear or improve underperforming products')
  if (rows.length < 100) improvements.push('Upload more data for better insights')
  if (improvements.length === 0) improvements.push('Maintain current performance trajectory')

  return {
    overall,
    financialHealth,
    operationalHealth: hasProducts,
    growthPotential,
    riskExposure: 100 - riskExposure,
    dataQuality,
    inventoryHealth: worstProducts === 0 ? 100 : 60,
    cashFlowStrength: profitMargin >= 0 ? 70 : 30,
    decisionReadiness: dataQuality * 0.5 + financialHealth * 0.5,
    explanation: `Business health score of ${overall}% reflects ${financialHealth >= 70 ? 'strong' : financialHealth >= 40 ? 'moderate' : 'weak'} financial performance${growthTrend === 'down' ? ' with declining trends' : growthTrend === 'up' ? ' with positive momentum' : ''}.`,
    improvements,
  }
}

export interface ForecastResult {
  metric: string
  currentValue: number
  forecastedValue: number
  confidence: number
  timeframe: string
  assumptions: string[]
  businessImpact: string
  recommendedActions: string[]
  dataQuality: 'observed' | 'estimated' | 'projected'
}

export interface ScenarioInput {
  changeType: 'price_increase' | 'price_decrease' | 'cost_increase' | 'cost_decrease' | 'volume_change' | 'market_expansion'
  entity?: string
  value: number
  unit?: '%' | 'absolute' | 'currency'
  description: string
}

export interface ScenarioResult {
  scenario: string
  financialImpact: number
  profitImpact: number
  cashFlowImpact: number
  riskLevel: 'low' | 'medium' | 'high'
  confidence: number
  recommendation: string
  assumptions: string[]
}

// ============================================================================
// Forecast Engine
// ============================================================================

export function generateForecast(context: SkillContext, metric: string): ForecastResult | null {
  const { precomputedAnalysis } = context
  const kpis = precomputedAnalysis?.kpis

  const totalRevenue = kpis?.totalRevenue ?? 0
  const totalProfit = kpis?.totalProfit ?? 0
  const profitMargin = kpis?.profitMargin ?? 0
  const growthTrend = kpis?.growthTrend
  const monthlyData = kpis?.monthlyTrend ?? []

  if (metric === 'revenue') {
    const growthRate = growthTrend === 'up' ? 0.05 : growthTrend === 'down' ? -0.05 : 0.02
    const forecastedValue = totalRevenue * (1 + growthRate * 12)
    const confidence = monthlyData.length >= 6 ? 85 : monthlyData.length >= 3 ? 65 : 45

    return {
      metric: 'Revenue',
      currentValue: totalRevenue,
      forecastedValue,
      confidence,
      timeframe: '12 months',
      assumptions: [
        growthRate > 0 ? `Continuing current growth rate of ${(growthRate * 100).toFixed(1)}% monthly` : 'Stabilizing current revenue level',
        'No major market disruptions',
        'Current product mix maintained',
      ],
      businessImpact: `Expected ${formatCurrency(forecastedValue - totalRevenue)} ${forecastedValue > totalRevenue ? 'increase' : 'change'} in annual revenue`,
      recommendedActions: [
        forecastedValue > totalRevenue
          ? 'Invest in scaling operations to meet projected demand'
          : 'Investigate revenue decline root causes',
        profitMargin < 10 ? 'Focus on margin improvement initiatives' : 'Maintain pricing discipline',
      ],
      dataQuality: monthlyData.length >= 12 ? 'observed' : monthlyData.length >= 3 ? 'estimated' : 'projected',
    }
  }

  if (metric === 'profit') {
    const forecastedProfit = totalProfit * (1 + (growthTrend === 'up' ? 0.03 : growthTrend === 'down' ? -0.03 : 0))
    const confidence = profitMargin > 0 && monthlyData.length >= 6 ? 80 : 55

    return {
      metric: 'Profit',
      currentValue: totalProfit,
      forecastedValue: forecastedProfit,
      confidence,
      timeframe: '12 months',
      assumptions: [
        'Current margin maintained',
        'Cost structure unchanged',
        'No price competition impact',
      ],
      businessImpact: `Projected ${formatCurrency(forecastedProfit - totalProfit)} ${forecastedProfit > totalProfit ? 'improvement' : 'change'} in annual profit`,
      recommendedActions: [
        profitMargin < 5 ? 'Prioritize cost reduction initiatives' : 'Reinvest profit into growth',
      ],
      dataQuality: profitMargin > 0 ? 'estimated' : 'projected',
    }
  }

  return null
}

// ============================================================================
// Scenario Engine
// ============================================================================

export function simulateScenario(context: SkillContext, scenario: ScenarioInput): ScenarioResult {
  const { precomputedAnalysis } = context
  const kpis = precomputedAnalysis?.kpis

  const totalRevenue = kpis?.totalRevenue ?? 0
  const totalProfit = kpis?.totalProfit ?? 0
  const profitMargin = kpis?.profitMargin ?? 0
  const worstProducts = kpis?.worstProducts ?? []

  let financialImpact = 0
  let scenarioDesc = ''

  switch (scenario.changeType) {
    case 'price_increase':
      const priceIncreaseImpact = totalRevenue * (scenario.value / 100) * 0.8
      financialImpact = priceIncreaseImpact
      scenarioDesc = `${scenario.value}% price increase on ${scenario.entity ?? 'products'}`
      break

    case 'price_decrease':
      const volumeLift = Math.min(100, 50 * (scenario.value / 10))
      financialImpact = -totalRevenue * (scenario.value / 100) * (volumeLift / 100) * 0.5
      scenarioDesc = `${scenario.value}% price decrease on ${scenario.entity ?? 'products'}`
      break

    case 'cost_increase':
      financialImpact = -totalRevenue * (scenario.value / 100)
      scenarioDesc = `${scenario.value}% cost increase (${scenario.description})`
      break

    case 'cost_decrease':
      financialImpact = totalRevenue * (scenario.value / 100)
      scenarioDesc = `${scenario.value}% cost reduction (${scenario.description})`
      break

    case 'volume_change':
      financialImpact = totalRevenue * (scenario.value / 100)
      scenarioDesc = `${scenario.value}% volume change (${scenario.description})`
      break

    case 'market_expansion':
      financialImpact = totalRevenue * (scenario.value / 100) * 0.25
      scenarioDesc = `Market expansion to ${scenario.description}`
      break

    default:
      financialImpact = 0
      scenarioDesc = scenario.description
  }

  const riskLevel = Math.abs(financialImpact) > totalProfit * 0.3
    ? 'high'
    : Math.abs(financialImpact) > totalProfit * 0.1
      ? 'medium'
      : 'low'

  const profitImpact = financialImpact * (profitMargin / 100)

  const recommendation = riskLevel === 'high'
    ? 'Review assumptions carefully - significant financial impact expected'
    : riskLevel === 'medium'
      ? 'Consider pilot program before full implementation'
      : 'Scenario appears financially viable'

  return {
    scenario: scenarioDesc,
    financialImpact,
    profitImpact,
    cashFlowImpact: profitImpact, // Simplified - same as profit impact
    riskLevel,
    confidence: kpis?.totalRevenue ? 85 : 60,
    recommendation,
    assumptions: [
      'Other factors remain constant',
      'Market conditions unchanged',
      'Customer behavior predictable',
    ],
  }
}

export const skillEngine = new BusinessSkillEngine()