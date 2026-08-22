import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout"
import { GenerateReportAction } from "@/components/dashboard/generate-report-action"
import { Card } from "@/components/ui/card"
import { auth } from "@/lib/auth/auth"
import { resolveDatasetType } from "@/lib/data/dataset-category"
import { getDb } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { BarChart3, DollarSign, Download, FileText, TrendingUp } from "lucide-react"
import Link from "next/link"
import type React from "react"

type ProfitabilityPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function ProfitabilityPage({ searchParams }: ProfitabilityPageProps) {
  const session = await auth()
  const userId = session?.user?.id

  let _activeDatasets = 0
  let focusedDataset: {
    id: string
    name: string
    fileName: string
    rowCount: number
    columnCount: number
    analysis: unknown
    precomputedMetrics: unknown
    columnMapping: unknown
    datasetType: string | null
  } | null = null

  const resolvedSearchParams = await searchParams
  const rawDatasetId = resolvedSearchParams?.datasetId
  const rawAnalysisId = resolvedSearchParams?.analysisId
  const focusedDatasetId = Array.isArray(rawDatasetId) ? rawDatasetId[0] : rawDatasetId
  const focusedAnalysisId = Array.isArray(rawAnalysisId) ? rawAnalysisId[0] : rawAnalysisId
  const focusedParentId = focusedDatasetId || focusedAnalysisId

  if (userId) {
    const db = getDb()
    if (db) {
      try {
        const profitabilityDatasets = await db.query.datasets.findMany({
          where: eq(datasets.userId, userId),
          columns: {
            id: true,
            datasetType: true,
            analysis: true,
            precomputedMetrics: true,
          },
        })

        if (focusedParentId) {
          const datasetWhere = session?.user?.role === "superadmin"
            ? eq(datasets.id, focusedParentId)
            : and(eq(datasets.id, focusedParentId), eq(datasets.userId, userId))
          focusedDataset = await db.query.datasets.findFirst({
            where: datasetWhere,
            columns: {
              id: true,
              name: true,
              fileName: true,
              rowCount: true,
              columnCount: true,
              analysis: true,
              precomputedMetrics: true,
              columnMapping: true,
              datasetType: true,
            },
          }) ?? null
          if (focusedDataset && resolveDatasetType(focusedDataset.datasetType, focusedDataset.analysis) !== "profitability") {
            focusedDataset = null
          }

          if (!focusedDataset && focusedAnalysisId) {
            const candidateDatasets = await db.query.datasets.findMany({
              where: eq(datasets.userId, userId),
              columns: {
                id: true,
                name: true,
                fileName: true,
                rowCount: true,
                columnCount: true,
                analysis: true,
                precomputedMetrics: true,
                columnMapping: true,
                datasetType: true,
              },
            })
            focusedDataset = candidateDatasets.find((dataset) =>
              resolveDatasetType(dataset.datasetType, dataset.analysis) === "profitability" &&
              getProfitabilityAnalysisId(dataset) === focusedAnalysisId
            ) ?? null
          }
        }

        _activeDatasets = new Set(profitabilityDatasets
          .filter((dataset) => resolveDatasetType(dataset.datasetType, dataset.analysis) === "profitability")
          .map((dataset) => getProfitabilityAnalysisId(dataset) || dataset.id)
        ).size
      } catch {
        // Continue without stats
      }
    }
  }

  const metricsContent = focusedDataset ? renderProfitabilityMetrics(focusedDataset.precomputedMetrics as Record<string, unknown> | null) : null
  const sourceInputs = focusedDataset ? getProfitabilitySourceInputs(focusedDataset) : []
  const sourceRowCount = sourceInputs.length > 0
    ? sourceInputs.reduce((total, input) => total + input.rowCount, 0)
    : focusedDataset?.rowCount ?? 0

  return (
    <DashboardSubpageLayout
      title="Profitability Analysis"
      description="Revenue, expense, and margin analysis for your business."
      breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Profitability" }]}
      icon={TrendingUp}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/app/upload">
            <span className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
              <DollarSign className="h-4 w-4" />
              Upload data
            </span>
          </Link>
        </div>
      }
    >
      <div className="flex-1 overflow-y-auto px-5 pb-32 pt-6 sm:pb-24">
        <div className="max-w-6xl mx-auto space-y-5">
          {focusedDataset && (
            <Card className="border-cyan-400/25 bg-cyan-400/5 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">
                    Profitability analysis
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">
                    Revenue + Expense Analysis
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    This parent analysis combines revenue and expense inputs while preserving each source file.
                  </p>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:min-w-80">
                  <ProfileContextRow label="Inputs" value={String(sourceInputs.length || 1)} />
                  <ProfileContextRow label="Source Rows" value={sourceRowCount.toLocaleString()} />
                  <ProfileContextRow label="Type" value="Profitability Analysis" />
                  <ProfileContextRow label="Status" value={metricsContent ? "Analyzed" : "Ready for review"} />
                </div>
              </div>
              {sourceInputs.length > 0 && (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {sourceInputs.map((input) => (
                    <div key={`${input.role}-${input.name}`} className="rounded-lg border border-border bg-background/80 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{input.label}</p>
                      <p className="mt-2 truncate text-sm font-semibold text-foreground" title={input.name}>{input.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{input.rowCount.toLocaleString()} rows</p>
                    </div>
                  ))}
                </div>
              )}
              {metricsContent && (
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <GenerateReportAction datasetId={focusedDataset.id} label="Generate / Regenerate Report" />
                  <Link
                    href="/app/downloads"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:bg-muted"
                  >
                    <FileText className="h-4 w-4" />
                    Open Profitability Report
                  </Link>
                  <Link
                    href={`/api/reports/download?datasetId=${focusedDataset.id}&format=pdf`}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:bg-muted"
                  >
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Link>
                  <Link
                    href={`/api/reports/download?datasetId=${focusedDataset.id}&format=csv`}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:bg-muted"
                  >
                    <Download className="h-4 w-4" />
                    Download Excel
                  </Link>
                </div>
              )}
              {metricsContent}
            </Card>
          )}

          {!focusedDataset && (
            <Card className="border-border bg-card p-6">
              <div className="flex flex-col items-center justify-center gap-4 py-12">
                <BarChart3 className="h-12 w-12 text-muted-foreground" />
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-foreground">No profitability dataset selected</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Upload revenue and expense files to generate a profitability analysis.
                  </p>
                </div>
                <Link
                  href="/app/upload"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                >
                  <DollarSign className="h-4 w-4" />
                  Upload profitability data
                </Link>
              </div>
            </Card>
          )}
        </div>
      </div>
    </DashboardSubpageLayout>
  )
}

function renderProfitabilityMetrics(metrics: unknown): React.ReactNode {
  if (!metrics || typeof metrics !== "object") return null

  const values = metrics as Record<string, unknown>
  const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
  const currencyValue = (value: unknown) => typeof value === "number" ? currency.format(value) : "No data"
  const percentValue = (value: unknown) => typeof value === "number" ? `${value.toFixed(1)}%` : "No data"
  const metricCards = [
    { label: "Revenue", value: currencyValue(values.totalRevenue) },
    { label: "COGS", value: currencyValue(values.cogs) },
    { label: "Gross Profit", value: currencyValue(values.grossProfit) },
    { label: "Operating Expenses", value: currencyValue(values.operatingExpenses) },
    { label: "Operating Profit", value: currencyValue(values.operatingProfit) },
    { label: "Interest", value: currencyValue(values.interestExpense) },
    { label: "Taxes", value: currencyValue(values.taxExpense) },
    { label: "Net Profit", value: currencyValue(values.netProfit) },
    { label: "Gross Margin", value: percentValue(values.grossMargin) },
    { label: "Operating Margin", value: percentValue(values.operatingMargin) },
    { label: "Net Margin", value: percentValue(values.netMargin) },
  ].filter((metric) => metric.value !== "No data")
  const rawCostCategories = Array.isArray(values.topCostCategories)
    ? values.topCostCategories
    : Array.isArray(values.expenseCategories)
      ? values.expenseCategories
      : []
  const topCostCategories = rawCostCategories
    .map((item) => {
      if (Array.isArray(item)) return { label: String(item[0] ?? "Other"), value: Number(item[1] ?? 0) }
      if (item && typeof item === "object") {
        const entry = item as Record<string, unknown>
        return {
          label: String(entry.category ?? entry.label ?? entry.name ?? "Other"),
          value: Number(entry.value ?? entry.amount ?? entry.total ?? 0),
        }
      }
      return null
    })
    .filter((item): item is { label: string; value: number } => Boolean(item && Number.isFinite(item.value)))
    .slice(0, 5)
  const trendData = Array.isArray(values.revenueByMonth) ? values.revenueByMonth.slice(0, 6) : []

  if (metricCards.length === 0) return null

  return (
    <div className="mt-5 space-y-4">
      {typeof values.statusLabel === "string" && (
        <div className="rounded-lg border border-border bg-background/80 p-4 text-sm text-muted-foreground">
          {values.statusLabel}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metricCards.map((metric) => (
          <div key={metric.label} className="rounded-lg border border-border bg-background/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{metric.label}</p>
            <p className="mt-2 text-xl font-semibold text-foreground">{metric.value}</p>
          </div>
        ))}
      </div>

      {topCostCategories.length > 0 && (
        <div className="rounded-lg border border-border bg-background/80 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Top cost categories</p>
          <div className="mt-3 space-y-2">
            {topCostCategories.map((category) => (
              <div key={category.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-muted-foreground">{category.label}</span>
                <span className="font-medium text-foreground">{currency.format(category.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {trendData.length > 0 && (
        <div className="rounded-lg border border-border bg-background/80 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Trend / period comparison</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {trendData.length} period{trendData.length === 1 ? "" : "s"} available for revenue comparison.
          </p>
        </div>
      )}
    </div>
  )
}

function ProfileContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[12rem] text-right font-medium text-foreground">{value || "Not configured"}</span>
    </div>
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function getProfitabilityPayload(dataset: { analysis: unknown; precomputedMetrics: unknown; columnMapping?: unknown }) {
  const analysis = isRecord(dataset.analysis) ? dataset.analysis : {}
  const nested = isRecord(analysis.profitability) ? analysis.profitability : null
  if (nested) return nested
  if (isRecord(dataset.precomputedMetrics)) return dataset.precomputedMetrics
  if (isRecord(dataset.columnMapping)) return dataset.columnMapping
  return {}
}

function getProfitabilityAnalysisId(dataset: { id?: string; analysis: unknown; precomputedMetrics: unknown; columnMapping?: unknown }) {
  const payload = getProfitabilityPayload(dataset)
  const analysis = isRecord(dataset.analysis) ? dataset.analysis : {}
  const metrics = isRecord(dataset.precomputedMetrics) ? dataset.precomputedMetrics : {}
  const mapping = isRecord(dataset.columnMapping) ? dataset.columnMapping : {}
  const value =
    payload.profitabilityAnalysisId ||
    payload.profitability_analysis_id ||
    analysis.profitabilityAnalysisId ||
    analysis.profitability_analysis_id ||
    metrics.profitabilityAnalysisId ||
    metrics.profitability_analysis_id ||
    mapping.profitabilityAnalysisId ||
    mapping.profitability_analysis_id
  return typeof value === "string" && value.length > 0 ? value : dataset.id ?? null
}

function getProfitabilitySourceInputs(dataset: { analysis: unknown; precomputedMetrics: unknown; columnMapping?: unknown }) {
  const payload = getProfitabilityPayload(dataset)
  const sourceFiles = Array.isArray(payload.sourceFiles) ? payload.sourceFiles : []
  return sourceFiles
    .map((sourceFile) => {
      if (!isRecord(sourceFile)) return null
      const role = String(sourceFile.role || "").toLowerCase()
      const rowCount = Number(sourceFile.rowCount)
      return {
        role,
        label: role === "revenue" ? "Revenue Input" : role === "expenses" ? "Expense Input" : "Source Input",
        name: String(sourceFile.name || "Uploaded source"),
        rowCount: Number.isFinite(rowCount) && rowCount > 0 ? rowCount : 0,
      }
    })
    .filter((sourceFile): sourceFile is { role: string; label: string; name: string; rowCount: number } => Boolean(sourceFile))
}
