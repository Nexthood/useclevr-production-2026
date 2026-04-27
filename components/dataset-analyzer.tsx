"use client"

import * as React from "react"
import { 
  Sparkles, 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Lightbulb, 
  Table2,
  Loader2,
  MessageSquare,
  X,
  ChevronRight,
  Info,
  FileText
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GrokChatPanel } from "@/components/grok-chat-panel"
import { formatCurrencyForKPI, formatCurrencyCompact, formatPercentage, detectCurrencyFromColumn, formatCurrencyWithDecimals, formatCurrencySimple, formatPercentSimple } from "@/lib/formatting"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell 
} from "recharts"
import { BusinessOnePager } from "@/components/business-one-pager"

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
  }
  
  // AI Summary
  ai_summary?: string
}

interface DatasetAnalyzerProps {
  datasetId: string
  datasetName: string
  columns: string[]
  data: any[]
  rowCount: number
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
  initialIsAnalyzed = false,
  initialAnalysis
}: DatasetAnalyzerProps) {
  const [isAnalyzed, setIsAnalyzed] = React.useState(initialIsAnalyzed)
  const [analysis, setAnalysis] = React.useState<CSVAnalysisResult | null>(initialAnalysis || null)
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)
  const [showChat, setShowChat] = React.useState(false)
  const [revenueViewMode, setRevenueViewMode] = React.useState<'region' | 'country'>('region')
  const [countryDisplayMode, setCountryDisplayMode] = React.useState<'top' | 'all'>('top')
  const [autoProcessing, setAutoProcessing] = React.useState(!initialIsAnalyzed && data.length > 0)
  const [isGeneratingReport, setIsGeneratingReport] = React.useState(false)
  const [reportGenerated, setReportGenerated] = React.useState(false)
  
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
    console.log('[DatasetAnalyzer] Render count:', renderCount.current)
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
      console.error('Analysis failed:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Handle generate report action
  const handleGenerateReport = async () => {
    if (!analysis?.business_analysis?.kpis) {
      console.error('No analysis data available')
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
        console.log('Report generated:', result)
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
        console.error('Report generation failed')
        const errorText = await response.text()
        console.error('Error response:', errorText)
      }
    } catch (error) {
      console.error('Report generation error:', error)
    } finally {
      setIsGeneratingReport(false)
    }
  }

  // ============================================================================
  // Investigation Handler
  // ============================================================================
  const [investigationFindings, setInvestigationFindings] = React.useState<string[]>([])
  const [isInvestigating, setIsInvestigating] = React.useState(false)

  const handleInvestigate = async () => {
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
      console.error('Investigation failed:', error)
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
      <div className="flex flex-col items-center justify-center min-h-[600px]">
        <div className="w-full max-w-lg">
          {/* Processing state - no button, just auto-processing */}
          <div className="text-center py-12 px-8 bg-gradient-to-br from-violet-50/50 to-purple-50/50 dark:from-violet-950/20 dark:to-purple-950/20 rounded-2xl border border-violet-100 dark:border-violet-900">
            <div className="relative inline-block mb-6">
              <div className="h-16 w-16 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-violet-600 dark:text-violet-400 animate-spin" />
              </div>
              <div className="absolute inset-0 h-16 w-16 rounded-full bg-violet-200 dark:bg-violet-800 animate-ping opacity-20" />
            </div>
            
            <h2 className="text-2xl font-semibold mb-3 text-foreground">
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
      <div className="flex flex-col items-center justify-center min-h-[600px]">
        <div className="w-full max-w-lg">
          {/* Clean centered card */}
          <div className="text-center py-12 px-8 bg-gradient-to-br from-violet-50/50 to-purple-50/50 dark:from-violet-950/20 dark:to-purple-950/20 rounded-2xl border border-violet-100 dark:border-violet-900">
            <h2 className="text-2xl font-semibold mb-3 text-foreground">
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
    <div className="flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{datasetName}</h2>
          <p className="text-muted-foreground">
            {rowCount.toLocaleString()} rows • {columns.length} columns
          </p>
        </div>
        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Generate Report Button */}
          {analysis?.business_analysis?.kpis && (
            <Button 
              onClick={handleGenerateReport}
              disabled={isGeneratingReport}
              variant="outline"
              className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
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
          {/* Primary AI Chat Button */}
          <Button 
            onClick={() => setShowChat(true)}
            className="bg-gradient-primary hover:opacity-90"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Ask AI about this dataset
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mb-4 shrink-0">
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

          {/* KPI Cards - Premium Executive Grid (gated by capabilities) */}
          {analysis?.business_analysis?.kpis && (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
              {/* Total Revenue - Dominant Card */}
              {capabilities.revenueAvailable && analysis?.business_analysis?.kpis && (
                <div 
                  className="bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-xl p-5 flex flex-col justify-between min-h-[140px] border border-neutral-800 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-200 cursor-pointer group"
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
                  <span className="text-xs text-neutral-400 uppercase tracking-wider font-medium text-center group-hover:text-neutral-300 transition-colors">Total Revenue</span>
                  <div className="text-2xl font-bold text-white text-center leading-tight">
                    {analysis.business_analysis.kpis.totalRevenue 
                      ? formatCurrencyForKPI(analysis.business_analysis.kpis.totalRevenue)
                      : <span className="text-neutral-500">No data</span>}
                  </div>
                </div>
              )}
              
               {/* Total Profit */}
               {capabilities.profitAvailable && (
               <div 
                   className="bg-neutral-900 rounded-xl p-5 flex flex-col justify-between min-h-[140px] border border-neutral-800 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-200 cursor-pointer group"
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
                    <span className="text-xs text-neutral-400 uppercase tracking-wider font-medium text-center group-hover:text-neutral-300 transition-colors">Total Profit</span>
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
                        <div className="text-lg font-medium text-neutral-500">No Data</div>
                        <div className="text-caption text-neutral-600 mt-0.5">Cannot calculate profit</div>
                      </div>
                    )}
                  </div>
                </div>
               )}
               <div 
                  className="bg-neutral-900 rounded-xl p-5 flex flex-col justify-between min-h-[140px] border border-neutral-800 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-200 cursor-pointer group"
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
                 <span className="text-xs text-neutral-400 uppercase tracking-wider font-medium text-center group-hover:text-neutral-300 transition-colors">Margin</span>
                 <div className="text-2xl font-bold text-blue-400 text-center leading-tight">
                   {capabilities.profitAvailable && analysis.business_analysis.kpis.profitMargin !== null
                     ? formatPercentSimple(analysis.business_analysis.kpis.profitMargin)
                     : <span className="text-neutral-500">No data</span>}
                 </div>
               </div>
               
               {/* Top Region */}
               {capabilities.regionRankingAvailable && (
               <div 
                  className="bg-neutral-900 rounded-xl p-5 flex flex-col justify-between min-h-[140px] border border-neutral-800 hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-200 cursor-pointer group"
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
                 <span className="text-xs text-neutral-400 uppercase tracking-wider font-medium text-center group-hover:text-neutral-300 transition-colors">Top Region</span>
                 <div className="text-lg font-semibold text-orange-400 text-center break-words leading-tight">
                   {analysis.business_analysis.kpis.topRegions[0]?.name 
                     ? analysis.business_analysis.kpis.topRegions[0].percentage
                       ? `${analysis.business_analysis.kpis.topRegions[0].name} (${formatPercentSimple(analysis.business_analysis.kpis.topRegions[0].percentage)})`
                       : analysis.business_analysis.kpis.topRegions[0].name
                     : <span className="text-neutral-500">No data</span>}
                 </div>
                </div>
               )}
               
               {/* Top Product */}
               {capabilities.productRankingAvailable && (
               <div 
                  className="bg-neutral-900 rounded-xl p-5 flex flex-col justify-between min-h-[140px] border border-neutral-800 hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/5 transition-all duration-200 cursor-pointer group"
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
                 <span className="text-xs text-neutral-400 uppercase tracking-wider font-medium text-center group-hover:text-neutral-300 transition-colors">Top Product</span>
                 <div className="text-lg font-semibold text-violet-400 text-center break-words leading-tight">
                   {analysis.business_analysis.kpis.topProducts[0]?.name 
                     ? analysis.business_analysis.kpis.topProducts[0].percentage
                       ? `${analysis.business_analysis.kpis.topProducts[0].name} (${formatPercentSimple(analysis.business_analysis.kpis.topProducts[0].percentage)})`
                       : analysis.business_analysis.kpis.topProducts[0].name
                     : <span className="text-neutral-500">No data</span>}
                 </div>
                </div>
               )}
               
               {/* Growth */}
               {capabilities.trendAvailable && analysis.business_analysis.kpis.growthValid && (
                   <div 
                     className="bg-neutral-900 rounded-xl p-5 flex flex-col justify-between min-h-[140px] border border-neutral-800 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/5 transition-all duration-200 cursor-pointer group"
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
                   <span className="text-xs text-neutral-400 uppercase tracking-wider font-medium text-center group-hover:text-neutral-300 transition-colors">Growth</span>
                   <div className={`text-2xl font-bold text-center leading-tight ${analysis.business_analysis.kpis.growthPercentage !== null && analysis.business_analysis.kpis.growthPercentage >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                     {analysis.business_analysis.kpis.growthPercentage !== null
                       ? formatPercentage(analysis.business_analysis.kpis.growthPercentage)
                       : <span className="text-neutral-500">No data</span>}
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
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base">Executive Financial Summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-neutral-300 space-y-2">
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
            <div className="border-t border-neutral-800 my-6" />
          )}

          {/* AI Executive Summary (gated by capabilities and available metrics) */}
          {(() => {
            if (!analysis?.ai_summary) return false
            const k = analysis?.business_analysis?.kpis
            const anyMetric = capabilities.revenueAvailable || capabilities.profitAvailable || (capabilities.trendAvailable && !!k?.growthPercentage && !!k?.growthValid) || (capabilities.productRankingAvailable && (k?.topProducts?.length || 0) > 0) || (capabilities.regionRankingAvailable && (k?.topRegions?.length || 0) > 0)
            return anyMetric
          })() && (
            <Card className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 border border-neutral-700 shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Sparkles className="h-5 w-5 text-purple-400" />
                  Executive Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base text-neutral-200 leading-relaxed">
                  {(() => {
                    const sentences = analysis.ai_summary.split('.').slice(0, 2).join('.');
                    return sentences.endsWith('.') ? sentences : sentences + '.';
                  })()}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Section Divider */}
          {analysis?.ai_summary && (
            <div className="border-t border-neutral-800 my-6" />
          )}

          {/* Key Drivers */}
          {analysis?.business_analysis?.kpis && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {capabilities.productRankingAvailable && analysis.business_analysis.kpis.topProducts.length > 0 && (
                <Card className="bg-neutral-900 border-neutral-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-base">Top Products</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-1">
                      {analysis.business_analysis.kpis.topProducts.slice(0, 10).map((item, idx) => (
                        <div 
                          key={idx} 
                          className={`flex items-center justify-between p-3 rounded-lg ${idx === 0 ? 'bg-neutral-800 border border-violet-500/30' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-medium ${idx === 0 ? 'text-violet-400' : 'text-neutral-400'}`}>
                              {idx + 1}.
                            </span>
                            <span className={`font-medium truncate ${idx === 0 ? 'text-white' : 'text-neutral-300'}`}>
                              {item.name}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className={`font-semibold ${idx === 0 ? 'text-violet-400' : 'text-neutral-400'}`}>
                              ${item.revenue.toLocaleString()}
                            </div>
                            <div className="text-xs text-neutral-500">
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
                <Card className="bg-neutral-900 border-neutral-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-base">Revenue by Region/Country</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {/* Debug: Log the data */}
                    <DebugRegionData 
                      topRegions={analysis.business_analysis.kpis.topRegions} 
                      breakdowns={analysis.business_analysis.breakdowns}
                      rawData={data}
                    />
                    
                    {/* Use breakdowns.revenueByRegion directly - contains ALL regions */}
                    <RegionBarChart 
                      rawData={data} 
                      fallbackData={analysis.business_analysis.kpis.topRegions}
                      breakdowns={analysis.business_analysis.breakdowns}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Section Divider */}
          {analysis?.business_analysis?.kpis && (analysis.business_analysis.kpis.topProducts.length > 0 || analysis.business_analysis.kpis.topRegions.length > 0) && (
            <div className="border-t border-neutral-800 my-6" />
          )}

           {/* Insights - Using Validated Metrics Layer */}
           {validatedInsights.length > 0 && (
             <Card className="bg-neutral-900 border-neutral-800">
               <CardHeader className="pb-3">
                 <CardTitle className="text-white flex items-center gap-2 text-base">
                   <Lightbulb className="h-4 w-4 text-amber-400" />
                   Business Insights
                 </CardTitle>
               </CardHeader>
               <CardContent className="pt-0">
                 <ul className="space-y-2">
                   {validatedInsights.map((insight, idx) => (
                     <li 
                       key={idx} 
                       className="flex items-start gap-3 text-neutral-300 cursor-pointer hover:bg-neutral-800/50 rounded-lg p-2 transition-colors"
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
                         <div>{insight.message}</div>
                         <div className="text-xs mt-1">
                           <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                             insight.reliability === 'verified' ? 'bg-emerald-900/30 text-emerald-400' :
                             insight.reliability === 'estimated' ? 'bg-amber-900/30 text-amber-400' :
                             'bg-neutral-700 text-neutral-400'
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
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  Recommended Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                 <div className="space-y-3">
                   {validatedRecommendations.slice(0, 4).map((rec, idx) => (
                     <div 
                       key={idx} 
                       className="border-l-2 border-emerald-500 pl-4 py-3 hover:bg-neutral-800/50 rounded-r-lg transition-colors cursor-pointer group"
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
                       <div className="font-semibold text-white group-hover:text-emerald-400 transition-colors">{rec.action}</div>
                       <div className="text-sm text-neutral-400 mt-1">{rec.reason}</div>
                       <div className="text-xs mt-2">
                         <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                           rec.reliability === 'verified' ? 'bg-emerald-900/30 text-emerald-400' :
                           rec.reliability === 'estimated' ? 'bg-amber-900/30 text-amber-400' :
                           'bg-neutral-700 text-neutral-400'
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
                  <div className="mt-4 pt-4 border-t border-neutral-800">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingDown className="h-4 w-4 text-red-400" />
                      <span className="text-sm font-medium text-red-400">Products with Negative Profit</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {analysis?.business_analysis?.kpis?.worstProducts?.slice(0, 5).map((product, idx) => (
                        <div key={idx} className="px-3 py-1.5 rounded-full bg-red-950/30 border border-red-900 text-xs text-red-300">
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
                className="bg-violet-600 hover:bg-violet-700"
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
            <div className="text-center py-16 bg-neutral-50 dark:bg-neutral-900 rounded-xl">
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
                
                console.log('[Overview] Using regionData:', regionData ? regionData.length + ' entries' : 'null');
                console.log('[Overview] revenueByRegion keys:', breakdowns.revenueByRegion ? Object.keys(breakdowns.revenueByRegion) : 'none');
                
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
                  
                  console.log('Overview aggregated revenue data:', entries);
                  
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
                          <div className="flex items-center justify-between flex-wrap gap-3">
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
                            
                            <div className="flex items-center gap-2">
                              {/* Region/Country Toggle */}
                              <div className="flex bg-muted rounded-lg p-1">
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
                              : "h-[320px] flex items-end justify-center"
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
                                  <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap z-10 pointer-events-none">
                                    <div className="font-semibold">{item.label}</div>
                                    <div className="text-purple-300">${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                    <div className="text-neutral-400">{sharePct}% of total</div>
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
                          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                            {entries.map((item, idx) => {
                              const widthPct = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
                              const minWidthPct = Math.max(widthPct, 10); // Minimum 10% width for visibility
                              const sharePct = totalRevenue > 0 ? ((item.value / totalRevenue) * 100).toFixed(2) : '0';
                              
                              return (
                                <div 
                                  key={idx} 
                                  className="flex items-center gap-4 group"
                                  title={`${item.label}: ${item.value.toLocaleString()} (${sharePct}% of total)`}
                                >
                                  <div className="w-40 flex-shrink-0">
                                    <span className="text-sm font-medium text-foreground dark:text-neutral-200 block" style={{ wordBreak: 'break-word' }}>
                                      {item.label}
                                    </span>
                                  </div>
                                  <div className="flex-1 h-8 bg-neutral-100 dark:bg-neutral-800 rounded-md overflow-hidden relative">
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
                                  <div className="w-28 flex-shrink-0 text-right">
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
                
                const totalCategories = groupCol ? new Set(rawData.map(r => r[groupCol])).size : 0;
                const totalValue = numericCol ? rawData.reduce((sum, r) => sum + (parseFloat(String(r[numericCol])) || 0), 0) : 0;
                
                // Format the label for display
                const getMetricLabel = (col: string | null): string => {
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
                      <div className="h-[300px] flex items-end justify-center" style={{ gap: `${gap}px`, padding: '0 24px 16px' }}>
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
                              <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap z-10 pointer-events-none">
                                <div className="font-semibold">{item.label}</div>
                                <div className="text-purple-300">${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                <div className="text-neutral-400">{sharePct}% of total</div>
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

      <GrokChatPanel
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        datasetId={datasetId}
        datasetName={datasetName}
        rowCount={rowCount}
        columnCount={columns.length}
        data={data}
        columns={columns}
        // UNIFIED: Pass pre-computed analysis to AI chat
        analysis={analysis?.business_analysis}
      />

      {/* Drilldown Panel */}
      {drilldownItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-neutral-900/90 backdrop-blur-lg border border-neutral-800 rounded-xl w-[90%] max-w-[500px] max-h-[80vh] overflow-hidden">
            <div className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">{drilldownItem.title}</h2>
              <button 
                onClick={() => setDrilldownItem(null)}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(80vh-80px)]">
              <div className="space-y-2">
                <p className="text-neutral-300">{drilldownItem.value}</p>
                {drilldownItem.type !== 'recommendation' && (
                  <p className="text-neutral-400 text-sm">{drilldownItem.explanation}</p>
                )}
              </div>
              
              {/* Supporting Data */}
              {drilldownItem.supportingData && drilldownItem.supportingData.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-neutral-300">Details</h4>
                  <div className="space-y-1">
                    {drilldownItem.supportingData.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-neutral-200 text-sm">
                        <span>{item.label}</span>
                        <span>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Next Actions */}
              {drilldownItem.nextActions && drilldownItem.nextActions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-neutral-300">Suggested Actions</h4>
                  <div className="space-y-1">
                    {drilldownItem.nextActions.map((action, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-amber-400">•</span>
                        <span className="text-neutral-200 text-sm">{action}</span>
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

interface RegionData {
  name: string;
  revenue: number;
  percentage: number;
}

interface Breakdowns {
  revenueByRegion?: Record<string, number>;
  revenueByProduct?: Record<string, number>;
}

// Debug component - logs data to console
function DebugRegionData({ 
  topRegions, 
  breakdowns, 
  rawData 
}: { 
  topRegions: RegionData[]; 
  breakdowns?: Breakdowns;
  rawData?: any[];
}) {
  React.useEffect(() => {
    console.log('[Overview] topRegions (from kpis):', topRegions);
    console.log('[Overview] breakdowns.revenueByRegion:', breakdowns?.revenueByRegion);
    console.log('[Overview] raw data sample:', rawData?.slice(0, 3));
    if (rawData && rawData.length > 0) {
      console.log('[Overview] raw data columns:', Object.keys(rawData[0]));
    }
  }, [topRegions, breakdowns, rawData]);
  return null; // Render nothing
}

// Recharts BarChart component for revenue by region
function RegionBarChart({ 
  rawData, 
  fallbackData,
  breakdowns
}: { 
  rawData?: any[]; 
  fallbackData: RegionData[];
  breakdowns?: Breakdowns;
}) {
  // Aggregate data from raw dataset - show ALL regions, not just top 5
  const chartData = React.useMemo(() => {
    console.log('[RegionBarChart] rawData length:', rawData?.length);
    console.log('[RegionBarChart] fallbackData length:', fallbackData?.length);
    console.log('[RegionBarChart] breakdowns.revenueByRegion:', breakdowns?.revenueByRegion);
    
    // FIRST: Use breakdowns.revenueByRegion if available - this has ALL regions computed correctly
    if (breakdowns?.revenueByRegion && Object.keys(breakdowns.revenueByRegion).length > 0) {
      const entries = Object.entries(breakdowns.revenueByRegion)
        .map(([name, revenue]) => ({ name, revenue }))
        .filter(item => item.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue);
      
      console.log('[RegionBarChart] Using breakdowns - ALL regions:', entries.length);
      return entries;
    }
    
    // SECOND: Try to aggregate from rawData
    if (rawData && rawData.length > 0) {
      const columns = Object.keys(rawData[0] || {});
      console.log('[RegionBarChart] Available columns:', columns);
      
      // Find country/region column
      const countryCol = columns.find(c => /country/i.test(c));
      const regionCol = columns.find(c => /region|area|zone|market|territory/i.test(c));
      
      // Find revenue column - check all variations
      const revenueCol = columns.find(c => 
        /revenue|sales|amount|total|value/i.test(c) ||
        c.toLowerCase().includes('net_revenue') ||
        c.toLowerCase().includes('order_total')
      );
      
      console.log('[RegionBarChart] Detected columns:', { countryCol, regionCol, revenueCol });
      
      const groupCol = countryCol || regionCol;
      
      if (groupCol && revenueCol) {
        // Aggregate ALL data from rawData - NO LIMIT
        const agg: Record<string, number> = {};
        rawData.forEach(r => {
          const key = String(r[groupCol] || 'Unknown');
          const val = parseFloat(String(r[revenueCol])) || 0;
          if (val > 0) agg[key] = (agg[key] || 0) + val;
        });
        
        const result = Object.entries(agg)
          .map(([name, revenue]) => ({ name, revenue }))
          .filter(item => item.revenue > 0)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 20); // Increased to 20 to show more regions
        
        console.log('[RegionBarChart] Aggregated from rawData - ALL regions:', result);
        console.log('[RegionBarChart] Total unique regions:', result.length);
        return result;
      }
    }
    
    // Fallback to topRegions only if rawData fails
    console.log('[RegionBarChart] Using fallback - rawData not available or columns not detected');
    const result = fallbackData.map(item => ({
      name: item.name,
      revenue: item.revenue,
    }));
    console.log('[RegionBarChart] Fallback result:', result);
    return result;
  }, [rawData, fallbackData, breakdowns]);
  
  console.log('[RegionBarChart] FINAL chartData:', chartData);
  console.log('[RegionBarChart] Rendering', chartData.length, 'bars');
  
  console.log('[RegionBarChart] Final chartData:', chartData);
  
  // Colors for bars
  const COLORS = ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5', '#fff7ed', '#fbbf24', '#f59e0b', '#ea580c', '#c2410c'];
  
  if (chartData.length === 0) {
    return <div className="text-neutral-500">No region data available</div>;
  }
  
  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={chartData} 
          layout="vertical"
          margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={true} vertical={false} />
          <XAxis 
            type="number" 
            stroke="#9ca3af" 
            fontSize={12}
            tickFormatter={(value) => `${value >= 1000 ? `${(value/1000).toFixed(2)}K` : value}`}
          />
          <YAxis 
            type="category" 
            dataKey="name" 
            stroke="#9ca3af" 
            fontSize={12}
            width={75}
            tick={{ fill: '#d1d5db' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1f2937', 
              border: '1px solid #374151', 
              borderRadius: '8px',
              color: '#fff'
            }}
            formatter={(value) => [`${(value as number)?.toLocaleString() || 0}`, 'Revenue']}
            labelStyle={{ color: '#fff', fontWeight: 600 }}
          />
          <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
