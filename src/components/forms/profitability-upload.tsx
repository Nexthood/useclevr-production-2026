"use client"

import { debugError, debugLog } from "@/lib/utils/debug"



import { Button } from "@/components/ui/button"
import { UploadSuccessPanel } from "@/components/forms/upload-success-panel"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { USAGE_REFRESH_EVENT } from "@/components/ui/usage-monitor"
import { useToast } from "@/hooks/use-toast"
import { calculateProfitabilityAnalysis, type ProfitabilityFileRole } from "@/lib/profitability/two-file-analysis"
import { uploadDatasetFile, type UploadDatasetResponse } from "@/lib/upload/upload-client"
import { formatCurrencyForKPI, formatPercentSimple } from "@/lib/utils/formatting"
import { ArrowRight, BarChart3, CheckCircle2, DollarSign, FileText, Lightbulb, Loader2, Receipt, Sparkles, Table2, TrendingUp, X } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts"

interface UploadedFile {
  name: string
  type: "revenue" | "expense"
  data?: any[]
  columns?: string[]
  rowCount?: number
}

type ProfitabilityUploadProps = {
  initialProfitabilityResult?: Record<string, unknown> | null
  initialUploadResult?: UploadDatasetResponse | null
}

export function ProfitabilityUpload({
  initialProfitabilityResult = null,
  initialUploadResult = null,
}: ProfitabilityUploadProps = {}) {
  const router = useRouter()
  const [revenueFile, setRevenueFile] = React.useState<UploadedFile | null>(null)
  const [expenseFile, setExpenseFile] = React.useState<UploadedFile | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const [dragActive, setDragActive] = React.useState<"revenue" | "expense" | null>(null)
  const [profitabilityResult, setProfitabilityResult] = React.useState<any>(initialProfitabilityResult)
  const [uploadResult, setUploadResult] = React.useState<UploadDatasetResponse | null>(initialUploadResult)
  const [generateStatus, setGenerateStatus] = React.useState<"idle" | "parsing" | "uploading" | "analyzing" | "success" | "partial_success" | "failure">("idle")
  const [isGeneratingReport, setIsGeneratingReport] = React.useState(false)
  const [reportGenerated, setReportGenerated] = React.useState(false)
  const [activeSection, setActiveSection] = React.useState<string | null>(null)
  const [profitabilityAnalysisId, setProfitabilityAnalysisId] = React.useState(() => {
    const initialAnalysisId =
      initialProfitabilityResult?.profitabilityAnalysisId ||
      initialProfitabilityResult?.profitability_analysis_id ||
      initialUploadResult?.datasetId
    return typeof initialAnalysisId === "string" && initialAnalysisId.length > 0
      ? initialAnalysisId
      : `pa_${crypto.randomUUID()}`
  })
  const { toast } = useToast()

  // Handle generate report action
  const handleGenerateReport = async () => {
    const persistedDatasetId = uploadResult?.datasetId
    if (!profitabilityResult || !persistedDatasetId) {
      debugError('[REPORT] No profitability result available')
      toast({ title: "Error", description: "No saved profitability analysis available", variant: "destructive" })
      return
    }

    setIsGeneratingReport(true)
    setReportGenerated(false)

    try {
      debugLog('[REPORT] Generating report for profitability analysis')

      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      const timezoneOffset = new Date().getTimezoneOffset()

      debugLog('[REPORT] Sending report request with:', { datasetId: persistedDatasetId, profitabilityAnalysisId })

      const response = await fetch('/api/reports', {
        method: 'POST',
        // Dataset-scoped idempotency prevents duplicate report creation and duplicate charging.
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `profitability:${profitabilityAnalysisId}:report`,
        },
        body: JSON.stringify({
          datasetId: persistedDatasetId,
          timezone: userTimezone,
          timezoneOffset,
        })
      })

      if (response.ok) {
        const result = await response.json()
        debugLog('[REPORT] Report generated:', result)
        setReportGenerated(true)

        if (result.reportId) {
          sessionStorage.setItem('lastGeneratedReportId', result.reportId)
        }

        toast({ title: "Report generated", description: "Your report is ready" })

        // Navigate to downloads after a short delay
        setTimeout(() => {
          window.location.href = result.redirectUrl || `/app/downloads?reportId=${result.reportId}`
        }, 1500)
      } else {
        const errorText = await response.text()
        debugError('[REPORT] Report generation failed:', errorText)
        toast({ title: "Error", description: "Failed to generate report", variant: "destructive" })
      }
    } catch (error) {
      debugError('[REPORT] Error:', error)
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
    const fileName = file.name.toLowerCase()
    const isCsv = fileName.endsWith(".csv")
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls")
    
    if (!isCsv && !isExcel) {
      toast({ title: "Invalid file", description: "Please upload a CSV or Excel file (.csv, .xlsx, .xls)", variant: "destructive" })
      return
    }

    setIsUploading(true)
    setGenerateStatus("parsing")

    try {
      let data: any[], fields: string[]
      
      if (isExcel) {
        // Parse Excel file
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const XLSX = require('xlsx')
        const workbook = XLSX.read(buffer, { type: 'buffer' })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
        
        if (json.length === 0) {
          toast({ title: "Invalid file", description: "Excel file is empty", variant: "destructive" })
          setGenerateStatus("idle")
          return
        }
        
        fields = json[0] as string[]
        data = json.slice(1).map((row) => {
          const obj: any = {}
          fields.forEach((col, i) => {
            obj[col] = row[i]
          })
          return obj
        })
      } else {
        // Parse CSV file
        const text = await file.text()
        const parsed = parseCSV(text)
        data = parsed.data
        fields = parsed.meta.fields || []
      }

      const uploadedFile: UploadedFile = {
        name: file.name,
        type,
        data: data,
        columns: fields,
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
      debugError("File processing error:", error)
      toast({ title: "Error", description: "Failed to process file", variant: "destructive" })
    } finally {
      setIsUploading(false)
      setGenerateStatus("idle")
    }
  }

  const parseCSV = (text: string): { data: any[], meta: { fields: string[] } } => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return { data: [], meta: { fields: [] } }

    const parseCSVLine = (line: string) => {
      const values: string[] = []
      let current = ''
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        const nextChar = line[i + 1]

        if (char === '"' && inQuotes && nextChar === '"') {
          current += '"'
          i++
        } else if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }

      values.push(current.trim())
      return values
    }

    const headers = parseCSVLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''))
    const data = lines.slice(1).map(line => {
      const values = parseCSVLine(line).map(v => v.trim().replace(/^"|"$/g, ''))
      const row: any = {}
      headers.forEach((header, idx) => {
        row[header] = values[idx] || ''
      })
      return row
    })

    return { data, meta: { fields: headers } }
  }

  const calculateTotals = () => calculateProfitabilityAnalysis({
    analysisId: profitabilityAnalysisId,
    revenueFile: revenueFile
      ? {
          role: "revenue",
          name: revenueFile.name,
          columns: revenueFile.columns || [],
          rows: revenueFile.data || [],
          rowCount: revenueFile.rowCount,
        }
      : null,
    expensesFile: expenseFile
      ? {
          role: "expenses",
          name: expenseFile.name,
          columns: expenseFile.columns || [],
          rows: expenseFile.data || [],
          rowCount: expenseFile.rowCount,
        }
      : null,
  })

  const stats = calculateTotals()

  const formatCurrency = (val: number): string => {
    if (Math.abs(val) >= 1000000) return `$${(val / 1000000).toFixed(1)}M`
    if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(1)}K`
    return `$${val.toFixed(0)}`
  }

  const handleGenerate = async () => {
    if (isUploading) return

    if (!revenueFile && !expenseFile) {
      toast({ title: "No files", description: "Please upload at least one file", variant: "destructive" })
      return
    }

    setIsUploading(true)
    setGenerateStatus("uploading")

    try {
      const filesToUpload = [
        revenueFile ? { role: "revenue" as const, file: revenueFile } : null,
        expenseFile ? { role: "expenses" as const, file: expenseFile } : null,
      ].filter((entry): entry is { role: ProfitabilityFileRole; file: UploadedFile } => Boolean(entry))
      let latestResult: UploadDatasetResponse | null = null

      for (const entry of filesToUpload) {
        const headers = entry.file.columns || []
        const csvContent = [
          headers.join(','),
          ...(entry.file.data || []).map(row =>
            headers.map(h => row[h] || '').join(',')
          )
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv' })
        const file = new File([blob], entry.file.name, { type: 'text/csv' })
        const extraFields: Record<string, string> = {
          datasetName: `Profitability - ${new Date().toLocaleDateString()}`,
          profitability_analysis_id: profitabilityAnalysisId,
          profitability_file_role: entry.role,
          profitabilityFileRole: entry.role,
          fileType: entry.role === "revenue" ? 'profitability_revenue' : 'profitability_expenses',
          profitabilityData: JSON.stringify({
            ...stats,
            revenueByProduct: stats.revenueByProduct,
            revenueByRegion: stats.revenueByRegion,
            revenueByMonth: stats.revenueByMonth
          }),
        }

        if (revenueFile) {
          extraFields.revenueColumns = JSON.stringify(revenueFile.columns)
          extraFields.revenueRowCount = String(revenueFile.rowCount || 0)
        }
        if (expenseFile) {
          extraFields.expenseColumns = JSON.stringify(expenseFile.columns)
          extraFields.expenseRowCount = String(expenseFile.rowCount || 0)
        }

        setGenerateStatus("analyzing")
        const result = await uploadDatasetFile({
          file,
          uploadMode: "profitability",
          source: "profitability_upload",
          extraFields,
        })

        if (!result.success) {
          setGenerateStatus("failure")
          if (result.usage?.limitReached) {
            toast({
              title: "Analyst credit limit reached",
              description: "Subscribe to Pro or top up to upload another dataset.",
              variant: "default",
            })
          }
          toast({
            title: "Upload failed",
            description: result.message || result.error || "Failed to create analysis",
            variant: "destructive",
          })
          return
        }
        latestResult = result
      }

      if (latestResult) {
        const parentAnalysisId = String(
          latestResult.profitabilityResult?.profitabilityAnalysisId ||
          latestResult.profitabilityResult?.profitability_analysis_id ||
          profitabilityAnalysisId
        )
        const redirectTo = `/app/profitability?datasetId=${parentAnalysisId}&analysisId=${parentAnalysisId}`
        window.dispatchEvent(new Event(USAGE_REFRESH_EVENT))
        setUploadResult({
          ...latestResult,
          datasetId: parentAnalysisId,
          datasetName: latestResult.datasetName || `Profitability - ${new Date().toLocaleDateString()}`,
          datasetType: latestResult.datasetType || latestResult.dataset_type || "profitability",
          rowsProcessed: (revenueFile?.rowCount || 0) + (expenseFile?.rowCount || 0),
          columnsDetected: (revenueFile?.columns?.length || 0) + (expenseFile?.columns?.length || 0),
          analysisStatus: stats.status === "ready" ? "ready" : "processing",
          redirectTo,
        })
        setProfitabilityResult(latestResult.profitabilityResult || stats)
        setGenerateStatus(stats.status === "ready" ? "success" : "partial_success")
        toast({ title: stats.statusLabel, description: stats.status === "ready" ? "Profitability analysis is ready." : "The uploaded file is saved and waiting for its matching pair." })
        if (stats.status === "ready") router.push(redirectTo)
      }
    } catch (error) {
      debugError("Create error:", error)
      setGenerateStatus("failure")
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

  const resetUploadFlow = () => {
    setRevenueFile(null)
    setExpenseFile(null)
    setProfitabilityResult(null)
    setUploadResult(null)
    setGenerateStatus("idle")
    setActiveSection(null)
    setReportGenerated(false)
    setProfitabilityAnalysisId(`pa_${crypto.randomUUID()}`)
  }

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
          accept=".csv,.xlsx,.xls"
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
                  className="ml-1 text-muted-foreground hover:text-purple-400 shrink-0"
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
      totalRevenue: typeof profitabilityResult.totalRevenue === "number" ? profitabilityResult.totalRevenue : null,
      totalExpenses: typeof profitabilityResult.totalExpenses === "number" ? profitabilityResult.totalExpenses : null,
      grossProfit: typeof profitabilityResult.grossProfit === "number" ? profitabilityResult.grossProfit : null,
      operatingProfit: typeof profitabilityResult.operatingProfit === "number" ? profitabilityResult.operatingProfit : null,
      netProfit: typeof profitabilityResult.netProfit === "number" ? profitabilityResult.netProfit : null,
      grossMargin: typeof profitabilityResult.grossMargin === "number" ? profitabilityResult.grossMargin : null,
      operatingMargin: typeof profitabilityResult.operatingMargin === "number" ? profitabilityResult.operatingMargin : null,
      netMargin: typeof profitabilityResult.netMargin === "number" ? profitabilityResult.netMargin : null,
      hasRevenue: profitabilityResult.hasRevenue !== false,
      hasExpenses: profitabilityResult.hasExpenses !== false,
    }
    const hasFullProfitability = kpis.hasRevenue && kpis.hasExpenses
    const displayCurrency = (value: number | null) => value === null ? "Not available" : formatCurrencyForKPI(value)
    const displayPercent = (value: number | null) => value === null ? "Not available" : formatPercentSimple(value)

    // Build insights from profitability data
    const insights: { message: string; type: string; evidence: string; reliability: 'verified' | 'estimated' }[] = []

    if (kpis.totalRevenue !== null && kpis.totalRevenue > 0) {
      insights.push({
        message: `Total revenue is ${formatCurrencyForKPI(kpis.totalRevenue)}`,
        type: 'revenue',
        evidence: `Revenue: ${formatCurrencyForKPI(kpis.totalRevenue)}`,
        reliability: 'verified'
      })
    }

    if (kpis.totalExpenses !== null && kpis.totalExpenses > 0) {
      insights.push({
        message: `Total expenses amount to ${formatCurrencyForKPI(kpis.totalExpenses)}`,
        type: 'expense',
        evidence: `Expenses: ${formatCurrencyForKPI(kpis.totalExpenses)}`,
        reliability: 'verified'
      })
    }

    if (kpis.operatingProfit !== null && kpis.operatingProfit !== 0) {
      const profitLabel = kpis.operatingProfit >= 0 ? 'profit' : 'loss'
      insights.push({
        message: `Operating ${profitLabel}: ${formatCurrencyForKPI(Math.abs(kpis.operatingProfit))}`,
        type: 'profit',
        evidence: `Operating profit: ${formatCurrencyForKPI(kpis.operatingProfit)}`,
        reliability: 'verified'
      })
    }

    if (kpis.operatingMargin !== null && kpis.operatingMargin !== 0) {
      insights.push({
        message: `Operating margin: ${formatPercentSimple(kpis.operatingMargin)}`,
        type: 'margin',
        evidence: `Operating margin: ${formatPercentSimple(kpis.operatingMargin)}`,
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
    if (hasFullProfitability && kpis.operatingMargin !== null && kpis.operatingMargin > 0 && kpis.operatingMargin < 20) {
      insights.push({
        message: `Positive but thin operating margin (${formatPercentSimple(kpis.operatingMargin)}) - vulnerable to cost increases`,
        type: 'risk',
        evidence: `Margin between 0-20%`,
        reliability: 'verified'
      })
    } else if (hasFullProfitability && kpis.operatingMargin !== null && kpis.operatingMargin >= 20) {
      insights.push({
        message: `Strong operating margin of ${formatPercentSimple(kpis.operatingMargin)} indicates healthy profitability`,
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
    if (kpis.totalRevenue !== null && kpis.totalExpenses !== null && kpis.totalExpenses > 0) {
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
    if (hasFullProfitability && kpis.operatingMargin !== null && kpis.operatingMargin < 0) {
      recommendations.push({
        action: 'URGENT: Review cost structure immediately',
        reason: 'Negative profit margin indicates unsustainable operations - immediate action required'
      })
    } else if (hasFullProfitability && kpis.operatingMargin !== null && kpis.operatingMargin < 5) {
      recommendations.push({
        action: 'Critical: Analyze cost reduction opportunities',
        reason: 'Margin below 5% leaves virtually no buffer for unexpected expenses'
      })
    } else if (hasFullProfitability && kpis.operatingMargin !== null && kpis.operatingMargin < 15) {
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
    if (kpis.operatingMargin !== null && kpis.operatingMargin > 20) {
      recommendations.push({
        action: 'Consider strategic reinvestment',
        reason: 'Strong margin enables growth investments, R&D, or market expansion'
      })
    }

    if (kpis.operatingProfit !== null && kpis.operatingProfit > 0) {
      recommendations.push({
        action: 'Evaluate profit allocation strategy',
        reason: `Available ${formatCurrencyForKPI(kpis.operatingProfit)} operating profit - consider reserves vs growth`
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

    const _revenueByRegionData = profitabilityResult.revenueByRegion
      ? profitabilityResult.revenueByRegion.slice(0, 10).map(([name, value]: [string, number]) => ({ name, value }))
      : []

    return (
      <div className="flex min-w-0 flex-col min-h-0">
        {/* Header */}
        <div className="mb-4 flex min-w-0 flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold">Profitability Analysis</h2>
            <p className="text-sm text-muted-foreground">
              Revenue & Expense Analysis • {profitabilityResult.hasRevenue && profitabilityResult.hasExpenses ? 'Full Analysis' : 'Partial Data'}
            </p>
          </div>
          {/* Action Buttons */}
          <div className="relative z-10 flex min-w-0 shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <Button
              onClick={() => {
                resetUploadFlow()
              }}
              variant="outline"
              size="sm"
              className="shrink-0 whitespace-nowrap border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
            >
              Analyze Another
            </Button>
            <Button
              className="shrink-0 whitespace-nowrap bg-gradient-primary hover:opacity-90"
              size="sm"
              disabled={isGeneratingReport || !hasFullProfitability}
              onClick={handleGenerateReport}
            >
              {isGeneratingReport ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : reportGenerated ? (
                <FileText className="mr-2 h-4 w-4" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              {isGeneratingReport ? 'Generating...' : reportGenerated ? 'Generated!' : hasFullProfitability ? 'Generate / Regenerate Report' : profitabilityResult.statusLabel || 'Waiting for matching file'}
            </Button>
          </div>
        </div>

        {uploadResult && (
          <UploadSuccessPanel
            result={uploadResult}
            uploadMode="profitability"
            onUploadAnother={resetUploadFlow}
          />
        )}

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
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              {/* Total Revenue - Clickable */}
              <button
                onClick={() => setActiveSection(activeSection === 'revenue' ? null : 'revenue')}
                className={`rounded-lg p-4 flex flex-col justify-between min-h-[100px] border bg-card transition-all duration-200 text-left group dark:bg-gradient-to-br dark:from-neutral-900 dark:to-neutral-800 ${
                  activeSection === 'revenue'
                    ? 'border-cyan-500 bg-cyan-50 dark:bg-gradient-to-br dark:from-cyan-900/30 dark:to-neutral-800'
                    : 'border-border hover:border-cyan-500/50 hover:bg-cyan-50 dark:hover:bg-gradient-to-br dark:hover:from-cyan-900/20'
                }`}
              >
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium text-center group-hover:text-cyan-400 transition-colors">Total Revenue</span>
                <div className="text-xl font-bold text-foreground text-center leading-tight group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                  {displayCurrency(kpis.totalRevenue)}
                </div>
              </button>

              {/* Total Expenses - Clickable */}
              <button
                onClick={() => setActiveSection(activeSection === 'expenses' ? null : 'expenses')}
                className={`rounded-lg p-4 flex flex-col justify-between min-h-[100px] border bg-card transition-all duration-200 text-left group dark:bg-gradient-to-br dark:from-neutral-900 dark:to-neutral-800 ${
                  activeSection === 'expenses'
                    ? 'border-purple-500 bg-purple-50 dark:bg-gradient-to-br dark:from-purple-900/30 dark:to-neutral-800'
                    : 'border-border hover:border-purple-500/50 hover:bg-purple-50 dark:hover:bg-gradient-to-br dark:hover:from-purple-900/20'
                }`}
              >
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium text-center group-hover:text-purple-400 transition-colors">Total Expenses</span>
                <div className="text-xl font-bold text-purple-400 text-center leading-tight group-hover:text-purple-300 transition-colors">
                  {displayCurrency(kpis.totalExpenses)}
                </div>
              </button>

              <button
                onClick={() => setActiveSection(activeSection === 'gross' ? null : 'gross')}
                className={`rounded-lg p-4 flex flex-col justify-between min-h-[100px] border bg-card transition-all duration-200 text-left group dark:bg-gradient-to-br dark:from-neutral-900 dark:to-neutral-800 ${
                  activeSection === 'gross'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-gradient-to-br dark:from-emerald-900/30 dark:to-neutral-800'
                    : 'border-border hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-gradient-to-br dark:hover:from-emerald-900/20'
                }`}
              >
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium text-center group-hover:text-emerald-400 transition-colors">Gross Profit</span>
                <div className={`text-xl font-bold text-center leading-tight ${(kpis.grossProfit ?? 0) >= 0 ? 'text-emerald-400' : 'text-purple-400'} group-hover:text-emerald-300 transition-colors`}>
                  {displayCurrency(kpis.grossProfit)}
                </div>
              </button>

              <button
                onClick={() => setActiveSection(activeSection === 'operating' ? null : 'operating')}
                className={`rounded-lg p-4 flex flex-col justify-between min-h-[100px] border bg-card transition-all duration-200 text-left group dark:bg-gradient-to-br dark:from-neutral-900 dark:to-neutral-800 ${
                  activeSection === 'operating'
                    ? 'border-blue-500 bg-blue-50 dark:bg-gradient-to-br dark:from-blue-900/30 dark:to-neutral-800'
                    : 'border-border hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-gradient-to-br dark:hover:from-blue-900/20'
                }`}
              >
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium text-center group-hover:text-blue-400 transition-colors">Operating Profit</span>
                <div className={`text-xl font-bold text-center leading-tight ${(kpis.operatingProfit ?? 0) >= 0 ? 'text-blue-400' : 'text-purple-400'} group-hover:text-blue-300 transition-colors`}>
                  {displayCurrency(kpis.operatingProfit)}
                </div>
              </button>

              <button
                onClick={() => setActiveSection(activeSection === 'profit' ? null : 'profit')}
                className={`rounded-lg p-4 flex flex-col justify-between min-h-[100px] border bg-card transition-all duration-200 text-left group dark:bg-gradient-to-br dark:from-neutral-900 dark:to-neutral-800 ${
                  activeSection === 'profit'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-gradient-to-br dark:from-emerald-900/30 dark:to-neutral-800'
                    : 'border-border hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-gradient-to-br dark:hover:from-emerald-900/20'
                  }`}
              >
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium text-center group-hover:text-emerald-400 transition-colors">Operating Margin</span>
                <div className={`text-xl font-bold text-center leading-tight ${(kpis.operatingMargin ?? 0) >= 0 ? 'text-emerald-400' : 'text-purple-400'} group-hover:text-emerald-300 transition-colors`}>
                  {displayPercent(kpis.operatingMargin)}
                </div>
              </button>

              <button
                onClick={() => setActiveSection(activeSection === 'margin' ? null : 'margin')}
                className={`rounded-lg p-4 flex flex-col justify-between min-h-[100px] border bg-card transition-all duration-200 text-left group dark:bg-gradient-to-br dark:from-neutral-900 dark:to-neutral-800 ${
                  activeSection === 'margin'
                    ? 'border-blue-500 bg-blue-50 dark:bg-gradient-to-br dark:from-blue-900/30 dark:to-neutral-800'
                    : 'border-border hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-gradient-to-br dark:hover:from-blue-900/20'
                  }`}
              >
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium text-center group-hover:text-blue-400 transition-colors">Data Confidence</span>
                <div className="text-xl font-bold text-center leading-tight text-blue-400 group-hover:text-blue-300 transition-colors">
                  {typeof profitabilityResult.dataConfidence === "number" ? `${profitabilityResult.dataConfidence}%` : "Verified"}
                </div>
              </button>

              {/* Top Cost Category - Highlighted if it's Salaries/Personnel - Clickable */}
              {profitabilityResult.expenseCategories && profitabilityResult.expenseCategories.length > 0 && (
                <button
                  onClick={() => setActiveSection(activeSection === 'topcost' ? null : 'topcost')}
                  className={`rounded-lg p-4 flex flex-col justify-between min-h-[100px] border transition-all duration-200 text-left group ${
                    activeSection === 'topcost'
                      ? 'border-orange-500 bg-orange-50 dark:bg-gradient-to-br dark:from-orange-900/40 dark:to-neutral-800'
                      : profitabilityResult.expenseCategories[0]?.[0]?.toLowerCase().includes('salar')
                        ? 'border-orange-500/50 bg-orange-50 hover:border-orange-500 dark:bg-gradient-to-br dark:from-orange-900/40 dark:to-neutral-800'
                        : 'border-border bg-card hover:border-orange-500/50 dark:bg-gradient-to-br dark:from-neutral-900 dark:to-neutral-800'
                  }`}
                >
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium text-center group-hover:text-orange-400 transition-colors">Top Cost Driver</span>
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
                    <div className="bg-card rounded-lg p-3 border border-border">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Cost Concentration</span>
                      <div className={`text-lg font-bold mt-1 ${concentration > 40 ? 'text-orange-400' : 'text-foreground'}`}>
                        {concentration.toFixed(1)}%
                      </div>
                    </div>
                  )
                })()}

                {/* Revenue-to-Expense Ratio */}
                {kpis.totalRevenue !== null && kpis.totalExpenses !== null && kpis.totalExpenses > 0 && (
                  <div className="bg-card rounded-lg p-3 border border-border">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Revenue/Expense</span>
                    <div className="text-lg font-bold text-foreground mt-1">
                      {(kpis.totalRevenue / kpis.totalExpenses).toFixed(2)}x
                    </div>
                  </div>
                )}

                {/* Expense Count */}
                <div className="bg-card rounded-lg p-3 border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Cost Categories</span>
                  <div className="text-lg font-bold text-foreground mt-1">
                    {profitabilityResult.expenseCategories.length}
                  </div>
                </div>

                {/* Top 3 Cost Share */}
                {(() => {
                  const totalExpenses = profitabilityResult.expenseCategories.reduce((sum: number, [_, val]: [string, number]) => sum + val, 0)
                  const top3Total = profitabilityResult.expenseCategories.slice(0, 3).reduce((sum: number, [_, val]: [string, number]) => sum + (val as number), 0)
                  const top3Share = top3Total / totalExpenses * 100
                  return (
                    <div className="bg-card rounded-lg p-3 border border-border">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Top 3 Cost Share</span>
                      <div className="text-lg font-bold text-foreground mt-1">
                        {top3Share.toFixed(1)}%
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Section Divider */}
            <div className="border-t border-border" />

            {/* Executive Summary */}
            <Card className="border border-border bg-card dark:bg-gradient-to-br dark:from-neutral-900 dark:via-neutral-800 dark:to-neutral-900">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-foreground text-sm">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  Executive Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground leading-relaxed">
                  {!hasFullProfitability
                    ? profitabilityResult.statusLabel || `Profitability is waiting for the matching file. Unavailable metrics list the missing source columns.`
                    : (kpis.operatingProfit ?? 0) >= 0
                    ? `Your business generated ${displayCurrency(kpis.totalRevenue)} in revenue with ${displayCurrency(kpis.totalExpenses)} in expenses, resulting in operating profit of ${displayCurrency(kpis.operatingProfit)} (${displayPercent(kpis.operatingMargin)} operating margin). ${profitabilityResult.expenseCategories?.[0] ? `The largest expense category is ${profitabilityResult.expenseCategories[0][0]} at ${formatCurrencyForKPI(profitabilityResult.expenseCategories[0][1] as number)}.` : ''}`
                    : `Your business generated ${displayCurrency(kpis.totalRevenue)} in revenue but incurred ${displayCurrency(kpis.totalExpenses)} in expenses, resulting in an operating loss of ${formatCurrencyForKPI(Math.abs(kpis.operatingProfit ?? 0))}. Immediate cost reduction strategies are recommended.`
                  }
                </p>
              </CardContent>
            </Card>

            {/* Section Divider */}
            <div className="border-t border-border" />

            {/* Key Drivers - Only render if we have data */}
            {(profitabilityResult.expenseCategories?.length > 0 || profitabilityResult.revenueByProduct?.length > 0 || profitabilityResult.revenueByRegion?.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top Cost Categories - Only if we have expense data */}
                {profitabilityResult.expenseCategories && profitabilityResult.expenseCategories.length > 0 && (
                  <Card className={`bg-card border transition-all duration-300 ${
                    activeSection === 'expenses' || activeSection === 'topcost'
                      ? 'border-purple-500 shadow-lg shadow-purple-500/10'
                      : 'border-border'
                  }`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-foreground text-sm flex items-center gap-2">
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
                                  ? (isSalaries ? 'bg-orange-50 border border-orange-500/30 dark:bg-orange-900/20' : 'bg-muted')
                                  : 'hover:bg-muted/50'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`text-xs font-medium ${idx === 0 ? (isSalaries ? 'text-orange-400' : 'text-purple-400') : 'text-muted-foreground'} shrink-0`}>
                                  {idx + 1}.
                                </span>
                                <span className={`text-sm truncate text-foreground ${isSalaries ? 'font-medium' : ''}`} title={name}>
                                  {name}
                                  {isSalaries && <span className="text-orange-400 ml-1 text-xs">(Personnel)</span>}
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                <div className={`text-sm font-medium ${idx === 0 ? (isSalaries ? 'text-orange-400' : 'text-purple-400') : 'text-muted-foreground'}`}>
                                  {formatCurrencyForKPI(value)}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
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
                  <Card className={`bg-card border transition-all duration-300 ${
                    activeSection === 'revenue'
                      ? 'border-cyan-500 shadow-lg shadow-cyan-500/10'
                      : 'border-border'
                  }`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-foreground text-sm flex items-center gap-2">
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
                              className={`flex items-center justify-between p-2 rounded-md ${idx === 0 ? 'bg-muted' : ''}`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`text-xs font-medium ${idx === 0 ? 'text-cyan-400' : 'text-muted-foreground'} shrink-0`}>
                                  {idx + 1}.
                                </span>
                                <span className="text-sm truncate text-foreground" title={name}>
                                  {name}
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                <div className={`text-sm font-medium ${idx === 0 ? 'text-cyan-400' : 'text-muted-foreground'}`}>
                                  {formatCurrencyForKPI(value)}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
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
              <div className="border-t border-border" />
            )}

            {/* Business Insights - Only if we have insights */}
            {insights.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-foreground flex items-center gap-2 text-sm">
                    <Lightbulb className="h-4 w-4 text-amber-400" />
                    Business Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-2">
                    {insights.map((insight, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-sm text-foreground"
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
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-foreground flex items-center gap-2 text-sm">
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
                        <div className="font-medium text-sm text-foreground">{rec.action}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{rec.reason}</div>
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
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-foreground text-base">Expense Distribution</CardTitle>
                </CardHeader>
                <CardContent>
<div className="h-[300px]">
                     <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-foreground text-base">Revenue Distribution</CardTitle>
                </CardHeader>
                <CardContent>
<div className="h-[300px]">
                     <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
        <Card className="p-5 bg-card border-border">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">What You'll Get</h3>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-muted rounded-lg p-3">
              <p className="text-xs text-muted-foreground uppercase">Total Revenue</p>
              <p className={`text-lg font-bold ${stats.hasRevenue ? 'text-cyan-400' : 'text-muted-foreground'}`}>
                {stats.totalRevenue !== null ? formatCurrency(stats.totalRevenue) : "—"}
              </p>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <p className="text-xs text-muted-foreground uppercase">Total Expenses</p>
              <p className={`text-lg font-bold ${stats.hasExpenses ? 'text-purple-400' : 'text-muted-foreground'}`}>
                {stats.totalExpenses !== null ? formatCurrency(stats.totalExpenses) : "—"}
              </p>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <p className="text-xs text-muted-foreground uppercase">Net Profit</p>
              <p className={`text-lg font-bold ${
                stats.netProfit === null ? 'text-muted-foreground' : stats.netProfit >= 0 ? 'text-cyan-400' : 'text-purple-400'
              }`}>
                {stats.netProfit !== null ? formatCurrency(stats.netProfit) : "—"}
              </p>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <p className="text-xs text-muted-foreground uppercase">Net Margin</p>
              <p className={`text-lg font-bold ${
                stats.netMargin === null ? 'text-muted-foreground' : stats.netMargin >= 0 ? 'text-cyan-400' : 'text-purple-400'
              }`}>
                {stats.netMargin !== null ? `${stats.netMargin.toFixed(1)}%` : "—"}
              </p>
            </div>
          </div>

          {/* Status Note */}
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5 mb-4">
            {!stats.hasRevenue && !stats.hasExpenses && "Upload files above to see your profitability analysis."}
            {stats.hasRevenue && !stats.hasExpenses && "Waiting for Expenses file."}
            {!stats.hasRevenue && stats.hasExpenses && "Waiting for Revenue file."}
            {stats.hasRevenue && stats.hasExpenses && !stats.matchKey &&
              "Based on totals. Add shared period + department, company_id, or cost_center columns for matched comparison."}
            {stats.hasRevenue && stats.hasExpenses && stats.matchKey &&
              `Matched analysis available using ${stats.matchKey.replaceAll("_", " + ")}.`}
          </div>

          {/* Top Expense Categories */}
          {stats.expenseCategories.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground uppercase mb-2">Top Cost Categories</p>
              <div className="flex flex-wrap gap-2">
                {stats.expenseCategories.map(([cat, amount]) => (
                  <div key={cat} className="px-3 py-1.5 rounded-full bg-muted border border-border text-xs">
                    <span className="text-foreground">{cat}</span>
                    <span className="text-purple-400 ml-2">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Revenue Products */}
          {stats.revenueByProduct.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground uppercase mb-2">Top Revenue Sources</p>
              <div className="flex flex-wrap gap-2">
                {stats.revenueByProduct.slice(0, 5).map(([item, amount]) => (
                  <div key={item} className="px-3 py-1.5 rounded-full bg-muted border border-border text-xs">
                    <span className="text-foreground">{item}</span>
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
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {generateStatus === "parsing" && "Parsing"}
                {generateStatus === "uploading" && "Uploading"}
                {generateStatus === "analyzing" && "Analyzing"}
                {!["parsing", "uploading", "analyzing"].includes(generateStatus) && "Processing"}
              </>
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

      {uploadResult && !profitabilityResult && (
        <UploadSuccessPanel
          result={uploadResult}
          uploadMode="profitability"
          onUploadAnother={resetUploadFlow}
        />
      )}
    </div>
  )
}
