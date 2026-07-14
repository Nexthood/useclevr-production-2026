"use client"

import { debugError, debugLog } from "@/lib/utils/debug"



import { WorldMapRevenue, type RegionData as MapRegionData } from "@/components/ui/world-map-revenue"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { shouldRenderWorldMapForBusinessModel, type BusinessModel } from "@/lib/data/business-model"
import { formatCurrencyCompact, formatCurrencyForKPI, formatPercentage, formatPercentSimple } from "@/lib/utils/formatting"
import {
    AlertTriangle, BarChart3, FileText, Lightbulb, Loader2, Sparkles, Table2, TrendingDown, TrendingUp, X
} from "lucide-react"
import * as React from "react"

// ============================================================================
// Type Definitions
// ============================================================================

interface CSVAnalysisResult {
  total_rows: number
  total_columns: number
  column_types: Record<string, string>
  date_columns?: string[]
  numeric_columns?: string[]
  categorical_columns?: string[]
  
  // Business analysis
  business_analysis?: {
    kpis: {
      totalRevenue: number | null
      avgRevenue: number | null
      totalCost?: number | null
      totalProfit: number | null
      profitMargin: number | null
      profitReliability: 'verified' | 'derived' | 'unavailable'
      topProducts: { name: string; revenue: number; percentage: number }[]
      topRegions: { name: string; revenue: number; percentage: number }[]
      worstProducts: { name: string; profit: number }[]
      growthPercentage: number | null
      growthTrend: 'up' | 'down' | 'stable' | null
      growthValid: boolean
      growthMessage: string
      dateRange: { start: string; end: string } | null
    }
    breakdowns: {
      revenueByProduct: Record<string, number>
      revenueByRegion: Record<string, number>
      profitByProduct: Record<string, number>
      profitByRegion: Record<string, number>
    }
    risks: {
      concentrationRisk: number
      revenueRisk: string
      productRisk: string
    }
    insights: { message: string; type: string }[]
    recommendations: { action: string; reason: string }[]
    detectedColumns: {
      revenueColumn: string | null
      profitColumn: string | null
      costColumn: string | null
      dateColumn: string | null
      productColumn: string | null
      regionColumn: string | null
    }
    businessProfileContext?: {
      profileInputs: {
        currency: string | null
        fiscalYearStart: string | null
        fiscalYearEnd: string | null
        riskTolerance: string | null
        targetMarginPercent: number | null
        growthTarget: string | null
      }
      uploadedDataInputs: {
        revenue: number | null
        datasetCosts: number | null
        payroll: number | null
        detectedCurrency: string | null
      }
      profileAdjustments: {
        fixedCostsAnnual: number
        insuranceAnnual: number
        employerContributionRatePercent: number | null
        employerContributionsAnnual: number | null
        taxRatePercent: number | null
      }
      kpis: {
        adjustedOperatingCosts: number | null
        profitBeforeTax: number | null
        estimatedTax: number | null
        profitAfterTax: number | null
        netMarginAfterProfileCosts: number | null
        targetMarginVariance: number | null
      }
      warnings: string[]
      conflicts: string[]
      recommendations: string[]
    }
  }
  
  // AI Summary
  ai_summary?: string
  business_intelligence?: {
    healthScore: {
      overall: number
      dataQuality: number
      kpiCompleteness: number
      trendStability: number
      riskScore: number
    }
    detectedKpis: Record<string, string | null>
    risks: { title: string; description: string; severity?: 'High' | 'Medium' | 'Low'; confidence: number }[]
    opportunities: { title: string; description: string; severity?: 'High' | 'Medium' | 'Low'; confidence: number }[]
    executiveSummary: string
    recommendedActions: {
      priority: 'High' | 'Medium' | 'Low'
      action: string
      reason: string
      expectedBusinessImpact: string
      confidence: number
    }[]
  }
}

interface DatasetAnalyzerProps {
  datasetId: string
  datasetName: string
  columns: string[]
  data: any[]
  rowCount: number
  businessModel?: BusinessModel
  isAnalyzed?: boolean
  initialIsAnalyzed?: boolean
  initialAnalysis?: CSVAnalysisResult
}

// ============================================================================
// Main Component
// ============================================================================

export function DatasetAnalyzer({
  datasetId,
  datasetName,
  columns,
  data,
  rowCount,
  businessModel = "generic",
  isAnalyzed: initialAnalyzedProp = false,
  initialIsAnalyzed = false,
  initialAnalysis
}: DatasetAnalyzerProps) {
  const [isAnalyzed, setIsAnalyzed] = React.useState(initialAnalyzedProp || initialIsAnalyzed)
  const [analysis, setAnalysis] = React.useState<CSVAnalysisResult | null>(initialAnalysis || null)
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)
  const [revenueViewMode, setRevenueViewMode] = React.useState<'region' | 'country'>('region')
  const [countryDisplayMode, setCountryDisplayMode] = React.useState<'top' | 'all'>('top')
  const [autoProcessing, _setAutoProcessing] = React.useState(!initialIsAnalyzed && data.length > 0)
  const [isGeneratingReport, setIsGeneratingReport] = React.useState(false)
  const [reportGenerated, setReportGenerated] = React.useState(false)
  const [isForecasting, setIsForecasting] = React.useState(false)
  const [forecastStatus, setForecastStatus] = React.useState<string | null>(null)
  
  // Drilldown panel state
  const [drilldownItem, setDrilldownItem] = React.useState<{
    type: 'kpi' | 'insight' | 'recommendation' | 'chart'
    title: string
    value: string
    explanation: string
    supportingData: { label: string; value: string }[]
    nextActions: string[]
    reliability?: 'verified' | 'estimated' | 'unavailable' | 'derived'
  } | null>(null)

  // ============================================================================
  // VALIDATED METRICS LAYER - Compute metrics from KPIs first, then generate UI
  // ============================================================================
  // Single source of truth: detect which metric families are actually available
  const capabilities = React.useMemo(() => {
    const detected = analysis?.business_analysis?.detectedColumns
    const kpis = analysis?.business_analysis?.kpis
    const revenueAvailable = !!detected?.revenueColumn && kpis?.totalRevenue !== null
    // Validate numeric usability for cost column from raw data
    const hasValidCostNumeric = (() => {
      const col = detected?.costColumn
      if (!col || !data || data.length === 0) return false
      let valid = 0
      for (const row of data.slice(0, 50)) {
        const v = (row as Record<string, unknown>)[col as string]
        if (v === null || v === undefined || v === '') continue
        const n = Number(v)
        if (!Number.isNaN(n) && Number.isFinite(n)) valid++
        if (valid >= 5) return true
      }
      return false
    })()
    // Tightened: require detected cost column AND validated numeric data OR verified profit reliability
    const costAvailable = !!detected?.costColumn && (hasValidCostNumeric || kpis?.profitReliability === 'verified')
    const profitAvailable = revenueAvailable && (costAvailable || (kpis?.profitReliability === 'derived' && kpis?.profitMargin !== null && kpis?.totalProfit !== null))
    // Tightened: require date column AND at least one validated numeric time-series source (revenue or cost numeric)
    const hasValidRevenueSeries = revenueAvailable
    const hasValidCostSeries = hasValidCostNumeric
    const trendAvailable = !!detected?.dateColumn && (hasValidRevenueSeries || hasValidCostSeries)
    const regionRankingAvailable = !!detected?.regionColumn && revenueAvailable
    const productRankingAvailable = !!detected?.productColumn && revenueAvailable
    return { revenueAvailable, costAvailable, profitAvailable, trendAvailable, regionRankingAvailable, productRankingAvailable }
  }, [analysis, data])
  
  // Generate validated insights from computed KPIs
  const getValidatedInsights = React.useCallback(() => {
    if (!analysis?.business_analysis?.kpis) return []
    
    const kpis = analysis.business_analysis.kpis
    const insights: {
      message: string
      type: string
      evidence: string
      reliability?: 'verified' | 'estimated' | 'unavailable'
    }[] = []
    
    // Revenue insight
    if (capabilities.revenueAvailable && kpis.totalRevenue !== null) {
      insights.push({
        message: `Total revenue is ${formatCurrencyForKPI(kpis.totalRevenue)}`,
        type: 'revenue',
        evidence: `Revenue: ${formatCurrencyForKPI(kpis.totalRevenue)}`,
        reliability: 'verified'
      })
    }
    
    // Profit insight
    if (capabilities.profitAvailable && kpis.totalProfit !== null) {
      const profitLabel = kpis.totalProfit >= 0 ? 'profit' : 'loss'
      insights.push({
        message: `Total ${profitLabel}: ${formatCurrencyForKPI(Math.abs(kpis.totalProfit))}`,
        type: 'profit',
        evidence: `Profit: ${formatCurrencyForKPI(kpis.totalProfit)}`,
        reliability: 'verified'
      })
    }
    
    // Profit margin insight
    if (capabilities.profitAvailable && kpis.profitMargin !== null) {
      insights.push({
        message: `Profit margin: ${formatPercentSimple(kpis.profitMargin)}`,
        type: 'margin',
        evidence: `Margin: ${formatPercentSimple(kpis.profitMargin)}`,
        reliability: 'verified'
      })
    }
    
    // Top region insight - only if we have region data
    if (capabilities.regionRankingAvailable && kpis.topRegions && kpis.topRegions.length > 0) {
      const topRegion = kpis.topRegions[0]
      if (topRegion) {
        insights.push({
          message: `${topRegion.name} drives ${formatPercentSimple(topRegion.percentage)} of business`,
          type: 'region',
          evidence: `${topRegion.name} contributes ${formatPercentSimple(topRegion.percentage)} of total revenue`,
          reliability: 'verified'
        })
      }
    }
    
    // Trend insight - only if valid
    if (capabilities.trendAvailable && kpis.growthValid && kpis.growthPercentage !== null) {
      const trend = kpis.growthPercentage >= 0 ? 'growth' : 'decline'
      insights.push({
        message: `Revenue ${trend}: ${formatPercentage(kpis.growthPercentage)} period-over-period`,
        type: 'trend',
        evidence: `Change: ${formatPercentage(kpis.growthPercentage)}`,
        reliability: 'verified'
      })
    } else if (!capabilities.trendAvailable || !kpis.growthValid) {
      insights.push({
        message: 'Trend analysis unavailable due to missing or invalid time data',
        type: 'trend',
        evidence: 'No valid time dimension detected',
        reliability: 'unavailable'
      })
    }
    
    // Average transaction value
    if (capabilities.revenueAvailable && kpis.avgRevenue !== null) {
      insights.push({
        message: `Average transaction value: ${formatCurrencyForKPI(kpis.avgRevenue)}`,
        type: 'average',
        evidence: `Average: ${formatCurrencyForKPI(kpis.avgRevenue)}`,
        reliability: 'verified'
      })
    }
    
    return insights
  }, [analysis, capabilities])
  
  // Generate validated recommendations from computed KPIs with strict triggers
  const getValidatedRecommendations = React.useCallback(() => {
    if (!analysis?.business_analysis?.kpis) return []
    
    const kpis = analysis.business_analysis.kpis
    const recommendations: {
      action: string
      reason: string
      evidence: string
      severity: 'critical' | 'high' | 'warning' | 'info'
      reliability?: 'verified' | 'estimated' | 'unavailable'
    }[] = []
    
    // Helper to extract period context from growth message
    const extractPeriodContext = (): { periodLabel: string; lastPeriod: string; prevPeriod: string } => {
      // Try to extract from growthMessage which may contain period names
      const msg = kpis.growthMessage || ''
      const fromMatch = msg.match(/from (\S+) to (\S+)/)
      if (fromMatch) {
        return {
          periodLabel: `${fromMatch[2]} → ${fromMatch[1]}`,
          lastPeriod: fromMatch[1],
          prevPeriod: fromMatch[2]
        }
      }
      // Fallback to generic
      return {
        periodLabel: 'recent period',
        lastPeriod: 'latest',
        prevPeriod: 'previous'
      }
    }
    
    // Helper for proper percentage phrasing
    const formatDecline = (pct: number): string => {
      const absPct = Math.abs(pct)
      return `declined by ${absPct.toFixed(1)}%`
    }
    
    const formatIncrease = (pct: number): string => {
      return `increased by ${pct.toFixed(1)}%`
    }
    
    // 1. Negative margin - CRITICAL
    if (kpis.profitMargin !== null && kpis.profitMargin < 0) {
      const lossAmount = Math.abs(kpis.totalProfit || 0)
      recommendations.push({
        action: 'Business is operating at a loss',
        reason: `${Math.abs(kpis.profitMargin).toFixed(1)}% negative margin requires immediate cost or pricing intervention`,
        evidence: `Current margin: ${kpis.profitMargin.toFixed(1)}% | Total loss: ${formatCurrencyForKPI(lossAmount)}`,
        severity: 'critical',
        reliability: kpis.profitReliability === 'verified' ? 'verified' : kpis.profitReliability === 'derived' ? 'estimated' : 'unavailable'
      })
    }
    
    // 2. Negative profit products - HIGH
    if (kpis.worstProducts && kpis.worstProducts.length > 0) {
      const negativeProducts = kpis.worstProducts.filter(p => p.profit < 0)
      if (negativeProducts.length > 0) {
        const topNegative = negativeProducts[0]
        const totalLoss = negativeProducts.reduce((sum, p) => sum + Math.abs(p.profit), 0)
        recommendations.push({
          action: `${negativeProducts.length} products are losing money`,
          reason: `These ${negativeProducts.length} items generated ${formatCurrencyForKPI(totalLoss)} in combined losses`,
          evidence: `Top loss-maker: ${topNegative.name} = ${formatCurrencyForKPI(Math.abs(topNegative.profit))}`,
          severity: 'high',
          reliability: 'verified'
        })
      }
    }
    
    // 3. Revenue decline - HIGH
    if (kpis.growthValid && kpis.growthPercentage !== null && kpis.growthPercentage < -5) {
      const period = extractPeriodContext()
      const declinePhrase = formatDecline(kpis.growthPercentage)
      recommendations.push({
        action: 'Revenue has declined significantly',
        reason: `Revenue ${declinePhrase} period-over-period - investigate drivers immediately`,
        evidence: `${period.lastPeriod}: ${formatCurrencyForKPI(kpis.totalRevenue || 0)} | ${period.prevPeriod}: Previous period | Change: ${kpis.growthPercentage.toFixed(1)}%`,
        severity: 'high',
        reliability: 'verified'
      })
    }
    
    // 4. Low margin warning - WARNING
    if (kpis.profitMargin !== null && kpis.profitMargin < 10 && kpis.profitMargin > 0) {
      const profitReliability = kpis.profitReliability || 'unavailable';
      recommendations.push({
        action: 'Profit margins are dangerously thin',
        reason: `Operating at ${kpis.profitMargin.toFixed(1)}% margin - review pricing and cost structure`,
        evidence: `Margin: ${kpis.profitMargin.toFixed(1)}% | Revenue: ${formatCurrencyForKPI(kpis.totalRevenue || 0)} | ${profitReliability === 'verified' ? 'Based on actual costs' : profitReliability === 'derived' ? 'Estimated from margin' : 'Limited data available'}`,
        severity: 'warning',
        reliability: profitReliability === 'verified' ? 'verified' : profitReliability === 'derived' ? 'estimated' : 'unavailable'
      })
    }
    
    // 5. Revenue concentration risk - WARNING
    if (kpis.topRegions && kpis.topRegions.length > 0) {
      const topRegion = kpis.topRegions[0]
      if (topRegion && topRegion.percentage > 50) {
        recommendations.push({
          action: 'Heavy reliance on single market',
          reason: `${topRegion.name} delivers ${topRegion.percentage.toFixed(0)}% of revenue - diversification recommended`,
          evidence: `${topRegion.name}: ${formatCurrencyForKPI(topRegion.revenue)} (${topRegion.percentage.toFixed(0)}% of total)`,
          severity: 'warning',
          reliability: 'verified'
        })
      }
    }
    
    // 6. Positive growth - INFO
    if (kpis.growthValid && kpis.growthPercentage !== null && kpis.growthPercentage > 5) {
      const period = extractPeriodContext()
      const increasePhrase = formatIncrease(kpis.growthPercentage)
      recommendations.push({
        action: 'Strong growth momentum detected',
        reason: `Revenue ${increasePhrase} - opportunity to scale successful strategies`,
        evidence: `${period.lastPeriod}: ${formatCurrencyForKPI(kpis.totalRevenue || 0)} | Growth: +${kpis.growthPercentage.toFixed(1)}%`,
        severity: 'info',
        reliability: 'verified'
      })
    }
    
    // 7. No time data - INFO
    if (!kpis.growthValid) {
      recommendations.push({
        action: 'Trend analysis unavailable',
        reason: 'Add a date column to enable period-over-period comparisons',
        evidence: 'No valid date column detected - include timestamps for trend insights',
        severity: 'info',
        reliability: 'unavailable'
      })
    }
    
    // Sort by severity: critical > high > warning > info
    const severityOrder = { critical: 0, high: 1, warning: 2, info: 3 }
    return recommendations.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
  }, [analysis])
  
  // Get computed validated data
  const validatedInsights = getValidatedInsights()
  const validatedRecommendations = getValidatedRecommendations()
  
  // Debug: Track render count
  const renderCount = React.useRef(0)
  renderCount.current++
  React.useEffect(() => {
    debugLog('[DatasetAnalyzer] Render count:', renderCount.current)
  })

  // Auto-trigger analysis on mount if not already analyzed
  React.useEffect(() => {
    if (!isAnalyzed && !isAnalyzing && data.length > 0 && autoProcessing) {
      // Small delay to let the UI render first
      const timer = setTimeout(() => {
        handleAnalyze()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isAnalyzed, isAnalyzing, data.length, autoProcessing])

  // ============================================================================
  // Analyze Handler
  // ============================================================================
  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    try {
      const response = await fetch(`/api/datasets/${datasetId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, columns })
      })
      
      if (response.ok) {
        const result = await response.json()
        setAnalysis(result)
        setIsAnalyzed(true)
      }
    } catch (error) {
      debugError('Analysis failed:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Handle generate report action
  const handleGenerateReport = async () => {
    if (!analysis?.business_analysis?.kpis) {
      debugError('No analysis data available')
      return
    }
    
    setIsGeneratingReport(true)
    setReportGenerated(false)
    
    try {
      const kpis = analysis.business_analysis.kpis
      const breakdowns = analysis.business_analysis?.breakdowns || {}
      
      // Get user's timezone
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      const timezoneOffset = new Date().getTimezoneOffset()
      
      // Format KPIs for report
      const reportKPIs = [
        { title: 'Total Revenue', value: kpis.totalRevenue || 0, format: 'currency' },
        { title: 'Total Profit', value: kpis.totalProfit || 0, format: 'currency' },
        { title: 'Profit Margin', value: kpis.profitMargin || 0, format: 'percentage' },
        { title: 'Avg Revenue', value: kpis.avgRevenue || 0, format: 'currency' },
        { title: 'Growth', value: kpis.growthPercentage || 0, format: 'percentage' }
      ].filter(k => k.value !== null && k.value !== 0)
      
      // Format charts data
      const charts: { type: 'bar' | 'line' | 'pie'; title: string; data: { name: string; value: number }[] }[] = []
      
      // Revenue by product chart
      if (breakdowns.revenueByProduct) {
        const productData = Object.entries(breakdowns.revenueByProduct)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 8)
        if (productData.length > 0) {
          charts.push({
            type: 'bar' as const,
            title: 'Revenue by Product',
            data: productData
          })
        }
      }
      
      // Revenue by region chart
      if (breakdowns.revenueByRegion) {
        const regionData = Object.entries(breakdowns.revenueByRegion)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 8)
        if (regionData.length > 0) {
          charts.push({
            type: 'bar' as const,
            title: 'Revenue by Region',
            data: regionData
          })
        }
      }
      
      // Format insights
      const insights = analysis.business_analysis?.insights?.map(i => i.message) || []
      const recommendations = analysis.business_analysis?.recommendations?.map(r => r.action) || []
      
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetId,
          datasetName,
          timezone: userTimezone,
          timezoneOffset,
          summary: analysis.ai_summary || `Analysis of ${datasetName}`,
          findings: recommendations,
          kpis: reportKPIs,
          charts,
          aiInsights: insights,
          predictions: [],
          alerts: [],
          rowCount: rowCount,
          columns
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        debugLog('Report generated:', result)
        setReportGenerated(true)
        // Store the report ID in sessionStorage so Downloads page can highlight it
        if (result.reportId) {
          sessionStorage.setItem('lastGeneratedReportId', result.reportId)
        }
        // Navigate to downloads after a short delay
        setTimeout(() => {
          window.location.href = '/app/downloads'
        }, 1500)
      } else {
        debugError('Report generation failed')
        const errorText = await response.text()
        debugError('Error response:', errorText)
      }
    } catch (error) {
      debugError('Report generation error:', error)
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const handleForecast = async () => {
    setIsForecasting(true)
    setForecastStatus(null)
    try {
      const response = await fetch(`/api/datasets/${datasetId}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        const result = await response.json()
        const predictionCount = Array.isArray(result.predictions) ? result.predictions.length : 0
        const insightCount = Array.isArray(result.insights) ? result.insights.length : 0
        if (predictionCount > 0) {
          setForecastStatus(`Generated ${predictionCount} forecasts and ${insightCount} forward-looking insights.`)
        } else {
          const warning = Array.isArray(result.insights) ? result.insights[0] : null
          setForecastStatus(
            result.summary ||
              warning?.description ||
              "Forecast needs a time column and numeric business values such as revenue, sales, profit, quantity, or cost.",
          )
        }
      } else {
        const body = await response.json().catch(() => ({}))
        if (typeof body.error === "string" && response.status < 500) {
          setForecastStatus(body.error)
          return
        }

        const fallbackValues = analysis?.business_analysis?.kpis
          ? [
              analysis.business_analysis.kpis.avgRevenue,
              analysis.business_analysis.kpis.totalRevenue,
              analysis.business_analysis.kpis.totalProfit,
            ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
          : []

        if (fallbackValues.length > 0) {
          const fallbackResponse = await fetch('/api/forecast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: fallbackValues, periods: 3 })
          })
          const fallbackResult = await fallbackResponse.json()
          if (fallbackResponse.ok && Array.isArray(fallbackResult.forecast)) {
            setForecastStatus(`Generated ${fallbackResult.forecast.length} lightweight forecast periods from available KPIs.`)
          } else {
            setForecastStatus('Forecast could not run with the available dataset fields.')
          }
        } else {
          setForecastStatus('Forecast needs numeric KPI data before it can run.')
        }
      }
    } catch (error) {
      debugError('Forecast system error:', error)
      setForecastStatus('Forecast could not run because of a system error. Please try again.')
    } finally {
      setIsForecasting(false)
    }
  }

  // ============================================================================
  // Investigation Handler
  // ============================================================================
  const [_investigationFindings, setInvestigationFindings] = React.useState<string[]>([])
  const [_isInvestigating, setIsInvestigating] = React.useState(false)

  const _handleInvestigate = async () => {
    setIsInvestigating(true)
    try {
      const response = await fetch(`/api/datasets/${datasetId}/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        const result = await response.json()
        setInvestigationFindings(result.findings || [])
        // Also trigger analysis if not done
        if (!isAnalyzed) {
          handleAnalyze()
        }
      }
    } catch (error) {
      debugError('Investigation failed:', error)
    } finally {
      setIsInvestigating(false)
    }
  }

  // ============================================================================
  // Data Detection Helpers
  // ============================================================================
  
  // Detect revenue column with priority: Revenue_USD > revenue > sales > amount > total
  const detectRevenueColumn = (cols: string[], rawData: any[]): string | null => {
    // Priority order for revenue columns
    const priorityKeywords = ['revenue_usd', 'revenue', 'sales', 'amount', 'total', 'income', 'value'];
    
    for (const kw of priorityKeywords) {
      const found = cols.find(c => 
        c.toLowerCase().includes(kw) && 
        !c.toLowerCase().includes('fx') && 
        !c.toLowerCase().includes('rate') &&
        !c.toLowerCase().includes('cost')
      );
      if (found) {
        // Verify it's a valid numeric column
        let validCount = 0;
        for (const row of rawData.slice(0, 30)) {
          const val = row[found];
          if (val === null || val === undefined || val === '') continue;
          const num = parseFloat(String(val));
          if (!isNaN(num) && isFinite(num) && num > 0) {
            validCount++;
          }
        }
        if (validCount >= 5) return found;
      }
    }
    return null;
  };
  
  // Detect region/continent column
  const detectRegionColumn = (cols: string[]): string | null => {
    const regionKeywords = ['region', 'continent', 'territory', 'area', 'zone'];
    return cols.find(c => regionKeywords.some(kw => c.toLowerCase().includes(kw))) || null;
  };
  
  // Detect country column
  const detectCountryColumn = (cols: string[]): string | null => {
    const countryKeywords = ['country', 'nation', 'market', 'location'];
    return cols.find(c => countryKeywords.some(kw => c.toLowerCase().includes(kw))) || null;
  };

  // ============================================================================
  // Render
  // ============================================================================
  
  // STATE 1: Auto-processing on first load - show processing state immediately
  // (autoProcessing is true by default for new uploads, showing processing animation)
  if (!isAnalyzed && data.length > 0 && autoProcessing) {
    return (
      <div className="flex min-h-[520px] flex-col items-center justify-center px-2 sm:min-h-[600px]">
        <div className="w-full max-w-lg">
          {/* Processing state - no button, just auto-processing */}
          <div className="rounded-lg border border-violet-200 bg-gradient-to-br from-violet-50/60 to-purple-50/60 px-5 py-10 text-center dark:border-violet-900 dark:from-violet-950/20 dark:to-purple-950/20 sm:px-8 sm:py-12">
            <div className="relative inline-block mb-6">
              <div className="h-16 w-16 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-violet-600 dark:text-violet-400 animate-spin" />
              </div>
              <div className="absolute inset-0 h-16 w-16 rounded-full bg-violet-200 dark:bg-violet-800 animate-ping opacity-20" />
            </div>
            
            <h2 className="text-xl font-semibold mb-3 text-foreground sm:text-2xl">
              Preparing dataset insights...
            </h2>
            <p className="text-muted-foreground mb-8">
              Detecting schema, analyzing patterns, and generating visualizations
            </p>
            
            {/* Dataset info */}
            <div className="mb-6 p-4 bg-muted/30 rounded-lg">
              <p className="font-medium text-foreground">{datasetName}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {rowCount.toLocaleString()} rows • {columns.length} columns
              </p>
            </div>
            
            {/* Processing steps indicator */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="h-2 w-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="h-2 w-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="ml-2">Analyzing</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // STATE 2: Not yet initiated - show the ready state (for returning users who haven't analyzed)
  if (!isAnalyzed) {
    return (
      <div className="flex min-h-[520px] flex-col items-center justify-center px-2 sm:min-h-[600px]">
        <div className="w-full max-w-lg">
          {/* Business Profile Warning */}
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-950 dark:text-amber-100">
            <div className="flex items-center gap-2 font-medium mb-1">
              <AlertTriangle className="h-4 w-4" />
              Business Profile Required
            </div>
            <p className="text-sm">
              Tax, payroll, insurance, fixed costs, profitability, forecasting, and KPI calculations depend on Business Profile data.
            </p>
          </div>

          {/* Clean centered card */}
          <div className="rounded-lg border border-violet-200 bg-gradient-to-br from-violet-50/60 to-purple-50/60 px-5 py-10 text-center dark:border-violet-900 dark:from-violet-950/20 dark:to-purple-950/20 sm:px-8 sm:py-12">
            <h2 className="text-xl font-semibold mb-3 text-foreground sm:text-2xl">
              Dataset ready for analysis
            </h2>
            <p className="text-muted-foreground mb-8">
              Run AI analysis to generate insights and visualizations
            </p>
            
            {/* Dataset info */}
            <div className="mb-8 p-4 bg-muted/30 rounded-lg">
              <p className="font-medium text-foreground">{datasetName}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {rowCount.toLocaleString()} rows • {columns.length} columns
              </p>
            </div>
            
            {/* ONE primary CTA button */}
            <Button 
              onClick={handleAnalyze} 
              disabled={isAnalyzing}
              size="lg"
              className="bg-violet-600 hover:bg-violet-700 text-base w-full"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing dataset...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Run AI Analysis
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // STATE 3: After analysis - Full dashboard
  return (
    <div className="flex min-w-0 flex-col min-h-0">
      {/* Header */}
      <div className="mb-6 flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="break-words text-2xl font-bold">{datasetName}</h2>
          <p className="text-muted-foreground">
            {rowCount.toLocaleString()} rows • {columns.length} columns
          </p>
        </div>
        {/* Action Buttons */}
        <div className="relative z-10 flex min-w-0 shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {/* Generate Report Button */}
          {analysis?.business_analysis?.kpis && (
            <Button 
              onClick={handleGenerateReport}
              disabled={isGeneratingReport}
              variant="outline"
              className="shrink-0 whitespace-nowrap border-violet-500/40 text-violet-700 hover:bg-violet-500/10 dark:text-violet-300"
            >
              {isGeneratingReport ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : reportGenerated ? (
                <FileText className="mr-2 h-4 w-4" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              {isGeneratingReport ? 'Generating...' : reportGenerated ? 'Generated!' : 'Generate Report'}
            </Button>
          )}
          <Button variant="outline" disabled={isForecasting} onClick={handleForecast} className="shrink-0 whitespace-nowrap">
            {isForecasting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <TrendingUp className="mr-2 h-4 w-4" />
            )}
            {isForecasting ? 'Forecasting...' : 'Run Forecast'}
          </Button>
        </div>
      </div>

      {forecastStatus && (
        <div className="mb-4 rounded-lg border border-violet-500/20 bg-violet-500/10 px-4 py-3 text-sm text-violet-900 dark:text-violet-100">
          {forecastStatus}
        </div>
      )}

      {analysis?.business_intelligence && (
        <Card className="mb-6 border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Sparkles className="h-5 w-5 text-violet-500" />
              Business Intelligence Engine
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-5">
              {[
                ["Health", analysis.business_intelligence.healthScore.overall],
                ["Data quality", analysis.business_intelligence.healthScore.dataQuality],
                ["KPI coverage", analysis.business_intelligence.healthScore.kpiCompleteness],
                ["Trend stability", analysis.business_intelligence.healthScore.trendStability],
                ["Risk control", analysis.business_intelligence.healthScore.riskScore],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">{Number(value)}/100</p>
                </div>
              ))}
            </div>

            <p className="rounded-lg border border-border bg-background p-3 text-sm leading-6 text-foreground">
              {analysis.business_intelligence.executiveSummary}
            </p>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-lg border border-border bg-background p-3">
                <h3 className="text-sm font-semibold text-foreground">Detected KPIs</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(analysis.business_intelligence.detectedKpis)
                    .filter(([, column]) => Boolean(column))
                    .slice(0, 10)
                    .map(([kpi, column]) => (
                      <span key={kpi} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        {kpi}: {column}
                      </span>
                    ))}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-background p-3">
                <h3 className="text-sm font-semibold text-foreground">Risks</h3>
                <div className="mt-3 space-y-2">
                  {analysis.business_intelligence.risks.slice(0, 3).map((risk) => (
                    <div key={`${risk.title}-${risk.description}`} className="text-sm">
                      <p className="font-medium text-foreground">{risk.title}</p>
                      <p className="text-xs leading-5 text-muted-foreground">{risk.description}</p>
                    </div>
                  ))}
                  {analysis.business_intelligence.risks.length === 0 && (
                    <p className="text-xs text-muted-foreground">No major automatic risk signal detected.</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-background p-3">
                <h3 className="text-sm font-semibold text-foreground">Opportunities</h3>
                <div className="mt-3 space-y-2">
                  {analysis.business_intelligence.opportunities.slice(0, 3).map((opportunity) => (
                    <div key={`${opportunity.title}-${opportunity.description}`} className="text-sm">
                      <p className="font-medium text-foreground">{opportunity.title}</p>
                      <p className="text-xs leading-5 text-muted-foreground">{opportunity.description}</p>
                    </div>
                  ))}
                  {analysis.business_intelligence.opportunities.length === 0 && (
                    <p className="text-xs text-muted-foreground">Add revenue, product, customer, or time fields to unlock more opportunities.</p>
                  )}
                </div>
              </div>
            </div>

            {analysis.business_intelligence.recommendedActions.length > 0 && (
              <div className="rounded-lg border border-border bg-background p-3">
                <h3 className="text-sm font-semibold text-foreground">Recommended Actions</h3>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {analysis.business_intelligence.recommendedActions.slice(0, 6).map((item) => (
                    <div key={`${item.priority}-${item.action}`} className="rounded-md border border-border bg-muted/20 p-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        item.priority === 'High'
                          ? 'bg-red-500/10 text-red-700 dark:text-red-300'
                          : item.priority === 'Medium'
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      }`}>
                        {item.priority}
                      </span>
                      <p className="mt-2 text-sm font-medium text-foreground">{item.action}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.reason}</p>
                      <p className="mt-2 text-xs text-muted-foreground">Impact: {item.expectedBusinessImpact}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mb-4 w-full shrink-0 overflow-x-auto sm:w-auto">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Table2 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="visualizations" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Visualizations
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab - Executive Only */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Smart Empty State */}
          {!isAnalyzed && (
            <div className="text-center py-16 px-6 bg-muted/20 rounded-xl">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-violet-400" />
              <h3 className="text-lg font-medium mb-2">No insights available yet</h3>
              <p className="text-muted-foreground mb-6">
                Run analysis to continue.
              </p>
              <Button 
                onClick={handleAnalyze} 
                disabled={isAnalyzing}
                className="bg-violet-600 hover:bg-violet-700 hover:scale-[1.03] hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] active:scale-[0.97] transition-all duration-200"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Run AI Analysis
                  </>
                )}
              </Button>
            </div>
          )}

          {analysis?.business_analysis?.businessProfileContext && (
            <Card className="border-amber-500/30 bg-amber-500/10 dark:border-amber-400/25 dark:bg-amber-400/10">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-amber-950 dark:text-amber-100">
                  <Lightbulb className="h-5 w-5" />
                  Business Profile Context
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-amber-950 dark:text-amber-50">
                {(() => {
                  const context = analysis.business_analysis.businessProfileContext
                  const hasAdjustedProfit = typeof context.kpis.profitAfterTax === 'number'
                  const hasAdjustedMargin = typeof context.kpis.netMarginAfterProfileCosts === 'number'
                  return (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg border border-amber-500/25 bg-background/70 p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Profit After Profile Costs</p>
                          <p className="mt-1 text-lg font-semibold text-foreground">
                            {hasAdjustedProfit ? formatCurrencyForKPI(context.kpis.profitAfterTax as number) : 'Needs tax/cost data'}
                          </p>
                        </div>
                        <div className="rounded-lg border border-amber-500/25 bg-background/70 p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Profile Net Margin</p>
                          <p className="mt-1 text-lg font-semibold text-foreground">
                            {hasAdjustedMargin ? formatPercentSimple(context.kpis.netMarginAfterProfileCosts as number) : 'Needs revenue data'}
                          </p>
                        </div>
                        <div className="rounded-lg border border-amber-500/25 bg-background/70 p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Annual Fixed + Insurance</p>
                          <p className="mt-1 text-lg font-semibold text-foreground">
                            {formatCurrencyForKPI(context.profileAdjustments.fixedCostsAnnual + context.profileAdjustments.insuranceAnnual)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-amber-500/25 bg-background/70 p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tax Assumption</p>
                          <p className="mt-1 text-lg font-semibold text-foreground">
                            {typeof context.profileAdjustments.taxRatePercent === 'number'
                              ? formatPercentSimple(context.profileAdjustments.taxRatePercent)
                              : 'Missing'}
                          </p>
                        </div>
                      </div>
                      {(context.conflicts.length > 0 || context.warnings.length > 0) && (
                        <div className="space-y-2">
                          {context.conflicts.map((message) => (
                            <div key={message} className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-950 dark:text-red-100">
                              {message}
                            </div>
                          ))}
                          {context.warnings.slice(0, 4).map((message) => (
                            <div key={message} className="rounded-lg border border-amber-500/25 bg-background/60 px-3 py-2">
                              {message}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )
                })()}
              </CardContent>
            </Card>
          )}

          {/* KPI Cards - Premium Executive Grid (gated by capabilities) */}
          {analysis?.business_analysis?.kpis && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
              {/* Total Revenue - Dominant Card */}
              {capabilities.revenueAvailable && analysis?.business_analysis?.kpis && (
                <div 
                  className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between min-h-[140px] shadow-sm transition-all duration-200 cursor-pointer group hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/5 dark:bg-gradient-to-br dark:from-neutral-900 dark:to-neutral-800"
                  onClick={() => {
                    const kpis = analysis!.business_analysis!.kpis;
                    setDrilldownItem({
                      type: 'kpi',
                      title: 'Total Revenue',
                      value: kpis.totalRevenue ? formatCurrencyForKPI(kpis.totalRevenue) : 'No data',
                      explanation: 'Total revenue represents the sum of all sales across your entire dataset. This is a key indicator of business scale and market reach.',
                      supportingData: [
                        { label: 'Top Product', value: kpis.topProducts[0]?.name || 'N/A' },
                        { label: 'Top Region', value: kpis.topRegions[0]?.name || 'N/A' },
                        { label: 'Date Range', value: kpis.dateRange ? `${kpis.dateRange.start} - ${kpis.dateRange.end}` : 'N/A' }
                      ],
                      nextActions: ['Review top performing products', 'Analyze regional distribution', 'Compare with previous periods'],
                      reliability: 'verified'
                    })
                  }}
                >
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium text-center group-hover:text-foreground transition-colors">Total Revenue</span>
                  <div className="text-2xl font-bold text-foreground text-center leading-tight">
                    {analysis.business_analysis.kpis.totalRevenue 
                      ? formatCurrencyForKPI(analysis.business_analysis.kpis.totalRevenue)
                      : <span className="text-muted-foreground">No data</span>}
                  </div>
                </div>
              )}
              
               {/* Total Profit */}
               {capabilities.profitAvailable && (
               <div 
                   className="bg-card rounded-xl p-5 flex flex-col justify-between min-h-[140px] border border-border hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-200 cursor-pointer group"
                   onClick={() => {
                     const kpis = analysis!.business_analysis!.kpis;
                     const reliability = kpis.profitReliability || 'unavailable';
                     const reliabilityLabel = reliability === 'verified' ? 'Verified' : reliability === 'derived' ? 'Derived' : 'Unavailable';
                    const explanation = reliability === 'derived' 
                      ? 'Profit is derived from revenue and margin (no cost data available in dataset).'
                      : reliability === 'verified'
                      ? 'Profit calculated from actual cost data in your dataset.'
                      : 'Total profit is the net earnings after subtracting all costs from revenue. It indicates the actual financial health and sustainability of your business.';
                    setDrilldownItem({
                      type: 'kpi',
                      title: 'Total Profit',
                      value: kpis.totalProfit !== null ? formatCurrencyForKPI(kpis.totalProfit) : 'No data',
                      explanation,
                      supportingData: [
                        { label: 'Revenue', value: kpis.totalRevenue ? formatCurrencyForKPI(kpis.totalRevenue) : 'N/A' },
                        { label: 'Margin', value: kpis.profitMargin !== null ? formatPercentSimple(kpis.profitMargin) : 'N/A' },
                        { label: 'Calculation', value: reliabilityLabel },
                        { label: 'Negative Products', value: kpis.worstProducts?.length ? `${kpis.worstProducts.length} products` : 'None' }
                      ],
                      nextActions: ['Review underperforming products', 'Analyze cost structure', 'Identify high-margin items'],
                      reliability
                    })
                  }}
                >
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium text-center group-hover:text-foreground transition-colors">Total Profit</span>
                    {analysis.business_analysis.kpis.profitReliability !== 'unavailable' && analysis.business_analysis.kpis.totalProfit !== null ? (
                      <>
                        <div className="text-2xl font-bold text-emerald-400 text-center mt-1">
                          {formatCurrencyForKPI(analysis.business_analysis.kpis.totalProfit)}
                        </div>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium mt-1 ${
                          analysis.business_analysis.kpis.profitReliability === 'verified' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-amber-900/30 text-amber-400'
                        }`}>
                          {analysis.business_analysis.kpis.profitReliability === 'verified' ? '✓ Verified' : '~ Derived'}
                        </span>
                      </>
                    ) : (
                      <div className="text-center mt-1">
                        <div className="text-lg font-medium text-muted-foreground">No Data</div>
                        <div className="text-caption text-neutral-600 mt-0.5">Cannot calculate profit</div>
                      </div>
                    )}
                  </div>
                </div>
               )}
               <div 
                  className="bg-card rounded-xl p-5 flex flex-col justify-between min-h-[140px] border border-border hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-200 cursor-pointer group"
                  onClick={() => {
                     if (analysis?.business_analysis?.kpis) {
                       const kpis = analysis.business_analysis.kpis;
                     setDrilldownItem({
                       type: 'kpi',
                       title: 'Profit Margin',
                       value: kpis.profitMargin !== null ? formatPercentSimple(kpis.profitMargin) : 'No data',
                       explanation: 'Profit margin represents the percentage of revenue that becomes profit after all costs. Higher margins indicate better efficiency and pricing power.',
                       supportingData: [
                         { label: 'Revenue', value: kpis.totalRevenue ? formatCurrencyForKPI(kpis.totalRevenue) : 'N/A' },
                         { label: 'Profit', value: kpis.totalProfit !== null ? formatCurrencyForKPI(kpis.totalProfit) : 'N/A' },
                         { label: 'Industry Benchmark', value: '15-20% for retail' }
                       ],
                       nextActions: ['Compare to industry standards', 'Analyze cost reduction opportunities', 'Review pricing strategy']
                     })
                   }
                 }}
               >
                 <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium text-center group-hover:text-foreground transition-colors">Margin</span>
                 <div className="text-2xl font-bold text-blue-400 text-center leading-tight">
                   {capabilities.profitAvailable && analysis.business_analysis.kpis.profitMargin !== null
                     ? formatPercentSimple(analysis.business_analysis.kpis.profitMargin)
                     : <span className="text-muted-foreground">No data</span>}
                 </div>
               </div>
               
               {/* Top Region */}
               {capabilities.regionRankingAvailable && (
               <div 
                  className="bg-card rounded-xl p-5 flex flex-col justify-between min-h-[140px] border border-border hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-200 cursor-pointer group"
                  onClick={() => {
                    if (analysis?.business_analysis?.kpis) {
                      const kpis = analysis.business_analysis.kpis;
                      setDrilldownItem({
                       type: 'kpi',
                       title: 'Top Region',
                       value: kpis.topRegions[0]?.name 
                         ? kpis.topRegions[0].percentage
                           ? `${kpis.topRegions[0].name} (${formatPercentSimple(kpis.topRegions[0].percentage)})`
                           : kpis.topRegions[0].name
                         : 'No data',
                       explanation: 'This region generates the highest revenue for your business. Understanding regional performance helps with resource allocation and expansion planning.',
                       supportingData: kpis.topRegions.slice(0, 3).map(r => ({ 
                         label: r.name || 'Unknown', 
                         value: r.percentage ? `${formatPercentSimple(r.percentage)} of revenue` : 'N/A' 
                       })),
                       nextActions: ['Analyze regional growth trends', 'Compare regional margins', 'Identify expansion opportunities']
                     })
                   }
                 }}
               >
                 <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium text-center group-hover:text-foreground transition-colors">Top Region</span>
                 <div className="text-lg font-semibold text-orange-400 text-center break-words leading-tight">
                   {analysis.business_analysis.kpis.topRegions[0]?.name 
                     ? analysis.business_analysis.kpis.topRegions[0].percentage
                       ? `${analysis.business_analysis.kpis.topRegions[0].name} (${formatPercentSimple(analysis.business_analysis.kpis.topRegions[0].percentage)})`
                       : analysis.business_analysis.kpis.topRegions[0].name
                     : <span className="text-muted-foreground">No data</span>}
                 </div>
                </div>
               )}
               
               {/* Top Product */}
               {capabilities.productRankingAvailable && (
               <div 
                  className="bg-card rounded-xl p-5 flex flex-col justify-between min-h-[140px] border border-border hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/5 transition-all duration-200 cursor-pointer group"
                  onClick={() => {
                    if (analysis?.business_analysis?.kpis) {
                      const kpis = analysis.business_analysis.kpis;
                      setDrilldownItem({
                       type: 'kpi',
                       title: 'Top Product',
                       value: kpis.topProducts[0]?.name 
                         ? kpis.topProducts[0].percentage
                           ? `${kpis.topProducts[0].name} (${formatPercentSimple(kpis.topProducts[0].percentage)})`
                           : kpis.topProducts[0].name
                         : 'No data',
                       explanation: 'This product generates the highest revenue for your business. Understanding top performers helps with inventory and marketing decisions.',
                       supportingData: kpis.topProducts.slice(0, 3).map(p => ({ 
                         label: p.name || 'Unknown', 
                         value: p.percentage ? `${formatPercentSimple(p.percentage)} of revenue` : formatCurrencyForKPI(p.revenue) 
                       })),
                       nextActions: ['Analyze product margins', 'Review inventory levels', 'Plan marketing for top performers']
                     })
                   }
                 }}
               >
                 <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium text-center group-hover:text-foreground transition-colors">Top Product</span>
                 <div className="text-lg font-semibold text-violet-400 text-center break-words leading-tight">
                   {analysis.business_analysis.kpis.topProducts[0]?.name 
                     ? analysis.business_analysis.kpis.topProducts[0].percentage
                       ? `${analysis.business_analysis.kpis.topProducts[0].name} (${formatPercentSimple(analysis.business_analysis.kpis.topProducts[0].percentage)})`
                       : analysis.business_analysis.kpis.topProducts[0].name
                     : <span className="text-muted-foreground">No data</span>}
                 </div>
                </div>
               )}
               
               {/* Growth */}
               {capabilities.trendAvailable && analysis.business_analysis.kpis.growthValid && (
                   <div 
                     className="bg-card rounded-xl p-5 flex flex-col justify-between min-h-[140px] border border-border hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/5 transition-all duration-200 cursor-pointer group"
                     onClick={() => {
                       if (analysis?.business_analysis?.kpis) {
                         const kpis = analysis.business_analysis.kpis;
                       setDrilldownItem({
                         type: 'kpi',
                         title: 'Revenue Growth',
                         value: kpis.growthPercentage !== null
                           ? formatPercentage(kpis.growthPercentage)
                           : 'No data',
                         explanation: kpis.growthMessage || 'Growth shows the percentage change in revenue over the analyzed time period. Positive growth indicates business expansion.',
                         supportingData: [
                           { label: 'Trend', value: kpis.growthTrend || 'N/A' },
                           { label: 'Date Range', value: kpis.dateRange ? `${kpis.dateRange.start} - ${kpis.dateRange.end}` : 'N/A' },
                           { label: 'Growth Status', value: (kpis.growthPercentage || 0) >= 0 ? 'Positive' : 'Negative' }
                         ],
                         nextActions: ['Analyze growth drivers', 'Compare periods', 'Forecast future performance']
                       })
                     }
                   }}
                 >
                   <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium text-center group-hover:text-foreground transition-colors">Growth</span>
                   <div className={`text-2xl font-bold text-center leading-tight ${analysis.business_analysis.kpis.growthPercentage !== null && analysis.business_analysis.kpis.growthPercentage >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                     {analysis.business_analysis.kpis.growthPercentage !== null
                       ? formatPercentage(analysis.business_analysis.kpis.growthPercentage)
                       : <span className="text-muted-foreground">No data</span>}
                   </div>
                 </div>
               )}
            </div>
          )}

          {/* Executive Financial Summary (grounded, validated-only) */}
          {(() => {
            const k = analysis?.business_analysis?.kpis
            if (!k) return false
            const hasAny = (capabilities.revenueAvailable || capabilities.profitAvailable || capabilities.costAvailable || (capabilities.trendAvailable && k.growthValid))
            return hasAny
          })() && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-foreground text-base">Executive Financial Summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-foreground space-y-2">
                {capabilities.revenueAvailable && typeof analysis!.business_analysis!.kpis!.totalRevenue === 'number' && (
                  <p>Revenue Overview: Total revenue {formatCurrencyForKPI(analysis!.business_analysis!.kpis!.totalRevenue)}{analysis!.business_analysis!.kpis!.avgRevenue ? `; average transaction ${formatCurrencyForKPI(analysis!.business_analysis!.kpis!.avgRevenue)}` : ''}.</p>
                )}
                {capabilities.costAvailable && typeof analysis!.business_analysis!.kpis!.totalCost === 'number' && (
                  <p>Cost / Expense Overview: Total expenses {formatCurrencyForKPI(analysis!.business_analysis!.kpis!.totalCost)}.</p>
                )}
                {capabilities.profitAvailable && typeof analysis!.business_analysis!.kpis!.totalProfit === 'number' && (
                  <p>Profitability: Net {analysis!.business_analysis!.kpis!.totalProfit >= 0 ? 'profit' : 'loss'} {formatCurrencyForKPI(Math.abs(analysis!.business_analysis!.kpis!.totalProfit))}{typeof analysis!.business_analysis!.kpis!.profitMargin === 'number' ? `; margin ${formatPercentSimple(analysis!.business_analysis!.kpis!.profitMargin)}` : ''}.</p>
                )}
                {capabilities.trendAvailable && analysis!.business_analysis!.kpis!.growthValid && typeof analysis!.business_analysis!.kpis!.growthPercentage === 'number' && (
                  <p>Growth / Trend: {analysis!.business_analysis!.kpis!.growthPercentage >= 0 ? 'Growth' : 'Decline'} of {formatPercentage(analysis!.business_analysis!.kpis!.growthPercentage)} over the measured period.</p>
                )}
                {!capabilities.revenueAvailable && !capabilities.costAvailable && !capabilities.profitAvailable && (
                  <p>Financial metrics are limited in this dataset. Narrative is restricted to validated figures only.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Section Divider */}
          {analysis?.business_analysis?.kpis && (
            <div className="border-t border-border my-6" />
          )}

          {/* AI Executive Summary (gated by capabilities and available metrics) */}
          {(() => {
            if (!analysis?.ai_summary) return false
            const k = analysis?.business_analysis?.kpis
            const anyMetric = capabilities.revenueAvailable || capabilities.profitAvailable || (capabilities.trendAvailable && !!k?.growthPercentage && !!k?.growthValid) || (capabilities.productRankingAvailable && (k?.topProducts?.length || 0) > 0) || (capabilities.regionRankingAvailable && (k?.topRegions?.length || 0) > 0)
            return anyMetric
          })() && (
            <Card className="border border-border bg-card shadow-xl dark:bg-gradient-to-br dark:from-neutral-900 dark:via-neutral-800 dark:to-neutral-900">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Sparkles className="h-5 w-5 text-purple-400" />
                  Executive Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base text-foreground leading-relaxed">
                  {(() => {
                    const aiSummary = analysis?.ai_summary || ""
                    const sentences = aiSummary.split('.').slice(0, 2).join('.');
                    return sentences.endsWith('.') ? sentences : sentences + '.';
                  })()}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Section Divider */}
          {analysis?.ai_summary && (
            <div className="border-t border-border my-6" />
          )}

          {/* Key Drivers */}
          {analysis?.business_analysis?.kpis && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {capabilities.productRankingAvailable && analysis.business_analysis.kpis.topProducts.length > 0 && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-foreground text-base">Top Products</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-1">
                      {analysis.business_analysis.kpis.topProducts.slice(0, 10).map((item, idx) => (
                        <div 
                          key={idx} 
                          className={`flex items-center justify-between p-3 rounded-lg ${idx === 0 ? 'bg-muted border border-violet-500/30' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-medium ${idx === 0 ? 'text-violet-400' : 'text-muted-foreground'}`}>
                              {idx + 1}.
                            </span>
                            <span className="font-medium truncate text-foreground">
                              {item.name}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className={`font-semibold ${idx === 0 ? 'text-violet-400' : 'text-muted-foreground'}`}>
                              ${item.revenue.toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.percentage}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {capabilities.regionRankingAvailable && analysis.business_analysis.kpis.topRegions.length > 0 && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-foreground text-base">World Revenue Map</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <WorldMapChart 
                      rawData={data} 
                      breakdowns={analysis.business_analysis.breakdowns}
                      businessModel={businessModel}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Section Divider */}
          {analysis?.business_analysis?.kpis && (analysis.business_analysis.kpis.topProducts.length > 0 || analysis.business_analysis.kpis.topRegions.length > 0) && (
            <div className="border-t border-border my-6" />
          )}

           {/* Insights - Using Validated Metrics Layer */}
           {validatedInsights.length > 0 && (
             <Card className="bg-card border-border">
               <CardHeader className="pb-3">
                 <CardTitle className="text-foreground flex items-center gap-2 text-base">
                   <Lightbulb className="h-4 w-4 text-amber-400" />
                   Business Insights
                 </CardTitle>
               </CardHeader>
               <CardContent className="pt-0">
                 <ul className="space-y-2">
                   {validatedInsights.map((insight, idx) => (
                     <li 
                       key={idx} 
                       className="flex items-start gap-3 text-foreground cursor-pointer hover:bg-muted/50 rounded-lg p-2 transition-colors"
                       onClick={() => setDrilldownItem({
                         type: 'insight',
                         title: `Insight ${idx + 1}`,
                         value: insight.message,
                         explanation: insight.evidence,
                         supportingData: [
                           { label: 'Type', value: insight.type || 'General' },
                           { label: 'Evidence', value: insight.evidence },
                           { label: 'Reliability', value: (insight.reliability || 'verified').charAt(0).toUpperCase() + (insight.reliability || 'verified').slice(1) }
                         ],
                         nextActions: ['Review related metrics', 'Analyze impact', 'Consider recommended actions'],
                         reliability: insight.reliability
                       })}
                     >
                       <span className="text-amber-400 mt-0.5">•</span>
                       <div className="flex-1">
	                        <div className="leading-relaxed">{insight.message}</div>
                         <div className="text-xs mt-1">
                           <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                             insight.reliability === 'verified' ? 'bg-emerald-900/30 text-emerald-400' :
                             insight.reliability === 'estimated' ? 'bg-amber-900/30 text-amber-400' :
                             'bg-muted text-muted-foreground'
                           }`}>
                             {insight.reliability === 'verified' ? '✓ Verified' : 
                              insight.reliability === 'estimated' ? '~ Estimated' : 
                              '✗ Unavailable'}
                           </span>
                         </div>
                       </div>
                     </li>
                   ))}
                 </ul>
               </CardContent>
             </Card>
           )}

          {/* Recommendations - Using Validated Metrics Layer */}
          {validatedRecommendations.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  Recommended Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                 <div className="space-y-3">
                   {validatedRecommendations.slice(0, 4).map((rec, idx) => (
                     <div 
                       key={idx} 
                       className="border-l-2 border-emerald-500 pl-4 py-3 hover:bg-muted/50 rounded-r-lg transition-colors cursor-pointer group"
                       onClick={() => {
                         // Generate specific next actions based on recommendation type
                         const getNextActions = (action: string): string[] => {
                           if (action.includes('Diversify')) {
                             return [
                               'Analyze top regions to identify expansion opportunities',
                               'Review customer distribution across other regions',
                               'Develop regional marketing strategies'
                             ]
                           }
                           if (action.includes('decline') || action.includes('Decline')) {
                             return [
                               'Break down revenue by region to identify underperforming areas',
                               'Analyze product-level sales trends',
                               'Review customer segment performance',
                               'Check transaction volume and average order value changes'
                             ]
                           }
                           if (action.includes('negative profit') || action.includes('loss')) {
                             return [
                               'Review cost structure for loss-making products',
                               'Consider pricing adjustments or product discontinuation',
                               'Analyze competitor pricing for these items'
                             ]
                           }
                           if (action.includes('growth') || action.includes('Growth')) {
                             return [
                               'Identify which channels/products driving growth',
                               'Increase marketing spend on top performers',
                               'Replicate successful strategies across segments'
                             ]
                           }
                           if (action.includes('margin')) {
                             return [
                               'Analyze cost breakdown by category',
                               'Review pricing strategy',
                               'Identify high-margin vs low-margin products'
                             ]
                           }
                           if (action.includes('time') || action.includes('Time')) {
                             return [
                               'Add a date column to your dataset',
                               'Ensure dates are in a consistent format',
                               'Include multiple time periods for trend analysis'
                             ]
                           }
                           return [
                             'Review related data in detail',
                             'Implement suggested changes',
                             'Monitor results over time'
                           ]
                         }
                         
                         setDrilldownItem({
                           type: 'recommendation',
                           title: rec.action,
                           value: rec.reason,
                           explanation: rec.evidence,
                           supportingData: [
                             { label: 'Data Quality', value: rec.reliability === 'verified' ? 'Verified' : rec.reliability === 'estimated' ? 'Estimated' : 'Unavailable' }
                           ],
                           nextActions: getNextActions(rec.action),
                           reliability: rec.reliability
                         })
                       }}
                     >
                       <div className="font-semibold text-foreground group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors">{rec.action}</div>
                       <div className="text-sm text-muted-foreground mt-1">{rec.reason}</div>
                       <div className="text-xs mt-2">
                         <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                           rec.reliability === 'verified' ? 'bg-emerald-900/30 text-emerald-400' :
                           rec.reliability === 'estimated' ? 'bg-amber-900/30 text-amber-400' :
                           'bg-muted text-muted-foreground'
                         }`}>
                           {rec.reliability === 'verified' ? '✓ Verified' : 
                            rec.reliability === 'estimated' ? '~ Estimated' : 
                            '✗ Unavailable'}
                         </span>
                       </div>
                     </div>
                   ))}
                 </div>
                {/* Show negative profit products if available */}
                {analysis?.business_analysis?.kpis?.worstProducts && analysis.business_analysis.kpis.worstProducts.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingDown className="h-4 w-4 text-red-400" />
                      <span className="text-sm font-medium text-red-400">Products with Negative Profit</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {analysis?.business_analysis?.kpis?.worstProducts?.slice(0, 5).map((product, idx) => (
	                        <div key={idx} className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-700 dark:text-red-300">
                          {product.name}: ${Math.abs(product.profit).toLocaleString()} loss
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Visualizations Tab */}
        <TabsContent value="visualizations" className="space-y-8 mt-8">
          {/* Empty State - Show when not analyzed */}
          {!isAnalyzed && (
            <div className="text-center py-16 px-6 bg-muted/20 rounded-xl">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-violet-400" />
              <h3 className="text-lg font-medium mb-2">No insights available yet</h3>
              <p className="text-muted-foreground mb-6">
                Run analysis to continue.
              </p>
              <Button 
                onClick={handleAnalyze} 
                disabled={isAnalyzing}
                className="shrink-0 whitespace-nowrap bg-violet-600 hover:bg-violet-700"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Run AI Analysis
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Check if business analysis data exists */}
          {(!analysis?.business_analysis?.breakdowns || 
            (typeof analysis.business_analysis.breakdowns === 'object' && 
             Object.keys(analysis.business_analysis.breakdowns).length === 0)) && (
	            <div className="rounded-lg border border-border bg-card px-6 py-16 text-center">
              <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No visualization data available</p>
              <p className="text-sm text-muted-foreground mt-2">Re-analyze your dataset to generate business insights.</p>
            </div>
          )}
          
           {capabilities.revenueAvailable && analysis?.business_analysis?.breakdowns && 
            typeof analysis.business_analysis.breakdowns === 'object' && 
            Object.keys(analysis.business_analysis.breakdowns).length > 0 && (
            <div className="space-y-8">
              {/* PRIMARY: Use breakdowns from analysis (same as Overview) */}
              {(() => {
                const breakdowns = analysis.business_analysis.breakdowns;
                
                // Use revenueByRegion if available (from processed analysis)
                const regionData = breakdowns.revenueByRegion && Object.keys(breakdowns.revenueByRegion).length > 0 
                  ? Object.entries(breakdowns.revenueByRegion)
                  : null;
                
                debugLog('[Overview] Using regionData:', regionData ? regionData.length + ' entries' : 'null');
                debugLog('[Overview] revenueByRegion keys:', breakdowns.revenueByRegion ? Object.keys(breakdowns.revenueByRegion) : 'none');
                
                // Use revenueByProduct if available (from processed analysis)
                const productData = breakdowns.revenueByProduct && Object.keys(breakdowns.revenueByProduct).length > 0
                  ? Object.entries(breakdowns.revenueByProduct)
                  : null;
                
                // If no breakdowns data, fall back to raw data aggregation
                if (!regionData && !productData) {
                  // Fallback: aggregate from raw data
                  const rawData = data;
                  if (!rawData || rawData.length === 0) return null;
                  
                  const columns = Object.keys(rawData[0]);
                  const groupCol = columns.find(c => 
                    /region|country|territory|area|zone|market/i.test(c)
                  ) || columns.find(c => 
                    new Set(rawData.map(r => r[c])).size > 1 &&
                    new Set(rawData.map(r => r[c])).size < rawData.length
                  );
                  
                  const numericCol = columns.find(c => 
                    /revenue|sales|amount|profit|value/i.test(c) &&
                    rawData.some(r => {
                      const v = parseFloat(String(r[c]));
                      return !isNaN(v) && isFinite(v) && v > 0;
                    })
                  );
                  
                  if (!groupCol || !numericCol) return null;
                  
                  const agg: Record<string, number> = {};
                  rawData.forEach(r => {
                    const key = String(r[groupCol] || 'Unknown');
                    const val = parseFloat(String(r[numericCol])) || 0;
                    if (val > 0) agg[key] = (agg[key] || 0) + val;
                  });
                  
                  const entries = Object.entries(agg)
                    .map(([label, value]) => ({ label, value }))
                    .filter(item => item.value > 0)
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 8);
                  
                  debugLog('Overview aggregated revenue data:', entries);
                  
                  if (entries.length === 0) return null;
                  
                  const maxVal = Math.max(...entries.map(e => e.value));
                  
                  return (
                    <Card className="overflow-hidden max-w-[800px] mx-auto w-full">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">{numericCol} by {groupCol}</CardTitle>
                        <p className="text-sm text-muted-foreground">{entries.length} categories</p>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="h-[300px] flex items-end justify-center gap-8 px-8 pb-4">
                          {entries.map((item, idx) => {
                            const heightPct = maxVal > 0 ? (item.value / maxVal) * 85 : 0;
                            const minHeight = Math.max(heightPct, 8);
                            
                            return (
                              <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full">
                                <span className="text-sm font-semibold text-violet-600 mb-2">
                                  ${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                                <div 
                                  className="w-full bg-gradient-to-t from-violet-600 to-purple-400 rounded-t-md"
                                  style={{ height: `${minHeight}%`, minHeight: '24px' }}
                                />
                                <span className="text-xs mt-2 text-center truncate max-w-[80px]">{item.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                }
                
                // PRIMARY: Use breakdowns data (processed from analysis)
                // With Region/Country toggle for drilldown
                if ((regionData && regionData.length > 0) || (data && data.length > 0)) {
                  // Get columns for dynamic detection
                  const cols = data && data.length > 0 ? Object.keys(data[0]) : [];
                  const revenueCol = detectRevenueColumn(cols, data);
                  const regionCol = detectRegionColumn(cols);
                  const countryCol = detectCountryColumn(cols);
                  
                  // Get data based on view mode
                  const getAggregatedData = () => {
                    const rawData = data;
                    if (!rawData || rawData.length === 0 || !revenueCol) return null;
                    
                    let groupCol: string | null = null;
                    
                    if (revenueViewMode === 'region') {
                      // For region view, prefer pre-computed regionData
                      if (regionData && regionData.length > 0) {
                        return regionData
                          .map(([label, value]) => ({ label, value }))
                          .filter(item => item.value > 0)
                          .sort((a, b) => b.value - a.value);
                      }
                      groupCol = regionCol || detectRegionColumn(cols);
                    } else {
                      // For country view, always aggregate from raw data
                      groupCol = countryCol || detectCountryColumn(cols);
                    }
                    
                    if (!groupCol) return null;
                    
                    const agg: Record<string, number> = {};
                    rawData.forEach(r => {
                      const key = String(r[groupCol!] || 'Unknown');
                      const val = parseFloat(String(r[revenueCol])) || 0;
                      if (val > 0) agg[key] = (agg[key] || 0) + val;
                    });
                    
                    let entries = Object.entries(agg)
                      .map(([label, value]) => ({ label, value }))
                      .filter(item => item.value > 0)
                      .sort((a, b) => b.value - a.value);
                    
                    // For country view, use display mode to determine what to show
                    // Top mode: show top 8, All mode: show all countries
                    if (revenueViewMode === 'country') {
                      if (countryDisplayMode === 'top' && entries.length > 8) {
                        entries = entries.slice(0, 8);
                      }
                      // In 'all' mode, show all entries (no grouping)
                    }
                    
                    return entries;
                  };
                  
                  const entries = getAggregatedData();
                  
                  if (entries && entries.length > 0) {
                    const maxVal = Math.max(...entries.map(e => e.value));
                    const totalRevenue = entries.reduce((sum, e) => sum + e.value, 0);
                    
                    // Calculate gap based on number of bars (28-36px range)
                    const barCount = entries.length;
                    const gap = barCount <= 4 ? 36 : barCount <= 6 ? 32 : 28;
                    
                    // Calculate bar width - max 90px, min 60px
                    const maxBarWidth = Math.min(90, Math.max(60, 600 / barCount));
                    
                    return (
	                      <Card className={countryDisplayMode === 'all' && entries.length > 8 ? "overflow-x-auto" : "overflow-hidden max-w-[900px] mx-auto w-full"}>
                        <CardHeader className="pb-2">
	                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <CardTitle className="text-xl">
                                {revenueViewMode === 'region' ? 'Revenue by Region' : 'Revenue by Country'}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground">
                                {revenueViewMode === 'region' 
                                  ? 'Aggregated revenue by region' 
                                  : countryDisplayMode === 'all' 
                                    ? `All countries (${entries.length} total - scroll to view)`
                                    : `Top countries (${entries.length} shown)`}
                              </p>
                            </div>
                            
	                            <div className="flex flex-wrap items-center gap-2">
                              {/* Region/Country Toggle */}
	                              <div className="flex rounded-lg bg-muted p-1">
                                <button
                                  onClick={() => setRevenueViewMode('region')}
                                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                                    revenueViewMode === 'region'
                                      ? 'bg-background shadow-sm text-foreground'
                                      : 'text-muted-foreground hover:text-foreground'
                                  }`}
                                >
                                  Region
                                </button>
                                <button
                                  onClick={() => { setRevenueViewMode('country'); setCountryDisplayMode('top'); }}
                                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                                    revenueViewMode === 'country'
                                      ? 'bg-background shadow-sm text-foreground'
                                      : 'text-muted-foreground hover:text-foreground'
                                  }`}
                                >
                                  Country
                                </button>
                              </div>
                              
                              {/* Top/All Toggle - only show for Country mode */}
                              {revenueViewMode === 'country' && entries.length > 8 && (
                                <div className="flex bg-muted rounded-lg p-1">
                                  <button
                                    onClick={() => setCountryDisplayMode('top')}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                                      countryDisplayMode === 'top'
                                        ? 'bg-background shadow-sm text-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                  >
                                    Top 8
                                  </button>
                                  <button
                                    onClick={() => setCountryDisplayMode('all')}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                                      countryDisplayMode === 'all'
                                        ? 'bg-background shadow-sm text-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                  >
                                    Show all
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-2">
                          <div 
                            className={countryDisplayMode === 'all' && entries.length > 8 
	                              ? "h-[320px] overflow-x-auto flex items-end scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent"
	                              : "h-[320px] min-w-[520px] flex items-end justify-center"
	                            }
                            style={{ gap: `${gap}px`, padding: '0 24px 16px' }}
                          >
                            {entries.map((item, idx) => {
                              const heightPct = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
                              const minHeight = Math.max(heightPct, 5);
                              const sharePct = totalRevenue > 0 ? ((item.value / totalRevenue) * 100).toFixed(2) : '0';
                              
                              return (
                                <div 
                                  key={idx} 
                                  className="flex flex-col items-center justify-end h-full relative group"
                                  style={{ width: `${maxBarWidth}px`, flexShrink: 0 }}
                                >
                                  {/* Tooltip */}
	                                  <div className="absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground opacity-0 shadow-xl transition-opacity pointer-events-none group-hover:opacity-100">
                                    <div className="font-semibold">{item.label}</div>
	                                    <div className="text-primary">${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                    <div className="text-muted-foreground">{sharePct}% of total</div>
                                  </div>
                                  
                                   {/* Value label above bar */}
                                   <span className="text-xs font-semibold text-violet-600 mb-1.5 whitespace-nowrap">
                                     {formatCurrencyCompact(item.value, '$')}
                                   </span>
                                  
                                   {/* Bar */}
                                   <div 
                                     className="w-full bg-gradient-to-t from-violet-600 to-purple-400 rounded-t-md cursor-pointer hover:from-violet-500 hover:to-purple-300 transition-all duration-200"
                                     style={{ height: `${minHeight}%`, minHeight: '24px' }}
                                     onClick={() => {
                                       setDrilldownItem({
                                         type: 'chart',
                                         title: `${item.label} Revenue`,
                                         value: `$${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                                         explanation: `This bar represents the revenue generated by ${item.label}. Chart data shows the distribution of revenue across different categories, helping identify top performers and underperformers.`,
                                         supportingData: [
                                           { label: 'Revenue Share', value: `${sharePct}% of total revenue` },
                                           { label: 'Category', value: item.label },
                                           { label: 'Absolute Value', value: `$${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` }
                                         ],
                                         nextActions: ['Analyze this category in detail', 'Compare with other categories', 'Review trends over time']
                                       })
                                     }}
                                   />
                                  
                                  {/* Label below bar */}
                                  <span className="text-xs mt-2 text-center truncate w-full" title={item.label}>
                                    {item.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          
                          {/* Baseline */}
                          <div className="border-t border-border mx-8 mt-2" />
                        </CardContent>
                      </Card>
                    );
                  }
                }
                
                // Display product data if available
                if (productData) {
                  const entries = productData
                    .map(([label, value]) => ({ label, value }))
                    .filter(item => item.value > 0)
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 8);
                  
                  if (entries.length > 0) {
                    const maxVal = Math.max(...entries.map(e => e.value));
                    const totalRevenue = entries.reduce((sum, e) => sum + e.value, 0);
                    const colors = ['from-violet-600', 'from-purple-600', 'from-blue-600', 'from-cyan-600', 'from-emerald-600', 'from-amber-600', 'from-orange-600', 'from-rose-600'];
                    
                    return (
                      <Card className="overflow-hidden">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-xl">Revenue by Product</CardTitle>
                          <p className="text-sm text-muted-foreground">{entries.length} products</p>
                        </CardHeader>
                        <CardContent className="pt-0">
	                          <div className="max-h-[400px] space-y-3 overflow-y-auto pr-2">
                            {entries.map((item, idx) => {
                              const widthPct = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
                              const minWidthPct = Math.max(widthPct, 10); // Minimum 10% width for visibility
                              const sharePct = totalRevenue > 0 ? ((item.value / totalRevenue) * 100).toFixed(2) : '0';
                              
                              return (
                                <div 
                                  key={idx} 
	                                  className="group flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"
                                  title={`${item.label}: ${item.value.toLocaleString()} (${sharePct}% of total)`}
                                >
	                                  <div className="w-full flex-shrink-0 sm:w-40">
                                    <span className="text-sm font-medium text-foreground dark:text-foreground block" style={{ wordBreak: 'break-word' }}>
                                      {item.label}
                                    </span>
                                  </div>
                                  <div className="flex-1 h-8 bg-neutral-100 dark:bg-muted rounded-md overflow-hidden relative">
                                    <div 
                                      className={`h-full bg-gradient-to-r ${colors[idx % colors.length]} to-violet-400 rounded-md transition-all duration-200 group-hover:opacity-80`}
                                      style={{ width: `${minWidthPct}%`, minWidth: '10%' }}
                                    />
                                    {/* Inline tooltip on hover */}
                                    <div className="absolute inset-0 flex items-center justify-end pr-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                      <span className="text-xs font-semibold text-white drop-shadow-md">
                                        ${item.value.toLocaleString()} ({sharePct}%)
                                      </span>
                                    </div>
                                  </div>
	                                  <div className="w-full flex-shrink-0 text-left sm:w-28 sm:text-right">
                                    <span className="text-sm font-bold text-violet-600">
                                      ${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }
                }
                
                return null;
              })()}

              {/* Distribution Summary */}
              {(() => {
                const rawData = data;
                if (!rawData || rawData.length === 0) return null;
                
                const columns = Object.keys(rawData[0]);
                
                // Helper: check if column is a date
                const isDateColumn = (col: string): boolean => {
                  const val = rawData[0]?.[col];
                  if (!val) return false;
                  const strVal = String(val);
                  return !isNaN(Date.parse(strVal)) && (!!strVal.match(/\d{4}/) || !!strVal.match(/\d{2}[-/]\d{2}/));
                };
                
                // Helper: is numeric column (strict - no dates, no IDs, no rates)
                const isValidNumericColumn = (col: string): boolean => {
                  const lower = col.toLowerCase();
                  
                  // Exclude date columns
                  if (isDateColumn(col)) return false;
                  
                  // Exclude ID columns
                  if (/^id$|_id$|uuid|code|no$|number|index/i.test(col)) return false;
                  
                  // Exclude FX rate and exchange rate columns
                  if (/fx_rate|exchange_rate|rate_to|fx$|currency_rate/i.test(lower)) return false;
                  
                  // Exclude percentage columns
                  if (lower.includes('percent') || lower.includes('pct') || lower.includes('percentage')) return false;
                  
                  // Must have at least 5 valid positive numbers
                  let validCount = 0;
                  for (const row of rawData.slice(0, 30)) {
                    const val = row[col];
                    if (val === null || val === undefined || val === '') continue;
                    const num = parseFloat(String(val));
                    if (!isNaN(num) && isFinite(num) && num > 0) {
                      validCount++;
                    }
                  }
                  return validCount >= 5;
                };
                
                // Find proper numeric column with priority: revenue > sales > amount > profit
                const priorityKeywords = ['revenue', 'sales', 'amount', 'profit', 'value', 'income', 'total'];
                let numericCol: string | null = null;
                
                for (const kw of priorityKeywords) {
                  const found = columns.find(c => 
                    c.toLowerCase().includes(kw) && isValidNumericColumn(c)
                  );
                  if (found) {
                    numericCol = found;
                    break;
                  }
                }
                
                // Fallback to any valid numeric
                if (!numericCol) {
                  numericCol = columns.find(c => isValidNumericColumn(c)) || null;
                }
                
                const groupCol = columns.find(c => c !== numericCol && !isDateColumn(c));
                
                const _totalCategories = groupCol ? new Set(rawData.map(r => r[groupCol])).size : 0;
                const _totalValue = numericCol ? rawData.reduce((sum, r) => sum + (parseFloat(String(r[numericCol])) || 0), 0) : 0;
                
                // Format the label for display
                const _getMetricLabel = (col: string | null): string => {
                  if (!col) return 'Total Value';
                  const lower = col.toLowerCase();
                  if (lower.includes('revenue') || lower.includes('sales')) return 'Total Revenue';
                  if (lower.includes('profit')) return 'Total Profit';
                  if (lower.includes('amount')) return 'Total Amount';
                  if (lower.includes('cost')) return 'Total Cost';
                  return col.charAt(0).toUpperCase() + col.slice(1);
                };
                
                if (!numericCol) return null;
                  
                  return null;
                })()}
            </div>
          )}

          {/* Fallback for when no business analysis but raw data exists */}
          {(!analysis?.business_analysis?.breakdowns || 
            (typeof analysis.business_analysis.breakdowns === 'object' && 
             Object.keys(analysis.business_analysis.breakdowns).length === 0)) && 
           data && data.length > 0 && (
            <div className="space-y-6">
              <Card className="p-6 max-w-[900px] mx-auto w-full">
                <CardHeader>
                  <CardTitle>Auto-Generated Visualization</CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const columns = Object.keys(data[0] || {});
                    const numericCol = detectRevenueColumn(columns, data);
                    const groupCol = detectRegionColumn(columns) || detectCountryColumn(columns) || columns.find(c => c !== numericCol);
                    
                    if (!numericCol || !groupCol) {
                      return <p className="text-muted-foreground">Could not find suitable columns for visualization.</p>;
                    }
                    
                    const agg: Record<string, number> = {};
                    (data as Record<string, unknown>[]).forEach(r => {
                      const key = String(r[groupCol]) || 'Unknown';
                      const val = parseFloat(String(r[numericCol])) || 0;
                      if (val > 0) agg[key] = (agg[key] || 0) + val;
                    });
                    
                    const entries = Object.entries(agg)
                      .map(([label, value]) => ({ label, value }))
                      .filter(item => item.value > 0)
                      .sort((a, b) => b.value - a.value)
                      .slice(0, 8);
                    
                    if (entries.length === 0) return <p className="text-muted-foreground">No valid data found for visualization.</p>;
                    
                    const maxVal = Math.max(...entries.map(e => e.value));
                    const totalRevenue = entries.reduce((sum, e) => sum + e.value, 0);
                    
                    // Calculate gap based on number of bars
                    const barCount = entries.length;
                    const gap = barCount <= 4 ? 36 : barCount <= 6 ? 32 : 28;
                    const maxBarWidth = Math.min(90, Math.max(60, 600 / barCount));
                    
	                      return (
	                      <div className="h-[300px] min-w-[520px] overflow-x-auto flex items-end justify-center" style={{ gap: `${gap}px`, padding: '0 24px 16px' }}>
                        {entries.map((item, idx) => {
                          const heightPct = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
                          const minHeight = Math.max(heightPct, 5);
                          const sharePct = totalRevenue > 0 ? ((item.value / totalRevenue) * 100).toFixed(2) : '0';
                          
                          return (
                            <div 
                              key={idx} 
                              className="flex flex-col items-center justify-end h-full relative group"
                              style={{ width: `${maxBarWidth}px`, flexShrink: 0 }}
                            >
                              {/* Tooltip */}
	                              <div className="absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground opacity-0 shadow-xl transition-opacity pointer-events-none group-hover:opacity-100">
                                <div className="font-semibold">{item.label}</div>
	                                <div className="text-primary">${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                <div className="text-muted-foreground">{sharePct}% of total</div>
                              </div>
                              
                              <span className="text-xs font-semibold text-violet-600 mb-1.5 whitespace-nowrap">
                                ${item.value >= 1000000 ? `${(item.value / 1000000).toFixed(2)}M` : item.value >= 1000 ? `${(item.value / 1000).toFixed(2)}K` : item.value.toLocaleString()}
                              </span>
                              <div 
                                className="w-full bg-gradient-to-t from-violet-600 to-purple-400 rounded-t-md"
                                style={{ height: `${minHeight}%`, minHeight: '20px' }}
                              />
                              <span className="text-xs mt-2 text-center truncate w-full">{item.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Drilldown Panel */}
      {drilldownItem && (
	        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
	          <div className="max-h-[85vh] w-full max-w-[520px] overflow-hidden rounded-lg border border-border bg-card/95 shadow-2xl backdrop-blur-lg">
	            <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
	              <h2 className="break-words text-lg font-bold text-foreground sm:text-xl">{drilldownItem.title}</h2>
              <button 
                onClick={() => setDrilldownItem(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
	            <div className="max-h-[calc(85vh-80px)] space-y-4 overflow-y-auto p-4 sm:p-6">
              <div className="space-y-2">
                <p className="text-foreground">{drilldownItem.value}</p>
                {drilldownItem.type !== 'recommendation' && (
                  <p className="text-muted-foreground text-sm">{drilldownItem.explanation}</p>
                )}
              </div>
              
              {/* Supporting Data */}
              {drilldownItem.supportingData && drilldownItem.supportingData.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Details</h4>
                  <div className="space-y-1">
                    {drilldownItem.supportingData.map((item, idx) => (
	                      <div key={idx} className="flex flex-col gap-1 rounded-md bg-muted/40 px-3 py-2 text-sm text-foreground sm:flex-row sm:justify-between">
	                        <span className="text-muted-foreground">{item.label}</span>
	                        <span className="break-words font-medium sm:text-right">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Next Actions */}
              {drilldownItem.nextActions && drilldownItem.nextActions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Suggested Actions</h4>
                  <div className="space-y-1">
                    {drilldownItem.nextActions.map((action, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-amber-400">•</span>
                        <span className="text-foreground text-sm">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Helper Components for Overview Tab
// ============================================================================

interface Breakdowns {
  revenueByRegion?: Record<string, number>;
  revenueByProduct?: Record<string, number>;
}

// Geographic column detection
const GEOGRAPHIC_COLUMNS = ['country', 'region', 'city', 'market', 'location', 'state', 'province', 'territory', 'area', 'zone'];
const REVENUE_COLUMNS = ['revenue_eur', 'revenue', 'sales', 'amount', 'total_sales', 'net_sales', 'order_total', 'total'];

function detectGeographicColumns(columns: string[]): string | null {
  return columns.find(col => GEOGRAPHIC_COLUMNS.some(geo => col.toLowerCase().includes(geo))) || null;
}

function detectRevenueColumn(columns: string[]): string | null {
  return columns.find(col => REVENUE_COLUMNS.some(rev => col.toLowerCase().includes(rev))) || null;
}

function detectOrdersColumn(columns: string[]): string | null {
  return columns.find(col => /order|quantity|unit|count/i.test(col)) || null;
}

function detectGrowthColumn(columns: string[]): string | null {
  return columns.find(col => /growth|pct|percent|change/i.test(col)) || null;
}

function detectCategoryColumn(columns: string[]): string | null {
  return columns.find(col => /category|product|type|segment/i.test(col)) || null;
}

function detectProductColumn(columns: string[]): string | null {
  return columns.find(col => /product|item|name|description/i.test(col)) || null;
}

// World Map Chart component - shows interactive world map with revenue bubbles
function WorldMapChart({ 
  rawData,
  breakdowns,
  businessModel,
}: { 
  rawData?: any[]; 
  breakdowns?: Breakdowns;
  businessModel: BusinessModel;
}) {
  const [selectedRegion, setSelectedRegion] = React.useState<MapRegionData | null>(null);

  const mapData: MapRegionData[] = React.useMemo(() => {
    debugLog('[WorldMapChart] Processing map data...');

    if (rawData && rawData.length > 0) {
      const columns = Object.keys(rawData[0] || {});
      const geoCol = detectGeographicColumns(columns);
      const revenueCol = detectRevenueColumn(columns);
      const ordersCol = detectOrdersColumn(columns);
      const growthCol = detectGrowthColumn(columns);
      const categoryCol = detectCategoryColumn(columns);
      const productCol = detectProductColumn(columns);
      
      debugLog('[WorldMapChart] Detected columns:', { geoCol, revenueCol, ordersCol, growthCol, categoryCol, productCol });
      
      if (geoCol && revenueCol) {
        const agg: Record<string, { revenue: number; orders: number; growth: number | null; topCategory: string | undefined; topProduct: string | undefined }> = {};
        
        rawData.forEach(r => {
          const key = String(r[geoCol] || 'Unknown').trim() || 'Unknown';
          const revenue = parseFloat(String(r[revenueCol])) || 0;
          const orders = ordersCol ? (parseFloat(String(r[ordersCol])) || 0) : 0;
          const growth = growthCol ? (parseFloat(String(r[growthCol])) || null) : null;
          const category = categoryCol ? String(r[categoryCol] || '') : '';
          const product = productCol ? String(r[productCol] || '') : '';
          
          if (!agg[key]) {
            agg[key] = { revenue: 0, orders: 0, growth: null, topCategory: undefined, topProduct: undefined };
          }
          agg[key].revenue += revenue;
          agg[key].orders += orders;
          if (growth !== null) agg[key].growth = growth;
          if (category && !agg[key].topCategory) agg[key].topCategory = category;
          if (product && !agg[key].topProduct) agg[key].topProduct = product;
        });
        
        const result = Object.entries(agg)
          .map(([name, data]) => ({
            name,
            revenue: data.revenue,
            orders: data.orders,
            profit: data.revenue * 0.3, // Approximate
            margin: 30,
            growth: data.growth,
            topCategory: data.topCategory,
            topProduct: data.topProduct,
          }))
          .filter(item => item.revenue > 0)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 30);
        
        debugLog('[WorldMapChart] Aggregated from rawData - regions:', result.length);
        if (breakdowns?.revenueByRegion && Object.keys(breakdowns.revenueByRegion).length > 0) {
          return result.map((item) => ({
            ...item,
            revenue: breakdowns.revenueByRegion?.[item.name] ?? item.revenue,
          }))
        }
        return result
      }
    }
    
    debugLog('[WorldMapChart] No geographic column detected');
    return [];
  }, [rawData, breakdowns]);

  const handleRegionClick = (region: MapRegionData) => {
    setSelectedRegion(region);
  };

  const canRenderMap = shouldRenderWorldMapForBusinessModel({
    businessModel,
    mappedLocations: mapData,
  });

  if (!canRenderMap) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-background/40 p-4 text-sm text-muted-foreground">
        This dataset does not expose valid mapped locations for a world map.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <WorldMapRevenue 
        regions={mapData} 
        onRegionClick={handleRegionClick}
      />
      
      {selectedRegion && (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">{selectedRegion.name}</p>
              <p className="text-sm text-muted-foreground">
                Revenue: {selectedRegion.revenue?.toLocaleString()}
                {selectedRegion.orders ? ` • Orders: ${selectedRegion.orders.toLocaleString()}` : ''}
                {selectedRegion.growth !== null ? ` • Growth: ${selectedRegion.growth >= 0 ? '+' : ''}${selectedRegion.growth.toFixed(1)}%` : ''}
              </p>
              {selectedRegion.topCategory && (
                <p className="text-xs text-muted-foreground mt-1">
                  Top: {selectedRegion.topCategory}
                </p>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedRegion(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
