"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import * as XLSX from "xlsx"
import {
  Upload, FileText, AlertTriangle, TrendingDown,
  TrendingUp, Loader2, CheckCircle2, AlertCircle,
  Table, BarChart3, Info, Building2,
  ChevronDown, ChevronUp, RefreshCw, Store,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataProcessingFlow } from "@/components/ui/data-processing-flow"
import { StatCard } from "@/components/ui/stat-card"
import { UploadSuccessPanel } from "@/components/forms/upload-success-panel"
import { USAGE_REFRESH_EVENT } from "@/components/ui/usage-monitor"
import { parseCreditExhaustionPayload, ZeroCreditModal, useZeroCreditModal } from "@/components/shared/zero-credit-modal"
import { useToast } from "@/hooks/use-toast"
import { parseCSVFileBrowser } from "@/lib/data/csvLoaderBrowser"
import { uploadDatasetFile, type UploadDatasetResponse } from "@/lib/upload/upload-client"
import { debugError } from "@/lib/utils/debug"
import {
  buildRetailRecords,
  computeDeadStock,
  computeLowStock,
  computeTopProfit,
  detectColumns,
} from "@/lib/retail/retail-record-engine"
import type {
  RetailDeadStockItem,
  RetailLowStockItem,
  RetailTopProfitItem,
} from "@/lib/retail/retail-record-engine"
import {
  formatRetailSourceParam,
  parseRetailSourceRef,
  type RetailAnalyticsSnapshot,
} from "@/lib/retail/retail-snapshot";
import {
  setActiveRetailSource,
} from "@/lib/retail/retail-source-bridge"

type PageState = "idle" | "parsing" | "uploading" | "analyzing" | "complete" | "error"

interface ParsedData {
  fileName: string
  rows: Record<string, unknown>[]
  columns: string[]
  rowCount: number
  columnCount: number
}

interface RetailInsights {
  aiSummary: string | null
  aiExplanation: string | null
  aiRecommendation: string | null
  lowStock: RetailLowStockItem[]
  deadStock: RetailDeadStockItem[]
  topProfit: RetailTopProfitItem[]
}

type SourceOptionDataset = {
  type: "dataset"
  id: string
  label: string
  fileName: string | null
  rowCount: number
  columnCount: number
  createdAt: string | null
}

type SourceOptionConnection = {
  type: "square"
  id: string
  label: string
  merchantId: string | null
  connectionStatus: string
  lastSuccessfulSyncAt: string | null
  counts: { locations: number; products: number; variants: number; orders: number }
}

type RetailSources = {
  datasets: SourceOptionDataset[]
  connections: SourceOptionConnection[]
}

const MAX_SYNC_POLL_ATTEMPTS = 40
const SYNC_POLL_INTERVAL_MS = 3000

const EMPTY_STATE_HINT = "Connect a retail system or upload CSV/Excel to start analyzing your business."

type SourceView = {
  loading: boolean
  error: string | null
  snapshot: RetailAnalyticsSnapshot | null
}

function sourceOptionValue(option: SourceOptionDataset | SourceOptionConnection): string {
  return option.type === "dataset"
    ? formatRetailSourceParam({ type: "dataset", datasetId: option.id })
    : formatRetailSourceParam({ type: option.type, connectionId: option.id })
}

function sourceOptionLabel(option: SourceOptionDataset | SourceOptionConnection): string {
  if (option.type === "dataset") return option.label || option.fileName || option.id
  return option.merchantId ? `Square — ${option.merchantId}` : "Square"
}

export function RetailInventoryClient({ embedded = false }: { embedded?: boolean }) {
  const [state, setState] = useState<PageState>("idle")
  const [dragActive, setDragActive] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [insights, setInsights] = useState<RetailInsights | null>(null)
  const [errorMessage, setErrorMessage] = useState("")
  const [processingStep, setProcessingStep] = useState(0)
  const [showAllColumns, setShowAllColumns] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadDatasetResponse | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeUploadRef = useRef(false)
  const { toast } = useToast()
  const zeroCredit = useZeroCreditModal()

  // Multi-source retail analytics state. The upload flow keeps its exact
  // historical behavior; connected sources render from a normalized
  // snapshot served by /api/retail/analytics.
  const [sources, setSources] = useState<RetailSources | null>(null)
  const [sourcesError, setSourcesError] = useState<string | null>(null)
  const [selectedSource, setSelectedSource] = useState<string | null>(null)
  const [sourceView, setSourceView] = useState<SourceView>({ loading: false, error: null, snapshot: null })
  const [syncing, setSyncing] = useState(false)
  const analyticsRequestRef = useRef(0)
  const selectedSourceRef = useRef<string | null>(null)

  const uploadFlowActive = state === "parsing" || state === "uploading" || state === "analyzing" || state === "complete" || state === "error"

  const updateSelectedSource = useCallback((value: string | null) => {
    selectedSourceRef.current = value
    setSelectedSource(value)
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href)
      if (value) {
        url.searchParams.set("source", value)
        url.searchParams.delete("datasetId")
      } else {
        url.searchParams.delete("source")
      }
      window.history.replaceState(null, "", url.toString())
    }
    const parsedRef = parseRetailSourceRef(value)
    setActiveRetailSource(
      parsedRef && parsedRef.type === "square"
        ? { type: "square", connectionId: parsedRef.connectionId, label: "Square" }
        : null,
    )
  }, [])

  const loadSources = useCallback(async (): Promise<RetailSources | null> => {
    try {
      const response = await fetch("/api/retail/sources", { cache: "no-store" })
      const payload = (await response.json()) as RetailSources & { error?: string }
      if (!response.ok) throw new Error(payload.error || "Retail data sources could not be loaded.")
      const nextSources: RetailSources = {
        datasets: Array.isArray(payload.datasets) ? payload.datasets : [],
        connections: Array.isArray(payload.connections) ? payload.connections : [],
      }
      setSources(nextSources)
      setSourcesError(null)
      return nextSources
    } catch (err) {
      debugError("Retail sources load error:", err)
      setSourcesError(err instanceof Error ? err.message : "Retail data sources could not be loaded.")
      return null
    }
  }, [])

  const fetchSnapshot = useCallback(async (sourceValue: string) => {
    const requestId = ++analyticsRequestRef.current
    setSourceView({ loading: true, error: null, snapshot: null })
    try {
      const response = await fetch(`/api/retail/analytics?source=${encodeURIComponent(sourceValue)}`, { cache: "no-store" })
      const payload = (await response.json()) as { snapshot?: RetailAnalyticsSnapshot; error?: string }
      if (analyticsRequestRef.current !== requestId) return
      if (!response.ok || !payload.snapshot) {
        throw new Error(payload.error || "Retail analytics could not be loaded.")
      }
      setSourceView({ loading: false, error: null, snapshot: payload.snapshot })
    } catch (err) {
      if (analyticsRequestRef.current !== requestId) return
      setSourceView({ loading: false, error: err instanceof Error ? err.message : "Retail analytics could not be loaded.", snapshot: null })
    }
  }, [])

  // Initial source selection: URL param wins (deep-link + refresh), then the
  // connected Square source, then the most recent retail dataset.
  useEffect(() => {
    let cancelled = false
    async function init() {
      const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null
      const urlSource = parseRetailSourceRef(params?.get("source") ?? null)
      const urlDatasetId = params?.get("datasetId")
      const initial = urlSource
        ? formatRetailSourceParam(urlSource)
        : urlDatasetId
          ? formatRetailSourceParam({ type: "dataset", datasetId: urlDatasetId })
          : null
      const loadedSources = await loadSources()
      if (cancelled) return
      const available = loadedSources ?? { datasets: [], connections: [] }
      if (initial) {
        updateSelectedSource(initial)
        return
      }
      const square = available.connections[0]
      const fallback = square
        ? sourceOptionValue(square)
        : available.datasets[0]
          ? sourceOptionValue(available.datasets[0])
          : null
      if (fallback) updateSelectedSource(fallback)
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [loadSources, updateSelectedSource])

  // Fetch analytics whenever a selected source is not covered by the active
  // upload flow (the upload flow renders its own fresh analysis).
  useEffect(() => {
    if (!selectedSource) {
      setSourceView({ loading: false, error: null, snapshot: null })
      return
    }
    if (uploadFlowActive) return
    void fetchSnapshot(selectedSource)
  }, [selectedSource, uploadFlowActive, fetchSnapshot])

  // A selected source that disappears (dataset deleted, Square disconnected)
  // falls back safely to the next available source.
  useEffect(() => {
    if (!sourceView.error || !sources || !selectedSource) return
    const stillAvailable = [...sources.connections, ...sources.datasets].some(
      (option) => sourceOptionValue(option) === selectedSource,
    )
    if (stillAvailable) return
    const fallback = sources.connections[0]
      ? sourceOptionValue(sources.connections[0])
      : sources.datasets[0]
        ? sourceOptionValue(sources.datasets[0])
        : null
    updateSelectedSource(fallback)
    if (fallback) toast({
      title: "Retail source switched",
      description: "The previously selected retail source is no longer available.",
    })
  }, [sourceView.error, sources, selectedSource, updateSelectedSource, toast])

  async function handleSourceSelect(value: string) {
    if (value === selectedSource) return
    updateSelectedSource(value)
  }

  async function handleSyncNow() {
    const parsedRef = parseRetailSourceRef(selectedSourceRef.current)
    if (!parsedRef || parsedRef.type !== "square") return
    setSyncing(true)
    try {
      const response = await fetch(`/api/integrations/retail/${parsedRef.connectionId}/sync`, { method: "POST" })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(payload.error || "Sync could not be started.")

      const syncStartedAt = Date.now()
      for (let attempt = 0; attempt < MAX_SYNC_POLL_ATTEMPTS; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, SYNC_POLL_INTERVAL_MS))
        const requestId = ++analyticsRequestRef.current
        const analyticsResponse = await fetch(
          `/api/retail/analytics?source=${encodeURIComponent(selectedSourceRef.current ?? "")}`,
          { cache: "no-store" },
        )
        const analyticsPayload = (await analyticsResponse.json()) as { snapshot?: RetailAnalyticsSnapshot; error?: string }
        if (analyticsRequestRef.current !== requestId) return
        if (!analyticsResponse.ok || !analyticsPayload.snapshot) {
          throw new Error(analyticsPayload.error || "Retail analytics could not be refreshed after sync.")
        }
        const snapshot = analyticsPayload.snapshot
        const posSource = snapshot.source.type === "square" ? snapshot.source : null
        const attemptAt = posSource?.lastSyncAttemptAt ? new Date(posSource.lastSyncAttemptAt).getTime() : 0
        const syncRunFinished = Boolean(
          posSource
          && attemptAt >= syncStartedAt
          && posSource.syncStatus !== "queued"
          && posSource.syncStatus !== "running",
        )
        if (syncRunFinished || attempt === MAX_SYNC_POLL_ATTEMPTS - 1) {
          setSourceView({ loading: false, error: null, snapshot })
          void loadSources()
          break
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync could not be completed."
      toast({ title: "Square sync", description: message, variant: "default" })
      void loadSources()
    } finally {
      setSyncing(false)
    }
  }

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
            initialAnalysis: true,
          }),
        })
        if (!analyzeRes.ok) {
          await zeroCredit.openFromResponse(analyzeRes)
        }
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
    if (activeUploadRef.current) return
    activeUploadRef.current = true
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

      const result = await uploadDatasetFile({ file: uploadFile, uploadMode: "retail", source: "retail_upload" })

      // Every credit/limit decision comes from the authoritative server
      // response. A rejected upload must never silently continue as a free
      // local analysis presented as a completed retail run.
      if (!result.ok || !result.success) {
        const uploadMessage = result.message || result.error || "Retail upload did not create a dataset."
        debugError("Upload failed:", uploadMessage)
        window.dispatchEvent(new Event(USAGE_REFRESH_EVENT))

        const creditState = parseCreditExhaustionPayload(result)
        if (creditState) {
          if (creditState.tier !== "free") {
            zeroCredit.openFromPayload(creditState)
          }
          toast({
            title: creditState.title,
            description: creditState.message,
            variant: "default",
          })
          setErrorMessage(creditState.message)
          setState("error")
          setProcessingStep(0)
          return
        }

        toast({
          title: "Upload failed",
          description: uploadMessage,
          variant: "default",
        })
        setErrorMessage(uploadMessage)
        setState("error")
        setProcessingStep(0)
        return
      }

      setProcessingStep(4)
      setUploadResult({
        ...result,
        datasetName: result.datasetName || data.fileName,
        datasetType: result.datasetType || result.dataset_type || "retail",
        rowsProcessed: result.rowsProcessed ?? data.rowCount,
        columnsDetected: result.columnsDetected ?? data.columnCount,
        analysisStatus: result.analysisStatus || "processing",
        redirectTo: result.redirectTo || "/app/retail",
      })
      window.dispatchEvent(new Event(USAGE_REFRESH_EVENT))
      if (result.datasetId) {
        updateSelectedSource(formatRetailSourceParam({ type: "dataset", datasetId: result.datasetId }))
      }
      setTimeout(() => startAnalysis(result.datasetId || null, data), 300)
    } catch (err) {
      debugError("Upload error:", err)
      window.dispatchEvent(new Event(USAGE_REFRESH_EVENT))
      toast({
        title: "Upload failed",
        description: "The dataset could not be uploaded. Please try again.",
        variant: "default",
      })
      setErrorMessage("The dataset could not be uploaded. Please try again.")
      setState("error")
      setProcessingStep(0)
    } finally {
      activeUploadRef.current = false
    }
  }, [toast, startAnalysis, zeroCredit, updateSelectedSource])

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
        setErrorMessage("Please upload a CSV or Excel (.csv, .xlsx, .xls) file")
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
    setUploadResult(null)
  }, [])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val)

  const formatPercent = (val: number) => `${val.toFixed(1)}%`

  const formatNumber = (val: number) => new Intl.NumberFormat().format(val)

  const formatCurrencyOrDash = (val: number | null) => (val === null ? "—" : formatCurrency(val))
  const formatPercentOrDash = (val: number | null) => (val === null ? "—" : formatPercent(val))
  const formatNumberOrDash = (val: number | null) => (val === null ? "—" : formatNumber(val))

  const visibleColumns = parsedData
    ? showAllColumns
      ? parsedData.columns
      : parsedData.columns.slice(0, 8)
    : []

  // The rendered analytics content. Upload-flow results take precedence;
  // otherwise the selected source snapshot drives every card.
  const snapshot = uploadFlowActive ? null : sourceView.snapshot
  const snapshotIsSquare = snapshot?.source.type === "square"
  const hasAnySource = Boolean(sources && (sources.datasets.length > 0 || sources.connections.length > 0))

  const aiSummary = uploadFlowActive || snapshot === null
    ? insights?.aiSummary ?? null
    : snapshot.summary.insight
  const aiExplanation = uploadFlowActive || snapshot === null
    ? insights?.aiExplanation ?? null
    : snapshot.summary.explanation
  const aiRecommendation = uploadFlowActive || snapshot === null
    ? insights?.aiRecommendation ?? null
    : snapshot.summary.recommendation
  const showSquareSummaryTag = !uploadFlowActive && snapshotIsSquare

  const lowStockItems = uploadFlowActive || snapshot === null
    ? insights?.lowStock ?? []
    : snapshot.lowStock.items
  const lowStockBanner = uploadFlowActive || snapshot === null
    ? (insights?.lowStock.length ? "Reorder these items first so recent sellers do not run out before the next buying cycle." : null)
    : snapshot.lowStock.items.length
      ? snapshot.lowStock.message
      : null
  const lowStockStatus = uploadFlowActive || snapshot === null
    ? null
    : snapshot.lowStock.items.length === 0 && snapshot.lowStock.status !== "ok"
      ? snapshot.lowStock.message
      : null
  const lowStockDatasetEmpty = uploadFlowActive && insights && insights.lowStock.length === 0
  const lowStockSnapshotOkEmpty = !uploadFlowActive && snapshot !== null
    && snapshot.lowStock.items.length === 0 && snapshot.lowStock.status === "ok"

  const deadStockItems = uploadFlowActive || snapshot === null
    ? insights?.deadStock ?? []
    : snapshot.deadStock.items
  const deadStockBanner = uploadFlowActive || snapshot === null
    ? (insights?.deadStock.length ? "Free cash from items that sit on the shelf before reordering more of the same stock." : null)
    : snapshot.deadStock.items.length
      ? snapshot.deadStock.message
      : null
  const deadStockStatus = uploadFlowActive || snapshot === null
    ? null
    : snapshot.deadStock.items.length === 0 && snapshot.deadStock.status !== "ok"
      ? snapshot.deadStock.message
      : null
  const deadStockDatasetEmpty = uploadFlowActive && insights && insights.deadStock.length === 0
  const deadStockSnapshotOkEmpty = !uploadFlowActive && snapshot !== null
    && snapshot.deadStock.items.length === 0 && snapshot.deadStock.status === "ok"

  const topProfitItems = uploadFlowActive || snapshot === null
    ? insights?.topProfit ?? []
    : snapshot.topProfit.items
  const topProfitBanner = uploadFlowActive || snapshot === null
    ? (insights?.topProfit.length ? "Protect these winners: keep inventory available, avoid unnecessary markdowns, and watch supplier cost." : null)
    : snapshot.topProfit.items.length
      ? snapshot.topProfit.message
      : null
  const topProfitStatus = uploadFlowActive || snapshot === null
    ? null
    : snapshot.topProfit.items.length === 0 && snapshot.topProfit.status !== "ok"
      ? snapshot.topProfit.message
      : null
  const topProfitDatasetEmpty = uploadFlowActive && insights && insights.topProfit.length === 0
  const topProfitSnapshotOkEmpty = !uploadFlowActive && snapshot !== null
    && snapshot.topProfit.items.length === 0 && snapshot.topProfit.status === "ok"

  const showSourceInsights = uploadFlowActive
    ? Boolean(insights)
    : Boolean(snapshot)

  return (
    <div className={embedded ? "space-y-6" : "min-w-0 flex-1 px-4 pb-6 pt-6 sm:px-6"}>
      <ZeroCreditModal state={zeroCredit.state} onOpenChange={(open) => { if (!open) zeroCredit.close() }} />
      <div className={embedded ? "space-y-6" : "mx-auto max-w-6xl space-y-6"}>
        {/* Data source selector */}
        {hasAnySource && (
          <Card>
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Store className="h-4 w-4 text-primary" />
                    Data source
                  </div>
                  <div className="relative w-full sm:w-96">
                    <select
                      aria-label="Retail data source"
                      className="h-10 w-full appearance-none rounded-lg border border-input/80 bg-background/80 px-3 py-2 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition duration-200 hover:border-primary/35 focus:outline-none focus:ring-2 focus:ring-ring/35"
                      value={selectedSource ?? ""}
                      onChange={(e) => void handleSourceSelect(e.target.value)}
                    >
                      {!selectedSource && <option value="">Select a data source</option>}
                      {(sources?.connections ?? []).map((connection) => (
                        <option key={connection.id} value={sourceOptionValue(connection)}>
                          {sourceOptionLabel(connection)}
                        </option>
                      ))}
                      {(sources?.datasets ?? []).map((dataset) => (
                        <option key={dataset.id} value={sourceOptionValue(dataset)}>
                          {sourceOptionLabel(dataset)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
                  </div>
                  {sourcesError && (
                    <p className="text-xs text-destructive">{sourcesError}</p>
                  )}
                </div>

                {snapshotIsSquare && snapshot && (
                  <SquareSourceHeader
                    snapshot={snapshot}
                    syncing={syncing}
                    onSync={() => void handleSyncNow()}
                  />
                )}
              </div>
              {snapshot && !uploadFlowActive && <SnapshotSummary snapshot={snapshot} />}
            </CardContent>
          </Card>
        )}

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
                    <p className="text-xs text-muted-foreground">
                      {hasAnySource
                        ? "Add another sales or inventory dataset, or analyze the selected source below"
                        : "Drop a sales or inventory file, or click to browse"}
                    </p>
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

        {state === "complete" && uploadResult && (
          <UploadSuccessPanel
            result={uploadResult}
            uploadMode="retail"
            onUploadAnother={reset}
          />
        )}

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

        {/* Source loading / error states */}
        {!uploadFlowActive && sourceView.loading && (
          <Card>
            <CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading retail analytics for the selected source...
            </CardContent>
          </Card>
        )}
        {!uploadFlowActive && !sourceView.loading && sourceView.error && (
          <Card>
            <CardContent className="flex items-start gap-3 p-5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{sourceView.error}</span>
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
            ) : sourceView.loading && !uploadFlowActive ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading insights...
              </div>
            ) : aiSummary && showSourceInsights ? (
              <div className="space-y-3">
                {showSquareSummaryTag && (
                  <p className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Deterministic summary from synchronized Square data
                  </p>
                )}
                <p className="text-sm font-medium text-foreground">{aiSummary}</p>
                {aiExplanation && (
                  <p className="text-sm text-muted-foreground">{aiExplanation}</p>
                )}
                {aiRecommendation && (
                  <div className="rounded-lg bg-primary/5 p-3">
                    <p className="text-xs font-medium text-primary mb-0.5">Recommendation</p>
                    <p className="text-sm text-muted-foreground">{aiRecommendation}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{EMPTY_STATE_HINT}</p>
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
            ) : sourceView.loading && !uploadFlowActive ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading stock levels...
              </div>
            ) : lowStockItems.length > 0 ? (
              <div className="space-y-3">
                {lowStockBanner && (
                  <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                    {lowStockBanner}
                  </p>
                )}
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
                      {lowStockItems.map((item, i) => (
                        <tr key={`${item.sku}-${item.orderId}-${i}`} className="align-top">
                          <td className="px-3 py-2">
                            <div className="font-medium text-foreground">{item.product}</div>
                            <div className="text-xs text-muted-foreground">SKU: {item.sku}</div>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{item.category}</td>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-amber-600">{formatNumberOrDash(item.stock)}</div>
                            <div className="text-xs text-muted-foreground">
                              Reorder: {item.reorderPoint === null ? "not provided" : formatNumber(item.reorderPoint)}
                            </div>
                          </td>
                          <td className="px-3 py-2">{formatNumberOrDash(item.unitsSold)}</td>
                          <td className="px-3 py-2">{formatCurrencyOrDash(item.revenue)}</td>
                          <td className="px-3 py-2">{formatCurrencyOrDash(item.grossProfit)}</td>
                          <td className="px-3 py-2">{formatPercentOrDash(item.margin)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{item.lastSaleDate}</td>
                          <td className="px-3 py-2">
                            <details className="group">
                              <summary className="cursor-pointer text-xs font-medium text-primary">View</summary>
                              <div className="mt-2 w-64 space-y-1 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                                <div>Cost: {formatCurrencyOrDash(item.cost)}</div>
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
            ) : lowStockStatus ? (
              <StatusNote message={lowStockStatus} />
            ) : lowStockDatasetEmpty || lowStockSnapshotOkEmpty ? (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                {uploadFlowActive ? "No low stock items detected" : snapshot?.lowStock.message}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{EMPTY_STATE_HINT}</p>
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
            ) : sourceView.loading && !uploadFlowActive ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading movement analysis...
              </div>
            ) : deadStockItems.length > 0 ? (
              <div className="space-y-3">
                {deadStockBanner && (
                  <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                    {deadStockBanner}
                  </p>
                )}
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
                      {deadStockItems.map((item, i) => (
                        <tr key={`${item.sku}-${item.orderId}-${i}`} className="align-top">
                          <td className="px-3 py-2">
                            <div className="font-medium text-foreground">{item.product}</div>
                            <div className="text-xs text-muted-foreground">SKU: {item.sku}</div>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{item.category}</td>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-red-600">{formatNumberOrDash(item.stock)}</div>
                            <div className="text-xs text-muted-foreground">
                              Reorder: {item.reorderPoint === null ? "not provided" : formatNumber(item.reorderPoint)}
                            </div>
                          </td>
                          <td className="px-3 py-2">{formatNumberOrDash(item.unitsSold)}</td>
                          <td className="px-3 py-2">
                            {item.daysSinceLastSale === null ? "No sale date" : formatNumber(item.daysSinceLastSale)}
                          </td>
                          <td className="px-3 py-2 font-medium">{formatCurrencyOrDash(item.stockValue)}</td>
                          <td className="px-3 py-2">{item.suggestedAction}</td>
                          <td className="px-3 py-2">
                            <details>
                              <summary className="cursor-pointer text-xs font-medium text-primary">View</summary>
                              <div className="mt-2 w-64 space-y-1 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                                <div>Revenue: {formatCurrencyOrDash(item.revenue)}</div>
                                <div>Cost: {formatCurrencyOrDash(item.cost)}</div>
                                <div>Gross profit: {formatCurrencyOrDash(item.grossProfit)}</div>
                                <div>Margin: {formatPercentOrDash(item.margin)}</div>
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
            ) : deadStockStatus ? (
              <StatusNote message={deadStockStatus} />
            ) : deadStockDatasetEmpty || deadStockSnapshotOkEmpty ? (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                {uploadFlowActive ? "No dead stock detected" : snapshot?.deadStock.message}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{EMPTY_STATE_HINT}</p>
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
            ) : sourceView.loading && !uploadFlowActive ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading profitability...
              </div>
            ) : topProfitItems.length > 0 ? (
              <div className="space-y-3">
                {topProfitBanner && (
                  <p className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-300">
                    {topProfitBanner}
                  </p>
                )}
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
                      {topProfitItems.map((item, i) => (
                        <tr key={`${item.sku}-${item.orderId}-${i}`} className="align-top">
                          <td className="px-3 py-2">
                            <div className="font-medium text-foreground">{item.product}</div>
                            <div className="text-xs text-muted-foreground">SKU: {item.sku}</div>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{item.category}</td>
                          <td className="px-3 py-2">{formatNumberOrDash(item.unitsSold)}</td>
                          <td className="px-3 py-2">{formatCurrencyOrDash(item.revenue)}</td>
                          <td className="px-3 py-2">{formatCurrencyOrDash(item.cost)}</td>
                          <td className="px-3 py-2 font-semibold text-green-600">{formatCurrencyOrDash(item.profit)}</td>
                          <td className="px-3 py-2">{formatPercentOrDash(item.margin)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{item.reason}</td>
                          <td className="px-3 py-2">
                            <details>
                              <summary className="cursor-pointer text-xs font-medium text-primary">View</summary>
                              <div className="mt-2 w-64 space-y-1 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                                <div>Current stock: {formatNumberOrDash(item.stock)}</div>
                                <div>Reorder point: {item.reorderPoint === null ? "not provided" : formatNumber(item.reorderPoint)}</div>
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
            ) : topProfitStatus ? (
              <StatusNote message={topProfitStatus} />
            ) : topProfitDatasetEmpty || topProfitSnapshotOkEmpty ? (
              <p className="text-sm text-muted-foreground">{uploadFlowActive ? "Add cost and revenue columns to see profit rankings" : snapshot?.topProfit.message}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{EMPTY_STATE_HINT}</p>
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

function SquareSourceHeader({
  snapshot,
  syncing,
  onSync,
}: {
  snapshot: RetailAnalyticsSnapshot
  syncing: boolean
  onSync: () => void
}) {
  if (snapshot.source.type !== "square") return null
  const source = snapshot.source
  const connected = source.connectionStatus === "connected" || source.connectionStatus === "active" || source.connectionStatus === "syncing"
  const counts = source.counts

  return (
    <div className="min-w-0 space-y-3 lg:max-w-md">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">Square</span>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
            connected
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          }`}
        >
          {connected ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
          {source.syncStatus === "queued" || source.syncStatus === "running"
            ? "Syncing"
            : source.connectionStatus.replaceAll("_", " ") || "Connected"}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <div>
          <dt className="inline">Last synced: </dt>
          <dd className="inline font-medium text-foreground">{formatSyncDate(source.lastSuccessfulSyncAt)}</dd>
        </div>
        <div>
          <dt className="inline">Locations: </dt>
          <dd className="inline font-medium text-foreground">{counts.locations}</dd>
        </div>
        <div>
          <dt className="inline">Products: </dt>
          <dd className="inline font-medium text-foreground">{counts.products}</dd>
        </div>
        <div>
          <dt className="inline">Variants: </dt>
          <dd className="inline font-medium text-foreground">{counts.variants}</dd>
        </div>
        <div>
          <dt className="inline">Orders: </dt>
          <dd className="inline font-medium text-foreground">{counts.orders}</dd>
        </div>
      </dl>
      {source.syncError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          {source.syncError}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition hover:border-primary/40 disabled:opacity-60"
        >
          {syncing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
          {syncing ? "Syncing..." : "Sync now"}
        </button>
        <a
          href="/app/retail/integrations"
          className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition hover:border-primary/40"
        >
          Manage connection
        </a>
      </div>
    </div>
  )
}

function SnapshotSummary({ snapshot }: { snapshot: RetailAnalyticsSnapshot }) {
  const kpis: Array<{ label: string; value: string }> = []
  const source = snapshot.source
  if (source.type === "dataset") {
    kpis.push(
      { label: "Rows", value: formatCount(source.rowCount) },
      { label: "Columns", value: formatCount(source.columnCount) },
      { label: "Products", value: snapshot.kpis.productCount === null ? "—" : formatCount(snapshot.kpis.productCount) },
      { label: "Uploaded", value: formatSyncDate(source.createdAt) },
    )
  } else {
    kpis.push(
      { label: "Locations", value: formatCount(source.counts.locations) },
      { label: "Products", value: formatCount(source.counts.products) },
      { label: "Variants", value: formatCount(source.counts.variants) },
      { label: "Orders", value: formatCount(source.counts.orders) },
    )
    if (snapshot.kpis.totalOnHand !== null) {
      kpis.push({ label: "Stock on hand", value: formatCount(snapshot.kpis.totalOnHand) })
    }
    if (snapshot.kpis.netSales !== null) {
      kpis.push({ label: "Net sales", value: formatMoney(snapshot.kpis.netSales, snapshot.currency) })
    }
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/40 pt-4 sm:grid-cols-4 lg:grid-cols-6">
      {kpis.map((kpi) => (
        <StatCard key={kpi.label} icon={BarChart3} label={kpi.label} value={kpi.value} />
      ))}
    </div>
  )
}

function StatusNote({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 text-sm text-muted-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value)
}

function formatMoney(value: number, currency: string | null): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(value)
}

function formatSyncDate(value: string | null): string {
  if (!value) return "Not available"
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function generateFallbackSummary(
  rows: Record<string, unknown>[],
  columns: string[],
  lowStock: RetailLowStockItem[],
  deadStock: RetailDeadStockItem[],
  topProfit: RetailTopProfitItem[],
): { insight: string; explanation: string; recommendation: string } {
  const total = new Intl.NumberFormat().format(rows.length)
  const cols = columns.length
  const low = lowStock.length
  const dead = deadStock.length
  const profit = topProfit.length > 0 ? topProfit[0].product : "N/A"
  const maxProfit = topProfit.length > 0
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(topProfit[0].profit ?? 0)
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
