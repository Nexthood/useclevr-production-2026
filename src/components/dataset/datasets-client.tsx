"use client"

import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout"
import { BatchDeleteButton } from "@/components/dataset/batch-delete-button"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { getDatasetCategoryDestinationLabel, getDatasetCategoryLabel, normalizeDatasetCategory } from "@/lib/data/dataset-category"
import { BarChart3, Database, FileSpreadsheet, Upload } from "lucide-react"
import Link from "next/link"
import * as React from "react"

export interface DatasetListItem {
  id: string
  name: string
  fileName: string
  rowCount: number
  columnCount: number
  status: string | null
  analysisStatus?: string | null
  datasetType: string | null
  uploadSource?: string | null
  destinationModule?: string | null
  createdAt: Date | null
  columns: string[]
  industry?: string | null
  monthRevenue?: number | null
}

interface DatasetsClientProps {
  initialDatasets: DatasetListItem[]
}

export function DatasetsClient({ initialDatasets }: DatasetsClientProps) {
  const [datasets] = React.useState<DatasetListItem[]>(initialDatasets)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())

  const getStatusBadge = (status: string | null) => {
    if (status === "ready") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
          Ready
        </span>
      )
    }
    if (status === "processing") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
          Processing
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
        {status || "Unknown"}
      </span>
    )
  }

  // Business-related stats
  const totalRevenue = datasets.reduce((sum, d) => sum + (d.monthRevenue || 0), 0)
  const averageRevenue = datasets.length > 0 ? totalRevenue / datasets.length : 0
  const readyCount = datasets.filter((d) => d.status === "ready").length

  function getDatasetTypeLink(dataset: DatasetListItem): string {
    const type = normalizeDatasetCategory(dataset.datasetType) || "standard"
    switch (type) {
      case "retail":
        return `/app/retail?datasetId=${dataset.id}`
      case "profitability":
        return `/app/profitability?datasetId=${dataset.id}`
      case "accountancy":
        return `/app/accountancy?datasetId=${dataset.id}`
      case "prebookkeeping":
        return `/app/prebookkeeping?datasetId=${dataset.id}`
      default:
        return `/app/datasets/${dataset.id}`
    }
  }

  function getDatasetTypeBadge(type: string | null) {
    const normalized = normalizeDatasetCategory(type) || "standard"
    const labels: Record<string, { label: string; className: string }> = {
      standard: { label: getDatasetCategoryLabel("standard"), className: "bg-slate-500/20 text-slate-400" },
      retail: { label: getDatasetCategoryLabel("retail"), className: "bg-cyan-500/20 text-cyan-400" },
      profitability: { label: getDatasetCategoryLabel("profitability"), className: "bg-emerald-500/20 text-emerald-400" },
      accountancy: { label: getDatasetCategoryLabel("accountancy"), className: "bg-purple-500/20 text-purple-400" },
      prebookkeeping: { label: getDatasetCategoryLabel("prebookkeeping"), className: "bg-amber-500/20 text-amber-400" },
    }
    const config = labels[normalized] || labels.standard
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    )
  }

  const datasetColumns: DataTableColumn<Record<string, unknown>>[] = [
    {
      key: "name",
      header: "Dataset",
      render: (row) => {
        const dataset = row as unknown as DatasetListItem
        return (
          <div>
            <Link href={getDatasetTypeLink(dataset)} className="font-medium text-foreground transition hover:text-primary">
              {String(dataset.name)}
            </Link>
            <div>
              <Link href={getDatasetTypeLink(dataset)} className="text-xs text-primary hover:underline">
                Open in module
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">{String(dataset.fileName)}</p>
          </div>
        )
      },
    },
    {
      key: "datasetType",
      header: "Type",
      render: (row) => getDatasetTypeBadge((row as unknown as DatasetListItem).datasetType),
    },
    {
      key: "uploadSource",
      header: "Upload source",
      render: (row) => {
        const source = (row as unknown as DatasetListItem).uploadSource || "standard"
        return <span className="text-sm text-muted-foreground">{source.replaceAll("_", " ")}</span>
      },
    },
    {
      key: "destinationModule",
      header: "Destination",
      render: (row) => {
        const dataset = row as unknown as DatasetListItem
        return (
          <Link href={getDatasetTypeLink(dataset)} className="text-sm font-medium text-primary hover:underline">
            {dataset.destinationModule || getDatasetCategoryDestinationLabel(dataset.datasetType)}
          </Link>
        )
      },
    },
    {
      key: "status",
      header: "Analysis status",
      render: (row) => {
        const dataset = row as unknown as DatasetListItem
        return getStatusBadge((dataset.analysisStatus || dataset.status) as string)
      },
    },
    {
      key: "shape",
      header: "Rows / columns",
      render: (row) => (
        <span className="text-muted-foreground">{Number((row as unknown as DatasetListItem).rowCount || 0).toLocaleString()} / {Number((row as unknown as DatasetListItem).columnCount || 0).toLocaleString()}</span>
      ),
    },
    {
      key: "viewTable",
      header: "Actions",
      align: "right",
      render: (row) => {
        const dataset = row as unknown as DatasetListItem
        const type = normalizeDatasetCategory(dataset.datasetType) || "standard"
        const analyzeHref = type === "standard"
          ? `/app/datasets/${dataset.id}/analyze`
          : getDatasetTypeLink(dataset)
        return (
          <div className="flex justify-end gap-3">
            <Link href={`/app/datasets/${dataset.id}`} className="text-xs font-medium text-primary hover:underline">
              View rows
            </Link>
            <Link href={analyzeHref} className="text-xs font-medium text-primary hover:underline">
              {type === "standard" ? "Analyze" : "Open module"}
            </Link>
          </div>
        )
      },
    },
  ]

  const handleBulkDelete = () => {
    setSelectedIds(new Set())
  }

  const rightSidebar = (
    <aside className="hidden w-72 shrink-0 border-l border-border bg-card lg:block">
      <div className="h-full space-y-3 overflow-y-auto p-4">
        <h2 className="text-sm font-semibold text-foreground">Dataset overview</h2>
        <Card className="border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-cyan-500/10">
              <Database className="h-4 w-4 text-cyan-800 dark:text-cyan-100" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{datasets.length}</p>
              <p className="text-xs text-muted-foreground">Total datasets</p>
            </div>
          </div>
        </Card>
        <Card className="border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">
                €{Math.round(averageRevenue).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Average monthly revenue</p>
            </div>
          </div>
        </Card>
        <Card className="border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500/10">
              <FileSpreadsheet className="h-4 w-4 text-emerald-800 dark:text-emerald-100" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{readyCount} / {datasets.length}</p>
              <p className="text-xs text-muted-foreground">Ready for analysis</p>
            </div>
          </div>
        </Card>
      </div>
    </aside>
  )

  return (
    <DashboardSubpageLayout
      title="Datasets"
      description="Manage uploaded files and analysis-ready data."
      breadcrumbs={[
        { label: "Dashboard", href: "/app" },
        { label: "Datasets" },
      ]}
      icon={Database}
      rightSidebar={rightSidebar}
    >
      <div className="min-w-0 flex-1 overflow-y-auto px-5 pb-5 pt-6">
        <div className="mx-auto w-full max-w-6xl min-w-0">
          <DataTable
            title="Dataset library"
            description="All uploaded data files with processing status and actions."
            emptyMessage="No datasets yet. Upload a CSV or Excel file to start analysis."
            rows={datasets as unknown as Record<string, unknown>[]}
            columns={datasetColumns}
            rowKey={(row) => String(row.id)}
            minWidth="min-w-[980px]"
            selectable
            selectedRows={selectedIds}
            onSelectedRowsChange={setSelectedIds}
            bulkActions={
              selectedIds.size > 0 && (
                <BatchDeleteButton
                  datasetIds={Array.from(selectedIds)}
                  onDeleted={handleBulkDelete}
                />
              )
            }
            actions={
              <Link href="/app/upload" className="shrink-0">
                <Button size="sm" className="whitespace-nowrap">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload dataset
                </Button>
              </Link>
            }
          />
        </div>
      </div>
    </DashboardSubpageLayout>
  )
}
