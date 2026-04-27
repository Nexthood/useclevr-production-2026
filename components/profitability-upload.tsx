"use client"

import * as React from "react"
import { Upload, FileSpreadsheet, DollarSign, Receipt, Loader2, CheckCircle2, AlertCircle, Plus, X, ArrowRight, TrendingUp, TrendingDown, BarChart3, Sparkles, Table2, FileText, MessageSquare, Lightbulb } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { uploadCSV } from "@/app/actions/upload"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCurrencyForKPI, formatPercentSimple, formatPercentage } from "@/lib/formatting"
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

interface UploadedFile {
  name: string
  type: "revenue" | "expense"
  data?: any[]
  columns?: string[]
  rowCount?: number
}

export function ProfitabilityUpload() {
  const [revenueFile, setRevenueFile] = React.useState<UploadedFile | null>(null)
  const [expenseFile, setExpenseFile] = React.useState<UploadedFile | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const [dragActive, setDragActive] = React.useState<"revenue" | "expense" | null>(null)
  const [profitabilityResult, setProfitabilityResult] = React.useState<any>(null)
  const [isGeneratingReport, setIsGeneratingReport] = React.useState(false)
  const [reportGenerated, setReportGenerated] = React.useState(false)
  const [activeSection, setActiveSection] = React.useState<string | null>(null)
  const { toast } = useToast()

  // Handle generate report action
  const handleGenerateReport = async () => {
    if (!profitabilityResult) {
      console.error('[REPORT] No profitability result available')
      toast({ title: "Error", description: "No analysis data available", variant: "destructive" })
      return
    }
    
    setIsGeneratingReport(true)
    setReportGenerated(false)
    
    try {
      console.log('[REPORT] Generating report for profitability analysis')
      
      const kpis = {
        totalRevenue: profitabilityResult.totalRevenue || 0,
        totalExpenses: profitabilityResult.totalExpenses || 0,
        profit: profitabilityResult.profit || 0,
        margin: profitabilityResult.margin || 0,
      }
      
      // Get user's timezone
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      const timezoneOffset = new Date().getTimezoneOffset()
      
      // Format KPIs for report
      const reportKPIs = [
        { title: 'Total Revenue', value: kpis.totalRevenue, format: 'currency' },
        { title: 'Total Expenses', value: kpis.totalExpenses, format: 'currency' },
        { title: 'Net Profit', value: kpis.profit, format: 'currency' },
        { title: 'Profit Margin', value: kpis.margin, format: 'percentage' },
      ].filter(k => k.value !== null && k.value !== 0)
      
      // Format charts data
      const charts: { type: 'bar' | 'line' | 'pie'; title: string; data: { name: string; value: number }[] }[] = []
      
      // Expense distribution chart
      if (profitabilityResult.expenseCategories) {
        const expenseData = profitabilityResult.expenseCategories
          .map(([name, value]: [string, number]) => ({ name, value }))
          .sort((a: { value: number }, b: { value: number }) => b.value - a.value)
          .slice(0, 8)
        if (expenseData.length > 0) {
          charts.push({
            type: 'bar' as const,
            title: 'Expense Distribution',
            data: expenseData
          })
        }
      }
      
      // Revenue by product chart
      if (profitabilityResult.revenueByProduct) {
        const productData = profitabilityResult.revenueByProduct
          .map(([name, value]: [string, number]) => ({ name, value }))
          .sort((a: { value: number }, b: { value: number }) => b.value - a.value)
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
      if (profitabilityResult.revenueByRegion) {
        const regionData = profitabilityResult.revenueByRegion
          .map(([name, value]: [string, number]) => ({ name, value }))
          .sort((a: { value: number }, b: { value: number }) => b.value - a.value)
          .slice(0, 8)
        if (regionData.length > 0) {
          charts.push({
            type: 'bar' as const,
            title: 'Revenue by Region',
            data: regionData
          })
        }
      }
      
      // Build insights and recommendations
      const insights: string[] = []
      const recommendations: string[] = []
      
      if (kpis.totalRevenue > 0) {
        insights.push(`Total revenue: ${formatCurrencyForKPI(kpis.totalRevenue)}`)
      }
      if (kpis.totalExpenses > 0) {
        insights.push(`Total expenses: ${formatCurrencyForKPI(kpis.totalExpenses)}`)
      }
      if (kpis.profit !== 0) {
        const profitLabel = kpis.profit >= 0 ? 'profit' : 'loss'
        insights.push(`Net ${profitLabel}: ${formatCurrencyForKPI(Math.abs(kpis.profit))}`)
      }
      if (kpis.margin !== 0) {
        insights.push(`Profit margin: ${formatPercentSimple(kpis.margin)}`)
      }
      
      if (profitabilityResult.expenseCategories?.[0]) {
        const topCat = profitabilityResult.expenseCategories[0]
        const totalExpenses = profitabilityResult.expenseCategories.reduce((sum: number, [_, val]: [string, number]) => sum + val, 0)
        const pct = ((topCat[1] as number) / totalExpenses * 100).toFixed(1)
        insights.push(`Top expense: ${topCat[0]} at ${formatCurrencyForKPI(topCat[1] as number)} (${pct}%)`)
      }
      
      // Generate recommendations based on margin
      if (kpis.margin < 0) {
        recommendations.push('Review cost structure immediately - negative margin indicates unsustainable operations')
      } else if (kpis.margin < 10) {
        recommendations.push('Analyze cost reduction opportunities - low margin leaves little room for error')
      } else if (kpis.margin > 30) {
        recommendations.push('Consider strategic reinvestment - strong margin enables growth investments')
      }
      
      if (profitabilityResult.expenseCategories && profitabilityResult.expenseCategories.length > 3) {
        recommendations.push('Focus on top 3 expense categories - they represent the majority of costs')
      }
      
      const datasetName = 'Profitability Analysis'
      const datasetId = 'profitability-demo'
      
      console.log('[REPORT] Sending report request with:', { datasetId, datasetName, kpis, charts: charts.length })
      
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetId,
          datasetName,
          timezone: userTimezone,
          timezoneOffset,
          summary: kpis.profit >= 0 
            ? `Profitability analysis showing ${formatCurrencyForKPI(kpis.totalRevenue)} revenue, ${formatCurrencyForKPI(kpis.totalExpenses)} expenses, ${formatCurrencyForKPI(kpis.profit)} net profit (${formatPercentSimple(kpis.margin)} margin)`
            : `Profitability analysis showing ${formatCurrencyForKPI(kpis.totalRevenue)} revenue, ${formatCurrencyForKPI(kpis.totalExpenses)} expenses, ${formatCurrencyForKPI(Math.abs(kpis.profit))} net loss`,
          findings: recommendations,
          kpis: reportKPIs,
          charts,
          aiInsights: insights,
          predictions: [],
          alerts: [],
          rowCount: (revenueFile?.rowCount || 0) + (expenseFile?.rowCount || 0),
          columns: (revenueFile?.columns?.length || 0) + (expenseFile?.columns?.length || 0)
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log('[REPORT] Report generated:', result)
        setReportGenerated(true)
        
        if (result.reportId) {
          sessionStorage.setItem('lastGeneratedReportId', result.reportId)
        }
        
        toast({ title: "Report generated", description: "Your report is ready" })
        
        // Navigate to downloads after a short delay
        setTimeout(() => {
          window.location.href = '/app/downloads'
        }, 1500)
      } else {
        const errorText = await response.text()
        console.error('[REPORT] Report generation failed:', errorText)
        toast({ title: "Error", description: "Failed to generate report", variant: "destructive" })
      }
    } catch (error) {
      console.error('[REPORT] Error:', error)
      toast({ title: "Error", description: "Failed to generate report", variant: "destructive" })
    } finally {
      setIsGeneratingReport(false)
    }
  }

  // Current step (1, 2, or 3)
  const currentStep = revenueFile && expenseFile ? 3 : revenueFile || expenseFile ? 2 : 1

  const handleDrag = (e: React.DragEvent, type: "revenue" | "expense") => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(type)
    } else if (e.type === "dragleave") {
      setDragActive(null)
    }
  }

  const handleDrop = async (e: React.DragEvent, type: "revenue" | "expense") => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(null)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0], type)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: "revenue" | "expense") => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0], type)
    }
  }

  const processFile = async (file: File, type: "revenue" | "expense") => {
    if (!file.name.endsWith(".csv")) {
      toast({ title: "Invalid file", description: "Please upload a CSV file", variant: "destructive" })
      return
    }

    setIsUploading(true)

    try {
      const text = await file.text()
      const { data, meta } = parseCSV(text)
      
      const uploadedFile: UploadedFile = {
        name: file.name,
        type,
        data: data, // Use full data, not just preview
        columns: meta.fields || [],
        rowCount: data.length
      }

      if (type === "revenue") {
        setRevenueFile(uploadedFile)
      } else {
        setExpenseFile(uploadedFile)
      }

      toast({ 
        title: `${type === "revenue" ? "Revenue" : "Expense"} file loaded`,
        description: `${file.name} (${data.length} rows)`
      })
    } catch (error) {
      console.error("File processing error:", error)
      toast({ title: "Error", description: "Failed to process file", variant: "destructive" })
    } finally {
      setIsUploading(false)
    }
  }

  const parseCSV = (text: string): { data: any[], meta: { fields: string[] } } => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return { data: [], meta: { fields: [] } }
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    const data = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
      const row: any = {}
      headers.forEach((header, idx) => {
        row[header] = values[idx] || ''
      })
      return row
    })
    
    return { data, meta: { fields: headers } }
  }

  // Smart column detection for common real-world business file formats
  // Supports: Stripe, Shopify, QuickBooks, Xero, Wave, Excel exports, manual trackers
  
  const detectAmountColumn = (columns: string[]): { column: string | null; confidence: number } => {
    // Priority patterns for different file types
    const patterns = {
      // Revenue/income patterns (highest priority for revenue files)
      revenue: [
        'amount', 'revenue', 'sales', 'total', 'income', 'subtotal', 'gross',
        'net_amount', 'order_total', 'total_usd', 'amount_usd', 'price',
        'gross_revenue', 'net_revenue', 'processed_amount'
      ],
      // Expense/cost patterns
      expense: [
        'amount', 'cost', 'expense', 'total', 'debit', 'outflow',
        'amount_usd', 'total_usd', 'price', 'unit_cost', 'cost_of_goods'
      ]
    }

    const isExpense = expenseFile !== null
    const searchPatterns = isExpense ? patterns.expense : patterns.revenue

    // First, look for exact or close matches
    for (const pattern of searchPatterns) {
      for (const col of columns) {
        const lower = col.toLowerCase().replace(/[^a-z0-9]/g, '')
        const patternNorm = pattern.toLowerCase().replace(/[^a-z0-9]/g, '')
        
        // Exact match
        if (lower === patternNorm) {
          return { column: col, confidence: 1.0 }
        }
        // Contains match
        if (lower.includes(patternNorm) || patternNorm.includes(lower)) {
          return { column: col, confidence: 0.8 }
        }
      }
    }

    // Second, look for any amount-like column (numeric with decimal)
    const amountPatterns = ['amount', 'total', 'sum', 'value', 'price', 'cost', 'revenue', 'income', 'expense']
    for (const col of columns) {
      const lower = col.toLowerCase()
      if (amountPatterns.some(p => lower.includes(p))) {
        return { column: col, confidence: 0.6 }
      }
    }

    // Fallback: return first column if none found
    return { column: columns[0] || null, confidence: 0.3 }
  }

  const detectDateColumn = (columns: string[]): string | null => {
    // Common date column names across platforms
    const datePatterns = [
      'date', 'created', 'transaction_date', 'posted_date', 'order_date',
      'invoice_date', 'due_date', 'period', 'month', 'year',
      'transaction_date_utc', 'created_at', 'updated_at'
    ]

    for (const col of columns) {
      const lower = col.toLowerCase().replace(/[^a-z]/g, '')
      for (const pattern of datePatterns) {
        if (lower.includes(pattern) || pattern.includes(lower)) {
          return col
        }
      }
    }

    // Check for date-like format in column names
    const dateLike = ['date', 'time', 'day', 'month', 'year'].filter(p => 
      columns.some(c => c.toLowerCase().includes(p))
    )
    if (dateLike.length > 0) {
      return columns.find(c => c.toLowerCase().includes(dateLike[0])) || null
    }

    return null
  }

  // Detect common business category columns
  const detectCategoryColumn = (columns: string[]): string | null => {
    const categoryPatterns = [
      'category', 'type', 'department', 'description', 'item', 'product_name',
      'sku', 'service', 'vendor', 'merchant', 'account', 'tag', 'label',
      'income_type', 'expense_type', 'cost_center', 'business_type'
    ]

    for (const col of columns) {
      const lower = col.toLowerCase().replace(/[^a-z]/g, '')
      for (const pattern of categoryPatterns) {
        if (lower.includes(pattern)) {
          return col
        }
      }
    }

    return null
  }

  // Detect region/customer columns
  const detectRegionColumn = (columns: string[]): string | null => {
    const regionPatterns = [
      'region', 'country', 'city', 'state', 'location', 'territory',
      'area', 'market', 'zone', 'customer_region', 'billing_country',
      'customer', 'client', 'company', 'account_name'
    ]

    for (const col of columns) {
      const lower = col.toLowerCase().replace(/[^a-z]/g, '')
      for (const pattern of regionPatterns) {
        if (lower.includes(pattern)) {
          return col
        }
      }
    }

    return null
  }

  const calculateTotals = () => {
    let totalRevenue = 0
    let totalExpenses = 0
    let revenueDateCol: string | null = null
    let expenseDateCol: string | null = null
    const expenseCategories: Record<string, number> = {}
    const revenueByProduct: Record<string, number> = {}
    const revenueByRegion: Record<string, number> = {}
    const revenueByMonth: Record<string, number> = {}

    // Process revenue file
    if (revenueFile?.data) {
      const amountInfo = detectAmountColumn(revenueFile.columns || [])
      const amountCol = amountInfo.column
      revenueDateCol = detectDateColumn(revenueFile.columns || [])
      const categoryCol = detectCategoryColumn(revenueFile.columns || [])
      const regionCol = detectRegionColumn(revenueFile.columns || [])
      
      for (const row of revenueFile.data) {
        // Parse amount - handle currency symbols, negative values in parentheses
        let val = 0
        const rawVal = row[amountCol || '']
        if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
          const strVal = String(rawVal).replace(/[^0-9.-]/g, '')
          val = parseFloat(strVal)
        }
        if (!isNaN(val) && val > 0) {
          totalRevenue += val
          
          // Group by product/category
          if (categoryCol && row[categoryCol]) {
            const cat = String(row[categoryCol]).slice(0, 30)
            revenueByProduct[cat] = (revenueByProduct[cat] || 0) + val
          }
          
          // Group by region
          if (regionCol && row[regionCol]) {
            const reg = String(row[regionCol]).slice(0, 30)
            revenueByRegion[reg] = (revenueByRegion[reg] || 0) + val
          }
          
          // Group by month if date available
          if (revenueDateCol && row[revenueDateCol]) {
            const dateStr = String(row[revenueDateCol])
            const monthMatch = dateStr.match(/(\d{4})-(\d{2})/)
            if (monthMatch) {
              const monthKey = `${monthMatch[1]}-${monthMatch[2]}`
              revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + val
            }
          }
        }
      }
    }

    // Process expense file
    if (expenseFile?.data) {
      const amountInfo = detectAmountColumn(expenseFile.columns || [])
      const amountCol = amountInfo.column
      expenseDateCol = detectDateColumn(expenseFile.columns || [])
      const categoryCol = detectCategoryColumn(expenseFile.columns || [])

      for (const row of expenseFile.data) {
        // Parse amount - handle currency symbols, negative values
        let val = 0
        const rawVal = row[amountCol || '']
        if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
          // Handle negative values or parentheses for expenses
          let strVal = String(rawVal).replace(/[^0-9.-]/g, '')
          // If in parentheses (accounting format), make positive for our purposes
          if (String(rawVal).includes('(') && String(rawVal).includes(')')) {
            strVal = '-' + strVal
          }
          val = parseFloat(strVal)
        }
        // For expenses, we want the absolute value for category totals
        const absVal = Math.abs(val)
        if (!isNaN(absVal) && absVal > 0) {
          totalExpenses += absVal
          
          // Group by category
          if (categoryCol && row[categoryCol]) {
            const cat = String(row[categoryCol]).slice(0, 30)
            expenseCategories[cat] = (expenseCategories[cat] || 0) + absVal
          }
        }
      }
    }

    // Calculate derived metrics
    const profit = totalRevenue - totalExpenses
    const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0

    // Sort and limit results
    const sortedExpenses = Object.entries(expenseCategories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
    
    const sortedRevenueByProduct = Object.entries(revenueByProduct)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
    
    const sortedRevenueByRegion = Object.entries(revenueByRegion)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)

    return {
      totalRevenue,
      totalExpenses,
      profit,
      margin,
      hasRevenue: !!revenueFile,
      hasExpenses: !!expenseFile,
      revenueDateCol,
      expenseDateCol,
      expenseCategories: sortedExpenses,
      revenueByProduct: sortedRevenueByProduct,
      revenueByRegion: sortedRevenueByRegion,
      revenueByMonth,
      canMatchPeriods: !!(revenueDateCol && expenseDateCol),
      hasDateData: !!(revenueDateCol || expenseDateCol)
    }
  }

  const stats = calculateTotals()

  const formatCurrency = (val: number): string => {
    if (Math.abs(val) >= 1000000) return `$${(val / 1000000).toFixed(1)}M`
    if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(1)}K`
    return `$${val.toFixed(0)}`
  }

  const handleGenerate = async () => {
    if (!revenueFile && !expenseFile) {
      toast({ title: "No files", description: "Please upload at least one file", variant: "destructive" })
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      
      const primaryFile = revenueFile || expenseFile
      if (primaryFile) {
        const headers = primaryFile.columns || []
        const csvContent = [
          headers.join(','),
          ...(primaryFile.data || []).map(row => 
            headers.map(h => row[h] || '').join(',')
          )
        ].join('\n')
        
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const file = new File([blob], primaryFile.name, { type: 'text/csv' })
        formData.append('file', file)
        
        formData.append('datasetName', `Profitability - ${new Date().toLocaleDateString()}`)
        formData.append('fileType', revenueFile && expenseFile ? 'profitability_both' : revenueFile ? 'profitability_revenue' : 'profitability_expense')
        
        if (revenueFile) {
          formData.append('revenueColumns', JSON.stringify(revenueFile.columns))
          formData.append('revenueRowCount', String(revenueFile.rowCount || 0))
        }
        if (expenseFile) {
          formData.append('expenseColumns', JSON.stringify(expenseFile.columns))
          formData.append('expenseRowCount', String(expenseFile.rowCount || 0))
        }
        
        formData.append('profitabilityData', JSON.stringify({
          ...stats,
          revenueByProduct: stats.revenueByProduct,
          revenueByRegion: stats.revenueByRegion,
          revenueByMonth: stats.revenueByMonth
        }))
      }

      const result = await uploadCSV(formData)
      
      if (result.success && result.profitabilityResult) {
        setProfitabilityResult(result.profitabilityResult)
        toast({ title: "Analysis complete", description: "Your profitability analysis is ready" })
      } else if (result.success && result.redirectTo) {
        window.location.href = result.redirectTo
      } else {
        toast({ title: "Error", description: result.error || "Failed to create analysis", variant: "destructive" })
      }
    } catch (error) {
      console.error("Create error:", error)
      toast({ title: "Error", description: "Failed to create analysis", variant: "destructive" })
    } finally {
      setIsUploading(false)
    }
  }

  const renderStep = (step: number, isActive: boolean, isComplete: boolean) => (
    <div className={`flex items-center gap-2 ${isActive ? 'text-primary' : isComplete ? 'text-green-500' : 'text-muted-foreground'}`}>
      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
        isActive ? 'bg-primary text-white' : isComplete ? 'bg-green-500 text-white' : 'bg-muted'
      }`}>
        {isComplete ? <CheckCircle2 className="h-4 w-4" /> : step}
      </div>
      <span className="text-sm font-medium hidden sm:inline">
        {step === 1 && "Upload Revenue"}
        {step === 2 && "Upload Expenses"}
        {step === 3 && "Generate Analysis"}
      </span>
      {step < 3 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
    </div>
  )

  const renderDropZone = (type: "revenue" | "expense", file: UploadedFile | null) => {
    const isActive = dragActive === type
    const isRevenue = type === "revenue"
    const isStepComplete = file !== null
    const isCurrentStep = (isRevenue && currentStep === 1) || (!isRevenue && currentStep === 2)
    
    return (
      <div
        className={`relative border-2 border-dashed rounded-xl p-5 transition-all ${
          isActive 
            ? "border-primary bg-primary/5 scale-[1.02]" 
            : isStepComplete 
              ? "border-green-500/50 bg-green-500/5" 
              : isCurrentStep
                ? "border-primary/30 hover:border-primary/60"
                : "border-border opacity-50"
        }`}
        onDragEnter={(e) => handleDrag(e, type)}
        onDragLeave={(e) => handleDrag(e, type)}
        onDragOver={(e) => handleDrag(e, type)}
        onDrop={(e) => handleDrop(e, type)}
      >
        <input
          type="file"
          accept=".csv"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={(e) => handleFileSelect(e, type)}
          disabled={isUploading || (!isCurrentStep && !isStepComplete)}
        />
        
        <div className="text-center">
          {file ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-2 min-w-0">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                <span className="font-medium text-cyan-400 truncate max-w-[180px] sm:max-w-[220px]" title={file.name}>
                  {file.name}
                </span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isRevenue) { setRevenueFile(null) } else { setExpenseFile(null) }
                  }}
                  className="ml-1 text-neutral-400 hover:text-purple-400 shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                {file.rowCount?.toLocaleString()} rows • {file.columns?.length} columns
              </p>
            </>
          ) : (
            <>
              <div className={`h-12 w-12 rounded-xl mx-auto mb-3 flex items-center justify-center ${
                isRevenue ? "bg-green-500/10" : "bg-red-500/10"
              }`}>
                {isRevenue ? (
                  <DollarSign className="h-6 w-6 text-cyan-400" />
                ) : (
                  <Receipt className="h-6 w-6 text-purple-400" />
                )}
              </div>
              <p className="font-semibold text-foreground">
                {isRevenue ? "Step 1: Upload Revenue File" : "Step 2: Upload Expense File"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {isRevenue 
                  ? "Stripe, Shopify, invoice exports, sales reports"
                  : "QuickBooks, Xero, expense reports, cost trackers"
                }
              </p>
              <p className="text-xs text-primary mt-2 font-medium">
                {isCurrentStep ? "Click or drag to upload" : "Complete previous step first"}
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  if (profitabilityResult) {
    // ============================================================================
    // MODE B: FULL ANALYZE-STYLE DASHBOARD
    // ============================================================================
    const kpis = {
      totalRevenue: profitabilityResult.totalRevenue || 0,
      totalExpenses: profitabilityResult.totalExpenses || 0,
      profit: profitabilityResult.profit || 0,
      margin: profitabilityResult.margin || 0,
      hasRevenue: profitabilityResult.hasRevenue !== false,
      hasExpenses: profitabilityResult.hasExpenses !== false,
    }
    
    // Build insights from profitability data
    const insights: { message: string; type: string; evidence: string; reliability: 'verified' | 'estimated' }[] = []
    
    if (kpis.totalRevenue > 0) {
      insights.push({
        message: `Total revenue is ${formatCurrencyForKPI(kpis.totalRevenue)}`,
        type: 'revenue',
        evidence: `Revenue: ${formatCurrencyForKPI(kpis.totalRevenue)}`,
        reliability: 'verified'
      })
    }
    
    if (kpis.totalExpenses > 0) {
      insights.push({
        message: `Total expenses amount to ${formatCurrencyForKPI(kpis.totalExpenses)}`,
        type: 'expense',
        evidence: `Expenses: ${formatCurrencyForKPI(kpis.totalExpenses)}`,
        reliability: 'verified'
      })
    }
    
    if (kpis.profit !== 0) {
      const profitLabel = kpis.profit >= 0 ? 'profit' : 'loss'
      insights.push({
        message: `Net ${profitLabel}: ${formatCurrencyForKPI(Math.abs(kpis.profit))}`,
        type: 'profit',
        evidence: `Profit: ${formatCurrencyForKPI(kpis.profit)}`,
        reliability: 'verified'
      })
    }
    
    if (kpis.margin !== 0) {
      insights.push({
        message: `Profit margin: ${formatPercentSimple(kpis.margin)}`,
        type: 'margin',
        evidence: `Margin: ${formatPercentSimple(kpis.margin)}`,
        reliability: 'verified'
      })
    }
    
    // Top cost category insight
    if (profitabilityResult.expenseCategories && profitabilityResult.expenseCategories.length > 0) {
      const topCat = profitabilityResult.expenseCategories[0]
      if (topCat) {
        const totalExpenses = profitabilityResult.expenseCategories.reduce((sum: number, [_, val]: [string, number]) => sum + val, 0)
        const pct = ((topCat[1] as number) / totalExpenses * 100).toFixed(1)
        insights.push({
          message: `${topCat[0]} is the largest expense at ${formatCurrencyForKPI(topCat[1] as number)} (${pct}% of total)`,
          type: 'expense',
          evidence: `Top category: ${topCat[0]}`,
          reliability: 'verified'
        })
        
        // Add concentration risk insight
        if (parseFloat(pct) > 40) {
          insights.push({
            message: `High concentration: ${topCat[0]} alone represents ${pct}% of total expenses - significant exposure`,
            type: 'risk',
            evidence: `Single category concentration above 40%`,
            reliability: 'verified'
          })
        }
      }
      
      // Add expense diversity insight
      if (profitabilityResult.expenseCategories.length > 5) {
        insights.push({
          message: `${profitabilityResult.expenseCategories.length} expense categories identified - diversified cost structure`,
          type: 'expense',
          evidence: `${profitabilityResult.expenseCategories.length} categories`,
          reliability: 'verified'
        })
      }
    }
    
    // Revenue source insights
    if (profitabilityResult.revenueByProduct && profitabilityResult.revenueByProduct.length > 0) {
      const topRevenue = profitabilityResult.revenueByProduct[0]
      if (topRevenue) {
        const totalRevenue = profitabilityResult.revenueByProduct.reduce((sum: number, [_, val]: [string, number]) => sum + val, 0)
        const pct = ((topRevenue[1] as number) / totalRevenue * 100).toFixed(1)
        insights.push({
          message: `${topRevenue[0]} is the top revenue driver at ${formatCurrencyForKPI(topRevenue[1] as number)} (${pct}%)`,
          type: 'revenue',
          evidence: `Top product: ${topRevenue[0]}`,
          reliability: 'verified'
        })
        
        if (parseFloat(pct) > 50) {
          insights.push({
            message: `Revenue concentration risk: ${topRevenue[0]} dominates with ${pct}% of total revenue`,
            type: 'risk',
            evidence: `Single product concentration above 50%`,
            reliability: 'verified'
          })
        }
      }
    }
    
    // Margin quality insight
    if (kpis.margin > 0 && kpis.margin < 20) {
      insights.push({
        message: `Positive but thin margin (${formatPercentSimple(kpis.margin)}) - vulnerable to cost increases`,
        type: 'risk',
        evidence: `Margin between 0-20%`,
        reliability: 'verified'
      })
    } else if (kpis.margin >= 20) {
      insights.push({
        message: `Strong margin of ${formatPercentSimple(kpis.margin)} indicates healthy profitability`,
        type: 'profit',
        evidence: `Margin above 20%`,
        reliability: 'verified'
      })
    }
    
    // Cost concentration insight
    if (profitabilityResult.expenseCategories && profitabilityResult.expenseCategories.length > 0) {
      const totalExpenses = profitabilityResult.expenseCategories.reduce((sum: number, [_, val]: [string, number]) => sum + val, 0)
      const topCost = profitabilityResult.expenseCategories[0]
      const concentration = topCost ? ((topCost[1] as number) / totalExpenses * 100) : 0
      
      if (concentration > 50) {
        insights.push({
          message: `Critical: Single cost category (${topCost[0]}) represents ${concentration.toFixed(0)}% of expenses - extreme concentration risk`,
          type: 'risk',
          evidence: `Top category ${concentration.toFixed(0)}% of total`,
          reliability: 'verified'
        })
      } else if (concentration > 30) {
        insights.push({
          message: `High concentration: ${topCost[0]} is ${concentration.toFixed(0)}% of total expenses`,
          type: 'expense',
          evidence: `Concentration ${concentration.toFixed(0)}%`,
          reliability: 'verified'
        })
      }
      
      // Top 3 share insight
      const top3Total = profitabilityResult.expenseCategories.slice(0, 3).reduce((sum: number, [_, val]: [string, number]) => sum + (val as number), 0)
      const top3Share = (top3Total / totalExpenses * 100)
      insights.push({
        message: `Top 3 expenses account for ${top3Share.toFixed(0)}% of total costs - focusing here yields biggest impact`,
        type: 'expense',
        evidence: `Top 3: ${top3Share.toFixed(0)}%`,
        reliability: 'verified'
      })
    }
    
    // Revenue/Expense ratio insight
    if (kpis.totalExpenses > 0) {
      const ratio = kpis.totalRevenue / kpis.totalExpenses
      if (ratio > 2) {
        insights.push({
          message: `Strong revenue-to-expense ratio of ${ratio.toFixed(2)}x - healthy operating efficiency`,
          type: 'profit',
          evidence: `R/E ratio: ${ratio.toFixed(2)}x`,
          reliability: 'verified'
        })
      } else if (ratio < 1) {
        insights.push({
          message: `Revenue below expenses - business is losing money on each dollar earned`,
          type: 'risk',
          evidence: `R/E ratio: ${ratio.toFixed(2)}x`,
          reliability: 'verified'
        })
      }
    }
    
    // Build recommendations
    const recommendations: { action: string; reason: string }[] = []
    
    // Priority 1: Critical warnings for negative/low margin
    if (kpis.margin < 0) {
      recommendations.push({
        action: 'URGENT: Review cost structure immediately',
        reason: 'Negative profit margin indicates unsustainable operations - immediate action required'
      })
    } else if (kpis.margin < 5) {
      recommendations.push({
        action: 'Critical: Analyze cost reduction opportunities',
        reason: 'Margin below 5% leaves virtually no buffer for unexpected expenses'
      })
    } else if (kpis.margin < 15) {
      recommendations.push({
        action: 'Prioritize efficiency improvements',
        reason: 'Low margin requires careful cost management and operational optimization'
      })
    }
    
    // Priority 2: Expense-specific recommendations
    if (profitabilityResult.expenseCategories && profitabilityResult.expenseCategories.length > 0) {
      const topCat = profitabilityResult.expenseCategories[0]
      const totalExpenses = profitabilityResult.expenseCategories.reduce((sum: number, [_, val]: [string, number]) => sum + val, 0)
      
      if (topCat && (topCat[1] as number) / totalExpenses > 0.4) {
        recommendations.push({
          action: `Diversify away from ${topCat[0]} dependency`,
          reason: `${topCat[0]} represents over 40% of expenses - explore alternatives`
        })
      }
      
      recommendations.push({
        action: 'Review top 3 expense categories for optimization',
        reason: 'Top 3 categories typically represent majority of total spend'
      })
    }
    
    // Priority 3: Growth/profitability opportunities
    if (kpis.margin > 20) {
      recommendations.push({
        action: 'Consider strategic reinvestment',
        reason: 'Strong margin enables growth investments, R&D, or market expansion'
      })
    }
    
    if (kpis.profit > 0) {
      recommendations.push({
        action: 'Evaluate profit allocation strategy',
        reason: `Available ${formatCurrencyForKPI(kpis.profit)} net profit - consider reserves vs growth`
      })
    }
    
    // Priority 4: Data quality recommendations
    if (!profitabilityResult.hasRevenue) {
      recommendations.push({
        action: 'Add revenue data for complete analysis',
        reason: 'Expense-only analysis limits profitability insights'
      })
    }
    if (!profitabilityResult.hasExpenses) {
      recommendations.push({
        action: 'Add expense data for complete analysis',
        reason: 'Revenue-only analysis limits cost visibility'
      })
    }
    
    // Prepare chart data
    const expenseChartData = profitabilityResult.expenseCategories 
      ? profitabilityResult.expenseCategories.map(([name, value]: [string, number]) => ({ name, value }))
      : []
    
    const revenueChartData = profitabilityResult.revenueByProduct
      ? profitabilityResult.revenueByProduct.map(([name, value]: [string, number]) => ({ name, value }))
      : profitabilityResult.revenueByRegion
        ? profitabilityResult.revenueByRegion.map(([name, value]: [string, number]) => ({ name, value }))
        : []
    
    const revenueByRegionData = profitabilityResult.revenueByRegion
      ? profitabilityResult.revenueByRegion.slice(0, 10).map(([name, value]: [string, number]) => ({ name, value }))
      : []
    
    return (
      <div className="flex flex-col min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-neutral-800">
          <div>
            <h2 className="text-2xl font-bold">Profitability Analysis</h2>
            <p className="text-sm text-muted-foreground">
              Revenue & Expense Analysis • {profitabilityResult.hasRevenue && profitabilityResult.hasExpenses ? 'Full Analysis' : 'Partial Data'}
            </p>
          </div>
          {/* Action Buttons */}
          <div className="flex items-center gap-3 shrink-0">
            <Button 
              onClick={() => {
                setRevenueFile(null)
                setExpenseFile(null)
                setProfitabilityResult(null)
              }}
              variant="outline"
              size="sm"
              className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
            >
              Analyze Another
            </Button>
            <Button 
              className="bg-gradient-primary hover:opacity-90"
              size="sm"
              disabled={isGeneratingReport}
              onClick={handleGenerateReport}
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

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-0">
            {/* KPI Cards - Premium Executive Grid - Interactive */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
              {/* Total Revenue - Clickable */}
              <button
                onClick={() => setActiveSection(activeSection === 'revenue' ? null : 'revenue')}
                className={`bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-lg p-4 flex flex-col justify-between min-h-[100px] border transition-all duration-200 text-left group ${
                  activeSection === 'revenue' 
                    ? 'border-cyan-500 bg-gradient-to-br from-cyan-900/30 to-neutral-800' 
                    : 'border-neutral-800 hover:border-cyan-500/50 hover:bg-gradient-to-br hover:from-cyan-900/20'
                }`}
              >
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium text-center group-hover:text-cyan-400 transition-colors">Total Revenue</span>
                <div className="text-xl font-bold text-white text-center leading-tight group-hover:text-cyan-400 transition-colors">
                  {formatCurrencyForKPI(kpis.totalRevenue)}
                </div>
              </button>
              
              {/* Total Expenses - Clickable */}
              <button
                onClick={() => setActiveSection(activeSection === 'expenses' ? null : 'expenses')}
                className={`bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-lg p-4 flex flex-col justify-between min-h-[100px] border transition-all duration-200 text-left group ${
                  activeSection === 'expenses' 
                    ? 'border-purple-500 bg-gradient-to-br from-purple-900/30 to-neutral-800' 
                    : 'border-neutral-800 hover:border-purple-500/50 hover:bg-gradient-to-br hover:from-purple-900/20'
                }`}
              >
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium text-center group-hover:text-purple-400 transition-colors">Total Expenses</span>
                <div className="text-xl font-bold text-purple-400 text-center leading-tight group-hover:text-purple-300 transition-colors">
                  {formatCurrencyForKPI(kpis.totalExpenses)}
                </div>
              </button>
              
              {/* Net Profit - Clickable */}
              <button
                onClick={() => setActiveSection(activeSection === 'profit' ? null : 'profit')}
                className={`bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-lg p-4 flex flex-col justify-between min-h-[100px] border transition-all duration-200 text-left group ${
                  activeSection === 'profit' 
                    ? 'border-emerald-500 bg-gradient-to-br from-emerald-900/30 to-neutral-800' 
                    : 'border-neutral-800 hover:border-emerald-500/50 hover:bg-gradient-to-br hover:from-emerald-900/20'
                }`}
              >
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium text-center group-hover:text-emerald-400 transition-colors">Net Profit</span>
                <div className={`text-xl font-bold text-center leading-tight ${kpis.profit >= 0 ? 'text-emerald-400' : 'text-purple-400'} group-hover:text-emerald-300 transition-colors`}>
                  {formatCurrencyForKPI(kpis.profit)}
                </div>
              </button>
              
              {/* Profit Margin - Clickable */}
              <button
                onClick={() => setActiveSection(activeSection === 'margin' ? null : 'margin')}
                className={`bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-lg p-4 flex flex-col justify-between min-h-[100px] border transition-all duration-200 text-left group ${
                  activeSection === 'margin' 
                    ? 'border-blue-500 bg-gradient-to-br from-blue-900/30 to-neutral-800' 
                    : 'border-neutral-800 hover:border-blue-500/50 hover:bg-gradient-to-br hover:from-blue-900/20'
                }`}
              >
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium text-center group-hover:text-blue-400 transition-colors">Margin</span>
                <div className={`text-xl font-bold text-center leading-tight ${kpis.margin >= 0 ? 'text-blue-400' : 'text-purple-400'} group-hover:text-blue-300 transition-colors`}>
                  {formatPercentSimple(kpis.margin)}
                </div>
              </button>
              
              {/* Top Cost Category - Highlighted if it's Salaries/Personnel - Clickable */}
              {profitabilityResult.expenseCategories && profitabilityResult.expenseCategories.length > 0 && (
                <button
                  onClick={() => setActiveSection(activeSection === 'topcost' ? null : 'topcost')}
                  className={`rounded-lg p-4 flex flex-col justify-between min-h-[100px] border transition-all duration-200 text-left group ${
                    activeSection === 'topcost' 
                      ? 'border-orange-500 bg-gradient-to-br from-orange-900/40 to-neutral-800' 
                      : profitabilityResult.expenseCategories[0]?.[0]?.toLowerCase().includes('salar') 
                        ? 'bg-gradient-to-br from-orange-900/40 to-neutral-800 border-orange-500/50 hover:border-orange-500'
                        : 'bg-gradient-to-br from-neutral-900 to-neutral-800 border-neutral-800 hover:border-orange-500/50'
                  }`}
                >
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium text-center group-hover:text-orange-400 transition-colors">Top Cost Driver</span>
                  <div className={`text-sm font-bold text-center leading-tight truncate ${ 
                    profitabilityResult.expenseCategories[0]?.[0]?.toLowerCase().includes('salar')
                      ? 'text-orange-400' : 'text-orange-400'
                  } group-hover:text-orange-300 transition-colors`} title={profitabilityResult.expenseCategories[0]?.[0]}>
                    {profitabilityResult.expenseCategories[0]?.[0] || 'N/A'}
                  </div>
                </button>
              )}
            </div>

            {/* Secondary Stats Row - Cost Concentration & Efficiency */}
            {profitabilityResult.expenseCategories && profitabilityResult.expenseCategories.length > 0 && (
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                {/* Cost Concentration % */}
                {(() => {
                  const totalExpenses = profitabilityResult.expenseCategories.reduce((sum: number, [_, val]: [string, number]) => sum + val, 0)
                  const topCost = profitabilityResult.expenseCategories[0]
                  const concentration = topCost ? ((topCost[1] as number) / totalExpenses * 100) : 0
                  return (
                    <div className="bg-neutral-900/60 rounded-lg p-3 border border-neutral-800">
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-medium">Cost Concentration</span>
                      <div className={`text-lg font-bold mt-1 ${concentration > 40 ? 'text-orange-400' : 'text-neutral-300'}`}>
                        {concentration.toFixed(1)}%
                      </div>
                    </div>
                  )
                })()}
                
                {/* Revenue-to-Expense Ratio */}
                {kpis.totalExpenses > 0 && (
                  <div className="bg-neutral-900/60 rounded-lg p-3 border border-neutral-800">
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-medium">Revenue/Expense</span>
                    <div className="text-lg font-bold text-neutral-300 mt-1">
                      {(kpis.totalRevenue / kpis.totalExpenses).toFixed(2)}x
                    </div>
                  </div>
                )}
                
                {/* Expense Count */}
                <div className="bg-neutral-900/60 rounded-lg p-3 border border-neutral-800">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-medium">Cost Categories</span>
                  <div className="text-lg font-bold text-neutral-300 mt-1">
                    {profitabilityResult.expenseCategories.length}
                  </div>
                </div>
                
                {/* Top 3 Cost Share */}
                {(() => {
                  const totalExpenses = profitabilityResult.expenseCategories.reduce((sum: number, [_, val]: [string, number]) => sum + val, 0)
                  const top3Total = profitabilityResult.expenseCategories.slice(0, 3).reduce((sum: number, [_, val]: [string, number]) => sum + (val as number), 0)
                  const top3Share = top3Total / totalExpenses * 100
                  return (
                    <div className="bg-neutral-900/60 rounded-lg p-3 border border-neutral-800">
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-medium">Top 3 Cost Share</span>
                      <div className="text-lg font-bold text-neutral-300 mt-1">
                        {top3Share.toFixed(1)}%
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Section Divider */}
            <div className="border-t border-neutral-800" />

            {/* Executive Summary */}
            <Card className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 border border-neutral-700">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-white text-sm">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  Executive Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-neutral-300 leading-relaxed">
                  {kpis.profit >= 0 
                    ? `Your business generated ${formatCurrencyForKPI(kpis.totalRevenue)} in revenue with ${formatCurrencyForKPI(kpis.totalExpenses)} in expenses, resulting in a net ${formatCurrencyForKPI(kpis.profit)} (${formatPercentSimple(kpis.margin)} margin). ${profitabilityResult.expenseCategories?.[0] ? `The largest expense category is ${profitabilityResult.expenseCategories[0][0]} at ${formatCurrencyForKPI(profitabilityResult.expenseCategories[0][1] as number)}.` : ''}`
                    : `Your business generated ${formatCurrencyForKPI(kpis.totalRevenue)} in revenue but incurred ${formatCurrencyForKPI(kpis.totalExpenses)} in expenses, resulting in a net loss of ${formatCurrencyForKPI(Math.abs(kpis.profit))}. Immediate cost reduction strategies are recommended.`
                  }
                </p>
              </CardContent>
            </Card>

            {/* Section Divider */}
            <div className="border-t border-neutral-800" />

            {/* Key Drivers - Only render if we have data */}
            {(profitabilityResult.expenseCategories?.length > 0 || profitabilityResult.revenueByProduct?.length > 0 || profitabilityResult.revenueByRegion?.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top Cost Categories - Only if we have expense data */}
                {profitabilityResult.expenseCategories && profitabilityResult.expenseCategories.length > 0 && (
                  <Card className={`bg-neutral-900 border transition-all duration-300 ${
                    activeSection === 'expenses' || activeSection === 'topcost'
                      ? 'border-purple-500 shadow-lg shadow-purple-500/10' 
                      : 'border-neutral-800'
                  }`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-white text-sm flex items-center gap-2">
                        Top Cost Categories
                        {/* Highlight salaries/personnel if it's the top cost */}
                        {profitabilityResult.expenseCategories[0]?.[0]?.toLowerCase().includes('salar') && (
                          <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
                            Primary Driver
                          </span>
                        )}
                        {/* Active indicator */}
                        {(activeSection === 'expenses' || activeSection === 'topcost') && (
                          <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full ml-auto">
                            Active
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-1">
                        {profitabilityResult.expenseCategories.slice(0, 6).map(([name, value]: [string, number], idx: number) => {
                          const totalExpenses = profitabilityResult.expenseCategories.reduce((sum: number, [_, val]: [string, number]) => sum + val, 0)
                          const percentage = ((value / totalExpenses) * 100).toFixed(1)
                          const isSalaries = name.toLowerCase().includes('salar')
                          return (
                            <div 
                              key={idx} 
                              className={`flex items-center justify-between p-2 rounded-md transition-all duration-200 ${
                                idx === 0 
                                  ? (isSalaries ? 'bg-orange-900/20 border border-orange-500/30' : 'bg-neutral-800')
                                  : 'hover:bg-neutral-800/50'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`text-xs font-medium ${idx === 0 ? (isSalaries ? 'text-orange-400' : 'text-purple-400') : 'text-neutral-500'} shrink-0`}>
                                  {idx + 1}.
                                </span>
                                <span className={`text-sm truncate ${idx === 0 ? 'text-white' : 'text-neutral-300'} ${isSalaries ? 'font-medium' : ''}`} title={name}>
                                  {name}
                                  {isSalaries && <span className="text-orange-400 ml-1 text-xs">(Personnel)</span>}
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                <div className={`text-sm font-medium ${idx === 0 ? (isSalaries ? 'text-orange-400' : 'text-purple-400') : 'text-neutral-400'}`}>
                                  {formatCurrencyForKPI(value)}
                                </div>
                                <div className="text-[10px] text-neutral-500">
                                  {percentage}%
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* Revenue by Product or Region - Only if we have real revenue data */}
                {(profitabilityResult.revenueByProduct?.length > 0 || profitabilityResult.revenueByRegion?.length > 0) && (
                  <Card className={`bg-neutral-900 border transition-all duration-300 ${
                    activeSection === 'revenue'
                      ? 'border-cyan-500 shadow-lg shadow-cyan-500/10' 
                      : 'border-neutral-800'
                  }`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-white text-sm flex items-center gap-2">
                        {profitabilityResult.revenueByProduct ? 'Revenue by Product' : 'Revenue by Region'}
                        {/* Active indicator */}
                        {activeSection === 'revenue' && (
                          <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full ml-auto">
                            Active
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-1">
                        {(profitabilityResult.revenueByProduct || profitabilityResult.revenueByRegion || []).slice(0, 6).map(([name, value]: [string, number], idx: number) => {
                          const totalRevenue = (profitabilityResult.revenueByProduct || profitabilityResult.revenueByRegion || []).reduce((sum: number, [_, val]: [string, number]) => sum + val, 0)
                          const percentage = ((value / totalRevenue) * 100).toFixed(1)
                          return (
                            <div 
                              key={idx} 
                              className={`flex items-center justify-between p-2 rounded-md ${idx === 0 ? 'bg-neutral-800' : ''}`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`text-xs font-medium ${idx === 0 ? 'text-cyan-400' : 'text-neutral-500'} shrink-0`}>
                                  {idx + 1}.
                                </span>
                                <span className={`text-sm truncate ${idx === 0 ? 'text-white' : 'text-neutral-300'}`} title={name}>
                                  {name}
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                <div className={`text-sm font-medium ${idx === 0 ? 'text-cyan-400' : 'text-neutral-400'}`}>
                                  {formatCurrencyForKPI(value)}
                                </div>
                                <div className="text-[10px] text-neutral-500">
                                  {percentage}%
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Section Divider - Only show if we have content above */}
            {(profitabilityResult.expenseCategories?.length > 0 || profitabilityResult.revenueByProduct?.length > 0) && insights.length > 0 && (
              <div className="border-t border-neutral-800" />
            )}

            {/* Business Insights - Only if we have insights */}
            {insights.length > 0 && (
              <Card className="bg-neutral-900 border-neutral-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white flex items-center gap-2 text-sm">
                    <Lightbulb className="h-4 w-4 text-amber-400" />
                    Business Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-2">
                    {insights.map((insight, idx) => (
                      <li 
                        key={idx} 
                        className="flex items-start gap-2 text-sm text-neutral-300"
                      >
                        <span className="text-amber-400 mt-0.5 shrink-0">•</span>
                        <div className="flex-1">
                          <div>{insight.message}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Recommended Actions - Only if we have recommendations */}
            {recommendations.length > 0 && (
              <Card className="bg-neutral-900 border-neutral-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                    Recommended Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {recommendations.map((rec, idx) => (
                      <div 
                        key={idx} 
                        className="border-l-2 border-emerald-500 pl-3 py-2"
                      >
                        <div className="font-medium text-sm text-white">{rec.action}</div>
                        <div className="text-xs text-neutral-400 mt-0.5">{rec.reason}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Visualizations Tab */}
          <TabsContent value="visualizations" className="space-y-6 mt-6">
            {/* Expense Distribution Chart */}
            {expenseChartData.length > 0 && (
              <Card className="bg-neutral-900 border-neutral-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-base">Expense Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={expenseChartData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis type="number" stroke="#666" tickFormatter={(v) => formatCurrencyForKPI(v)} />
                        <YAxis type="category" dataKey="name" stroke="#666" width={120} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                          formatter={(value) => [formatCurrencyForKPI(value as number), 'Amount']}
                        />
                        <Bar dataKey="value" fill="#a855f7" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Revenue Distribution Chart */}
            {revenueChartData.length > 0 && (
              <Card className="bg-neutral-900 border-neutral-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-base">Revenue Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenueChartData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis type="number" stroke="#666" tickFormatter={(v) => formatCurrencyForKPI(v)} />
                        <YAxis type="category" dataKey="name" stroke="#666" width={120} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                          formatter={(value) => [formatCurrencyForKPI(value as number), 'Amount']}
                        />
                        <Bar dataKey="value" fill="#22d3ee" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-1 py-2">
        {renderStep(1, currentStep === 1, currentStep > 1)}
        {renderStep(2, currentStep === 2, currentStep > 2)}
        {renderStep(3, currentStep === 3, false)}
      </div>

      {/* Value Proposition */}
      <div className="text-center px-4">
        <p className="text-muted-foreground">
          Upload your revenue and expense files to analyze profit, margin, and cost categories in seconds
        </p>
      </div>

      {/* File Upload Zones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderDropZone("revenue", revenueFile)}
        {renderDropZone("expense", expenseFile)}
      </div>

      {/* Live Preview */}
      {(revenueFile || expenseFile) && (
        <Card className="p-5 bg-neutral-900 border-neutral-800">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold text-white">What You'll Get</h3>
          </div>
          
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-neutral-800 rounded-lg p-3">
              <p className="text-xs text-neutral-400 uppercase">Total Revenue</p>
              <p className={`text-lg font-bold ${stats.hasRevenue ? 'text-cyan-400' : 'text-neutral-500'}`}>
                {stats.hasRevenue ? formatCurrency(stats.totalRevenue) : "—"}
              </p>
            </div>
            <div className="bg-neutral-800 rounded-lg p-3">
              <p className="text-xs text-neutral-400 uppercase">Total Expenses</p>
              <p className={`text-lg font-bold ${stats.hasExpenses ? 'text-purple-400' : 'text-neutral-500'}`}>
                {stats.hasExpenses ? formatCurrency(stats.totalExpenses) : "—"}
              </p>
            </div>
            <div className="bg-neutral-800 rounded-lg p-3">
              <p className="text-xs text-neutral-400 uppercase">Estimated Profit</p>
              <p className={`text-lg font-bold ${
                !stats.hasRevenue || !stats.hasExpenses ? 'text-neutral-500' : stats.profit >= 0 ? 'text-cyan-400' : 'text-purple-400'
              }`}>
                {stats.hasRevenue && stats.hasExpenses ? formatCurrency(stats.profit) : "—"}
              </p>
            </div>
            <div className="bg-neutral-800 rounded-lg p-3">
              <p className="text-xs text-neutral-400 uppercase">Profit Margin</p>
              <p className={`text-lg font-bold ${
                !stats.hasRevenue || !stats.hasExpenses ? 'text-neutral-500' : stats.margin >= 0 ? 'text-cyan-400' : 'text-purple-400'
              }`}>
                {stats.hasRevenue && stats.hasExpenses ? `${stats.margin.toFixed(1)}%` : "—"}
              </p>
            </div>
          </div>

          {/* Status Note */}
          <div className="text-xs text-neutral-500 bg-neutral-800/50 rounded-lg p-2.5 mb-4">
            {!stats.hasRevenue && !stats.hasExpenses && "Upload files above to see your profitability analysis."}
            {stats.hasRevenue && !stats.hasExpenses && "⚠️ Add expense data for full profit analysis."}
            {!stats.hasRevenue && stats.hasExpenses && "⚠️ Add revenue data for full profit analysis."}
            {stats.hasRevenue && stats.hasExpenses && !stats.canMatchPeriods && 
              "ℹ️ Based on totals. Add date columns to enable period comparison."}
            {stats.hasRevenue && stats.hasExpenses && stats.canMatchPeriods && 
              "✓ Period-aligned analysis available."}
          </div>

          {/* Top Expense Categories */}
          {stats.expenseCategories.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-neutral-400 uppercase mb-2">Top Cost Categories</p>
              <div className="flex flex-wrap gap-2">
                {stats.expenseCategories.map(([cat, amount]) => (
                  <div key={cat} className="px-3 py-1.5 rounded-full bg-neutral-800 border border-neutral-700 text-xs">
                    <span className="text-neutral-300">{cat}</span>
                    <span className="text-purple-400 ml-2">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Revenue Products */}
          {stats.revenueByProduct.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-neutral-400 uppercase mb-2">Top Revenue Sources</p>
              <div className="flex flex-wrap gap-2">
                {stats.revenueByProduct.slice(0, 5).map(([item, amount]) => (
                  <div key={item} className="px-3 py-1.5 rounded-full bg-neutral-800 border border-neutral-700 text-xs">
                    <span className="text-neutral-300">{item}</span>
                    <span className="text-cyan-400 ml-2">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA Button */}
          <Button
            onClick={handleGenerate}
            disabled={isUploading || (!revenueFile && !expenseFile)}
            className="w-full bg-gradient-primary hover:opacity-90 h-11 text-base"
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : currentStep === 3 ? (
              <>
                <TrendingUp className="mr-2 h-5 w-5" />
                Generate Profitability Analysis
              </>
            ) : currentStep === 2 ? (
              <>
                <ArrowRight className="mr-2 h-5 w-5" />
                Continue to Expenses
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-5 w-5" />
                Continue to Expenses
              </>
            )}
          </Button>
        </Card>
      )}
    </div>
  )
}
