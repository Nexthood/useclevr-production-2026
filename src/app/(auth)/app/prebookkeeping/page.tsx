import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout"
import { AccountancyUpload } from "@/components/accountancy/accountancy-upload"
import { Card } from "@/components/ui/card"
import { auth } from "@/lib/auth/auth"
import { resolveDatasetType } from "@/lib/data/dataset-category"
import { getDb } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { FileText, Upload } from "lucide-react"
import Link from "next/link"
import type React from "react"

type PrebookkeepingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function PrebookkeepingPage({ searchParams }: PrebookkeepingPageProps) {
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
        const prebookkeepingDatasets = await db.query.datasets.findMany({
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
          if (focusedDataset && resolveDatasetType(focusedDataset.datasetType, focusedDataset.analysis) !== "prebookkeeping") {
            focusedDataset = null
          }
        }

        _activeDatasets = prebookkeepingDatasets.filter((dataset) =>
          resolveDatasetType(dataset.datasetType, dataset.analysis) === "prebookkeeping"
        ).length
      } catch {
        // Continue without stats
      }
    }
  }

  return (
    <DashboardSubpageLayout
      title="Pre-bookkeeping"
      description="Upload invoices, receipts, and bank exports for automated categorization and bookkeeping summaries."
      breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Pre-bookkeeping" }]}
      icon={FileText}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/app/prebookkeeping">
            <span className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
              <Upload className="h-4 w-4" />
              Upload document
            </span>
          </Link>
        </div>
      }
    >
      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-6">
        <div className="max-w-6xl mx-auto space-y-5">
          <div id="prebookkeeping-upload">
            <AccountancyUpload datasetType="prebookkeeping" />
          </div>

          {focusedDataset && (
            <Card className="border-cyan-400/25 bg-cyan-400/5 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">
                    Routed pre-bookkeeping dataset
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">
                    {focusedDataset.name || focusedDataset.fileName}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    This upload is saved in Pre-bookkeeping so invoices, receipts, and bank exports stay separate from the main Dashboard.
                  </p>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:min-w-80">
                  <ProfileContextRow label="Rows" value={focusedDataset.rowCount.toLocaleString()} />
                  <ProfileContextRow label="Columns" value={focusedDataset.columnCount.toLocaleString()} />
                  <ProfileContextRow label="Type" value="Pre-bookkeeping" />
                  <ProfileContextRow label="Status" value="Ready for categorization" />
                </div>
              </div>
            </Card>
          )}

          {!focusedDataset && (
            <Card className="border-border bg-card p-6">
              <div className="flex flex-col items-center justify-center gap-4 py-12">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-foreground">No pre-bookkeeping dataset selected</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Upload invoices, receipts, bank exports, PDFs, Excel, or CSV files for pre-bookkeeping insights.
                  </p>
                </div>
                <Link
                  href="/app/prebookkeeping"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                >
                  <Upload className="h-4 w-4" />
                  Upload document
                </Link>
              </div>
            </Card>
          )}
        </div>
      </div>
    </DashboardSubpageLayout>
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
