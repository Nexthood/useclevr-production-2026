"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getStandardUploadSuccessView } from "@/lib/upload/standard-upload-success"
import type { UploadDatasetResponse, UploadMode } from "@/lib/upload/upload-client"
import { AlertCircle, BarChart3, CheckCircle2, Database, RotateCcw } from "lucide-react"
import Link from "next/link"

type UploadSuccessPanelProps = {
  result: UploadDatasetResponse
  uploadMode: UploadMode
  onUploadAnother: () => void
}

function primaryResultHref(uploadMode: UploadMode, result: UploadDatasetResponse) {
  if (result.redirectTo) return result.redirectTo
  if (uploadMode === "retail") return "/app/retail"
  if (uploadMode === "profitability") return "/app/profitability"
  if (uploadMode === "accountancy") return "/app/accountancy"
  if (uploadMode === "prebookkeeping") return "/app/prebookkeeping"
  return result.datasetId ? `/app/dashboard?datasetId=${encodeURIComponent(result.datasetId)}` : "/app/dashboard"
}

function primaryResultLabel(uploadMode: UploadMode) {
  if (uploadMode === "standard") return "Open in Dashboard"
  if (uploadMode === "retail") return "Open Retail"
  if (uploadMode === "profitability") return "Open Profitability"
  if (uploadMode === "accountancy") return "Open Accountancy"
  if (uploadMode === "prebookkeeping") return "Open Pre-bookkeeping"
  return "Open Result"
}

function datasetTypeLabel(result: UploadDatasetResponse, uploadMode: UploadMode) {
  return String(result.datasetType || result.dataset_type || uploadMode)
}

function normalizeUploadType(value: string | undefined) {
  return (value || "").trim().toLowerCase().replace(/[\s_-]+/g, "")
}

function analysisLabel(status: string | undefined) {
  if (!status) return "Pending"
  if (status === "ready") return "Ready"
  if (status === "completed") return "Ready"
  if (status === "processing") return "Processing"
  if (status === "pending") return "Pending"
  if (status === "failed") return "Failed"
  return status.replaceAll("_", " ")
}

export function UploadSuccessPanel({ result, uploadMode, onUploadAnother }: UploadSuccessPanelProps) {
  const resolvedDatasetType = normalizeUploadType(String(result.dataset_type || result.datasetType || uploadMode))
  const isStandardUploadSuccess = uploadMode === "standard" && resolvedDatasetType === "standard"

  if (isStandardUploadSuccess) {
    return <StandardUploadSuccessPanel result={result} onUploadAnother={onUploadAnother} />
  }

  const datasetHref = result.datasetId ? `/app/datasets/${result.datasetId}` : "/app/datasets"
  const hasDatasetNavigation = Boolean(result.datasetId)
  const rowsProcessed = typeof result.rowsProcessed === "number" ? result.rowsProcessed : null
  const columnsDetected = typeof result.columnsDetected === "number" ? result.columnsDetected : null

  return (
    <Card className="mt-4 border-emerald-500/30 bg-emerald-500/5 p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-200">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-foreground">Upload completed successfully</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.analysisStatus === "processing" || result.analysisStatus === "pending"
                  ? "Dataset uploaded successfully. Analysis is being prepared."
                  : result.message || "Dataset uploaded successfully."}
              </p>
            </div>
          </div>

          {!hasDatasetNavigation && (
            <div className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-100">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Upload completed, but the dataset result could not be opened.</p>
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ResultMetric label="Dataset" value={result.datasetName || result.fileName || "Uploaded dataset"} />
            <ResultMetric label="Rows processed" value={rowsProcessed === null ? "Not reported" : rowsProcessed.toLocaleString()} />
            <ResultMetric label="Columns detected" value={columnsDetected === null ? "Not reported" : columnsDetected.toLocaleString()} />
            <ResultMetric label="Analysis status" value={analysisLabel(result.analysisStatus)} />
          </div>

          <p className="mt-3 text-xs text-muted-foreground">Dataset type: {datasetTypeLabel(result, uploadMode)}</p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
          <Link
            href={primaryResultHref(uploadMode, result)}
            className="inline-flex h-10 items-center justify-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            {primaryResultLabel(uploadMode)}
          </Link>
          {hasDatasetNavigation ? (
            <Link
              href={datasetHref}
              className="inline-flex h-10 items-center justify-start rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Database className="mr-2 h-4 w-4" />
              View Dataset
            </Link>
          ) : (
            <Link
              href="/app/datasets"
              className="inline-flex h-10 items-center justify-start rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Database className="mr-2 h-4 w-4" />
              Go to Datasets
            </Link>
          )}
          <Button type="button" variant="outline" className="justify-start" onClick={onUploadAnother}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {uploadMode === "standard" && !hasDatasetNavigation ? "Retry" : "Upload Another File"}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/70 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function StandardUploadSuccessPanel({
  result,
  onUploadAnother,
}: {
  result: UploadDatasetResponse
  onUploadAnother: () => void
}) {
  const view = getStandardUploadSuccessView(result)

  return (
    <Card className="border-emerald-500/30 bg-card p-5 shadow-sm" data-upload-success-panel="standard">
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-200">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-foreground">{view.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{view.description}</p>
          </div>
        </div>

        {!view.hasDatasetNavigation && (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-100">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Upload completed, but the dataset result could not be opened.</p>
            </div>
          </div>
        )}

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-standard-upload-kpis="true">
          {view.metrics.map((metric) => (
            <StandardResultMetric key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link
            href={view.dashboardHref}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Open in Dashboard
          </Link>
          <Link
            href={view.datasetHref}
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Database className="mr-2 h-4 w-4" />
            View Dataset
          </Link>
          <Button type="button" variant="outline" className="justify-center" onClick={onUploadAnother}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Upload Another File
          </Button>
        </div>
      </div>
    </Card>
  )
}

function StandardResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-background/70 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-normal break-words text-sm font-semibold leading-snug text-foreground">{value}</p>
    </div>
  )
}
