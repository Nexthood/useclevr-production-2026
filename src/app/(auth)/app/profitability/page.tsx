import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout"
import { ProfitabilityUpload } from "@/components/forms/profitability-upload"
import { Card } from "@/components/ui/card"
import { auth } from "@/lib/auth/auth"
import { resolveDatasetType } from "@/lib/data/dataset-category"
import { getDb } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { BarChart3, DollarSign, TrendingUp } from "lucide-react"
import Link from "next/link"

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

  const profitabilityPayload = focusedDataset ? getProfitabilityPayload(focusedDataset) : null
  const sourceInputs = focusedDataset ? getProfitabilitySourceInputs(focusedDataset) : []
  const sourceRowCount = sourceInputs.length > 0
    ? sourceInputs.reduce((total, input) => total + input.rowCount, 0)
    : focusedDataset?.rowCount ?? 0
  const initialUploadResult = focusedDataset && profitabilityPayload
    ? {
        success: true,
        datasetId: focusedDataset.id,
        datasetName: focusedDataset.name || "Revenue + Expense Analysis",
        datasetType: "profitability",
        rowsProcessed: sourceRowCount,
        columnsDetected: focusedDataset.columnCount,
        analysisStatus: "ready",
        redirectTo: `/app/profitability?datasetId=${focusedDataset.id}&analysisId=${getProfitabilityAnalysisId(focusedDataset) || focusedDataset.id}`,
      }
    : null

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
          {focusedDataset && profitabilityPayload && (
            <ProfitabilityUpload
              initialProfitabilityResult={profitabilityPayload}
              initialUploadResult={initialUploadResult}
            />
          )}

          {(!focusedDataset || !profitabilityPayload) && (
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
