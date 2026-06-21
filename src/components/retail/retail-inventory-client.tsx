"use client"

import { useState, useRef, useCallback } from "react"
import * as XLSX from "xlsx"
import {
  Upload, FileText, AlertTriangle, TrendingDown,
  TrendingUp, Loader2, CheckCircle2, AlertCircle,
  Table, BarChart3, Info, Building2,
  ChevronDown, ChevronUp,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataProcessingFlow } from "@/components/ui/data-processing-flow"
import { StatCard } from "@/components/ui/stat-card"
import { useToast } from "@/hooks/use-toast"
import { parseCSVFileBrowser } from "@/lib/data/csvLoaderBrowser"
import { debugError } from "@/lib/utils/debug"

type PageState = "idle" | "parsing" | "uploading" | "analyzing" | "complete" | "error"

interface ParsedData {
  fileName: string
  rows: Record<string, unknown>[]
  columns: string[]
  rowCount: number
  columnCount: number
}

interface LowStockItem {
  product: string
  sku: string
  category: string
  stock: number
  reorderPoint: number
  unitsSold: number
  revenue: number
  cost: number
  grossProfit: number
  margin: number
  lastSaleDate: string
  orderId: string
  recommendation: string
}

interface DeadStockItem {
  product: string
  sku: string
  category: string
  stock: number
  reorderPoint: number
  unitsSold: number
  revenue: number
  cost: number
  grossProfit: number
  margin: number
  lastSaleDate: string
  daysSinceLastSale: number | null
  stockValue: number
  orderId: string
  suggestedAction: string
  recommendation: string
}

interface TopProfitItem {
  product: string
  sku: string
  category: string
  stock: number
  reorderPoint: number
  unitsSold: number
  profit: number
  margin: number
  revenue: number
  cost: number
  lastSaleDate: string
  orderId: string
  reason: string
  recommendation: string
}

interface RetailInsights {
  aiSummary: string | null
  aiExplanation: string | null
  aiRecommendation: string | null
  lowStock: LowStockItem[]
  deadStock: DeadStockItem[]
  topProfit: TopProfitItem[]
}

function matchColumn(columns: string[], keywords: string[]): string | null {
  const normalized = columns.map((c) => ({
    original: c,
    normalized: c.toLowerCase().trim().replace(/[^a-z0-9]/g, "_"),
  }))
  for (const keyword of keywords) {
    const kw = keyword.toLowerCase().trim().replace(/[^a-z0-9]/g, "_")
    const found = normalized.find((c) => c.normalized.includes(kw))
    if (found) return found.original
  }
  return null
}

function toNumber(val: unknown): number {
  if (typeof val === "number") return val
  if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9.\-]/g, "")
    const n = parseFloat(cleaned)
    return isNaN(n) ? 0 : n
  }
  return 0
}

function toText(val: unknown, fallback = "Not provided"): string {
  if (val === null || val === undefined) return fallback
  const text = String(val).trim()
  return text.length > 0 ? text : fallback
}

function parseDateValue(val: unknown): Date | null {
  if (val instanceof Date && !isNaN(val.getTime())) return val
  if (typeof val === "number" && val > 0) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const date = new Date(excelEpoch.getTime() + val * 24 * 60 * 60 * 1000)
    return isNaN(date.getTime()) ? null : date
  }
  if (typeof val === "string" && val.trim()) {
    const date = new Date(val)
    return isNaN(date.getTime()) ? null : date
  }
  return null
}

function formatDateValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "Not provided"
}

function isUnitCostColumn(column: string | null): boolean {
  if (!column) return false
  return /unit|wholesale|purchase|buying|cost_price|product_cost/i.test(column)
}

function detectColumns(columns: string[]) {
  return {
    skuCol: matchColumn(columns, [
      "sku", "product_sku", "item_sku", "variant_sku", "barcode",
      "upc", "ean", "code", "item_code", "product_code",
    ]),
    productCol: matchColumn(columns, [
      "product_name", "item_name", "product", "name", "item", "title",
      "description", "article",
    ]),
    categoryCol: matchColumn(columns, [
      "category", "department", "collection", "product_type", "type",
      "class", "group",
    ]),
    stockCol: matchColumn(columns, [
      "stock", "quantity", "qty", "on_hand", "inventory", "available",
      "qty_in_stock", "units_in_stock", "stock_qty", "stock_level",
    ]),
    reorderPointCol: matchColumn(columns, [
      "reorder_point", "reorder", "minimum_stock", "min_stock", "par_level",
      "safety_stock", "restock_level",
    ]),
    salesCol: matchColumn(columns, [
      "sold", "units_sold", "quantity_sold", "sales_quantity", "qty_sold",
      "sales", "sell", "quantity", "qty",
    ]),
    revenueCol: matchColumn(columns, [
      "revenue", "sales_amount", "total_sales", "income", "turnover",
      "total_revenue", "amount", "price", "selling_price", "retail_price",
      "unit_price", "sale_price",
    ]),
    costCol: matchColumn(columns, [
      "cost", "cogs", "unit_cost", "product_cost", "cost_price",
      "wholesale_price", "purchase_price", "cost_of_goods", "buying_price",
    ]),
    dateCol: matchColumn(columns, [
      "date", "transaction_date", "order_date", "sale_date", "created_at",
      "timestamp", "datetime", "date_created",
    ]),
    orderCol: matchColumn(columns, [
      "order_number", "order_id", "orderid", "order", "invoice_number",
      "invoice_id", "receipt_number", "transaction_id",
    ]),
  }
}

type DetectedColumns = ReturnType<typeof detectColumns>

interface RetailRecord {
  product: string
  sku: string
  category: string
  stock: number
  reorderPoint: number
  unitsSold: number
  revenue: number
  cost: number
  grossProfit: number
  margin: number
  lastSaleDate: string
  lastSaleAt: Date | null
  orderId: string
  stockValue: number
}

function buildRetailRecords(rows: Record<string, unknown>[], detected: DetectedColumns): RetailRecord[] {
  return rows
    .map((row) => {
      const product = detected.productCol
        ? toText(row[detected.productCol], "Unknown product")
        : "Unknown product"
      const sku = detected.skuCol ? toText(row[detected.skuCol]) : "Not provided"
      const category = detected.categoryCol ? toText(row[detected.categoryCol]) : "Not provided"
      const stock = detected.stockCol ? toNumber(row[detected.stockCol]) : 0
      const reorderPoint = detected.reorderPointCol ? toNumber(row[detected.reorderPointCol]) : 10
      const unitsSold = detected.salesCol ? toNumber(row[detected.salesCol]) : 0
      const revenue = detected.revenueCol ? toNumber(row[detected.revenueCol]) : 0
      const rawCost = detected.costCol ? toNumber(row[detected.costCol]) : 0
      const unitCost = isUnitCostColumn(detected.costCol) ? rawCost : unitsSold > 0 ? rawCost / unitsSold : rawCost
      const cost = isUnitCostColumn(detected.costCol) && unitsSold > 0 ? rawCost * unitsSold : rawCost
      const grossProfit = revenue - cost
      const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0
      const lastSaleAt = detected.dateCol ? parseDateValue(row[detected.dateCol]) : null
      const orderId = detected.orderCol ? toText(row[detected.orderCol]) : "Not provided"

      return {
        product,
        sku,
        category,
        stock,
        reorderPoint,
        unitsSold,
        revenue,
        cost,
        grossProfit,
        margin,
        lastSaleDate: formatDateValue(lastSaleAt),
        lastSaleAt,
        orderId,
        stockValue: Math.max(stock, 0) * Math.max(unitCost, 0),
      }
    })
    .filter((record) => record.product !== "Unknown product" || record.sku !== "Not provided")
}

function getReferenceDate(records: RetailRecord[]): Date | null {
  return records.reduce<Date | null>((latest, record) => {
    if (!record.lastSaleAt) return latest
    if (!latest || record.lastSaleAt > latest) return record.lastSaleAt
    return latest
  }, null)
}

function computeLowStock(
  records: RetailRecord[],
): LowStockItem[] {
  return records
    .filter((item) => item.stock <= item.reorderPoint && (item.product !== "Unknown product" || item.sku !== "Not provided"))
    .map((item) => ({
      ...item,
      recommendation: `Stock ${formatPlainNumber(item.stock)}, reorder point ${formatPlainNumber(item.reorderPoint)}, sold ${formatPlainNumber(item.unitsSold)} units recently → reorder recommended.`,
    }))
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 20)
}

function computeDeadStock(
  records: RetailRecord[],
): DeadStockItem[] {
  const referenceDate = getReferenceDate(records)

  return records
    .map((item) => {
      const daysSinceLastSale = referenceDate && item.lastSaleAt
        ? Math.max(0, Math.floor((referenceDate.getTime() - item.lastSaleAt.getTime()) / 86_400_000))
        : null
      const suggestedAction = item.unitsSold === 0
        ? "Discount or bundle"
        : daysSinceLastSale !== null && daysSinceLastSale >= 60
          ? "Bundle or stop reorder"
          : "Review before reorder"

      return {
        ...item,
        daysSinceLastSale,
        suggestedAction,
        recommendation:
          `${suggestedAction}: ${item.stock > 0 ? "clear stocked units before buying more" : "keep off reorder lists until demand returns"}.`,
      }
    })
    .filter((item) => item.stock > 0 && (item.unitsSold <= 0 || (item.daysSinceLastSale !== null && item.daysSinceLastSale >= 60)))
    .sort((a, b) => b.stockValue - a.stockValue)
    .slice(0, 20)
}

function computeTopProfit(
  records: RetailRecord[],
): TopProfitItem[] {
  const grouped = new Map<string, RetailRecord>()

  for (const record of records) {
    const key = [
      record.product.toLowerCase(),
      record.sku.toLowerCase(),
      record.orderId === "Not provided" ? "" : record.orderId.toLowerCase(),
    ].join("|")
    const existing = grouped.get(key)

    if (!existing) {
      grouped.set(key, { ...record })
      continue
    }

    const revenue = existing.revenue + record.revenue
    const cost = existing.cost + record.cost
    const grossProfit = revenue - cost
    const lastSaleAt = !existing.lastSaleAt || (record.lastSaleAt && record.lastSaleAt > existing.lastSaleAt)
      ? record.lastSaleAt
      : existing.lastSaleAt

    grouped.set(key, {
      ...existing,
      stock: Math.max(existing.stock, record.stock),
      reorderPoint: Math.max(existing.reorderPoint, record.reorderPoint),
      unitsSold: existing.unitsSold + record.unitsSold,
      revenue,
      cost,
      grossProfit,
      margin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
      lastSaleAt,
      lastSaleDate: formatDateValue(lastSaleAt),
      stockValue: existing.stockValue + record.stockValue,
    })
  }

  return Array.from(grouped.values())
    .filter((item) => item.grossProfit > 0 && (item.product !== "Unknown product" || item.sku !== "Not provided"))
    .sort((a, b) => b.grossProfit - a.grossProfit)
    .slice(0, 20)
    .map((item) => ({
      ...item,
      profit: item.grossProfit,
      reason: item.margin >= 50
        ? "High margin converts sales into strong profit."
        : item.unitsSold >= 10
          ? "Sales volume drives strong total profit."
          : "Positive margin and profitable sales make this worth protecting.",
      recommendation: "Keep this item in stock and protect margin before discounting.",
    }))
}

function formatPlainNumber(val: number): string {
  return new Intl.NumberFormat().format(val)
}

function generateFallbackSummary(
  rows: Record<string, unknown>[],
  columns: string[],
  lowStock: LowStockItem[],
  deadStock: DeadStockItem[],
  topProfit: TopProfitItem[],
): { insight: string; explanation: string; recommendation: string } {
  const total = new Intl.NumberFormat().format(rows.length)
  const cols = columns.length
  const low = lowStock.length
  const dead = deadStock.length
  const profit = topProfit.length > 0 ? topProfit[0].product : "N/A"
  const maxProfit = topProfit.length > 0
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(topProfit[0].profit)
    : "N/A"

  return {
    insight: `Analysis of ${total} products complete`,
    explanation:
      `Found ${total} inventory records across ${cols} columns. ` +
      `${low} products have low stock (below 10 units). ` +
      `${dead} products have no recorded sales. ` +
      `Top profit product: ${profit} (${maxProfit}).`,
    recommendation:
      low > 0
        ? `Restock ${low} low-inventory products to prevent stockouts. Focus on reordering top-selling items first.`
        : "Review pricing strategy and consider promotions for slow-moving items.",
  }
}

export function RetailInventoryClient() {
  const [state, setState] = useState<PageState>("idle")
  const [dragActive, setDragActive] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [insights, setInsights] = useState<RetailInsights | null>(null)
  const [errorMessage, setErrorMessage] = useState("")
  const [processingStep, setProcessingStep] = useState(0)
  const [showAllColumns, setShowAllColumns] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const startAnalysis = useCallback(async (datasetId: string | null, data: ParsedData) => {
    setState("analyzing")
    setProcessingStep(5)

    const { rows, columns } = data
    const detected = detectColumns(columns)
    const retailRecords = buildRetailRecords(rows, detected)
    const lowStock = computeLowStock(retailRecords)
    const deadStock = computeDeadStock(retailRecords)
    const topProfit = computeTopProfit(retailRecords)

    let aiSummary: string | null = null
    let aiExplanation: string | null = null
    let aiRecommendation: string | null = null

    if (datasetId) {
      try {
        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: "Analyze this retail inventory data for a store owner. Explain exactly which product and SKU are affected, why each issue matters, and what action to take. Include low stock alerts, dead stock with stuck stock value, and top profit products without repeated duplicate product rows.",
            datasetId,
          }),
        })
        const analyzeResult = await analyzeRes.json()
        if (analyzeResult.success) {
          aiSummary = analyzeResult.insight || null
          aiExplanation = analyzeResult.explanation || null
          aiRecommendation = analyzeResult.recommendation || null
        }
      } catch (err) {
        debugError("Analysis error:", err)
      }
    }

    if (!aiSummary) {
      const fallback = generateFallbackSummary(rows, columns, lowStock, deadStock, topProfit)
      aiSummary = fallback.insight
      aiExplanation = fallback.explanation
      aiRecommendation = fallback.recommendation
    }

    setInsights({ aiSummary, aiExplanation, aiRecommendation, lowStock, deadStock, topProfit })
    setState("complete")
  }, [])

  const uploadFile = useCallback(async (originalFile: File, data: ParsedData) => {
    try {
      let uploadFile: File
      if (originalFile.name.match(/\.xlsx?$/i)) {
        const csvContent = convertToCSV(data.rows, data.columns)
        uploadFile = new File(
          [csvContent],
          originalFile.name.replace(/\.xlsx?$/i, ".csv"),
          { type: "text/csv" },
        )
      } else {
        uploadFile = originalFile
      }

      const formData = new FormData()
      formData.append("file", uploadFile)

      const response = await fetch("/api/upload", { method: "POST", body: formData })
      const result = await response.json()

      if (!response.ok || !result.success) {
        debugError("Upload failed:", result.error)
        toast({
          title: "Upload warning",
          description: "Analysis will use in-memory data only",
          variant: "default",
        })
        startAnalysis(null, data)
        return
      }

      setProcessingStep(4)
      setTimeout(() => startAnalysis(result.datasetId, data), 300)
    } catch (err) {
      debugError("Upload error:", err)
      toast({
        title: "Upload warning",
        description: "Continuing with local analysis",
        variant: "default",
      })
      startAnalysis(null, data)
    }
  }, [toast, startAnalysis])

  const parseFile = useCallback(async (file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      setErrorMessage("File must be under 50MB")
      setState("error")
      return
    }

    setState("parsing")
    setProcessingStep(1)
    setErrorMessage("")

    try {
      let rows: Record<string, unknown>[] = []
      let columns: string[] = []

      if (file.name.endsWith(".csv")) {
        const parsed = await parseCSVFileBrowser(file)
        rows = parsed.rows
        columns = parsed.columns
      } else if (file.name.match(/\.xlsx?$/i)) {
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: "array" })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
        })
        rows = json
        columns = json.length > 0 ? Object.keys(json[0]) : []
      } else {
        setErrorMessage("Please upload a CSV or Excel (.xlsx) file")
        setState("error")
        return
      }

      if (rows.length === 0 || columns.length === 0) {
        setErrorMessage("File appears to be empty or unreadable")
        setState("error")
        return
      }

      const data: ParsedData = {
        fileName: file.name,
        rows,
        columns,
        rowCount: rows.length,
        columnCount: columns.length,
      }
      setParsedData(data)
      setProcessingStep(2)

      toast({
        title: "File parsed",
        description: `${rows.length} rows, ${columns.length} columns detected`,
      })

      setTimeout(() => {
        setState("uploading")
        setProcessingStep(3)
        uploadFile(file, data)
      }, 500)
    } catch (err) {
      debugError("Parse error:", err)
      setErrorMessage("Failed to parse file. Check the format and try again.")
      setState("error")
    }
  }, [toast, uploadFile])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
    if (e.target) e.target.value = ""
  }, [parseFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) parseFile(file)
  }, [parseFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }, [])

  const reset = useCallback(() => {
    setState("idle")
    setParsedData(null)
    setInsights(null)
    setErrorMessage("")
    setProcessingStep(0)
    setShowAllColumns(false)
  }, [])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val)

  const formatPercent = (val: number) => `${val.toFixed(1)}%`

  const formatNumber = (val: number) => new Intl.NumberFormat().format(val)

  const visibleColumns = parsedData
    ? showAllColumns
      ? parsedData.columns
      : parsedData.columns.slice(0, 8)
    : []

  return (
    <div className="min-w-0 flex-1 px-4 pt-16 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Upload Card */}
        <Card
          className={`relative border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden ${
            dragActive
              ? "border-primary bg-primary/5 scale-[1.01] shadow-lg shadow-primary/10"
              : "border-border hover:border-primary/30"
          } ${state === "complete" ? "border-green-500/50 bg-green-500/5" : ""} ${
            state === "error" ? "border-destructive/50 bg-destructive/5" : ""
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            disabled={state === "parsing" || state === "uploading" || state === "analyzing"}
          />
          <CardContent className="p-5 sm:p-7">
            <div className="flex flex-col items-center gap-3">
              {(state === "parsing" || state === "uploading" || state === "analyzing") && processingStep > 0 && (
                <div className="mb-2">
                  <DataProcessingFlow currentStep={processingStep} />
                </div>
              )}

              <div
                className={`flex h-12 w-12 items-center justify-center rounded-lg transition-all ${
                  state === "parsing" || state === "uploading" || state === "analyzing"
                    ? "bg-primary/10"
                    : state === "complete"
                      ? "bg-green-500/10"
                      : state === "error"
                        ? "bg-destructive/10"
                        : "bg-gradient-to-br from-primary to-primary/60"
                }`}
              >
                {state === "parsing" ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                ) : state === "uploading" || state === "analyzing" ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                ) : state === "complete" ? (
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                ) : state === "error" ? (
                  <AlertCircle className="h-6 w-6 text-destructive" />
                ) : (
                  <Upload className="h-6 w-6 text-white" />
                )}
              </div>

              <div className="text-center space-y-1.5">
                {state === "parsing" && (
                  <>
                    <h3 className="text-base font-semibold">Parsing file...</h3>
                    <p className="text-xs text-muted-foreground">Reading rows and columns</p>
                  </>
                )}
                {state === "uploading" && (
                  <>
                    <h3 className="text-base font-semibold">Uploading file...</h3>
                    <p className="text-xs text-muted-foreground">Saving to your account</p>
                  </>
                )}
                {state === "analyzing" && (
                  <>
                    <h3 className="text-base font-semibold">Analyzing inventory...</h3>
                    <p className="text-xs text-muted-foreground">Computing retail insights</p>
                  </>
                )}
                {state === "complete" && (
                  <>
                    <h3 className="text-base font-semibold text-green-500">Analysis complete</h3>
                    <p className="text-xs text-muted-foreground">Ready to review insights below</p>
                  </>
                )}
                {state === "error" && (
                  <>
                    <h3 className="text-base font-semibold text-destructive">Error</h3>
                    <p className="text-xs text-muted-foreground">{errorMessage || "Something went wrong"}</p>
                  </>
                )}
                {state === "idle" && (
                  <>
                    <h3 className="text-base font-semibold">Upload CSV/Excel</h3>
                    <p className="text-xs text-muted-foreground">Drop a sales or inventory file, or click to browse</p>
                    <div className="mt-3 border-t border-border/40 pt-3">
                      <p className="text-xs text-muted-foreground/80">
                        <span className="font-medium text-foreground">CSV</span> and{" "}
                        <span className="font-medium text-foreground">Excel</span> files up to 50MB
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* File Summary */}
        {parsedData && state !== "idle" && state !== "error" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Parsed File Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon={FileText} label="File name" value={parsedData.fileName} />
                <StatCard icon={Table} label="Total rows" value={formatNumber(parsedData.rowCount)} />
                <StatCard icon={BarChart3} label="Total columns" value={formatNumber(parsedData.columnCount)} />
                <StatCard icon={Building2} label="Status" value={state === "complete" ? "Ready" : "Processing"} />
              </div>

              {/* Column names */}
              {parsedData.columns.length > 0 && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowAllColumns(!showAllColumns)
                    }}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Table className="h-3 w-3" />
                    {parsedData.columns.length} column{parsedData.columns.length > 1 ? "s" : ""}
                    {showAllColumns
                      ? <ChevronUp className="h-3 w-3" />
                      : <ChevronDown className="h-3 w-3" />}
                  </button>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {visibleColumns.map((col) => (
                      <span
                        key={col}
                        className="inline-flex items-center rounded-md bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary"
                      >
                        {col}
                      </span>
                    ))}
                    {!showAllColumns && parsedData.columns.length > 8 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowAllColumns(true)
                        }}
                        className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        +{parsedData.columns.length - 8} more
                      </button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* AI Insights Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-primary" />
              AI Insights Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {state === "analyzing" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating AI insights...
              </div>
            ) : insights?.aiSummary ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">{insights.aiSummary}</p>
                {insights.aiExplanation && (
                  <p className="text-sm text-muted-foreground">{insights.aiExplanation}</p>
                )}
                {insights.aiRecommendation && (
                  <div className="rounded-lg bg-primary/5 p-3">
                    <p className="text-xs font-medium text-primary mb-0.5">Recommendation</p>
                    <p className="text-sm text-muted-foreground">{insights.aiRecommendation}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Upload a file to see AI-powered inventory insights</p>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {state === "analyzing" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking stock levels...
              </div>
            ) : insights && insights.lowStock.length > 0 ? (
              <div className="space-y-3">
                <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                  Reorder these items first so recent sellers do not run out before the next buying cycle.
                </p>
                <div className="max-h-[32rem] overflow-auto rounded-lg border border-amber-500/20">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-amber-500/10 text-xs uppercase text-muted-foreground backdrop-blur">
                      <tr>
                        <th className="px-3 py-2 font-medium">Product / SKU</th>
                        <th className="px-3 py-2 font-medium">Category</th>
                        <th className="px-3 py-2 font-medium">Stock</th>
                        <th className="px-3 py-2 font-medium">Sold</th>
                        <th className="px-3 py-2 font-medium">Revenue</th>
                        <th className="px-3 py-2 font-medium">Profit</th>
                        <th className="px-3 py-2 font-medium">Margin</th>
                        <th className="px-3 py-2 font-medium">Last sale</th>
                        <th className="px-3 py-2 font-medium">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {insights.lowStock.map((item, i) => (
                        <tr key={`${item.sku}-${item.orderId}-${i}`} className="align-top">
                          <td className="px-3 py-2">
                            <div className="font-medium text-foreground">{item.product}</div>
                            <div className="text-xs text-muted-foreground">SKU: {item.sku}</div>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{item.category}</td>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-amber-600">{formatNumber(item.stock)}</div>
                            <div className="text-xs text-muted-foreground">Reorder: {formatNumber(item.reorderPoint)}</div>
                          </td>
                          <td className="px-3 py-2">{formatNumber(item.unitsSold)}</td>
                          <td className="px-3 py-2">{formatCurrency(item.revenue)}</td>
                          <td className="px-3 py-2">{formatCurrency(item.grossProfit)}</td>
                          <td className="px-3 py-2">{formatPercent(item.margin)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{item.lastSaleDate}</td>
                          <td className="px-3 py-2">
                            <details className="group">
                              <summary className="cursor-pointer text-xs font-medium text-primary">View</summary>
                              <div className="mt-2 w-64 space-y-1 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                                <div>Cost: {formatCurrency(item.cost)}</div>
                                <div>Order: {item.orderId}</div>
                                <div className="font-medium text-foreground">{item.recommendation}</div>
                              </div>
                            </details>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : insights && insights.lowStock.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                No low stock items detected
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Upload a file to see stock alerts</p>
            )}
          </CardContent>
        </Card>

        {/* Dead Stock & Slow Movers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Dead Stock &amp; Slow Movers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {state === "analyzing" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Identifying slow-moving products...
              </div>
            ) : insights && insights.deadStock.length > 0 ? (
              <div className="space-y-3">
                <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                  Free cash from items that sit on the shelf before reordering more of the same stock.
                </p>
                <div className="max-h-[32rem] overflow-auto rounded-lg border border-red-500/20">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-red-500/10 text-xs uppercase text-muted-foreground backdrop-blur">
                      <tr>
                        <th className="px-3 py-2 font-medium">Product / SKU</th>
                        <th className="px-3 py-2 font-medium">Category</th>
                        <th className="px-3 py-2 font-medium">Stock</th>
                        <th className="px-3 py-2 font-medium">Sold</th>
                        <th className="px-3 py-2 font-medium">Days since sale</th>
                        <th className="px-3 py-2 font-medium">Stock value stuck</th>
                        <th className="px-3 py-2 font-medium">Action</th>
                        <th className="px-3 py-2 font-medium">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {insights.deadStock.map((item, i) => (
                        <tr key={`${item.sku}-${item.orderId}-${i}`} className="align-top">
                          <td className="px-3 py-2">
                            <div className="font-medium text-foreground">{item.product}</div>
                            <div className="text-xs text-muted-foreground">SKU: {item.sku}</div>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{item.category}</td>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-red-600">{formatNumber(item.stock)}</div>
                            <div className="text-xs text-muted-foreground">Reorder: {formatNumber(item.reorderPoint)}</div>
                          </td>
                          <td className="px-3 py-2">{formatNumber(item.unitsSold)}</td>
                          <td className="px-3 py-2">
                            {item.daysSinceLastSale === null ? "No sale date" : formatNumber(item.daysSinceLastSale)}
                          </td>
                          <td className="px-3 py-2 font-medium">{formatCurrency(item.stockValue)}</td>
                          <td className="px-3 py-2">{item.suggestedAction}</td>
                          <td className="px-3 py-2">
                            <details>
                              <summary className="cursor-pointer text-xs font-medium text-primary">View</summary>
                              <div className="mt-2 w-64 space-y-1 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                                <div>Revenue: {formatCurrency(item.revenue)}</div>
                                <div>Cost: {formatCurrency(item.cost)}</div>
                                <div>Gross profit: {formatCurrency(item.grossProfit)}</div>
                                <div>Margin: {formatPercent(item.margin)}</div>
                                <div>Last sale: {item.lastSaleDate}</div>
                                <div>Order: {item.orderId}</div>
                                <div className="font-medium text-foreground">{item.recommendation}</div>
                              </div>
                            </details>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : insights && insights.deadStock.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                No dead stock detected
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Upload a file to identify slow-moving stock</p>
            )}
          </CardContent>
        </Card>

        {/* Top Profit Products */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Top Profit Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            {state === "analyzing" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Computing profitability...
              </div>
            ) : insights && insights.topProfit.length > 0 ? (
              <div className="space-y-3">
                <p className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-300">
                  Protect these winners: keep inventory available, avoid unnecessary markdowns, and watch supplier cost.
                </p>
                <div className="max-h-[32rem] overflow-auto rounded-lg border border-green-500/20">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-green-500/10 text-xs uppercase text-muted-foreground backdrop-blur">
                      <tr>
                        <th className="px-3 py-2 font-medium">Product / SKU</th>
                        <th className="px-3 py-2 font-medium">Category</th>
                        <th className="px-3 py-2 font-medium">Units sold</th>
                        <th className="px-3 py-2 font-medium">Revenue</th>
                        <th className="px-3 py-2 font-medium">Cost</th>
                        <th className="px-3 py-2 font-medium">Profit</th>
                        <th className="px-3 py-2 font-medium">Margin</th>
                        <th className="px-3 py-2 font-medium">Reason</th>
                        <th className="px-3 py-2 font-medium">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {insights.topProfit.map((item, i) => (
                        <tr key={`${item.sku}-${item.orderId}-${i}`} className="align-top">
                          <td className="px-3 py-2">
                            <div className="font-medium text-foreground">{item.product}</div>
                            <div className="text-xs text-muted-foreground">SKU: {item.sku}</div>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{item.category}</td>
                          <td className="px-3 py-2">{formatNumber(item.unitsSold)}</td>
                          <td className="px-3 py-2">{formatCurrency(item.revenue)}</td>
                          <td className="px-3 py-2">{formatCurrency(item.cost)}</td>
                          <td className="px-3 py-2 font-semibold text-green-600">{formatCurrency(item.profit)}</td>
                          <td className="px-3 py-2">{formatPercent(item.margin)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{item.reason}</td>
                          <td className="px-3 py-2">
                            <details>
                              <summary className="cursor-pointer text-xs font-medium text-primary">View</summary>
                              <div className="mt-2 w-64 space-y-1 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                                <div>Current stock: {formatNumber(item.stock)}</div>
                                <div>Reorder point: {formatNumber(item.reorderPoint)}</div>
                                <div>Last sale: {item.lastSaleDate}</div>
                                <div>Order: {item.orderId}</div>
                                <div className="font-medium text-foreground">{item.recommendation}</div>
                              </div>
                            </details>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : insights && insights.topProfit.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add cost and revenue columns to see profit rankings</p>
            ) : (
              <p className="text-sm text-muted-foreground">Upload a file to see profit rankings</p>
            )}
          </CardContent>
        </Card>

        {/* Reset button */}
        {state === "complete" && (
          <div className="flex justify-center pb-4">
            <button
              type="button"
              onClick={reset}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              Upload a different file
            </button>
          </div>
        )}
        {state === "error" && (
          <div className="flex justify-center pb-4">
            <button
              type="button"
              onClick={reset}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function convertToCSV(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")
  const body = rows
    .map((row) =>
      columns
        .map((col) => {
          const val = row[col]
          if (val === null || val === undefined) return ""
          return `"${String(val).replace(/"/g, '""')}"`
        })
        .join(","),
    )
    .join("\n")
  return header + "\n" + body
}
