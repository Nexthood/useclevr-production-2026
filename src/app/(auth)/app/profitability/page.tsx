import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout"
import { Card } from "@/components/ui/card"
import { auth } from "@/lib/auth/auth"
import { resolveDatasetType } from "@/lib/data/dataset-category"
import { getDb } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { BarChart3, DollarSign, TrendingUp } from "lucide-react"
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
    datasetType: string | null
  } | null = null

  const resolvedSearchParams = await searchParams
  const rawDatasetId = resolvedSearchParams?.datasetId
  const focusedDatasetId = Array.isArray(rawDatasetId) ? rawDatasetId[0] : rawDatasetId

  if (userId) {
    const db = getDb()
    if (db) {
      try {
        const profitabilityDatasets = await db.query.datasets.findMany({
          where: eq(datasets.userId, userId),
          columns: {
            datasetType: true,
            analysis: true,
          },
        })

        if (focusedDatasetId) {
          const datasetWhere = session?.user?.role === "superadmin"
            ? eq(datasets.id, focusedDatasetId)
            : and(eq(datasets.id, focusedDatasetId), eq(datasets.userId, userId))
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
              datasetType: true,
            },
          }) ?? null
          if (focusedDataset && resolveDatasetType(focusedDataset.datasetType, focusedDataset.analysis) !== "profitability") {
            focusedDataset = null
          }
        }

        _activeDatasets = profitabilityDatasets.filter((dataset) =>
          resolveDatasetType(dataset.datasetType, dataset.analysis) === "profitability"
        ).length
      } catch {
        // Continue without stats
      }
    }
  }

  const metricsContent = focusedDataset ? renderProfitabilityMetrics(focusedDataset.precomputedMetrics as Record<string, unknown> | null) : null

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
      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-6">
        <div className="max-w-6xl mx-auto space-y-5">
          {focusedDataset && (
            <Card className="border-cyan-400/25 bg-cyan-400/5 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">
                    Routed profitability dataset
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">
                    {focusedDataset.name || focusedDataset.fileName}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    This upload is saved in Profitability so revenue and expense analysis stays separate from the main Dashboard.
                  </p>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:min-w-80">
                  <ProfileContextRow label="Rows" value={focusedDataset.rowCount.toLocaleString()} />
                  <ProfileContextRow label="Columns" value={focusedDataset.columnCount.toLocaleString()} />
                  <ProfileContextRow label="Type" value="Profitability Analysis" />
                  <ProfileContextRow label="Status" value={metricsContent ? "Analyzed" : "Ready for review"} />
                </div>
              </div>
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
    { label: "Expenses", value: currencyValue(values.totalExpenses) },
    { label: "Gross Profit", value: currencyValue(values.grossProfit ?? values.profit) },
    { label: "Net Profit", value: currencyValue(values.netProfit ?? values.profit) },
    { label: "Gross Margin", value: percentValue(values.grossMargin ?? values.margin) },
    { label: "Net Margin", value: percentValue(values.netMargin ?? values.margin) },
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
      <span className="max-w-[12rem] text-right font-medium text-foreground">{value || "Not set"}</span>
    </div>
  )
}
